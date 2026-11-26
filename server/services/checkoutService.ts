import crypto from 'node:crypto';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { DeliveryMethod, OrderDTO, PaymentMode } from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  brands,
  cartItems,
  carts,
  inventoryLogs,
  orderItems,
  orders,
  orderStatusHistory,
  productImages,
  products,
  userAddresses,
} from '../../src/db/schema.ts';
import { hydrateOrders, syncProductAvailabilityFromStock } from '../repositories/cartOrderRepository.ts';
import { orderEventBus } from './orderNotificationObserver.ts';
import { simulateDemoPayment } from './paymentDemoService.ts';
import { getCommerceConfig } from './recommendationService.ts';

export class CheckoutError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface PlaceOrderInput {
  userId: number;
  userEmail: string;
  addressId?: number;
  shippingAddress?: {
    label: string;
    fullName: string;
    phone: string;
    houseBuilding: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  saveAddress?: boolean;
  deliveryMethod: DeliveryMethod;
  paymentMode: PaymentMode;
  idempotencyKey: string;
}

export async function placeTransactionalOrder(input: PlaceOrderInput): Promise<{
  order: OrderDTO;
  idempotentReplay: boolean;
}> {
  const config = await getCommerceConfig();

  // 1. Check Idempotency Key before mutating anything
  const [existingByKey] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existingByKey) {
    if (existingByKey.userId !== input.userId) {
      throw new CheckoutError('Idempotency key conflict.', 409);
    }
    const [hydrated] = await hydrateOrders([existingByKey], config.cancellableStatuses);
    return { order: hydrated, idempotentReplay: true };
  }

