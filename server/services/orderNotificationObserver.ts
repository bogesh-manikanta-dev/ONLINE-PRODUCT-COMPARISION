import { eq } from 'drizzle-orm';
import type { OrderStatus } from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import { auditLogs, userPreferences } from '../../src/db/schema.ts';

export type OrderDomainEvent =
  | {
      type: 'OrderPlaced';
      orderId: number;
      orderNumber: string;
      userId: number;
      userEmail: string;
      totalAmount: number;
    }
  | {
      type: 'OrderStatusChanged';
      orderId: number;
      orderNumber: string;
      userId: number;
      userEmail: string;
      previousStatus: OrderStatus;
      nextStatus: OrderStatus;
      actorEmail: string;
    }
  | {
      type: 'OrderCancelled';
      orderId: number;
      orderNumber: string;
      userId: number;
      userEmail: string;
      reason: string;
    }
  | {
      type: 'ReturnRequested';
      orderId: number;
      orderNumber: string;
      returnId: number;
      userId: number;
      userEmail: string;
      reason: string;
    };

export type OrderEventListener = (event: OrderDomainEvent) => Promise<void> | void;

/**
 * Observer Pattern: OrderEventBus
 * Decouples transactional order mutations from downstream audit logging and
 * user notification preference dispatch.
 */
class OrderEventBus {
  private listeners: OrderEventListener[] = [];

  subscribe(listener: OrderEventListener): void {
    this.listeners.push(listener);
  }

  async emit(event: OrderDomainEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (err) {
        console.error(`OrderEventBus listener error for ${event.type}:`, err);
      }
    }
  }
}

export const orderEventBus = new OrderEventBus();

// Built-in Observer 1: Audit Log Recorder
orderEventBus.subscribe(async (event) => {
  await db.insert(auditLogs).values({
    actorUserId: event.userId,
    actorEmail: 'actorEmail' in event ? event.actorEmail : event.userEmail,
    action: `ORDER_EVENT_${event.type.toUpperCase()}`,
    entityType: 'ORDER',
    entityId: String(event.orderId),
    detailsJson: JSON.stringify(event),
  });
});

// Built-in Observer 2: Preference-Aware Simulated Notification Recorder
orderEventBus.subscribe(async (event) => {
  const [pref] = await db
    .select({ emailNotifications: userPreferences.emailNotifications })
    .from(userPreferences)
    .where(eq(userPreferences.userId, event.userId))
    .limit(1);

  if (pref && !pref.emailNotifications) {
    return;
  }

  // Simulated order notification log entry (academic demo environment does not invoke live SMTP)
  await db.insert(auditLogs).values({
    actorUserId: event.userId,
    actorEmail: 'notify-engine@comparex.local',
    action: 'SIMULATED_ORDER_NOTIFICATION',
    entityType: 'ORDER',
    entityId: event.orderNumber,
    detailsJson: JSON.stringify({
      recipient: event.userEmail,
      eventType: event.type,
      simulatedChannel: 'IN_APP_ORDER_TIMELINE',
    }),
  });
});
