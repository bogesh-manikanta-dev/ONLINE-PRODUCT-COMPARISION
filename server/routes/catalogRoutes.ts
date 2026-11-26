import { Router } from 'express';
import { z } from 'zod';
import { analyzeComparison } from '../../shared/engines/comparisonEngine.ts';
import { recommendationRequestSchema } from '../../shared/validators.ts';
import { db } from '../../src/db/index.ts';
import { recentlyViewed, recommendationRequests } from '../../src/db/schema.ts';
import { type AuthRequest, optionalAuth } from '../middleware/auth.ts';
import {
  getAllBrandsWithCounts,
  getAllCategoriesWithMeta,
  getBrandDetailBySlug,
  getProductDetail,
  getProductPriceHistory,
  getProductsByIds,
  getSpecDefinitionsByCategory,
  queryProducts,
} from '../repositories/catalogRepository.ts';
import {
  executeRecommendationStrategy,
  getCommerceConfig,
} from '../services/recommendationService.ts';

const router = Router();

router.get('/categories', async (_req, res) => {
  try {
    const data = await getAllCategoriesWithMeta();
    return res.json({ categories: data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load categories.' });
  }
});

router.get('/brands', async (_req, res) => {
  try {
    const data = await getAllBrandsWithCounts();
    return res.json({ brands: data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load brands.' });
  }
});

router.get('/brands/:slug', async (req, res) => {
  try {
    const detail = await getBrandDetailBySlug(String(req.params.slug));
    if (!detail) {
      return res.status(404).json({ error: 'Brand not found.' });
    }
    return res.json(detail);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load brand showcase.' });
  }
});

router.get('/recommendation-config', async (_req, res) => {
  try {
    const config = await getCommerceConfig();
    return res.json({ config });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load configuration.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const subcategoryId = req.query.subcategoryId ? Number(req.query.subcategoryId) : undefined;
    const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const minRating = req.query.minRating ? Number(req.query.minRating) : undefined;
    const availability = typeof req.query.availability === 'string' ? req.query.availability : undefined;
    const specKey = typeof req.query.specKey === 'string' ? req.query.specKey : undefined;
    const specValue = typeof req.query.specValue === 'string' ? req.query.specValue : undefined;
    const sort = (typeof req.query.sort === 'string' ? req.query.sort : 'popularity') as
      | 'popularity'
      | 'price_asc'
      | 'price_desc'
      | 'rating'
      | 'value';
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 12;

    const result = await queryProducts({
      q,
      categorySlug,
      categoryId,
      subcategoryId,
      brandId,
      minPrice,
      maxPrice,
      minRating,
      availability,
      specKey,
      specValue,
      sort,
      page,
      limit,
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to query products.' });
  }
});

router.get('/products/:idOrSlug', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const product = await getProductDetail(String(req.params.idOrSlug));
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (req.authUser) {
      await db
        .insert(recentlyViewed)
        .values({ userId: req.authUser.id, productId: product.id, viewedAt: new Date() })
        .onConflictDoUpdate({
          target: [recentlyViewed.userId, recentlyViewed.productId],
          set: { viewedAt: new Date() },
        });
    }

    return res.json({ product });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load product.' });
  }
});

router.get('/products/:id/price-history', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const product = await getProductDetail(String(id));
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const history = await getProductPriceHistory(id);
    return res.json({ product, ...history });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to load price history.' });
  }
});

const compareAnalyzeSchema = z.object({
  productIds: z
    .array(z.number().int().positive())
    .min(2, 'Select at least 2 products to compare')
    .max(4, 'You can compare up to 4 products at a time'),
});

router.post('/compare/analyze', async (req, res) => {
  try {
    const parsed = compareAnalyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const uniqueIds = Array.from(new Set(parsed.data.productIds));
    if (uniqueIds.length < 2) {
      return res.status(400).json({ error: 'Select at least 2 distinct products to compare.' });
    }

    const products = await getProductsByIds(uniqueIds);
    if (products.length !== uniqueIds.length) {
      return res.status(404).json({ error: 'One or more selected products could not be found.' });
    }

    const categoryIds = new Set(products.map((p) => p.categoryId));
    if (categoryIds.size > 1) {
      return res.status(400).json({
        error:
          'Incompatible categories selected. CompareX only compares products within the same category so specifications align accurately.',
        categories: products.map((p) => ({ id: p.id, name: p.name, category: p.categoryName })),
      });
    }

    const defs = await getSpecDefinitionsByCategory(products[0].categoryId);
    const analysis = analyzeComparison(products, defs);
    return res.json(analysis);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Comparison analysis failed.' });
  }
});

router.post('/recommendations', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = recommendationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const criteria = parsed.data;
    const allCats = await getAllCategoriesWithMeta();
    const category = allCats.find((c) => c.id === criteria.categoryId);
    if (!category) {
      return res.status(404).json({ error: 'Selected category was not found.' });
    }

    const { items: categoryProducts } = await queryProducts({
      categoryId: criteria.categoryId,
      limit: 50,
    });
    const defs = category.specDefinitions || [];

    const result = await executeRecommendationStrategy(categoryProducts, category, defs, criteria);

    const [savedReq] = await db
      .insert(recommendationRequests)
      .values({
        userId: req.authUser?.id ?? null,
        categoryId: criteria.categoryId,
        budgetMin: criteria.budgetMin ?? null,
        budgetMax: criteria.budgetMax,
        intendedUsage: criteria.intendedUsage,
        preferredBrandId: criteria.preferredBrandId ?? null,
        criteriaJson: JSON.stringify(criteria),
        resultsSummaryJson: JSON.stringify(
          result.recommendations.slice(0, 5).map((r) => ({
            productId: r.product.id,
            name: r.product.name,
            score: r.overallScore,
          }))
        ),
      })
      .returning();

    return res.json({
      ...result,
      requestId: savedReq.id,
    });
  } catch (error: any) {
    console.error('Recommendation error:', error);
    return res.status(500).json({ error: error.message || 'Recommendation calculation failed.' });
  }
});

export default router;
