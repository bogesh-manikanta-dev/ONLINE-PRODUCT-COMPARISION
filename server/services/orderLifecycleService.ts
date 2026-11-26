import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type {
  CartDTO,
  OrderDTO,
  OrderStatus,
  ReturnRequestDTO,
  ReturnStatus,
} from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  auditLogs,
  inventoryLogs,
  orderItems,
  orders,
  orderStatusHistory,
  products,
  returnRequests,
  users,
} from '../../src/db/schema.ts';
import { hydrateOrders, syncProductAvailabilityFromStock } from '../repositories/cartOrderRepository.ts';
import { addItemToCart, resolveOrCreateCartId } from './cartService.ts';
import { orderEventBus } from './orderNotificationObserver.ts';
import { getCommerceConfig } from './recommendationService.ts';

export class OrderLifecycleError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function listOrdersForUser(userId: number): Promise<OrderDTO[]> {
  const config = await getCommerceConfig();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  return hydrateOrders(rows, config.cancellableStatuses);
}

export async function getOrderDetailAuthorized(
  orderId: number,
  userId: number,
  isAdmin: boolean
): Promise<OrderDTO> {
  const config = await getCommerceConfig();
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!row) {
    throw new OrderLifecycleError('Order not found.', 404);
  }
  if (row.userId !== userId && !isAdmin) {
    throw new OrderLifecycleError('You do not have permission to view this order.', 403);
  }
  const [hydrated] = await hydrateOrders([row], config.cancellableStatuses);
  return hydrated;
}

export async function cancelOrderAuthorized(opts: {
  orderId: number;
  userId: number;
  userEmail: string;
  isAdmin: boolean;
  reason: string;
}): Promise<OrderDTO> {
  const config = await getCommerceConfig();
  const [orderRow] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, opts.orderId))
    .limit(1);

  if (!orderRow) {
    throw new OrderLifecycleError('Order not found.', 404);
  }
  if (orderRow.userId !== opts.userId && !opts.isAdmin) {
    throw new OrderLifecycleError('You do not have permission to cancel this order.', 403);
  }

  const currentStatus = orderRow.status as OrderStatus;
  if (currentStatus === 'Cancelled') {
    throw new OrderLifecycleError('This order has already been cancelled.', 400);
  }

  if (!config.cancellableStatuses.includes(currentStatus)) {
    throw new OrderLifecycleError(
      `Orders in status "${currentStatus}" cannot be cancelled. Eligible pre-shipment stages: ${config.cancellableStatuses.join(', ')}.`,
      400
    );
  }

  const updatedRow = await db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'Cancelled',
        cancellationReason: opts.reason,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderRow.id))
      .returning();

    await tx.insert(orderStatusHistory).values({
      orderId: orderRow.id,
      status: 'Cancelled',
      note: `Cancelled by ${opts.isAdmin && orderRow.userId !== opts.userId ? 'Admin' : 'Customer'}: ${opts.reason}`,
      actorEmail: opts.userEmail,
    });

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderRow.id));

    for (const item of items) {
      if (!item.productId) continue;
      const [restored] = await tx
        .update(products)
        .set({
          stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
          updatedAt: now,
        })
        .where(eq(products.id, item.productId))
        .returning();

      if (restored) {
        await syncProductAvailabilityFromStock(tx, item.productId, restored.stockQuantity);
        await tx.insert(inventoryLogs).values({
          productId: item.productId,
          changeAmount: item.quantity,
          previousStock: restored.stockQuantity - item.quantity,
          newStock: restored.stockQuantity,
          reason: `Order Cancelled (${orderRow.orderNumber})`,
          actorEmail: opts.userEmail,
        });
      }
    }

    return updated;
  });

  await orderEventBus.emit({
    type: 'OrderCancelled',
    orderId: updatedRow.id,
    orderNumber: updatedRow.orderNumber,
    userId: updatedRow.userId,
    userEmail: opts.userEmail,
    reason: opts.reason,
  });

  const [hydrated] = await hydrateOrders([updatedRow], config.cancellableStatuses);
  return hydrated;
}

