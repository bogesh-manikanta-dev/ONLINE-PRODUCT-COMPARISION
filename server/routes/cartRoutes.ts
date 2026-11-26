import { Router } from 'express';
import {
  cartItemAddSchema,
  cartItemUpdateSchema,
  cartMergeSchema,
} from '../../shared/validators.ts';
import { type AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import {
  addItemToCart,
  CartError,
  getCartDTO,
  mergeGuestCartIntoUserCart,
  removeCartItem,
  resolveOrCreateCartId,
  updateCartItemQty,
} from '../services/cartService.ts';

const router = Router();

function extractGuestToken(req: AuthRequest): string | undefined {
  const hdr = req.headers['x-cart-token'];
  if (typeof hdr === 'string' && hdr.trim().length >= 8) {
    return hdr.trim();
  }
  return undefined;
}

router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestToken = extractGuestToken(req);
    if (!req.authUser && !guestToken) {
      return res.json({
        cart: {
          id: 0,
          items: [],
          itemCount: 0,
          subtotal: 0,
          taxAmount: 0,
          standardDeliveryCharge: 0,
          expressDeliveryCharge: 0,
          freeDeliveryThreshold: 2000,
          estimatedTotalStandard: 0,
          estimatedTotalExpress: 0,
          currency: 'INR',
          notices: [],
        },
      });
    }
    const cartId = await resolveOrCreateCartId({
      userId: req.authUser?.id,
      guestToken,
    });
    const cart = await getCartDTO(cartId);
    return res.json({ cart });
  } catch (error: any) {
    if (error instanceof CartError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Cart fetch failed:', error);
    return res.status(500).json({ error: 'Unable to load shopping cart.' });
  }
});

router.post('/items', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = cartItemAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const guestToken = extractGuestToken(req);
    const cartId = await resolveOrCreateCartId({
      userId: req.authUser?.id,
      guestToken,
    });
    const cart = await addItemToCart(cartId, parsed.data.productId, parsed.data.quantity);
    return res.status(201).json({ cart });
  } catch (error: any) {
    if (error instanceof CartError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Add to cart failed:', error);
    return res.status(500).json({ error: 'Unable to add item to cart.' });
  }
});

router.patch('/items/:itemId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: 'Invalid cart item ID.' });
    }

    const parsed = cartItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const guestToken = extractGuestToken(req);
    const cartId = await resolveOrCreateCartId({
      userId: req.authUser?.id,
      guestToken,
    });
    const cart = await updateCartItemQty(cartId, itemId, parsed.data.quantity);
    return res.json({ cart });
  } catch (error: any) {
    if (error instanceof CartError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Update cart item failed:', error);
    return res.status(500).json({ error: 'Unable to update cart item.' });
  }
});

router.delete('/items/:itemId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ error: 'Invalid cart item ID.' });
    }

    const guestToken = extractGuestToken(req);
    const cartId = await resolveOrCreateCartId({
      userId: req.authUser?.id,
      guestToken,
    });
    const cart = await removeCartItem(cartId, itemId);
    return res.json({ cart });
  } catch (error: any) {
    if (error instanceof CartError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Remove cart item failed:', error);
    return res.status(500).json({ error: 'Unable to remove cart item.' });
  }
});

router.post('/merge', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = cartMergeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const cart = await mergeGuestCartIntoUserCart(req.authUser!.id, parsed.data.guestToken);
    return res.json({ cart });
  } catch (error: any) {
    console.error('Merge cart failed:', error);
    return res.status(500).json({ error: 'Unable to merge guest cart.' });
  }
});

export default router;
