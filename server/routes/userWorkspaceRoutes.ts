import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { saveComparisonSchema, wishlistToggleSchema } from '../../shared/validators.ts';
import { db } from '../../src/db/index.ts';
import {
  categories,
  comparisonItems,
  comparisons,
  recentlyViewed,
  recommendationRequests,
  wishlistItems,
  wishlists,
} from '../../src/db/schema.ts';
import { type AuthRequest, ensureUserWorkspace, requireAuth } from '../middleware/auth.ts';
import { getProductsByIds } from '../repositories/catalogRepository.ts';
import { listOrdersForUser } from '../services/orderLifecycleService.ts';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!.id;
    await ensureUserWorkspace(userId);

    const [savedComps, userWlRows, recentRows, recRows, userOrders] = await Promise.all([
      db
        .select()
        .from(comparisons)
        .where(eq(comparisons.userId, userId))
        .orderBy(desc(comparisons.updatedAt))
        .limit(5),
      db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1),
      db
        .select()
        .from(recentlyViewed)
        .where(eq(recentlyViewed.userId, userId))
        .orderBy(desc(recentlyViewed.viewedAt))
        .limit(6),
      db
        .select()
        .from(recommendationRequests)
        .where(eq(recommendationRequests.userId, userId))
        .orderBy(desc(recommendationRequests.createdAt))
        .limit(4),
      listOrdersForUser(userId),
    ]);

    const compIds = savedComps.map((c) => c.id);
    const compItemRows =
      compIds.length > 0
        ? await db.select().from(comparisonItems).where(inArray(comparisonItems.comparisonId, compIds))
        : [];

    const wl = userWlRows[0];
    const wlItems = wl
      ? await db
          .select()
          .from(wishlistItems)
          .where(eq(wishlistItems.wishlistId, wl.id))
          .orderBy(desc(wishlistItems.addedAt))
      : [];

    const allProductIds = Array.from(
      new Set([
        ...compItemRows.map((i) => i.productId),
        ...wlItems.map((i) => i.productId),
        ...recentRows.map((r) => r.productId),
      ])
    );
    const hydratedProducts = await getProductsByIds(allProductIds);
    const prodMap = new Map(hydratedProducts.map((p) => [p.id, p]));

    const allCats = await db.select().from(categories);
    const catMap = new Map(allCats.map((c) => [c.id, c]));

    return res.json({
      savedComparisons: savedComps.map((c) => ({
        id: c.id,
        title: c.title,
        categoryId: c.categoryId,
        categoryName: catMap.get(c.categoryId)?.name ?? 'Category',
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        products: compItemRows
          .filter((i) => i.comparisonId === c.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => prodMap.get(i.productId))
          .filter(Boolean),
      })),
      wishlist: wlItems
        .map((i) => ({
          id: i.id,
          productId: i.productId,
          targetPrice: i.targetPrice,
          notes: i.notes,
          addedAt: i.addedAt.toISOString(),
          product: prodMap.get(i.productId) ?? null,
        }))
        .filter((i) => i.product !== null),
      recentlyViewed: recentRows
        .map((r) => prodMap.get(r.productId))
        .filter(Boolean),
      recentRecommendations: recRows.map((r) => ({
        id: r.id,
        categoryId: r.categoryId,
        categoryName: catMap.get(r.categoryId)?.name ?? 'Category',
        budgetMax: r.budgetMax,
        intendedUsage: r.intendedUsage,
        resultsSummary: JSON.parse(r.resultsSummaryJson || '[]'),
        createdAt: r.createdAt.toISOString(),
      })),
      recentOrders: userOrders.slice(0, 5),
    });
  } catch (error) {
    console.error('Dashboard fetch failed:', error);
    return res.status(500).json({ error: 'Unable to load your dashboard.' });
  }
});

router.get('/comparisons', async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!.id;
    const rows = await db
      .select()
      .from(comparisons)
      .where(eq(comparisons.userId, userId))
      .orderBy(desc(comparisons.updatedAt));

    const compIds = rows.map((r) => r.id);
    const items =
      compIds.length > 0
        ? await db.select().from(comparisonItems).where(inArray(comparisonItems.comparisonId, compIds))
        : [];
    const hydrated = await getProductsByIds(Array.from(new Set(items.map((i) => i.productId))));
    const prodMap = new Map(hydrated.map((p) => [p.id, p]));
    const allCats = await db.select().from(categories);
    const catMap = new Map(allCats.map((c) => [c.id, c]));

    return res.json({
      comparisons: rows.map((c) => ({
        id: c.id,
        title: c.title,
        categoryId: c.categoryId,
        categoryName: catMap.get(c.categoryId)?.name ?? 'Category',
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        products: items
          .filter((i) => i.comparisonId === c.id)
          .sort((a, b) => a.position - b.position)
          .map((i) => prodMap.get(i.productId))
          .filter(Boolean),
      })),
    });
  } catch (error) {
    console.error('Load saved comparisons failed:', error);
    return res.status(500).json({ error: 'Unable to load saved comparisons.' });
  }
});

