import { Router } from 'express';
import { count, desc, eq } from 'drizzle-orm';
import { normalizeNumericSpec } from '../../shared/engines/comparisonEngine.ts';
import {
  adminInventoryAdjustSchema,
  adminOrderStatusSchema,
  adminRecommendationConfigSchema,
  adminReturnDecisionSchema,
  brandCreateSchema,
  categoryCreateSchema,
  offerUpsertSchema,
  priceObservationCreateSchema,
  productCreateSchema,
  sellerCreateSchema,
  specDefinitionCreateSchema,
} from '../../shared/validators.ts';
import { db } from '../../src/db/index.ts';
import {
  auditLogs,
  brands,
  categories,
  inventoryLogs,
  orders,
  priceObservations,
  productImages,
  productOffers,
  products,
  productSpecifications,
  returnRequests,
  sellers,
  specificationDefinitions,
  subcategories,
  systemSettings,
  users,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../../src/db/seed.ts';
import { SAMPLE_CSV_TEMPLATE, validateProductCsv } from '../../src/lib/csv.ts';
import { sanitizeUrl, slugify } from '../../src/lib/security.ts';
import { type AuthRequest, requireAdmin } from '../middleware/auth.ts';
import { queryProducts } from '../repositories/catalogRepository.ts';
import { runDataQualityAudit } from '../services/dataQualityService.ts';
import {
  adjustInventoryByAdmin,
  decideReturnByAdmin,
  listAllOrdersForAdmin,
  listAllReturnsForAdmin,
  OrderLifecycleError,
  updateOrderStatusByAdmin,
} from '../services/orderLifecycleService.ts';
import { getCommerceConfig } from '../services/recommendationService.ts';

const router = Router();

router.use(requireAdmin);

async function logAudit(
  actor: AuthRequest['authUser'],
  action: string,
  entityType: string,
  entityId: string | number,
  details: Record<string, unknown> = {}
) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? 'admin',
      action,
      entityType,
      entityId: String(entityId),
      detailsJson: JSON.stringify(details),
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

router.get('/overview', async (_req, res) => {
  try {
    await ensureSeeded();
    const [[prodCount], [catCount], [brandCount], [sellerCount], [userCount], [orderCount], [pendingReturnCount], quality, recentLogs] =
      await Promise.all([
        db.select({ c: count() }).from(products),
        db.select({ c: count() }).from(categories),
        db.select({ c: count() }).from(brands),
        db.select({ c: count() }).from(sellers),
        db.select({ c: count() }).from(users),
        db.select({ c: count() }).from(orders),
        db.select({ c: count() }).from(returnRequests).where(eq(returnRequests.status, 'Requested')),
        runDataQualityAudit(),
        db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(12),
      ]);

    return res.json({
      stats: {
        products: Number(prodCount.c),
        categories: Number(catCount.c),
        brands: Number(brandCount.c),
        sellers: Number(sellerCount.c),
        users: Number(userCount.c),
        orders: Number(orderCount.c),
        pendingReturns: Number(pendingReturnCount.c),
        dataQualityScore: quality.summary.healthScore,
        openQualityIssues: quality.summary.totalIssues,
      },
      recentAuditLogs: recentLogs.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: JSON.parse(l.detailsJson || '{}'),
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Admin overview failed:', error);
    return res.status(500).json({ error: 'Unable to load admin overview.' });
  }
});

router.get('/products', async (req, res) => {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const result = await queryProducts({
      q,
      categoryId,
      includeInactive: true,
      page,
      limit: 25,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed loading admin products.' });
  }
});

router.post('/products', async (req: AuthRequest, res) => {
  try {
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const d = parsed.data;
    const slug = `${slugify(d.name)}-${Date.now().toString().slice(-4)}`;

    const [created] = await db
      .insert(products)
      .values({
        name: d.name,
        slug,
        brandId: d.brandId,
        categoryId: d.categoryId,
        subcategoryId: d.subcategoryId ?? null,
        description: d.description,
        modelNumber: d.modelNumber,
        variantLabel: d.variantLabel,
        basePrice: d.basePrice,
        currency: d.currency.toUpperCase(),
        stockQuantity: d.stockQuantity,
        taxRatePercent: d.taxRatePercent,
        isFeatured: d.isFeatured,
        availabilityStatus: d.availabilityStatus,
        status: d.status,
        rating: d.rating ?? null,
        reviewCount: d.reviewCount ?? 0,
        isDemoData: false,
        dataSourceLabel: 'Administrator Catalog Entry',
      })
      .returning();

    const safeImg = sanitizeUrl(d.imageUrl);
    if (safeImg) {
      await db.insert(productImages).values({
        productId: created.id,
        url: safeImg,
        altText: `${d.name} product image`,
        isPrimary: true,
        sortOrder: 0,
      });
    }

    if (d.specifications && d.specifications.length > 0) {
      const catDefs = await db
        .select()
        .from(specificationDefinitions)
        .where(eq(specificationDefinitions.categoryId, d.categoryId));
      const defMap = new Map(catDefs.map((def) => [def.id, def]));

      for (const spec of d.specifications) {
        const def = defMap.get(spec.specDefinitionId);
        const norm =
          def?.dataType === 'numeric'
            ? normalizeNumericSpec(spec.rawValue, spec.unit || def.unit, def.unit)
            : { numericValue: spec.numericValue ?? null, normalizedValue: null };

        await db.insert(productSpecifications).values({
          productId: created.id,
          specDefinitionId: spec.specDefinitionId,
          rawValue: spec.rawValue,
          numericValue: norm.numericValue,
          unit: spec.unit ?? def?.unit ?? '',
          normalizedValue: norm.normalizedValue,
          isConflicting: Boolean(spec.isConflicting),
          sourceNote: spec.sourceNote ?? 'Administrator entry',
        });
      }
    }

    await logAudit(req.authUser, 'CREATE_PRODUCT', 'PRODUCT', created.id, { name: created.name });
    return res.status(201).json({ product: created });
  } catch (error) {
    console.error('Create product failed:', error);
    return res.status(500).json({ error: 'Unable to create product.' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const parsed = productCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const d = parsed.data;

    const [updated] = await db
      .update(products)
      .set({
        name: d.name,
        brandId: d.brandId,
        categoryId: d.categoryId,
        subcategoryId: d.subcategoryId ?? null,
        description: d.description,
        modelNumber: d.modelNumber,
        variantLabel: d.variantLabel,
        basePrice: d.basePrice,
        currency: d.currency.toUpperCase(),
        stockQuantity: d.stockQuantity,
        taxRatePercent: d.taxRatePercent,
        isFeatured: d.isFeatured,
        availabilityStatus: d.availabilityStatus,
        status: d.status,
        rating: d.rating ?? null,
        reviewCount: d.reviewCount ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const safeImg = sanitizeUrl(d.imageUrl);
    if (safeImg) {
      await db.delete(productImages).where(eq(productImages.productId, id));
      await db.insert(productImages).values({
        productId: id,
        url: safeImg,
        altText: `${d.name} product image`,
        isPrimary: true,
        sortOrder: 0,
      });
    }

    if (d.specifications) {
      const catDefs = await db
        .select()
        .from(specificationDefinitions)
        .where(eq(specificationDefinitions.categoryId, d.categoryId));
      const defMap = new Map(catDefs.map((def) => [def.id, def]));

      for (const spec of d.specifications) {
        const def = defMap.get(spec.specDefinitionId);
        const norm =
          def?.dataType === 'numeric'
            ? normalizeNumericSpec(spec.rawValue, spec.unit || def.unit, def.unit)
            : { numericValue: spec.numericValue ?? null, normalizedValue: null };

        await db
          .insert(productSpecifications)
          .values({
            productId: id,
            specDefinitionId: spec.specDefinitionId,
            rawValue: spec.rawValue,
            numericValue: norm.numericValue,
            unit: spec.unit ?? def?.unit ?? '',
            normalizedValue: norm.normalizedValue,
            isConflicting: Boolean(spec.isConflicting),
            sourceNote: spec.sourceNote ?? 'Administrator update',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [productSpecifications.productId, productSpecifications.specDefinitionId],
            set: {
              rawValue: spec.rawValue,
              numericValue: norm.numericValue,
              unit: spec.unit ?? def?.unit ?? '',
              normalizedValue: norm.normalizedValue,
              isConflicting: Boolean(spec.isConflicting),
              sourceNote: spec.sourceNote ?? 'Administrator update',
              updatedAt: new Date(),
            },
          });
      }
    }

    await logAudit(req.authUser, 'UPDATE_PRODUCT', 'PRODUCT', id, { name: updated.name });
    return res.json({ product: updated });
  } catch (error) {
    console.error('Update product failed:', error);
    return res.status(500).json({ error: 'Unable to update product.' });
  }
});

router.delete('/products/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Product not found.' });
    await logAudit(req.authUser, 'DELETE_PRODUCT', 'PRODUCT', id, { name: deleted.name });
    return res.json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('Delete product failed:', error);
    return res.status(500).json({ error: 'Unable to delete product.' });
  }
});

// Categories & Specification Definitions
router.post('/categories', async (req: AuthRequest, res) => {
  try {
    const parsed = categoryCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const slug = slugify(parsed.data.name);
    const [created] = await db
      .insert(categories)
      .values({
        name: parsed.data.name,
        slug,
        domainGroup: parsed.data.domainGroup,
        description: parsed.data.description,
        iconName: parsed.data.iconName,
      })
      .returning();
    await logAudit(req.authUser, 'CREATE_CATEGORY', 'CATEGORY', created.id, { name: created.name });
    return res.status(201).json({ category: created });
  } catch (error) {
    console.error('Create category failed:', error);
    return res.status(500).json({ error: 'Unable to create category (name/slug may already exist).' });
  }
});

router.post('/categories/:id/subcategories', async (req: AuthRequest, res) => {
  try {
    const categoryId = Number(req.params.id);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (!Number.isInteger(categoryId) || categoryId <= 0 || name.length < 2) {
      return res.status(400).json({ error: 'Valid category ID and subcategory name are required.' });
    }
    const [created] = await db
      .insert(subcategories)
      .values({ categoryId, name, slug: slugify(name), description })
      .returning();
    await logAudit(req.authUser, 'CREATE_SUBCATEGORY', 'SUBCATEGORY', created.id, { name });
    return res.status(201).json({ subcategory: created });
  } catch (error) {
    console.error('Create subcategory failed:', error);
    return res.status(500).json({ error: 'Unable to create subcategory.' });
  }
});

router.post('/spec-definitions', async (req: AuthRequest, res) => {
  try {
    const parsed = specDefinitionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const d = parsed.data;
    const [created] = await db
      .insert(specificationDefinitions)
      .values({
        categoryId: d.categoryId,
        key: d.key,
        label: d.label,
        dataType: d.dataType,
        unit: d.unit,
        higherIsBetter: d.higherIsBetter ?? null,
        isMandatory: d.isMandatory,
        isComparable: d.isComparable,
        enumValuesJson: JSON.stringify(d.enumValues || []),
        weight: d.weight,
      })
      .returning();
    await logAudit(req.authUser, 'CREATE_SPEC_DEF', 'SPEC_DEFINITION', created.id, {
      categoryId: d.categoryId,
      key: d.key,
    });
    return res.status(201).json({ specDefinition: created });
  } catch (error) {
    console.error('Create spec definition failed:', error);
    return res.status(500).json({ error: 'Unable to create specification definition.' });
  }
});

router.delete('/spec-definitions/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID.' });
    await db.delete(specificationDefinitions).where(eq(specificationDefinitions.id, id));
    await logAudit(req.authUser, 'DELETE_SPEC_DEF', 'SPEC_DEFINITION', id);
    return res.json({ message: 'Specification definition removed.' });
  } catch (error) {
    console.error('Delete spec definition failed:', error);
    return res.status(500).json({ error: 'Unable to remove specification definition.' });
  }
});