export async function createReturnRequestForOrder(opts: {
  orderId: number;
  orderItemId: number;
  userId: number;
  userEmail: string;
  reason: string;
}): Promise<ReturnRequestDTO> {
  const [orderRow] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, opts.orderId))
    .limit(1);

  if (!orderRow) {
    throw new OrderLifecycleError('Order not found.', 404);
  }
  if (orderRow.userId !== opts.userId) {
    throw new OrderLifecycleError('You do not have permission to request a return for this order.', 403);
  }
  if (orderRow.status !== 'Delivered') {
    throw new OrderLifecycleError(
      'Return requests are only eligible after an order reaches Delivered status.',
      400
    );
  }

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, opts.orderItemId), eq(orderItems.orderId, orderRow.id)))
    .limit(1);

  if (!item) {
    throw new OrderLifecycleError('Order item not found on this order.', 404);
  }

  const existingReturns = await db
    .select()
    .from(returnRequests)
    .where(eq(returnRequests.orderItemId, item.id));

  if (existingReturns.some((r) => r.status !== 'Rejected')) {
    throw new OrderLifecycleError('A return request is already active for this item.', 400);
  }

  const [created] = await db
    .insert(returnRequests)
    .values({
      orderId: orderRow.id,
      orderItemId: item.id,
      userId: opts.userId,
      reason: opts.reason,
      status: 'Requested',
      demoRefundAmount: item.lineTotal,
    })
    .returning();

  await orderEventBus.emit({
    type: 'ReturnRequested',
    orderId: orderRow.id,
    orderNumber: orderRow.orderNumber,
    returnId: created.id,
    userId: opts.userId,
    userEmail: opts.userEmail,
    reason: opts.reason,
  });

  return {
    id: created.id,
    orderId: created.orderId,
    orderNumber: orderRow.orderNumber,
    orderItemId: created.orderItemId,
    productNameSnapshot: item.productNameSnapshot,
    userId: created.userId,
    userEmail: opts.userEmail,
    reason: created.reason,
    status: created.status as ReturnStatus,
    adminNote: created.adminNote,
    demoRefundAmount: created.demoRefundAmount,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function listReturnRequestsForUser(userId: number): Promise<ReturnRequestDTO[]> {
  const rows = await db
    .select()
    .from(returnRequests)
    .where(eq(returnRequests.userId, userId))
    .orderBy(desc(returnRequests.createdAt));

  if (rows.length === 0) return [];
  const orderIds = Array.from(new Set(rows.map((r) => r.orderId)));
  const itemIds = Array.from(new Set(rows.map((r) => r.orderItemId)));

  const [ordRows, itemRows] = await Promise.all([
    db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, orderIds)),
    db.select({ id: orderItems.id, name: orderItems.productNameSnapshot }).from(orderItems).where(inArray(orderItems.id, itemIds)),
  ]);

  const ordMap = new Map(ordRows.map((o) => [o.id, o.orderNumber]));
  const itemMap = new Map(itemRows.map((i) => [i.id, i.name]));

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: ordMap.get(r.orderId),
    orderItemId: r.orderItemId,
    productNameSnapshot: itemMap.get(r.orderItemId),
    userId: r.userId,
    reason: r.reason,
    status: r.status as ReturnStatus,
    adminNote: r.adminNote,
    demoRefundAmount: r.demoRefundAmount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function reorderToCart(
  orderId: number,
  userId: number
): Promise<{ cart: CartDTO; notices: string[] }> {
  const [orderRow] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!orderRow) throw new OrderLifecycleError('Order not found.', 404);
  if (orderRow.userId !== userId) {
    throw new OrderLifecycleError('You do not have permission to reorder this order.', 403);
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id));
  const cartId = await resolveOrCreateCartId({ userId });
  const notices: string[] = [];

  for (const item of items) {
    if (!item.productId) {
      notices.push(`${item.productNameSnapshot} is no longer in the catalog.`);
      continue;
    }
    try {
      await addItemToCart(cartId, item.productId, item.quantity);
    } catch (err: any) {
      notices.push(err?.message || `Could not re-add ${item.productNameSnapshot}.`);
    }
  }

  const { getCartDTO } = await import('./cartService.ts');
  const cart = await getCartDTO(cartId);
  return { cart, notices };
}

// --- Admin Order, Return & Inventory Lifecycle ---

export async function listAllOrdersForAdmin(): Promise<OrderDTO[]> {
  const config = await getCommerceConfig();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  return hydrateOrders(rows, config.cancellableStatuses);
}

export async function updateOrderStatusByAdmin(opts: {
  orderId: number;
  nextStatus: OrderStatus;
  note: string;
  actorEmail: string;
}): Promise<OrderDTO> {
  const config = await getCommerceConfig();
  const [orderRow] = await db.select().from(orders).where(eq(orders.id, opts.orderId)).limit(1);
  if (!orderRow) throw new OrderLifecycleError('Order not found.', 404);

  const prevStatus = orderRow.status as OrderStatus;
  if (prevStatus === 'Cancelled' && opts.nextStatus !== 'Cancelled') {
    throw new OrderLifecycleError('Cancelled orders cannot be re-opened.', 400);
  }

  if (opts.nextStatus === 'Cancelled' && prevStatus !== 'Cancelled') {
    return cancelOrderAuthorized({
      orderId: opts.orderId,
      userId: orderRow.userId,
      userEmail: opts.actorEmail,
      isAdmin: true,
      reason: opts.note || 'Cancelled by administrator',
    });
  }

  const [updated] = await db
    .update(orders)
    .set({ status: opts.nextStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderRow.id))
    .returning();

  await db.insert(orderStatusHistory).values({
    orderId: orderRow.id,
    status: opts.nextStatus,
    note: opts.note || `Status updated to ${opts.nextStatus}`,
    actorEmail: opts.actorEmail,
  });

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, orderRow.userId))
    .limit(1);

  await orderEventBus.emit({
    type: 'OrderStatusChanged',
    orderId: orderRow.id,
    orderNumber: orderRow.orderNumber,
    userId: orderRow.userId,
    userEmail: owner?.email ?? 'customer@comparex.local',
    previousStatus: prevStatus,
    nextStatus: opts.nextStatus,
    actorEmail: opts.actorEmail,
  });

  const [hydrated] = await hydrateOrders([updated], config.cancellableStatuses);
  return hydrated;
}

