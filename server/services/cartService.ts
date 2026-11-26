import { and, asc, eq, inArray } from 'drizzle-orm';
import type { CartDTO, CartItemDTO } from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  brands,
  cartItems,
  carts,
  productImages,
  products,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../../src/db/seed.ts';
import { getCommerceConfig } from './recommendationService.ts';

export class CartError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function resolveOrCreateCartId(opts: {
  userId?: number;
  guestToken?: string;
}): Promise<number> {
  await ensureSeeded();
  if (opts.userId) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(eq(carts.userId, opts.userId))
      .limit(1);
    if (existing) return existing.id;

    const [created] = await db
      .insert(carts)
      .values({ userId: opts.userId })
      .onConflictDoUpdate({
        target: carts.userId,
        set: { updatedAt: new Date() },
      })
      .returning();
    return created.id;
  }

  const token = (opts.guestToken || '').trim();
  if (!token || token.length < 8) {
    throw new CartError('A valid guest cart session token is required.', 400);
  }

  const [existing] = await db
    .select()
    .from(carts)
    .where(eq(carts.guestToken, token))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(carts)
    .values({ guestToken: token })
    .onConflictDoUpdate({
      target: carts.guestToken,
      set: { updatedAt: new Date() },
    })
    .returning();
  return created.id;
}

export async function getCartDTO(cartId: number): Promise<CartDTO> {
  const config = await getCommerceConfig();
  const rows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.addedAt));

  if (rows.length === 0) {
    return {
      id: cartId,
      items: [],
      itemCount: 0,
      subtotal: 0,
      taxAmount: 0,
      standardDeliveryCharge: 0,
      expressDeliveryCharge: 0,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      estimatedTotalStandard: 0,
      estimatedTotalExpress: 0,
      currency: 'INR',
      notices: [],
    };
  }

  const prodIds = rows.map((r) => r.productId);
  const [prodRows, allBrands, imgRows] = await Promise.all([
    db.select().from(products).where(inArray(products.id, prodIds)),
    db.select().from(brands),
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, prodIds))
      .orderBy(asc(productImages.sortOrder)),
  ]);

  const prodMap = new Map(prodRows.map((p) => [p.id, p]));
  const brandMap = new Map(allBrands.map((b) => [b.id, b]));
  const notices: string[] = [];
  const items: CartItemDTO[] = [];

  for (const row of rows) {
    const prod = prodMap.get(row.productId);
    if (!prod || prod.status !== 'ACTIVE' || prod.availabilityStatus === 'DISCONTINUED') {
      await db.delete(cartItems).where(eq(cartItems.id, row.id));
      notices.push('An unavailable item was removed from your cart.');
      continue;
    }

    let effectiveQty = row.quantity;
    if (prod.stockQuantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, row.id));
      notices.push(`${prod.name} went out of stock and was removed from your cart.`);
      continue;
    }

    if (effectiveQty > prod.stockQuantity) {
      effectiveQty = prod.stockQuantity;
      await db
        .update(cartItems)
        .set({ quantity: effectiveQty })
        .where(eq(cartItems.id, row.id));
      notices.push(
        `Quantity for ${prod.name} was adjusted to ${effectiveQty} based on current demonstration stock.`
      );
    }

    const pImgs = imgRows.filter((i) => i.productId === prod.id);
    const primary = pImgs.find((i) => i.isPrimary) || pImgs[0];
    const lineSubtotal = Number((prod.basePrice * effectiveQty).toFixed(2));
    const lineTax = Number(((lineSubtotal * prod.taxRatePercent) / 100).toFixed(2));

    items.push({
      id: row.id,
      productId: prod.id,
      productName: prod.name,
      productSlug: prod.slug,
      brandName: brandMap.get(prod.brandId)?.name ?? 'Brand',
      modelNumber: prod.modelNumber,
      variantLabel: prod.variantLabel,
      primaryImage: primary?.url ?? '',
      unitPrice: prod.basePrice,
      currency: prod.currency,
      taxRatePercent: prod.taxRatePercent,
      quantity: effectiveQty,
      stockQuantity: prod.stockQuantity,
      availabilityStatus: prod.availabilityStatus,
      lineSubtotal,
      lineTax,
    });
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = Number(items.reduce((sum, i) => sum + i.lineSubtotal, 0).toFixed(2));
  const taxAmount = Number(items.reduce((sum, i) => sum + i.lineTax, 0).toFixed(2));

  const standardDeliveryCharge =
    items.length === 0
      ? 0
      : subtotal >= config.freeDeliveryThreshold
        ? 0
        : config.standardDeliveryFee;

  const expressDeliveryCharge = items.length === 0 ? 0 : config.expressDeliveryFee;

  return {
    id: cartId,
    items,
    itemCount,
    subtotal,
    taxAmount,
    standardDeliveryCharge,
    expressDeliveryCharge,
    freeDeliveryThreshold: config.freeDeliveryThreshold,
    estimatedTotalStandard: Number((subtotal + taxAmount + standardDeliveryCharge).toFixed(2)),
    estimatedTotalExpress: Number((subtotal + taxAmount + expressDeliveryCharge).toFixed(2)),
    currency: 'INR',
    notices,
  };
}

