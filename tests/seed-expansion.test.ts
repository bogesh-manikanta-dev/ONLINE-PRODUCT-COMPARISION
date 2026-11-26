/**
 * Phase 4 catalogue expansion — validation tests.
 *
 * These tests are deliberately database-free: they import the expansion module
 * and cross-check it against the entity definitions declared in
 * `src/db/seed.ts`. That keeps the catalogue verifiable in CI (and in this
 * workspace, where no PostgreSQL instance is configured) while still proving
 * that every new product points at a real brand, category, subcategory and
 * specification definition.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_NUMERIC_SPEC_KEYS,
  CATEGORY_SPEC_KEYS,
  EXPANSION_CATEGORIES,
  EXPANSION_PRODUCTS,
  EXPANSION_SPEC_DEFS,
  EXPANSION_SUBCATEGORIES,
} from '../src/db/catalog/expansion.ts';

/** Values that are legitimately not numeric for a numeric-typed specification. */
const ALLOWED_NON_NUMERIC = new Set(['Corded (continuous)']);

const seedSource = readFileSync(path.resolve(process.cwd(), 'src/db/seed.ts'), 'utf8');

/** Extracts the literal body of a top-level `const <anchor>` array in seed.ts. */
function seedArrayBody(anchor: string): string {
  const start = seedSource.indexOf(anchor);
  if (start === -1) throw new Error(`anchor "${anchor}" is missing from src/db/seed.ts`);
  const end = seedSource.indexOf('];', start);
  if (end === -1) throw new Error(`array for "${anchor}" is not terminated in src/db/seed.ts`);
  return seedSource.slice(start, end);
}

function uniqueValues(chunk: string, pattern: RegExp): Set<string> {
  const values = new Set<string>();
  for (const match of chunk.matchAll(pattern)) values.add(match[1]);
  return values;
}

const brandSlugs = uniqueValues(seedArrayBody('const brandInputs'), /slug:\s*'([^']+)'/g);
const categorySlugs = new Set([
  ...uniqueValues(seedArrayBody('const categoryInputs'), /slug:\s*'([^']+)'/g),
  ...EXPANSION_CATEGORIES.map((category) => category.slug),
]);
const subcategoryPairs = new Set<string>();
for (const match of seedArrayBody('const subInputs').matchAll(/cat:\s*'([^']+)'[^}]*?slug:\s*'([^']+)'/g)) {
  subcategoryPairs.add(`${match[1]}/${match[2]}`);
}
for (const sub of EXPANSION_SUBCATEGORIES) subcategoryPairs.add(`${sub.cat}/${sub.slug}`);

const specKeysByCategory = new Map<string, Set<string>>();
for (const match of seedArrayBody('const specDefsInput').matchAll(
  /categorySlug:\s*'([^']+)',\s*key:\s*'([^']+)'/g,
)) {
  const [, categorySlug, key] = match;
  if (!specKeysByCategory.has(categorySlug)) specKeysByCategory.set(categorySlug, new Set());
  specKeysByCategory.get(categorySlug)!.add(key);
}
for (const def of EXPANSION_SPEC_DEFS) {
  if (!specKeysByCategory.has(def.categorySlug)) specKeysByCategory.set(def.categorySlug, new Set());
  specKeysByCategory.get(def.categorySlug)!.add(def.key);
}

// Products already shipped by the Phase 3 catalogue. Parsed from the literal
// array so a new product can never silently upsert over an existing record
// (the seeder upserts products by slug).
const legacyProductRegion = seedSource.slice(
  seedSource.indexOf('const phase3Products'),
  seedSource.indexOf('...EXPANSION_PRODUCTS'),
);
const legacyProductSlugs = uniqueValues(legacyProductRegion, /^ {6}slug: '([^']+)'/gm);
const legacyCountByCategory = new Map<string, number>();
for (const match of legacyProductRegion.matchAll(/^ {6}categorySlug: '([^']+)'/gm)) {
  legacyCountByCategory.set(match[1], (legacyCountByCategory.get(match[1]) ?? 0) + 1);
}

/** Categories that shipped with a single product and could not be compared. */
const THIN_CATEGORIES: string[] = ['bags', 'vacuum-cleaners', 'air-purifiers'];

