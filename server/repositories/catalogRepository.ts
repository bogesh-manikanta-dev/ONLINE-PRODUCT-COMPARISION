import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { computeOfferTotals } from '../../shared/engines/costCalculator.ts';
import type {
  BrandDTO,
  BrandDetailDTO,
  CategoryDTO,
  PriceObservationDTO,
  ProductDTO,
  ProductOfferDTO,
  ProductSpecDTO,
  SpecDataType,
  SpecDefinitionDTO,
} from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  brands,
  categories,
  priceObservations,
  productImages,
  productOffers,
  products,
  productSpecifications,
  sellers,
  specificationDefinitions,
  subcategories,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../../src/db/seed.ts';

export interface ProductQueryFilters {
  q?: string;
  categorySlug?: string;
  categoryId?: number;
  subcategoryId?: number;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: string;
  specKey?: string;
  specValue?: string;
  includeInactive?: boolean;
  sort?: 'popularity' | 'price_asc' | 'price_desc' | 'rating' | 'value';
  page?: number;
  limit?: number;
}

export async function getAllCategoriesWithMeta(): Promise<CategoryDTO[]> {
  try {
    await ensureSeeded();
    const cats = await db.select().from(categories).orderBy(asc(categories.displayOrder), asc(categories.name));
    const subs = await db.select().from(subcategories).orderBy(asc(subcategories.name));
    const defs = await db
      .select()
      .from(specificationDefinitions)
      .orderBy(asc(specificationDefinitions.sortOrder));
    const prodCounts = await db
      .select({
        categoryId: products.categoryId,
        count: sql<number>`count(*)::int`,
      })
      .from(products)
      .where(eq(products.status, 'ACTIVE'))
      .groupBy(products.categoryId);

    const countMap = new Map(prodCounts.map((r) => [r.categoryId, Number(r.count)]));

    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      domainGroup: c.domainGroup,
      description: c.description,
      iconName: c.iconName,
      displayOrder: c.displayOrder,
      productCount: countMap.get(c.id) ?? 0,
      subcategories: subs
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({
          id: s.id,
          categoryId: s.categoryId,
          name: s.name,
          slug: s.slug,
          description: s.description,
        })),
      specDefinitions: defs
        .filter((d) => d.categoryId === c.id)
        .map((d) => ({
          id: d.id,
          categoryId: d.categoryId,
          key: d.key,
          label: d.label,
          dataType: d.dataType as SpecDataType,
          unit: d.unit,
          higherIsBetter: d.higherIsBetter,
          isMandatory: d.isMandatory,
          isComparable: d.isComparable,
          enumValues: JSON.parse(d.enumValuesJson || '[]'),
          weight: d.weight,
          sortOrder: d.sortOrder,
        })),
    }));
  } catch (error) {
    console.error('Failed loading categories:', error);
    throw new Error('Unable to load product categories.', { cause: error });
  }
}

export async function getAllBrandsWithCounts(): Promise<BrandDTO[]> {
  try {
    await ensureSeeded();
    const allBrands = await db.select().from(brands).orderBy(asc(brands.name));
    const counts = await db
      .select({
        brandId: products.brandId,
        count: sql<number>`count(*)::int`,
      })
      .from(products)
      .where(eq(products.status, 'ACTIVE'))
      .groupBy(products.brandId);
    const map = new Map(counts.map((c) => [c.brandId, Number(c.count)]));

    return allBrands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      country: b.country,
      website: b.website,
      description: b.description,
      tagline: b.tagline,
      accentColor: b.accentColor,
      heroDescription: b.heroDescription,
      productCount: map.get(b.id) ?? 0,
    }));
  } catch (error) {
    console.error('Failed loading brands:', error);
    throw new Error('Unable to load brands.', { cause: error });
  }
}

export async function getBrandDetailBySlug(slug: string): Promise<BrandDetailDTO | null> {
  try {
    await ensureSeeded();
    const [brandRow] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
    if (!brandRow) return null;

    const prodRows = await db
      .select()
      .from(products)
      .where(and(eq(products.brandId, brandRow.id), eq(products.status, 'ACTIVE')))
      .orderBy(desc(products.popularityScore));

    const hydrated = await hydrateProducts(prodRows);
    const allCats = await getAllCategoriesWithMeta();
    const catIds = new Set(hydrated.map((p) => p.categoryId));
    const brandCats = allCats.filter((c) => catIds.has(c.id));

    return {
      brand: {
        id: brandRow.id,
        name: brandRow.name,
        slug: brandRow.slug,
        country: brandRow.country,
        website: brandRow.website,
        description: brandRow.description,
        tagline: brandRow.tagline,
        accentColor: brandRow.accentColor,
        heroDescription: brandRow.heroDescription,
        productCount: hydrated.length,
      },
      categories: brandCats,
      products: hydrated,
    };
  } catch (error) {
    console.error('Failed loading brand showcase:', error);
    throw new Error('Unable to load brand showcase.', { cause: error });
  }
}