export async function addItemToCart(
  cartId: number,
  productId: number,
  quantity: number
): Promise<CartDTO> {
  await ensureSeeded();
  const [prod] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!prod || prod.status !== 'ACTIVE') {
    throw new CartError('Product not found or currently unavailable.', 404);
  }
  if (prod.availabilityStatus === 'DISCONTINUED' || prod.stockQuantity <= 0) {
    throw new CartError(`${prod.name} is currently out of stock.`, 400);
  }

  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .limit(1);

  const nextQty = (existing?.quantity ?? 0) + quantity;
  if (nextQty > prod.stockQuantity) {
    throw new CartError(
      `Only ${prod.stockQuantity} unit(s) of ${prod.name} are available in demonstration inventory.`,
      400
    );
  }
  if (nextQty > 20) {
    throw new CartError('Maximum 20 units per product can be placed in a single order.', 400);
  }

  if (existing) {
    await db
      .update(cartItems)
      .set({ quantity: nextQty })
      .where(eq(cartItems.id, existing.id));
  } else {
    await db.insert(cartItems).values({
      cartId,
      productId,
      quantity: nextQty,
    });
  }

  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return getCartDTO(cartId);
}

export async function updateCartItemQty(
  cartId: number,
  itemId: number,
  quantity: number
): Promise<CartDTO> {
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
    .limit(1);

  if (!existing) {
    throw new CartError('Cart item not found.', 404);
  }

  if (quantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
    await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
    return getCartDTO(cartId);
  }

  const [prod] = await db
    .select()
    .from(products)
    .where(eq(products.id, existing.productId))
    .limit(1);

  if (!prod || prod.stockQuantity <= 0) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
    throw new CartError('Product is out of stock and was removed from your cart.', 400);
  }

  if (quantity > prod.stockQuantity) {
    throw new CartError(
      `Requested quantity (${quantity}) exceeds available demonstration stock (${prod.stockQuantity}).`,
      400
    );
  }

  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return getCartDTO(cartId);
}

export async function removeCartItem(cartId: number, itemId: number): Promise<CartDTO> {
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)));
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  return getCartDTO(cartId);
}

export async function mergeGuestCartIntoUserCart(
  userId: number,
  guestToken: string
): Promise<CartDTO> {
  const userCartId = await resolveOrCreateCartId({ userId });
  const [guestCart] = await db
    .select()
    .from(carts)
    .where(eq(carts.guestToken, guestToken.trim()))
    .limit(1);

  if (!guestCart) {
    return getCartDTO(userCartId);
  }

  const guestItems = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, guestCart.id));

  for (const gItem of guestItems) {
    const [prod] = await db
      .select()
      .from(products)
      .where(eq(products.id, gItem.productId))
      .limit(1);
    if (!prod || prod.status !== 'ACTIVE' || prod.stockQuantity <= 0) continue;

    const [uItem] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, userCartId), eq(cartItems.productId, gItem.productId)))
      .limit(1);

    const combined = Math.min(20, prod.stockQuantity, (uItem?.quantity ?? 0) + gItem.quantity);
    if (combined <= 0) continue;

    if (uItem) {
      await db.update(cartItems).set({ quantity: combined }).where(eq(cartItems.id, uItem.id));
    } else {
      await db.insert(cartItems).values({
        cartId: userCartId,
        productId: gItem.productId,
        quantity: combined,
      });
    }
  }

  await db.delete(carts).where(eq(carts.id, guestCart.id));
  return getCartDTO(userCartId);
}