  // 2. Resolve Shipping Address strictly owned by user or validated inline
  let resolvedAddress = input.shippingAddress;
  if (input.addressId) {
    const [addrRow] = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, input.addressId), eq(userAddresses.userId, input.userId)))
      .limit(1);
    if (!addrRow) {
      throw new CheckoutError('Selected shipping address was not found.', 404);
    }
    resolvedAddress = {
      label: addrRow.label,
      fullName: addrRow.fullName,
      phone: addrRow.phone,
      houseBuilding: addrRow.houseBuilding,
      street: addrRow.street,
      city: addrRow.city,
      state: addrRow.state,
      postalCode: addrRow.postalCode,
      country: addrRow.country,
    };
  }

  if (!resolvedAddress) {
    throw new CheckoutError('A valid shipping address is required to place an order.', 400);
  }

  // Optional: save new inline address to user's address book
  if (!input.addressId && input.saveAddress) {
    const existingAddrs = await db
      .select({ id: userAddresses.id })
      .from(userAddresses)
      .where(eq(userAddresses.userId, input.userId));
    await db.insert(userAddresses).values({
      userId: input.userId,
      ...resolvedAddress,
      isDefault: existingAddrs.length === 0,
    });
  }

  const demoPayment = simulateDemoPayment(input.paymentMode);

  // 3. Execute atomic DB transaction
  const createdOrderRow = await db.transaction(async (tx) => {
    const [userCart] = await tx
      .select()
      .from(carts)
      .where(eq(carts.userId, input.userId))
      .limit(1);

    if (!userCart) {
      throw new CheckoutError('Your shopping cart is empty.', 400);
    }

    const cItems = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, userCart.id));

    if (cItems.length === 0) {
      throw new CheckoutError('Your shopping cart is empty.', 400);
    }

    const prodIds = cItems.map((i) => i.productId);
    const [prodRows, allBrands, imgRows] = await Promise.all([
      tx.select().from(products).where(inArray(products.id, prodIds)),
      tx.select().from(brands),
      tx.select().from(productImages).where(inArray(productImages.productId, prodIds)),
    ]);

    const prodMap = new Map(prodRows.map((p) => [p.id, p]));
    const brandMap = new Map(allBrands.map((b) => [b.id, b]));

    let subtotal = 0;
    let taxAmount = 0;
    const orderNumber = `CX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const itemSnapshots: Array<{
      productId: number;
      productNameSnapshot: string;
      brandNameSnapshot: string;
      modelSnapshot: string;
      variantSnapshot: string;
      imageSnapshot: string;
      unitPriceSnapshot: number;
      taxRateSnapshot: number;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const cItem of cItems) {
      const prod = prodMap.get(cItem.productId);
      if (!prod || prod.status !== 'ACTIVE' || prod.availabilityStatus === 'DISCONTINUED') {
        throw new CheckoutError(
          `A product in your cart (${prod?.name ?? 'Unknown'}) is no longer active.`,
          400
        );
      }

      // Atomic stock decrement preventing oversell under concurrent checkouts
      const [decremented] = await tx
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} - ${cItem.quantity}`,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, prod.id), gte(products.stockQuantity, cItem.quantity)))
        .returning();

      if (!decremented) {
        throw new CheckoutError(
          `Insufficient demonstration stock for ${prod.name}. Available: ${prod.stockQuantity}.`,
          400
        );
      }

      await syncProductAvailabilityFromStock(tx, prod.id, decremented.stockQuantity);

      await tx.insert(inventoryLogs).values({
        productId: prod.id,
        changeAmount: -cItem.quantity,
        previousStock: decremented.stockQuantity + cItem.quantity,
        newStock: decremented.stockQuantity,
        reason: `Order Placed (${orderNumber})`,
        actorEmail: input.userEmail,
      });

      const lineSubtotal = Number((prod.basePrice * cItem.quantity).toFixed(2));
      const lineTax = Number(((lineSubtotal * prod.taxRatePercent) / 100).toFixed(2));
      subtotal += lineSubtotal;
      taxAmount += lineTax;

      const pImgs = imgRows.filter((i) => i.productId === prod.id);
      const primary = pImgs.find((i) => i.isPrimary) || pImgs[0];

      itemSnapshots.push({
        productId: prod.id,
        productNameSnapshot: prod.name,
        brandNameSnapshot: brandMap.get(prod.brandId)?.name ?? 'Brand',
        modelSnapshot: prod.modelNumber,
        variantSnapshot: prod.variantLabel,
        imageSnapshot: primary?.url ?? '',
        unitPriceSnapshot: prod.basePrice,
        taxRateSnapshot: prod.taxRatePercent,
        quantity: cItem.quantity,
        lineTotal: Number((lineSubtotal + lineTax).toFixed(2)),
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    taxAmount = Number(taxAmount.toFixed(2));
    const deliveryCharge =
      input.deliveryMethod === 'EXPRESS'
        ? config.expressDeliveryFee
        : subtotal >= config.freeDeliveryThreshold
          ? 0
          : config.standardDeliveryFee;

    const totalAmount = Number((subtotal + taxAmount + deliveryCharge).toFixed(2));

    const estDate = new Date();
    estDate.setDate(estDate.getDate() + (input.deliveryMethod === 'EXPRESS' ? 2 : 5));

    const [createdOrder] = await tx
      .insert(orders)
      .values({
        orderNumber,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        status: 'Order Placed',
        paymentMode: input.paymentMode,
        paymentStatus: demoPayment.paymentStatus,
        shippingAddressJson: JSON.stringify(resolvedAddress),
        deliveryMethod: input.deliveryMethod,
        subtotal,
        deliveryCharge,
        taxAmount,
        totalAmount,
        currency: 'INR',
        estimatedDeliveryDate: estDate,
      })
      .returning();

    for (const snap of itemSnapshots) {
      await tx.insert(orderItems).values({
        orderId: createdOrder.id,
        ...snap,
      });
    }

    await tx.insert(orderStatusHistory).values({
      orderId: createdOrder.id,
      status: 'Order Placed',
      note: `${demoPayment.disclaimer} Reference: ${demoPayment.simulationReference}`,
      actorEmail: input.userEmail,
    });

    // Clear user's cart
    await tx.delete(cartItems).where(eq(cartItems.cartId, userCart.id));
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, userCart.id));

    return createdOrder;
  });

  await orderEventBus.emit({
    type: 'OrderPlaced',
    orderId: createdOrderRow.id,
    orderNumber: createdOrderRow.orderNumber,
    userId: input.userId,
    userEmail: input.userEmail,
    totalAmount: createdOrderRow.totalAmount,
  });

  const [hydrated] = await hydrateOrders([createdOrderRow], config.cancellableStatuses);
  return { order: hydrated, idempotentReplay: false };
}