export async function listAllReturnsForAdmin(): Promise<ReturnRequestDTO[]> {
  const rows = await db.select().from(returnRequests).orderBy(desc(returnRequests.createdAt));
  if (rows.length === 0) return [];

  const orderIds = Array.from(new Set(rows.map((r) => r.orderId)));
  const itemIds = Array.from(new Set(rows.map((r) => r.orderItemId)));
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));

  const [ordRows, itemRows, userRows] = await Promise.all([
    db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(inArray(orders.id, orderIds)),
    db.select({ id: orderItems.id, name: orderItems.productNameSnapshot }).from(orderItems).where(inArray(orderItems.id, itemIds)),
    db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds)),
  ]);

  const ordMap = new Map(ordRows.map((o) => [o.id, o.orderNumber]));
  const itemMap = new Map(itemRows.map((i) => [i.id, i.name]));
  const userMap = new Map(userRows.map((u) => [u.id, u.email]));

  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: ordMap.get(r.orderId),
    orderItemId: r.orderItemId,
    productNameSnapshot: itemMap.get(r.orderItemId),
    userId: r.userId,
    userEmail: userMap.get(r.userId),
    reason: r.reason,
    status: r.status as ReturnStatus,
    adminNote: r.adminNote,
    demoRefundAmount: r.demoRefundAmount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function decideReturnByAdmin(opts: {
  returnId: number;
  nextStatus: ReturnStatus;
  adminNote: string;
  actorEmail: string;
}): Promise<ReturnRequestDTO> {
  const [retRow] = await db
    .select()
    .from(returnRequests)
    .where(eq(returnRequests.id, opts.returnId))
    .limit(1);

  if (!retRow) throw new OrderLifecycleError('Return request not found.', 404);

  const prevStatus = retRow.status as ReturnStatus;
  const shouldRestock =
    (opts.nextStatus === 'Approved' || opts.nextStatus === 'Demo Refund Completed') &&
    prevStatus !== 'Approved' &&
    prevStatus !== 'Demo Refund Completed';

  const updated = await db.transaction(async (tx) => {
    const [upd] = await tx
      .update(returnRequests)
      .set({
        status: opts.nextStatus,
        adminNote: opts.adminNote,
        updatedAt: new Date(),
      })
      .where(eq(returnRequests.id, retRow.id))
      .returning();

    if (shouldRestock) {
      const [item] = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, retRow.orderItemId))
        .limit(1);

      if (item?.productId) {
        const [restored] = await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId))
          .returning();

        if (restored) {
          await syncProductAvailabilityFromStock(tx, item.productId, restored.stockQuantity);
          await tx.insert(inventoryLogs).values({
            productId: item.productId,
            changeAmount: item.quantity,
            previousStock: restored.stockQuantity - item.quantity,
            newStock: restored.stockQuantity,
            reason: `Return Approved (#${retRow.id})`,
            actorEmail: opts.actorEmail,
          });
        }
      }
    }

    await tx.insert(auditLogs).values({
      actorEmail: opts.actorEmail,
      action: 'ADMIN_RETURN_DECISION',
      entityType: 'RETURN_REQUEST',
      entityId: String(retRow.id),
      detailsJson: JSON.stringify({ prevStatus, nextStatus: opts.nextStatus, adminNote: opts.adminNote }),
    });

    return upd;
  });

  return {
    id: updated.id,
    orderId: updated.orderId,
    orderItemId: updated.orderItemId,
    userId: updated.userId,
    reason: updated.reason,
    status: updated.status as ReturnStatus,
    adminNote: updated.adminNote,
    demoRefundAmount: updated.demoRefundAmount,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function adjustInventoryByAdmin(opts: {
  productId: number;
  stockQuantity: number;
  reason: string;
  actorEmail: string;
}): Promise<{ productId: number; previousStock: number; newStock: number }> {
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id, opts.productId))
    .limit(1);

  if (!existing) {
    throw new OrderLifecycleError('Product not found.', 404);
  }

  const previousStock = existing.stockQuantity;
  const newStock = opts.stockQuantity;

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({ stockQuantity: newStock, updatedAt: new Date() })
      .where(eq(products.id, opts.productId));

    await syncProductAvailabilityFromStock(tx, opts.productId, newStock);

    await tx.insert(inventoryLogs).values({
      productId: opts.productId,
      changeAmount: newStock - previousStock,
      previousStock,
      newStock,
      reason: opts.reason,
      actorEmail: opts.actorEmail,
    });

    await tx.insert(auditLogs).values({
      actorEmail: opts.actorEmail,
      action: 'ADMIN_INVENTORY_ADJUST',
      entityType: 'PRODUCT',
      entityId: String(opts.productId),
      detailsJson: JSON.stringify({ previousStock, newStock, reason: opts.reason }),
    });
  });

  return { productId: opts.productId, previousStock, newStock };
}