async function hydrateProducts(productRows: Array<typeof products.$inferSelect>): Promise<ProductDTO[]> {
  if (productRows.length === 0) return [];
  const productIds = productRows.map((p) => p.id);

  const [allBrands, allCats, allSubs, imgs, specs, defs] = await Promise.all([
    db.select().from(brands),
    db.select().from(categories),
    db.select().from(subcategories),
    db.select().from(productImages).where(inArray(productImages.productId, productIds)).orderBy(asc(productImages.sortOrder)),
    db.select().from(productSpecifications).where(inArray(productSpecifications.productId, productIds)),
    db.select().from(specificationDefinitions).orderBy(asc(specificationDefinitions.sortOrder)),
  ]);

  const brandMap = new Map(allBrands.map((b) => [b.id, b]));
  const catMap = new Map(allCats.map((c) => [c.id, c]));
  const subMap = new Map(allSubs.map((s) => [s.id, s]));
  const defMap = new Map(defs.map((d) => [d.id, d]));

  return productRows.map((p) => {
    const brand = brandMap.get(p.brandId);
    const cat = catMap.get(p.categoryId);
    const sub = p.subcategoryId ? subMap.get(p.subcategoryId) : undefined;
    const pImgs = imgs.filter((i) => i.productId === p.id);
    const primary = pImgs.find((i) => i.isPrimary) || pImgs[0];

    const pSpecs: ProductSpecDTO[] = specs
      .filter((s) => s.productId === p.id)
      .map((s) => {
        const def = defMap.get(s.specDefinitionId);
        return {
          id: s.id,
          specDefinitionId: s.specDefinitionId,
          key: def?.key ?? 'unknown',
          label: def?.label ?? 'Specification',
          dataType: (def?.dataType as SpecDataType) ?? 'text',
          unit: s.unit || def?.unit || '',
          higherIsBetter: def?.higherIsBetter ?? null,
          isMandatory: def?.isMandatory ?? false,
          isComparable: def?.isComparable ?? true,
          rawValue: s.rawValue,
          numericValue: s.numericValue,
          normalizedValue: s.normalizedValue,
          isConflicting: s.isConflicting,
          sourceNote: s.sourceNote,
        };
      });

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brandId: p.brandId,
      brandName: brand?.name ?? 'Unknown',
      categoryId: p.categoryId,
      categoryName: cat?.name ?? 'Unknown',
      categorySlug: cat?.slug ?? '',
      subcategoryId: p.subcategoryId,
      subcategoryName: sub?.name ?? null,
      description: p.description,
      modelNumber: p.modelNumber,
      variantLabel: p.variantLabel,
      basePrice: p.basePrice,
      currency: p.currency,
      stockQuantity: p.stockQuantity,
      taxRatePercent: p.taxRatePercent,
      isFeatured: p.isFeatured,
      availabilityStatus: p.availabilityStatus,
      status: p.status,
      rating: p.rating,
      reviewCount: p.reviewCount,
      popularityScore: p.popularityScore,
      model3dPreset: p.model3dPreset,
      model3dUrl: p.model3dUrl,
      finishHex: p.finishHex,
      isDemoData: p.isDemoData,
      dataSourceLabel: p.dataSourceLabel,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      primaryImage: primary?.url ?? '',
      images: pImgs.map((i) => ({
        id: i.id,
        url: i.url,
        altText: i.altText,
        isPrimary: i.isPrimary,
        sortOrder: i.sortOrder,
      })),
      specifications: pSpecs,
    };
  });
}

