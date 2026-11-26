import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { and, eq } from 'drizzle-orm';
import {
  addressCreateSchema,
  checkoutSchema,
  orderCancelSchema,
  returnRequestCreateSchema,
} from '../../shared/validators.ts';
import { db } from '../../src/db/index.ts';
import { userAddresses } from '../../src/db/schema.ts';
import { type AuthRequest, requireAuth } from '../middleware/auth.ts';
import { getUserAddresses, mapAddressDTO } from '../repositories/cartOrderRepository.ts';
import { CheckoutError, placeTransactionalOrder } from '../services/checkoutService.ts';
import {
  cancelOrderAuthorized,
  createReturnRequestForOrder,
  getOrderDetailAuthorized,
  listOrdersForUser,
  listReturnRequestsForUser,
  OrderLifecycleError,
  reorderToCart,
} from '../services/orderLifecycleService.ts';

const router = Router();

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout attempts. Please wait a moment before trying again.' },
});

router.use(requireAuth);

// --- Saved Shipping Addresses ---
router.get('/addresses', async (req: AuthRequest, res) => {
  try {
    const addresses = await getUserAddresses(req.authUser!.id);
    return res.json({ addresses });
  } catch (error) {
    console.error('Load addresses failed:', error);
    return res.status(500).json({ error: 'Unable to load saved addresses.' });
  }
});

router.post('/addresses', async (req: AuthRequest, res) => {
  try {
    const parsed = addressCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const userId = req.authUser!.id;
    const existing = await getUserAddresses(userId);
    const shouldDefault = parsed.data.isDefault || existing.length === 0;

    if (shouldDefault && existing.length > 0) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.userId, userId));
    }

    const [created] = await db
      .insert(userAddresses)
      .values({
        userId,
        label: parsed.data.label,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        houseBuilding: parsed.data.houseBuilding,
        street: parsed.data.street,
        city: parsed.data.city,
        state: parsed.data.state,
        postalCode: parsed.data.postalCode,
        country: parsed.data.country,
        isDefault: shouldDefault,
      })
      .returning();

    return res.status(201).json({ address: mapAddressDTO(created) });
  } catch (error) {
    console.error('Create address failed:', error);
    return res.status(500).json({ error: 'Unable to save shipping address.' });
  }
});

router.patch('/addresses/:id/default', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid address ID.' });
    }
    const userId = req.authUser!.id;
    const [existing] = await db
      .select()
      .from(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ error: 'Address not found.' });
    }

    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, userId));
    const [updated] = await db
      .update(userAddresses)
      .set({ isDefault: true })
      .where(eq(userAddresses.id, id))
      .returning();

    return res.json({ address: mapAddressDTO(updated) });
  } catch (error) {
    console.error('Set default address failed:', error);
    return res.status(500).json({ error: 'Unable to update default address.' });
  }
});

router.delete('/addresses/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid address ID.' });
    }
    const [deleted] = await db
      .delete(userAddresses)
      .where(and(eq(userAddresses.id, id), eq(userAddresses.userId, req.authUser!.id)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Address not found.' });
    }
    return res.json({ message: 'Address deleted.' });
  } catch (error) {
    console.error('Delete address failed:', error);
    return res.status(500).json({ error: 'Unable to delete address.' });
  }
});

// --- Transactional Checkout ---
router.post('/checkout', checkoutLimiter, async (req: AuthRequest, res) => {
  try {
    // Reject unexpected real payment fields explicitly
    if (
      req.body &&
      ('cardNumber' in req.body || 'cvv' in req.body || 'upiPin' in req.body || 'pin' in req.body)
    ) {
      return res.status(400).json({
        error: 'Real card numbers, CVV, or PINs are never accepted in demonstration checkout.',
      });
    }

    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const result = await placeTransactionalOrder({
      userId: req.authUser!.id,
      userEmail: req.authUser!.email,
      ...parsed.data,
    });

    return res.status(result.idempotentReplay ? 200 : 201).json(result);
  } catch (error: any) {
    if (error instanceof CheckoutError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Checkout failed:', error);
    return res.status(500).json({ error: 'Unable to complete checkout right now.' });
  }
});

// --- Orders & Tracking ---
router.get('/orders', async (req: AuthRequest, res) => {
  try {
    const ordersList = await listOrdersForUser(req.authUser!.id);
    return res.json({ orders: ordersList });
  } catch (error) {
    console.error('List orders failed:', error);
    return res.status(500).json({ error: 'Unable to load orders.' });
  }
});

router.get('/orders/:id', async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const order = await getOrderDetailAuthorized(
      orderId,
      req.authUser!.id,
      req.authUser!.role === 'ADMIN'
    );
    return res.json({ order });
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Load order detail failed:', error);
    return res.status(500).json({ error: 'Unable to load order details.' });
  }
});

router.post('/orders/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const parsed = orderCancelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const order = await cancelOrderAuthorized({
      orderId,
      userId: req.authUser!.id,
      userEmail: req.authUser!.email,
      isAdmin: req.authUser!.role === 'ADMIN',
      reason: parsed.data.reason,
    });
    return res.json({ order });
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Order cancellation failed:', error);
    return res.status(500).json({ error: 'Unable to cancel order.' });
  }
});

router.post('/orders/:id/returns', async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const parsed = returnRequestCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const returnRequest = await createReturnRequestForOrder({
      orderId,
      orderItemId: parsed.data.orderItemId,
      userId: req.authUser!.id,
      userEmail: req.authUser!.email,
      reason: parsed.data.reason,
    });
    return res.status(201).json({ returnRequest });
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Return request failed:', error);
    return res.status(500).json({ error: 'Unable to submit return request.' });
  }
});

router.post('/orders/:id/reorder', async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const result = await reorderToCart(orderId, req.authUser!.id);
    return res.json(result);
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Reorder failed:', error);
    return res.status(500).json({ error: 'Unable to reorder items.' });
  }
});

router.get('/returns', async (req: AuthRequest, res) => {
  try {
    const returns = await listReturnRequestsForUser(req.authUser!.id);
    return res.json({ returns });
  } catch (error) {
    console.error('List returns failed:', error);
    return res.status(500).json({ error: 'Unable to load return requests.' });
  }
});

export default router;