// Brands
router.post('/brands', async (req: AuthRequest, res) => {
  try {
    const parsed = brandCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const [created] = await db
      .insert(brands)
      .values({
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        country: parsed.data.country,
        website: sanitizeUrl(parsed.data.website),
        description: parsed.data.description,
        tagline: parsed.data.tagline || '',
        accentColor: parsed.data.accentColor || '#38BDF8',
        heroDescription: parsed.data.heroDescription || '',
      })
      .returning();
    await logAudit(req.authUser, 'CREATE_BRAND', 'BRAND', created.id, { name: created.name });
    return res.status(201).json({ brand: created });
  } catch (error) {
    console.error('Create brand failed:', error);
    return res.status(500).json({ error: 'Unable to create brand (may already exist).' });
  }
});

router.delete('/brands/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [linked] = await db.select({ c: count() }).from(products).where(eq(products.brandId, id));
    if (Number(linked.c) > 0) {
      return res.status(400).json({ error: 'Cannot delete brand with existing products.' });
    }
    await db.delete(brands).where(eq(brands.id, id));
    await logAudit(req.authUser, 'DELETE_BRAND', 'BRAND', id);
    return res.json({ message: 'Brand removed.' });
  } catch (error) {
    console.error('Delete brand failed:', error);
    return res.status(500).json({ error: 'Unable to delete brand.' });
  }
});

