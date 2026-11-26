import type { DataQualityIssue } from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import {
  categories,
  productOffers,
  products,
  productSpecifications,
  specificationDefinitions,
} from '../../src/db/schema.ts';
import { ensureSeeded } from '../../src/db/seed.ts';

export async function runDataQualityAudit(): Promise<{
  summary: {
    totalProducts: number;
    totalIssues: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    healthScore: number;
  };
  issues: DataQualityIssue[];
}> {
  try {
    await ensureSeeded();
    const [allProds, allCats, allDefs, allSpecs, allOffers] = await Promise.all([
      db.select().from(products),
      db.select().from(categories),
      db.select().from(specificationDefinitions),
      db.select().from(productSpecifications),
      db.select().from(productOffers),
    ]);

    const catMap = new Map(allCats.map((c) => [c.id, c]));
    const issues: DataQualityIssue[] = [];

    // 1. Missing mandatory specifications & 4. Inconsistent units & 5. Conflicting specs
    for (const prod of allProds) {
      const cat = catMap.get(prod.categoryId);
      const catName = cat?.name ?? 'Unknown';
      const mandatoryDefs = allDefs.filter((d) => d.categoryId === prod.categoryId && d.isMandatory);
      const prodSpecs = allSpecs.filter((s) => s.productId === prod.id);

      for (const def of mandatoryDefs) {
        const match = prodSpecs.find((s) => s.specDefinitionId === def.id);
        if (!match || !match.rawValue.trim()) {
          issues.push({
            id: `missing-${prod.id}-${def.id}`,
            severity: 'HIGH',
            issueType: 'MISSING_MANDATORY_SPEC',
            entityType: 'PRODUCT',
            entityId: prod.id,
            productId: prod.id,
            productName: prod.name,
            categoryName: catName,
            description: `Missing mandatory specification "${def.label}".`,
            suggestedAction: `Add a verified value for ${def.label} in Product Management.`,
          });
        }
      }

      for (const sp of prodSpecs) {
        const def = allDefs.find((d) => d.id === sp.specDefinitionId);
        if (sp.isConflicting) {
          issues.push({
            id: `conflict-${sp.id}`,
            severity: 'MEDIUM',
            issueType: 'CONFLICTING_SPEC',
            entityType: 'SPECIFICATION',
            entityId: sp.id,
            productId: prod.id,
            productName: prod.name,
            categoryName: catName,
            description: `Conflicting source values recorded for "${def?.label || 'Specification'}": ${sp.sourceNote || sp.rawValue}.`,
            suggestedAction: 'Review source documentation and clear conflict flag once verified.',
          });
        }
        if (
          def &&
          def.unit &&
          sp.unit &&
          def.unit.toLowerCase() !== sp.unit.toLowerCase() &&
          sp.normalizedValue === null
        ) {
          issues.push({
            id: `unit-${sp.id}`,
            severity: 'LOW',
            issueType: 'INCONSISTENT_UNIT',
            entityType: 'SPECIFICATION',
            entityId: sp.id,
            productId: prod.id,
            productName: prod.name,
            categoryName: catName,
            description: `Specification "${def.label}" uses "${sp.unit}" while category standard is "${def.unit}" without normalized value.`,
            suggestedAction: `Normalize value to "${def.unit}" for accurate comparisons.`,
          });
        }
      }

      // 3. Invalid prices
      if (prod.basePrice <= 0) {
        issues.push({
          id: `price-${prod.id}`,
          severity: 'HIGH',
          issueType: 'INVALID_PRICE',
          entityType: 'PRODUCT',
          entityId: prod.id,
          productId: prod.id,
          productName: prod.name,
          categoryName: catName,
          description: `Base price (${prod.basePrice}) must be greater than zero.`,
          suggestedAction: 'Update base price to a valid positive amount.',
        });
      }
    }

    // 2. Duplicate products (by modelNumber or slug/name)
    const seenModels = new Map<string, typeof allProds[0]>();
    for (const prod of allProds) {
      const key = `${prod.brandId}:${prod.modelNumber.toLowerCase().trim()}`;
      const existing = seenModels.get(key);
      if (existing) {
        issues.push({
          id: `dup-${prod.id}`,
          severity: 'HIGH',
          issueType: 'DUPLICATE_PRODUCT',
          entityType: 'PRODUCT',
          entityId: prod.id,
          productId: prod.id,
          productName: prod.name,
          categoryName: catMap.get(prod.categoryId)?.name ?? 'Unknown',
          description: `Model number "${prod.modelNumber}" duplicates existing product "${existing.name}" (#${existing.id}).`,
          suggestedAction: 'Merge or archive duplicate catalog entry.',
        });
      } else {
        seenModels.set(key, prod);
      }
    }

    // 6. Outdated price observations (> 60 days)
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const prodMap = new Map(allProds.map((p) => [p.id, p]));

    for (const offer of allOffers) {
      if (offer.price <= 0) {
        const p = prodMap.get(offer.productId);
        issues.push({
          id: `offer-price-${offer.id}`,
          severity: 'HIGH',
          issueType: 'INVALID_PRICE',
          entityType: 'OFFER',
          entityId: offer.id,
          productId: offer.productId,
          productName: p?.name ?? `Product #${offer.productId}`,
          categoryName: p ? catMap.get(p.categoryId)?.name ?? 'Unknown' : 'Unknown',
          description: `Seller offer #${offer.id} has non-positive price (${offer.price}).`,
          suggestedAction: 'Correct or remove invalid seller offer.',
        });
      }
      if (now - offer.lastVerifiedAt.getTime() > sixtyDaysMs) {
        const p = prodMap.get(offer.productId);
        const daysOld = Math.round((now - offer.lastVerifiedAt.getTime()) / (24 * 60 * 60 * 1000));
        issues.push({
          id: `outdated-${offer.id}`,
          severity: 'MEDIUM',
          issueType: 'OUTDATED_PRICE',
          entityType: 'OFFER',
          entityId: offer.id,
          productId: offer.productId,
          productName: p?.name ?? `Product #${offer.productId}`,
          categoryName: p ? catMap.get(p.categoryId)?.name ?? 'Unknown' : 'Unknown',
          description: `Seller offer price has not been verified in ${daysOld} days.`,
          suggestedAction: 'Verify current seller pricing and log a fresh price observation.',
        });
      }
    }

    const highSeverity = issues.filter((i) => i.severity === 'HIGH').length;
    const mediumSeverity = issues.filter((i) => i.severity === 'MEDIUM').length;
    const lowSeverity = issues.filter((i) => i.severity === 'LOW').length;
    const penalty = highSeverity * 8 + mediumSeverity * 4 + lowSeverity * 2;
    const healthScore = Math.max(40, Math.min(100, 100 - penalty));

    return {
      summary: {
        totalProducts: allProds.length,
        totalIssues: issues.length,
        highSeverity,
        mediumSeverity,
        lowSeverity,
        healthScore,
      },
      issues,
    };
  } catch (error) {
    console.error('Data quality audit failed:', error);
    throw new Error('Failed to generate data quality report.', { cause: error });
  }
}