export async function queryProducts(filters: ProductQueryFilters): Promise<{
  items: ProductDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  try {
    await ensureSeeded();

    const conditions = [];
    if (!filters.includeInactive) {
      conditions.push(eq(products.status, 'ACTIVE'));
    }

    if (filters.categorySlug) {
      const [cat] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, filters.categorySlug))
        .limit(1);
      if (cat) {
        conditions.push(eq(products.categoryId, cat.id));
      } else {
        return { items: [], total: 0, page: 1, limit: filters.limit || 12, totalPages: 0 };
      }
    }

    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (filters.subcategoryId) {
      conditions.push(eq(products.subcategoryId, filters.subcategoryId));
    }
    if (filters.brandId) {
      conditions.push(eq(products.brandId, filters.brandId));
    }
    if (filters.minPrice !== undefined && Number.isFinite(filters.minPrice)) {
      conditions.push(gte(products.basePrice, filters.minPrice));
    }
    if (filters.maxPrice !== undefined && Number.isFinite(filters.maxPrice)) {
      conditions.push(lte(products.basePrice, filters.maxPrice));
    }
    if (filters.minRating !== undefined && Number.isFinite(filters.minRating)) {
      conditions.push(gte(products.rating, filters.minRating));
    }
    if (filters.availability) {
      conditions.push(eq(products.availabilityStatus, filters.availability));
    }

    if (filters.q && filters.q.trim() !== '') {
      const term = `%${filters.q.trim()}%`;
      const matchingBrands = await db
        .select({ id: brands.id })
        .from(brands)
        .where(ilike(brands.name, term));
      const brandIds = matchingBrands.map((b) => b.id);
      if (brandIds.length > 0) {
        conditions.push(
          or(
            ilike(products.name, term),
            ilike(products.modelNumber, term),
            ilike(products.description, term),
            inArray(products.brandId, brandIds)
          )
        );
      } else {
        conditions.push(
          or(
            ilike(products.name, term),
            ilike(products.modelNumber, term),
            ilike(products.description, term)
          )
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderClause = desc(products.popularityScore);
    if (filters.sort === 'price_asc') orderClause = asc(products.basePrice);
    else if (filters.sort === 'price_desc') orderClause = desc(products.basePrice);
    else if (filters.sort === 'rating') orderClause = desc(products.rating);

    const matchedRows = await db.select().from(products).where(whereClause).orderBy(orderClause);
    let hydrated = await hydrateProducts(matchedRows);

    // Spec filtering (in-memory over hydrated specs if specified)
    if (filters.specKey && filters.specValue) {
      const targetVal = filters.specValue.toLowerCase().trim();
      hydrated = hydrated.filter((p) =>
        p.specifications.some(
          (s) =>
            s.key === filters.specKey &&
            s.rawValue.toLowerCase().includes(targetVal)
        )
      );
    }

    // Value score sort: spec count + rating relative to price
    if (filters.sort === 'value') {
      hydrated.sort((a, b) => {
        const valA = ((a.rating ?? 4.0) * 20 + a.specifications.length * 4) / Math.max(100, a.basePrice);
        const valB = ((b.rating ?? 4.0) * 20 + b.specifications.length * 4) / Math.max(100, b.basePrice);
        return valB - valA;
      });
    }

    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(48, Math.max(1, filters.limit ?? 12));
    const total = hydrated.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paged = hydrated.slice(offset, offset + limit);

    return { items: paged, total, page, limit, totalPages };
  } catch (error) {
    console.error('Failed querying products:', error);
    throw new Error('Unable to search products right now.', { cause: error });
  }
}

export async function getProductsByIds(ids: number[]): Promise<ProductDTO[]> {
  try {
    await ensureSeeded();
    if (ids.length === 0) return [];
    const rows = await db.select().from(products).where(inArray(products.id, ids));
    const hydrated = await hydrateProducts(rows);
    // Preserve input ID order
    const map = new Map(hydrated.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is ProductDTO => Boolean(p));
  } catch (error) {
    console.error('Failed loading products by IDs:', error);
    throw new Error('Unable to retrieve requested products.', { cause: error });
  }
}

export async function getProductDetail(idOrSlug: string): Promise<ProductDTO | null> {
  try {
    await ensureSeeded();
    const numericId = Number(idOrSlug);
    const [row] = Number.isInteger(numericId) && numericId > 0
      ? await db.select().from(products).where(eq(products.id, numericId)).limit(1)
      : await db.select().from(products).where(eq(products.slug, idOrSlug)).limit(1);

    if (!row) return null;
    const [hydrated] = await hydrateProducts([row]);

    const offerRows = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.productId, row.id))
      .orderBy(asc(productOffers.price));
    const allSellers = await db.select().from(sellers);
    const sellerMap = new Map(allSellers.map((s) => [s.id, s]));

    const offers: ProductOfferDTO[] = offerRows.map((o) => {
      const seller = sellerMap.get(o.sellerId);
      const totals = computeOfferTotals({
        price: o.price,
        deliveryCharge: o.deliveryCharge,
        installationCharge: o.installationCharge,
        warrantyCost: o.warrantyCost,
        requiredAccessoriesCost: o.requiredAccessoriesCost,
        additionalFees: o.additionalFees,
      });
      return {
        id: o.id,
        sellerId: o.sellerId,
        sellerName: seller?.name ?? 'Merchant',
        sellerWebsite: seller?.website ?? '',
        isAuthorizedApi: seller?.isAuthorizedApi ?? false,
        price: o.price,
        currency: o.currency,
        deliveryCharge: o.deliveryCharge,
        installationCharge: o.installationCharge,
        warrantyCost: o.warrantyCost,
        requiredAccessoriesCost: o.requiredAccessoriesCost,
        additionalFees: o.additionalFees,
        additionalFeesNote: o.additionalFeesNote,
        estimatedTotalCost: totals.estimatedTotalCost,
        hasMissingCostInfo: totals.hasMissingCostInfo,
        missingCostFields: totals.missingCostFields,
        availabilityStatus: o.availabilityStatus,
        offerUrl: o.offerUrl,
        dataSource: o.dataSource,
        lastVerifiedAt: o.lastVerifiedAt.toISOString(),
      };
    });

    const obsRows = await db
      .select()
      .from(priceObservations)
      .where(eq(priceObservations.productId, row.id));
    const lowestRecordedPrice =
      obsRows.length >= 2 ? Math.min(...obsRows.map((o) => o.price)) : null;

    return {
      ...hydrated,
      offers,
      lowestRecordedPrice,
    };
  } catch (error) {
    console.error('Failed getting product detail:', error);
    throw new Error('Unable to load product details.', { cause: error });
  }
}