describe('catalogue expansion — dataset shape', () => {
  it('adds a meaningful number of products (additive only)', () => {
    // P2 added 19; the coverage correction added 3 more (Bags, Vacuum Cleaners
    // and Air Purifiers). The lower bound guards against accidental deletions.
    expect(EXPANSION_PRODUCTS.length).toBeGreaterThanOrEqual(14);
  });

  it('uses unique, URL-safe slugs and unique product names', () => {
    const slugs = EXPANSION_PRODUCTS.map((product) => product.slug);
    const names = EXPANSION_PRODUCTS.map((product) => product.name);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(names).size).toBe(names.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('does not collide with any product already in the catalogue', () => {
    // The seeder upserts products by slug, so a collision would overwrite an
    // existing row instead of adding a product.
    expect(legacyProductSlugs.size, 'existing products must be preserved').toBeGreaterThanOrEqual(31);
    for (const product of EXPANSION_PRODUCTS) {
      expect(legacyProductSlugs.has(product.slug), `${product.slug} collides with an existing product`).toBe(false);
    }
    expect(legacyProductSlugs.size + EXPANSION_PRODUCTS.length, 'total unique products').toBeGreaterThanOrEqual(45);
  });

  it('gives every previously thin category a second comparable product', () => {
    // Bags, Vacuum Cleaners and Air Purifiers each shipped with exactly one
    // product, so the comparison engine had nothing to compare. Every one of
    // them must now hold at least two products, without losing the original.
    for (const category of THIN_CATEGORIES) {
      const added = EXPANSION_PRODUCTS.filter((product) => product.categorySlug === category);
      expect(added.length, `${category} gained at least one new product`).toBeGreaterThanOrEqual(1);
      const legacyCount = legacyCountByCategory.get(category) ?? 0;
      expect(legacyCount, `${category} existing products are preserved`).toBeGreaterThanOrEqual(1);
      expect(legacyCount + added.length, `${category} is now comparable`).toBeGreaterThanOrEqual(2);
    }
  });

  it('adds quality-checked products to the thin categories', () => {
    const added = EXPANSION_PRODUCTS.filter((product) => THIN_CATEGORIES.includes(product.categorySlug));
    expect(added.length, 'one addition per thin category').toBeGreaterThanOrEqual(3);

    const slugs = added.map((product) => product.slug);
    const models = added.map((product) => product.modelNumber);
    expect(new Set(slugs).size, 'unique slugs').toBe(slugs.length);
    expect(new Set(models).size, 'unique model numbers').toBe(models.length);

    for (const product of added) {
      expect(legacyProductSlugs.has(product.slug), `${product.slug} must not reuse a legacy slug`).toBe(false);
      expect(product.basePrice, `${product.slug} price`).toBeGreaterThan(0);
      expect(product.description.length, `${product.slug} description`).toBeGreaterThan(60);
      // Comparable specifications: every key registered for the category must
      // be present, otherwise the comparison engine silently loses an attribute.
      for (const key of CATEGORY_SPEC_KEYS[product.categorySlug] ?? []) {
        expect(product.specs[key], `${product.slug} is missing the "${key}" specification`).toBeDefined();
      }
    }
  });

  it('never fabricates ratings or customer reviews', () => {
    for (const product of EXPANSION_PRODUCTS) {
      expect(product.rating, `${product.slug} rating`).toBe(0);
      expect(product.reviewCount, `${product.slug} reviewCount`).toBe(0);
    }
  });

  it('has commercially sensible price, stock and availability values', () => {
    for (const product of EXPANSION_PRODUCTS) {
      expect(product.basePrice, `${product.slug} price`).toBeGreaterThan(0);
      expect(Number.isInteger(product.basePrice), `${product.slug} price is integral`).toBe(true);
      expect(product.stockQuantity, `${product.slug} stock`).toBeGreaterThanOrEqual(0);
      expect(product.taxRatePercent, `${product.slug} tax`).toBeGreaterThan(0);
      expect(product.taxRatePercent, `${product.slug} tax`).toBeLessThanOrEqual(28);
      expect(['IN_STOCK', 'LIMITED'], `${product.slug} availability`).toContain(product.availabilityStatus);
      expect(product.description.length, `${product.slug} description`).toBeGreaterThan(60);
      expect(product.primaryImage, `${product.slug} image`).toMatch(/^\/.+\.(jpg|png|webp)$/);
      expect(product.secondaryImage, `${product.slug} image`).toMatch(/^\/.+\.(jpg|png|webp)$/);
    }
  });
});

describe('catalogue expansion — relational integrity', () => {
  it('references only brands that exist in the seed', () => {
    expect(brandSlugs.size).toBeGreaterThanOrEqual(26);
    for (const product of EXPANSION_PRODUCTS) {
      expect(brandSlugs.has(product.brandSlug), `${product.slug} -> brand ${product.brandSlug}`).toBe(true);
    }
  });

  it('references only categories and subcategories that exist in the seed', () => {
    for (const product of EXPANSION_PRODUCTS) {
      expect(categorySlugs.has(product.categorySlug), `${product.slug} -> category`).toBe(true);
      expect(
        subcategoryPairs.has(`${product.categorySlug}/${product.subcategorySlug}`),
        `${product.slug} -> subcategory ${product.categorySlug}/${product.subcategorySlug}`,
      ).toBe(true);
    }
  });

  it('registers a specification definition for every specification it stores', () => {
    for (const product of EXPANSION_PRODUCTS) {
      const registered = specKeysByCategory.get(product.categorySlug);
      expect(registered, `${product.categorySlug} has spec definitions`).toBeDefined();
      for (const key of Object.keys(product.specs)) {
        expect(registered!.has(key), `${product.slug} spec "${key}" is registered`).toBe(true);
      }
    }
  });
});

describe('catalogue expansion — comparability', () => {
  it('stores the full comparable specification set for its category', () => {
    for (const product of EXPANSION_PRODUCTS) {
      const contract = CATEGORY_SPEC_KEYS[product.categorySlug];
      expect(contract, `${product.categorySlug} has a spec contract`).toBeDefined();
      expect(Object.keys(product.specs).sort(), `${product.slug} spec keys`).toEqual([...contract].sort());
    }
  });

  it('provides parseable numeric values for comparable numeric specifications', () => {
    for (const product of EXPANSION_PRODUCTS) {
      const numericKeys = CATEGORY_NUMERIC_SPEC_KEYS[product.categorySlug] ?? [];
      for (const key of numericKeys) {
        const raw = product.specs[key];
        expect(raw, `${product.slug} has numeric spec "${key}"`).toBeDefined();
        expect(raw.trim().length, `${product.slug} "${key}" is non-empty`).toBeGreaterThan(0);
        if (ALLOWED_NON_NUMERIC.has(raw)) continue;
        const digitsOnly = raw.replace(/,/g, '');
        const leading = digitsOnly.match(/-?\d+(?:\.\d+)?/);
        expect(leading, `${product.slug} "${key}" (${raw}) must start with a measurable number`).not.toBeNull();
        const value = Number(leading![0]);
        expect(Number.isFinite(value), `${product.slug} "${key}" is finite`).toBe(true);
        expect(value, `${product.slug} "${key}" is non-negative`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('covers every required category area with at least one new product', () => {
    const covered = new Set(EXPANSION_PRODUCTS.map((product) => product.categorySlug));
    const required: Record<string, string[]> = {
      smartphones: ['smartphones'],
      laptops: ['laptops'],
      televisions: ['televisions'],
      'headphones & audio': ['headphones'],
      smartwatches: ['smartwatches'],
      'home appliances': ['refrigerators', 'washing-machines', 'air-conditioners', 'microwaves'],
      fashion: ['footwear', 'clothing', 'bags', 'watches'],
      furniture: ['furniture'],
      kitchen: ['kitchen-appliances'],
      'personal care': ['personal-care'],
    };
    for (const [area, categories] of Object.entries(required)) {
      expect(categories.some((category) => covered.has(category)), `${area} coverage`).toBe(true);
    }
  });

  it('introduces at least two products per new category it creates', () => {
    for (const category of EXPANSION_CATEGORIES) {
      const count = EXPANSION_PRODUCTS.filter((product) => product.categorySlug === category.slug).length;
      expect(count, `${category.slug} product count`).toBeGreaterThanOrEqual(2);
    }
  });
});
