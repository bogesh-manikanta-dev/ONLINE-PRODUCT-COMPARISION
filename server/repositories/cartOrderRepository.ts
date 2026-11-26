import { and, desc, eq, inArray } from 'drizzle-orm';
import type {
  DeliveryMethod,
  OrderDTO,
  OrderItemDTO,
  OrderStatus,
  OrderStatusHistoryDTO,
  PaymentMode,
  ReturnRequestDTO,
  ReturnStatus,
  UserAddressDTO,
} from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  orderItems,
  orders,
  orderStatusHistory,
  products,
  returnRequests,
  userAddresses,
  users,
} from '../../src/db/schema.ts';

export function mapAddressDTO(a: typeof userAddresses.$inferSelect): UserAddressDTO {
  return {
    id: a.id,
    userId: a.userId,
    label: a.label,
    fullName: a.fullName,
    phone: a.phone,
    houseBuilding: a.houseBuilding,
    street: a.street,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function getUserAddresses(userId: number): Promise<UserAddressDTO[]> {
  const rows = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, userId))
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));
  return rows.map(mapAddressDTO);
}

export async function hydrateOrders(
  orderRows: Array<typeof orders.$inferSelect>,
  cancellableStatuses: OrderStatus[]
): Promise<OrderDTO[]> {
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((o) => o.id);
  const userIds = Array.from(new Set(orderRows.map((o) => o.userId)));

  const [itemRows, histRows, retRows, userRows] = await Promise.all([
    db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
    db.select().from(orderStatusHistory).where(inArray(orderStatusHistory.orderId, orderIds)),
    db.select().from(returnRequests).where(inArray(returnRequests.orderId, orderIds)),
    db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds)),
  ]);

  const userEmailMap = new Map(userRows.map((u) => [u.id, u.email]));

  return orderRows.map((o) => {
    const items: OrderItemDTO[] = itemRows
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        id: i.id,
        orderId: i.orderId,
        productId: i.productId,
        productNameSnapshot: i.productNameSnapshot,
        brandNameSnapshot: i.brandNameSnapshot,
        modelSnapshot: i.modelSnapshot,
        variantSnapshot: i.variantSnapshot,
        imageSnapshot: i.imageSnapshot,
        unitPriceSnapshot: i.unitPriceSnapshot,
        taxRateSnapshot: i.taxRateSnapshot,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
      }));

    const history: OrderStatusHistoryDTO[] = histRows
      .filter((h) => h.orderId === o.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((h) => ({
        id: h.id,
        orderId: h.orderId,
        status: h.status as OrderStatus,
        note: h.note,
        actorEmail: h.actorEmail,
        createdAt: h.createdAt.toISOString(),
      }));

    const itemNameMap = new Map(items.map((i) => [i.id, i.productNameSnapshot]));

    const returns: ReturnRequestDTO[] = retRows
      .filter((r) => r.orderId === o.id)
      .map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNumber: o.orderNumber,
        orderItemId: r.orderItemId,
        productNameSnapshot: itemNameMap.get(r.orderItemId),
        userId: r.userId,
        userEmail: userEmailMap.get(r.userId),
        reason: r.reason,
        status: r.status as ReturnStatus,
        adminNote: r.adminNote,
        demoRefundAmount: r.demoRefundAmount,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

    let shippingAddress = {
      label: 'Delivery Address',
      fullName: '',
      phone: '',
      houseBuilding: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    };
    try {
      shippingAddress = JSON.parse(o.shippingAddressJson);
    } catch {
      // ignore malformed fallback
    }

    const status = o.status as OrderStatus;
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      userId: o.userId,
      userEmail: userEmailMap.get(o.userId),
      status,
      paymentMode: o.paymentMode as PaymentMode,
      paymentStatus: o.paymentStatus,
      shippingAddress,
      deliveryMethod: o.deliveryMethod as DeliveryMethod,
      subtotal: o.subtotal,
      deliveryCharge: o.deliveryCharge,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
      currency: o.currency,
      cancellationReason: o.cancellationReason,
      cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
      estimatedDeliveryDate: o.estimatedDeliveryDate.toISOString(),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      isCancellable: cancellableStatuses.includes(status),
      isReturnEligible: status === 'Delivered',
      items,
      history,
      returns,
    };
  });
}

export async function syncProductAvailabilityFromStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  productId: number,
  newStock: number
): Promise<void> {
  const [prod] = await tx
    .select({ availabilityStatus: products.availabilityStatus })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!prod || prod.availabilityStatus === 'DISCONTINUED') return;

  const nextAvailability =
    newStock <= 0 ? 'OUT_OF_STOCK' : newStock <= 6 ? 'LIMITED' : 'IN_STOCK';

  await tx
    .update(products)
    .set({ availabilityStatus: nextAvailability, updatedAt: new Date() })
    .where(and(eq(products.id, productId)));
}
