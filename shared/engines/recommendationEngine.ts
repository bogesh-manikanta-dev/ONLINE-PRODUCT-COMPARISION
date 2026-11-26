import type {
  CategoryDTO,
  ProductDTO,
  RecommendationCriteriaInput,
  RecommendationResponseDTO,
  RecommendationResultItem,
  SpecDefinitionDTO,
} from '../types.ts';
import { normalizeNumericSpec } from './comparisonEngine.ts';

const USAGE_KEY_BOOSTS: Record<string, string[]> = {
  gaming: ['graphics', 'processor', 'ram', 'refresh_rate', 'cooling'],
  creative_work: ['processor', 'ram', 'display', 'storage', 'color_accuracy'],
  student_portable: ['battery', 'weight', 'storage', 'ram'],
  business_travel: ['battery', 'weight', 'processor', 'connectivity'],
  photography: ['camera', 'storage', 'display', 'battery'],
  daily_commute: ['battery', 'anc', 'weight', 'bluetooth'],
  family_household: ['capacity', 'energy_rating', 'annual_energy', 'doors'],
  energy_efficiency: ['energy_rating', 'annual_energy', 'cooling_tech'],
  everyday_value: ['battery', 'storage', 'material', 'warranty'],
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatMoney(amount: number, currency = 'INR'): string {
  const sym = currency === 'INR' ? '₹' : '$';
  const loc = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${sym}${Math.round(amount).toLocaleString(loc)}`;
}

export function generateRecommendations(
  allCategoryProducts: ProductDTO[],
  category: CategoryDTO,
  specDefinitions: SpecDefinitionDTO[],
  criteria: RecommendationCriteriaInput
): RecommendationResponseDTO {
  const activeProducts = allCategoryProducts.filter((p) => p.status === 'ACTIVE');
  const filteredOutReasons: Array<{ productId: number; productName: string; reason: string }> = [];
  const candidates: ProductDTO[] = [];

  for (const product of activeProducts) {
    // Hard filter 1: Availability check if discontinued
    if (product.availabilityStatus === 'DISCONTINUED') {
      filteredOutReasons.push({
        productId: product.id,
        productName: product.name,
        reason: 'Product status is Discontinued.',
      });
      continue;
    }

    // Hard filter 2: Severe budget overflow (>25% above budgetMax) or below budgetMin
    if (criteria.budgetMin && product.basePrice < criteria.budgetMin) {
      filteredOutReasons.push({
        productId: product.id,
        productName: product.name,
        reason: `Base price (${formatMoney(product.basePrice, product.currency)}) is below minimum budget (${formatMoney(criteria.budgetMin, product.currency)}).`,
      });
      continue;
    }
    if (product.basePrice > criteria.budgetMax * 1.25) {
      filteredOutReasons.push({
        productId: product.id,
        productName: product.name,
        reason: `Base price (${formatMoney(product.basePrice, product.currency)}) exceeds maximum budget (${formatMoney(criteria.budgetMax, product.currency)}) by more than 25%.`,
      });
      continue;
    }

    // Hard filter 3: Mandatory specification rules provided by the user
    let failedReq: string | null = null;
    for (const reqSpec of criteria.requiredSpecs || []) {
      const def = specDefinitions.find((d) => d.key === reqSpec.key);
      const spec = product.specifications.find((s) => s.key === reqSpec.key);
      if (!spec || !spec.rawValue) {
        failedReq = `Missing required specification: ${def?.label || reqSpec.key}`;
        break;
      }

      if (reqSpec.operator === 'gte' || reqSpec.operator === 'lte') {
        const targetNum = Number(reqSpec.value);
        const norm =
          spec.normalizedValue ??
          normalizeNumericSpec(spec.rawValue, spec.unit || def?.unit || '', def?.unit || '').normalizedValue;
        if (norm === null || !Number.isFinite(targetNum)) {
          failedReq = `Could not verify numeric threshold for ${def?.label || reqSpec.key}`;
          break;
        }
        if (reqSpec.operator === 'gte' && norm < targetNum) {
          failedReq = `${def?.label || reqSpec.key} (${spec.rawValue}) is below required ${targetNum}${def?.unit ? ' ' + def.unit : ''}`;
          break;
        }
        if (reqSpec.operator === 'lte' && norm > targetNum) {
          failedReq = `${def?.label || reqSpec.key} (${spec.rawValue}) exceeds maximum ${targetNum}${def?.unit ? ' ' + def.unit : ''}`;
          break;
        }
      } else if (reqSpec.operator === 'eq') {
        const expected = String(reqSpec.value).toLowerCase().trim();
        if (!spec.rawValue.toLowerCase().includes(expected)) {
          failedReq = `${def?.label || reqSpec.key} (${spec.rawValue}) does not match "${reqSpec.value}"`;
          break;
        }
      }
    }

    if (failedReq) {
      filteredOutReasons.push({
        productId: product.id,
        productName: product.name,
        reason: failedReq,
      });
      continue;
    }

    candidates.push(product);
  }

  // Compute min/max per comparable numeric specification across candidates for fair normalization
  const comparableDefs = specDefinitions.filter((d) => d.isComparable);
  const ranges = new Map<number, { min: number; max: number }>();

  for (const def of comparableDefs) {
    if (def.dataType !== 'numeric') continue;
    const vals: number[] = [];
    for (const p of candidates) {
      const s = p.specifications.find((sp) => sp.specDefinitionId === def.id || sp.key === def.key);
      if (!s) continue;
      const n =
        s.normalizedValue ??
        normalizeNumericSpec(s.rawValue, s.unit || def.unit, def.unit).normalizedValue;
      if (n !== null) vals.push(n);
    }
    if (vals.length > 0) {
      ranges.set(def.id, { min: Math.min(...vals), max: Math.max(...vals) });
    }
  }

  // Normalize user priority weights so they sum to 1.0
  const pPerf = Math.max(0, criteria.priorities.performance);
  const pVal = Math.max(0, criteria.priorities.value);
  const pEff = Math.max(0, criteria.priorities.efficiency);
  const pRel = Math.max(0, criteria.priorities.reliability);
  const totalWeight = pPerf + pVal + pEff + pRel || 1;
  const wPerf = pPerf / totalWeight;
  const wVal = pVal / totalWeight;
  const wEff = pEff / totalWeight;
  const wRel = pRel / totalWeight;

  const usageBoostKeys = USAGE_KEY_BOOSTS[criteria.intendedUsage] || [];
  const importantSet = new Set((criteria.importantFeatures || []).map((k) => k.toLowerCase()));

  const scored: RecommendationResultItem[] = candidates.map((product) => {
    const strengths: string[] = [];
    const limitations: string[] = [];
    const missingDataNotes: string[] = [];

    // 1. Specification Match Score (0-100)
    let specScoreWeightedSum = 0;
    let specWeightTotal = 0;
    let presentCount = 0;

    for (const def of comparableDefs) {
      const spec = product.specifications.find(
        (s) => s.specDefinitionId === def.id || s.key === def.key
      );
      const isUsageBoosted =
        usageBoostKeys.some((k) => def.key.includes(k)) ||
        importantSet.has(def.key.toLowerCase()) ||
        importantSet.has(def.label.toLowerCase());
      const effectiveWeight = def.weight * (isUsageBoosted ? 1.5 : 1.0);

      if (!spec || !spec.rawValue) {
        if (def.isMandatory) {
          missingDataNotes.push(`Missing mandatory attribute: ${def.label}`);
        } else {
          missingDataNotes.push(`Unrecorded attribute: ${def.label}`);
        }
        // Do NOT treat missing data as 0 for the spec itself; track transparently in dataCompleteness
        continue;
      }

      presentCount++;
      specWeightTotal += effectiveWeight;

      if (def.dataType === 'numeric' && def.higherIsBetter !== null) {
        const range = ranges.get(def.id);
        const val =
          spec.normalizedValue ??
          normalizeNumericSpec(spec.rawValue, spec.unit || def.unit, def.unit).normalizedValue;
        if (val !== null && range && range.max > range.min) {
          const ratio = (val - range.min) / (range.max - range.min);
          const itemScore = (def.higherIsBetter ? ratio : 1 - ratio) * 100;
          specScoreWeightedSum += itemScore * effectiveWeight;
          if (itemScore >= 80) {
            strengths.push(`Strong ${def.label} (${spec.rawValue})`);
          } else if (itemScore <= 25) {
            limitations.push(`Lower ${def.label} (${spec.rawValue}) relative to peers`);
          }
        } else {
          specScoreWeightedSum += 70 * effectiveWeight;
        }
      } else if (def.dataType === 'boolean') {
        const truthy = ['yes', 'true', '1', 'supported'].includes(spec.rawValue.toLowerCase().trim());
        const itemScore = truthy ? 95 : 40;
        specScoreWeightedSum += itemScore * effectiveWeight;
        if (truthy && isUsageBoosted) {
          strengths.push(`Includes ${def.label}`);
        }
      } else {
        specScoreWeightedSum += 72 * effectiveWeight;
      }
    }

    const specificationMatch =
      specWeightTotal > 0 ? clamp(Math.round(specScoreWeightedSum / specWeightTotal), 0, 100) : 50;

    // 2. Budget & Value Score (0-100)
    let budgetSuitability: RecommendationResultItem['budgetSuitability'] = 'OPTIMAL_FIT';
    let budgetValue = 80;
    if (product.basePrice <= criteria.budgetMax * 0.75) {
      budgetSuitability = 'UNDER_BUDGET';
      budgetValue = 92;
      strengths.push(`Well within budget (${formatMoney(product.basePrice, product.currency)} vs. ${formatMoney(criteria.budgetMax, product.currency)} max)`);
    } else if (product.basePrice <= criteria.budgetMax) {
      budgetSuitability = 'OPTIMAL_FIT';
      const headroom = (criteria.budgetMax - product.basePrice) / criteria.budgetMax;
      budgetValue = clamp(Math.round(78 + headroom * 60), 75, 95);
    } else {
      budgetSuitability = 'STRETCH';
      const overageRatio = (product.basePrice - criteria.budgetMax) / criteria.budgetMax;
      budgetValue = clamp(Math.round(62 - overageRatio * 120), 25, 65);
      limitations.push(
        `Stretch price: ${formatMoney(product.basePrice, product.currency)} is ${(overageRatio * 100).toFixed(0)}% above target budget`
      );
    }

    // Factor in feature-to-price ratio
    budgetValue = clamp(Math.round(budgetValue * 0.65 + specificationMatch * 0.35), 0, 100);

    // 3. Usage Alignment Score (0-100)
    let usageHits = 0;
    for (const keyFrag of usageBoostKeys) {
      const matched = product.specifications.find((s) => s.key.includes(keyFrag));
      if (matched) usageHits++;
    }
    const usageAlignment =
      usageBoostKeys.length > 0
        ? clamp(Math.round(55 + (usageHits / usageBoostKeys.length) * 45), 40, 100)
        : 75;

    // 4. Data Completeness & Reliability Score (0-100)
    const dataCompleteness =
      comparableDefs.length > 0
        ? Math.round((presentCount / comparableDefs.length) * 100)
        : 100;
    const ratingFactor = product.rating !== null ? (product.rating / 5) * 100 : 70;
    const reliabilityComposite = Math.round(dataCompleteness * 0.45 + ratingFactor * 0.55);

    if (product.rating === null) {
      missingDataNotes.push('No verified consumer rating recorded; reliability weighted toward spec completeness.');
    }

    // 5. Brand Preference
    const brandPreference = criteria.preferredBrandId
      ? product.brandId === criteria.preferredBrandId
        ? 100
        : 50
      : 75;
    if (criteria.preferredBrandId && product.brandId === criteria.preferredBrandId) {
      strengths.push(`Matches preferred brand (${product.brandName})`);
    }

    // Composite Weighted Score
    const weightedComposite =
      specificationMatch * wPerf +
      budgetValue * wVal +
      usageAlignment * wEff +
      reliabilityComposite * wRel;

    const brandAdjustment = criteria.preferredBrandId
      ? product.brandId === criteria.preferredBrandId
        ? 4
        : -2
      : 0;
    const missingPenalty = missingDataNotes.length > 2 ? -3 : 0;

    const overallScore = clamp(Math.round(weightedComposite + brandAdjustment + missingPenalty), 0, 100);

    const keyDifferences: string[] = [];
    for (const def of comparableDefs.slice(0, 4)) {
      const sp = product.specifications.find((s) => s.specDefinitionId === def.id);
      if (sp) {
        keyDifferences.push(`${def.label}: ${sp.rawValue}`);
      }
    }

    const explanation = `${product.name} scored ${overallScore}/100 for ${criteria.intendedUsage.replace(/_/g, ' ')} under your priority weights (Performance ${Math.round(wPerf * 100)}%, Value ${Math.round(wVal * 100)}%, Efficiency/Usage ${Math.round(wEff * 100)}%, Reliability ${Math.round(wRel * 100)}%). Specification coverage is ${dataCompleteness}%, and base price (${formatMoney(product.basePrice, product.currency)}) is ${budgetSuitability.toLowerCase().replace(/_/g, ' ')}.`;

    return {
      product,
      rank: 0,
      overallScore,
      criterionScores: {
        specificationMatch,
        budgetValue,
        usageAlignment,
        dataCompleteness,
        brandPreference,
      },
      budgetSuitability,
      strengths: strengths.slice(0, 4),
      limitations: limitations.slice(0, 4),
      missingDataNotes,
      keyDifferences,
      explanation,
    };
  });

  scored.sort((a, b) => b.overallScore - a.overallScore);
  scored.forEach((item, index) => {
    item.rank = index + 1;
  });

  return {
    category,
    disclaimer:
      'CompareX scores reflect your selected budget, intended usage, priority weights, and currently recorded demonstration specifications. No single product is objectively best for every consumer.',
    totalEvaluated: activeProducts.length,
    filteredOutCount: filteredOutReasons.length,
    filteredOutReasons,
    recommendations: scored,
  };
}