router.post('/comparisons', async (req: AuthRequest, res) => {
  try {
    const parsed = saveComparisonSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const { title, categoryId, productIds, notes } = parsed.data;
    const uniqueIds = Array.from(new Set(productIds));
    const prods = await getProductsByIds(uniqueIds);

    if (prods.length !== uniqueIds.length) {
      return res.status(404).json({ error: 'One or more products not found.' });
    }
    if (prods.some((p) => p.categoryId !== categoryId)) {
      return res.status(400).json({ error: 'All products in a saved comparison must belong to the same category.' });
    }

    const [created] = await db
      .insert(comparisons)
      .values({
        userId: req.authUser!.id,
        title,
        categoryId,
        notes,
      })
      .returning();

    for (let idx = 0; idx < uniqueIds.length; idx++) {
      await db.insert(comparisonItems).values({
        comparisonId: created.id,
        productId: uniqueIds[idx],
        position: idx,
      });
    }

    return res.status(201).json({ comparison: created });
  } catch (error) {
    console.error('Save comparison failed:', error);
    return res.status(500).json({ error: 'Unable to save comparison.' });
  }
});

router.delete('/comparisons/:id', async (req: AuthRequest, res) => {
  try {
    const compId = Number(req.params.id);
    if (!Number.isInteger(compId) || compId <= 0) {
      return res.status(400).json({ error: 'Invalid comparison ID.' });
    }

    const [existing] = await db
      .select()
      .from(comparisons)
      .where(eq(comparisons.id, compId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Saved comparison not found.' });
    }
    if (existing.userId !== req.authUser!.id && req.authUser!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'You do not have permission to delete this saved comparison.' });
    }

    await db.delete(comparisons).where(eq(comparisons.id, compId));
    return res.json({ message: 'Saved comparison deleted.' });
  } catch (error) {
    console.error('Delete comparison failed:', error);
    return res.status(500).json({ error: 'Unable to delete comparison.' });
  }
});

router.get('/wishlist', async (req: AuthRequest, res) => {
  try {
    const userId = req.authUser!.id;
    await ensureUserWorkspace(userId);
    const [wl] = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
    if (!wl) return res.json({ items: [] });

    const rows = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.wishlistId, wl.id))
      .orderBy(desc(wishlistItems.addedAt));

    const hydrated = await getProductsByIds(rows.map((r) => r.productId));
    const map = new Map(hydrated.map((p) => [p.id, p]));

    return res.json({
      items: rows
        .map((r) => ({
          id: r.id,
          productId: r.productId,
          targetPrice: r.targetPrice,
          notes: r.notes,
          addedAt: r.addedAt.toISOString(),
          product: map.get(r.productId) ?? null,
        }))
        .filter((i) => i.product !== null),
    });
  } catch (error) {
    console.error('Wishlist load failed:', error);
    return res.status(500).json({ error: 'Unable to load wishlist.' });
  }
});

router.post('/wishlist', async (req: AuthRequest, res) => {
  try {
    const parsed = wishlistToggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const userId = req.authUser!.id;
    await ensureUserWorkspace(userId);
    const [wl] = await db.select().from(wishlists).where(eq(wishlists.userId, userId)).limit(1);
    if (!wl) {
      return res.status(500).json({ error: 'Wishlist workspace could not be initialized.' });
    }

    const [prod] = await getProductsByIds([parsed.data.productId]);
    if (!prod) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [item] = await db
      .insert(wishlistItems)
      .values({
        wishlistId: wl.id,
        productId: parsed.data.productId,
        targetPrice: parsed.data.targetPrice ?? null,
        notes: parsed.data.notes ?? '',
      })
      .onConflictDoUpdate({
        target: [wishlistItems.wishlistId, wishlistItems.productId],
        set: {
          targetPrice: parsed.data.targetPrice ?? null,
          notes: parsed.data.notes ?? '',
        },
      })
      .returning();

    return res.status(201).json({ item });
  } catch (error) {
    console.error('Wishlist save failed:', error);
    return res.status(500).json({ error: 'Unable to save to wishlist.' });
  }
});

router.delete('/wishlist/:productId', async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const [wl] = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, req.authUser!.id))
      .limit(1);
    if (!wl) return res.json({ message: 'Removed from wishlist.' });

    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.wishlistId, wl.id), eq(wishlistItems.productId, productId)));

    return res.json({ message: 'Removed from wishlist.' });
  } catch (error) {
    console.error('Wishlist remove failed:', error);
    return res.status(500).json({ error: 'Unable to remove wishlist item.' });
  }
});

export default router;