// Sellers, Offers & Price Observations
router.get('/sellers', async (_req, res) => {
  try {
    await ensureSeeded();
    const allSellers = await db.select().from(sellers);
    const allOffers = await db.select().from(productOffers).orderBy(desc(productOffers.updatedAt));
    const allProds = await db.select({ id: products.id, name: products.name }).from(products);
    const prodMap = new Map(allProds.map((p) => [p.id, p.name]));
    const sellerMap = new Map(allSellers.map((s) => [s.id, s.name]));

    return res.json({
      sellers: allSellers,
      offers: allOffers.map((o) => ({
        ...o,
        productName: prodMap.get(o.productId) ?? `Product #${o.productId}`,
        sellerName: sellerMap.get(o.sellerId) ?? `Seller #${o.sellerId}`,
        lastVerifiedAt: o.lastVerifiedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Load sellers/offers failed:', error);
    return res.status(500).json({ error: 'Unable to load sellers and offers.' });
  }
});

router.post('/sellers', async (req: AuthRequest, res) => {
  try {
    const parsed = sellerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const [created] = await db
      .insert(sellers)
      .values({
        name: parsed.data.name,
        slug: slugify(parsed.data.name),
        website: sanitizeUrl(parsed.data.website),
        reliabilityNote: parsed.data.reliabilityNote,
        isAuthorizedApi: parsed.data.isAuthorizedApi,
      })
      .returning();
    await logAudit(req.authUser, 'CREATE_SELLER', 'SELLER', created.id, { name: created.name });
    return res.status(201).json({ seller: created });
  } catch (error) {
    console.error('Create seller failed:', error);
    return res.status(500).json({ error: 'Unable to create seller.' });
  }
});

router.post('/offers', async (req: AuthRequest, res) => {
  try {
    const parsed = offerUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const d = parsed.data;
    const now = new Date();
    const [offer] = await db
      .insert(productOffers)
      .values({
        productId: d.productId,
        sellerId: d.sellerId,
        price: d.price,
        currency: d.currency.toUpperCase(),
        deliveryCharge: d.deliveryCharge ?? null,
        installationCharge: d.installationCharge ?? null,
        warrantyCost: d.warrantyCost ?? null,
        requiredAccessoriesCost: d.requiredAccessoriesCost ?? null,
        additionalFees: d.additionalFees ?? null,
        additionalFeesNote: d.additionalFeesNote,
        availabilityStatus: d.availabilityStatus,
        dataSource: d.dataSource,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [productOffers.productId, productOffers.sellerId],
        set: {
          price: d.price,
          currency: d.currency.toUpperCase(),
          deliveryCharge: d.deliveryCharge ?? null,
          installationCharge: d.installationCharge ?? null,
          warrantyCost: d.warrantyCost ?? null,
          requiredAccessoriesCost: d.requiredAccessoriesCost ?? null,
          additionalFees: d.additionalFees ?? null,
          additionalFeesNote: d.additionalFeesNote,
          availabilityStatus: d.availabilityStatus,
          dataSource: d.dataSource,
          lastVerifiedAt: now,
          updatedAt: now,
        },
      })
      .returning();

    // Also record a price observation
    await db.insert(priceObservations).values({
      productId: d.productId,
      sellerId: d.sellerId,
      price: d.price,
      currency: d.currency.toUpperCase(),
      sourceLabel: d.dataSource,
      isDemoData: false,
      observedAt: now,
    });

    await logAudit(req.authUser, 'UPSERT_OFFER', 'OFFER', offer.id, {
      productId: d.productId,
      sellerId: d.sellerId,
      price: d.price,
    });

    return res.status(201).json({ offer });
  } catch (error) {
    console.error('Upsert offer failed:', error);
    return res.status(500).json({ error: 'Unable to save offer.' });
  }
});

router.post('/price-observations', async (req: AuthRequest, res) => {
  try {
    const parsed = priceObservationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const d = parsed.data;
    const obsDate = d.observedAt ? new Date(d.observedAt) : new Date();
    const [obs] = await db
      .insert(priceObservations)
      .values({
        productId: d.productId,
        sellerId: d.sellerId,
        price: d.price,
        currency: d.currency.toUpperCase(),
        sourceLabel: d.sourceLabel,
        isDemoData: false,
        observedAt: Number.isNaN(obsDate.getTime()) ? new Date() : obsDate,
      })
      .returning();

    await logAudit(req.authUser, 'RECORD_PRICE_OBSERVATION', 'PRICE_OBSERVATION', obs.id, {
      productId: d.productId,
      price: d.price,
    });
    return res.status(201).json({ observation: obs });
  } catch (error) {
    console.error('Price observation create failed:', error);
    return res.status(500).json({ error: 'Unable to record price observation.' });
  }
});

// CSV Import & Sample Template
router.get('/csv-template', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="comparex-product-template.csv"');
  return res.send(SAMPLE_CSV_TEMPLATE);
});

router.post('/csv-import', async (req: AuthRequest, res) => {
  try {
    const csvContent = typeof req.body?.csvContent === 'string' ? req.body.csvContent : '';
    const dryRun = Boolean(req.body?.dryRun);
    if (!csvContent.trim()) {
      return res.status(400).json({ error: 'CSV content is empty.' });
    }

    const validation = validateProductCsv(csvContent);
    if (validation.errors.length > 0) {
      return res.status(400).json({
        importedCount: 0,
        validCount: validation.validRows.length,
        errors: validation.errors,
        error: `CSV validation failed with ${validation.errors.length} error(s).`,
      });
    }

    const allCats = await db.select().from(categories);
    const catBySlug = new Map(allCats.map((c) => [c.slug, c]));
    const allDefs = await db.select().from(specificationDefinitions);

    // Verify category slugs exist before importing
    const rowErrors: Array<{ rowNumber: number; message: string }> = [];
    for (const row of validation.validRows) {
      if (!catBySlug.has(row.data.categorySlug)) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: `Unknown categorySlug "${row.data.categorySlug}"`,
        });
      }
    }
    if (rowErrors.length > 0) {
      return res.status(400).json({
        importedCount: 0,
        validCount: validation.validRows.length - rowErrors.length,
        errors: rowErrors,
        error: 'One or more rows reference an unknown category slug.',
      });
    }

    if (dryRun) {
      return res.json({
        dryRun: true,
        validCount: validation.validRows.length,
        errors: [],
      });
    }

    let importedCount = 0;
    for (const row of validation.validRows) {
      const cat = catBySlug.get(row.data.categorySlug)!;
      const brandSlug = slugify(row.data.brand);
      let [brand] = await db.select().from(brands).where(eq(brands.slug, brandSlug)).limit(1);
      if (!brand) {
        [brand] = await db
          .insert(brands)
          .values({
            name: row.data.brand,
            slug: brandSlug,
            country: 'Global',
            description: 'Imported via CSV',
          })
          .returning();
      }

      const prodSlug = `${slugify(row.data.name)}-${Date.now().toString().slice(-4)}-${row.rowNumber}`;
      const [created] = await db
        .insert(products)
        .values({
          name: row.data.name,
          slug: prodSlug,
          brandId: brand.id,
          categoryId: cat.id,
          modelNumber: row.data.modelNumber,
          basePrice: row.data.basePrice,
          currency: row.data.currency,
          availabilityStatus: row.data.availabilityStatus,
          description: row.data.description,
          status: 'ACTIVE',
          isDemoData: false,
          dataSourceLabel: 'Administrator CSV Import',
        })
        .returning();

      const catDefs = allDefs.filter((d) => d.categoryId === cat.id);
      for (const [key, val] of Object.entries(row.data.specs)) {
        const def = catDefs.find((d) => d.key === key);
        if (!def) continue;
        const norm =
          def.dataType === 'numeric'
            ? normalizeNumericSpec(val, def.unit, def.unit)
            : { numericValue: null, normalizedValue: null };

        await db.insert(productSpecifications).values({
          productId: created.id,
          specDefinitionId: def.id,
          rawValue: val,
          numericValue: norm.numericValue,
          unit: def.unit,
          normalizedValue: norm.normalizedValue,
          sourceNote: 'Imported via CSV',
        });
      }
      importedCount++;
    }

    await logAudit(req.authUser, 'CSV_IMPORT', 'PRODUCT', 'batch', { importedCount });
    return res.status(201).json({
      importedCount,
      errors: [],
      message: `Successfully imported ${importedCount} product(s).`,
    });
  } catch (error) {
    console.error('CSV import failed:', error);
    return res.status(500).json({ error: 'CSV import failed.' });
  }
});

// User & Role Management
router.get('/users', async (_req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    return res.json({
      users: allUsers.map((u) => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('List users failed:', error);
    return res.status(500).json({ error: 'Unable to load users.' });
  }
});

router.patch('/users/:id/role', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const role = req.body?.role;
    const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (role !== undefined && role !== 'CONSUMER' && role !== 'ADMIN') {
      return res.status(400).json({ error: 'Role must be CONSUMER or ADMIN.' });
    }

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (role !== undefined) updateSet.role = role;
    if (isActive !== undefined) updateSet.isActive = isActive;

    const [updated] = await db.update(users).set(updateSet).where(eq(users.id, id)).returning();
    if (!updated) return res.status(404).json({ error: 'User not found.' });

    await logAudit(req.authUser, 'UPDATE_USER_ACCESS', 'USER', id, { role, isActive });
    return res.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('Update user role failed:', error);
    return res.status(500).json({ error: 'Unable to update user.' });
  }
});

// Data Quality Reports & Corrections
router.get('/data-quality', async (_req, res) => {
  try {
    const report = await runDataQualityAudit();
    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Data quality audit failed.' });
  }
});

router.post('/data-quality/resolve-conflict/:specId', async (req: AuthRequest, res) => {
  try {
    const specId = Number(req.params.specId);
    const rawValue = typeof req.body?.rawValue === 'string' ? req.body.rawValue.trim() : undefined;
    const [existing] = await db
      .select()
      .from(productSpecifications)
      .where(eq(productSpecifications.id, specId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'Specification record not found.' });

    await db
      .update(productSpecifications)
      .set({
        rawValue: rawValue || existing.rawValue,
        isConflicting: false,
        sourceNote: 'Verified and conflict cleared by Administrator',
        updatedAt: new Date(),
      })
      .where(eq(productSpecifications.id, specId));

    await logAudit(req.authUser, 'RESOLVE_SPEC_CONFLICT', 'SPECIFICATION', specId, { rawValue });
    return res.json({ message: 'Specification conflict resolved.' });
  } catch (error) {
    console.error('Resolve conflict failed:', error);
    return res.status(500).json({ error: 'Unable to resolve specification conflict.' });
  }
});

router.post('/data-quality/refresh-offer/:offerId', async (req: AuthRequest, res) => {
  try {
    const offerId = Number(req.params.offerId);
    const [updated] = await db
      .update(productOffers)
      .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(productOffers.id, offerId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Offer not found.' });
    await logAudit(req.authUser, 'REFRESH_OFFER_VERIFICATION', 'OFFER', offerId);
    return res.json({ message: 'Offer timestamp refreshed.' });
  } catch (error) {
    console.error('Refresh offer failed:', error);
    return res.status(500).json({ error: 'Unable to refresh offer.' });
  }
});

router.get('/audit-logs', async (_req, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50);
    return res.json({
      logs: logs.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: JSON.parse(l.detailsJson || '{}'),
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Audit logs failed:', error);
    return res.status(500).json({ error: 'Unable to load audit logs.' });
  }
});

// Phase 3 Admin: Inventory Management
router.get('/inventory', async (_req, res) => {
  try {
    await ensureSeeded();
    const [{ items }, logs, allProds] = await Promise.all([
      queryProducts({ includeInactive: false, limit: 48, page: 1 }),
      db.select().from(inventoryLogs).orderBy(desc(inventoryLogs.createdAt)).limit(40),
      db.select({ id: products.id, name: products.name }).from(products),
    ]);
    const prodMap = new Map(allProds.map((p) => [p.id, p.name]));

    return res.json({
      products: items,
      logs: logs.map((l) => ({
        id: l.id,
        productId: l.productId,
        productName: prodMap.get(l.productId) ?? `Product #${l.productId}`,
        changeAmount: l.changeAmount,
        previousStock: l.previousStock,
        newStock: l.newStock,
        reason: l.reason,
        actorEmail: l.actorEmail,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Admin inventory fetch failed:', error);
    return res.status(500).json({ error: 'Unable to load inventory.' });
  }
});

router.post('/inventory/:productId/adjust', async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }
    const parsed = adminInventoryAdjustSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const result = await adjustInventoryByAdmin({
      productId,
      stockQuantity: parsed.data.stockQuantity,
      reason: parsed.data.reason,
      actorEmail: req.authUser!.email,
    });
    return res.json(result);
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Inventory adjust failed:', error);
    return res.status(500).json({ error: 'Unable to adjust inventory.' });
  }
});

// Phase 3 Admin: Order Fulfillment & Cancellation
router.get('/orders', async (_req, res) => {
  try {
    const ordersList = await listAllOrdersForAdmin();
    return res.json({ orders: ordersList });
  } catch (error) {
    console.error('Admin orders load failed:', error);
    return res.status(500).json({ error: 'Unable to load orders.' });
  }
});

router.patch('/orders/:id/status', async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }
    const parsed = adminOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const order = await updateOrderStatusByAdmin({
      orderId,
      nextStatus: parsed.data.status,
      note: parsed.data.note,
      actorEmail: req.authUser!.email,
    });
    return res.json({ order });
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Admin order status update failed:', error);
    return res.status(500).json({ error: 'Unable to update order status.' });
  }
});

// Phase 3 Admin: Returns Queue
router.get('/returns', async (_req, res) => {
  try {
    const returns = await listAllReturnsForAdmin();
    return res.json({ returns });
  } catch (error) {
    console.error('Admin returns load failed:', error);
    return res.status(500).json({ error: 'Unable to load return requests.' });
  }
});

router.patch('/returns/:id', async (req: AuthRequest, res) => {
  try {
    const returnId = Number(req.params.id);
    if (!Number.isInteger(returnId) || returnId <= 0) {
      return res.status(400).json({ error: 'Invalid return ID.' });
    }
    const parsed = adminReturnDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const returnRequest = await decideReturnByAdmin({
      returnId,
      nextStatus: parsed.data.status,
      adminNote: parsed.data.adminNote,
      actorEmail: req.authUser!.email,
    });
    return res.json({ returnRequest });
  } catch (error: any) {
    if (error instanceof OrderLifecycleError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Admin return decision failed:', error);
    return res.status(500).json({ error: 'Unable to process return request.' });
  }
});

// Phase 3 Admin: Recommendation Strategy & Delivery/Cancellation Rules
router.get('/recommendation-config', async (_req, res) => {
  try {
    const config = await getCommerceConfig();
    return res.json({ config });
  } catch (error) {
    console.error('Load recommendation config failed:', error);
    return res.status(500).json({ error: 'Unable to load configuration.' });
  }
});

router.put('/recommendation-config', async (req: AuthRequest, res) => {
  try {
    const parsed = adminRecommendationConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    await db
      .insert(systemSettings)
      .values({
        key: 'recommendation_config',
        value: JSON.stringify(parsed.data),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: JSON.stringify(parsed.data), updatedAt: new Date() },
      });

    await logAudit(req.authUser, 'UPDATE_COMMERCE_CONFIG', 'SYSTEM_SETTINGS', 'recommendation_config', parsed.data);
    return res.json({ config: parsed.data });
  } catch (error) {
    console.error('Save recommendation config failed:', error);
    return res.status(500).json({ error: 'Unable to save configuration.' });
  }
});

export default router;