export async function getProductPriceHistory(productId: number): Promise<{
  observations: PriceObservationDTO[];
  lowestPrice: number | null;
  highestPrice: number | null;
  latestPrice: number | null;
  priceChangeAmount: number | null;
  priceChangePercent: number | null;
}> {
  try {
    await ensureSeeded();
    const obsRows = await db
      .select()
      .from(priceObservations)
      .where(eq(priceObservations.productId, productId))
      .orderBy(asc(priceObservations.observedAt));

    const allSellers = await db.select().from(sellers);
    const sellerMap = new Map(allSellers.map((s) => [s.id, s]));

    const observations: PriceObservationDTO[] = obsRows.map((o) => ({
      id: o.id,
      productId: o.productId,
      sellerId: o.sellerId,
      sellerName: sellerMap.get(o.sellerId)?.name ?? 'Merchant',
      price: o.price,
      currency: o.currency,
      sourceLabel: o.sourceLabel,
      isDemoData: o.isDemoData,
      observedAt: o.observedAt.toISOString(),
    }));

    if (observations.length === 0) {
      return {
        observations: [],
        lowestPrice: null,
        highestPrice: null,
        latestPrice: null,
        priceChangeAmount: null,
        priceChangePercent: null,
      };
    }

    const prices = observations.map((o) => o.price);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const firstPrice = observations[0].price;
    const latestPrice = observations[observations.length - 1].price;
    const priceChangeAmount = Number((latestPrice - firstPrice).toFixed(2));
    const priceChangePercent =
      firstPrice > 0 ? Number(((priceChangeAmount / firstPrice) * 100).toFixed(1)) : null;

    return {
      observations,
      lowestPrice,
      highestPrice,
      latestPrice,
      priceChangeAmount,
      priceChangePercent,
    };
  } catch (error) {
    console.error('Failed loading price history:', error);
    throw new Error('Unable to load price history observations.', { cause: error });
  }
}

export async function getSpecDefinitionsByCategory(categoryId: number): Promise<SpecDefinitionDTO[]> {
  try {
    const defs = await db
      .select()
      .from(specificationDefinitions)
      .where(eq(specificationDefinitions.categoryId, categoryId))
      .orderBy(asc(specificationDefinitions.sortOrder));

    return defs.map((d) => ({
      id: d.id,
      categoryId: d.categoryId,
      key: d.key,
      label: d.label,
      dataType: d.dataType as SpecDataType,
      unit: d.unit,
      higherIsBetter: d.higherIsBetter,
      isMandatory: d.isMandatory,
      isComparable: d.isComparable,
      enumValues: JSON.parse(d.enumValuesJson || '[]'),
      weight: d.weight,
      sortOrder: d.sortOrder,
    }));
  } catch (error) {
    console.error('Failed loading spec definitions:', error);
    throw new Error('Unable to load specification definitions.', { cause: error });
  }
}
