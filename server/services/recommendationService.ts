import { eq } from 'drizzle-orm';
import { generateRecommendations } from '../../shared/engines/recommendationEngine.ts';
import type {
  CategoryDTO,
  OrderStatus,
  ProductDTO,
  RecommendationConfigDTO,
  RecommendationCriteriaInput,
  RecommendationResponseDTO,
  SpecDefinitionDTO,
} from '../../shared/types.ts';
import { db } from '../../src/db/index.ts';
import { systemSettings } from '../../src/db/schema.ts';

export const DEFAULT_COMMERCE_CONFIG: RecommendationConfigDTO = {
  strategy: 'BALANCED_DECISION',
  defaultWeights: {
    performance: 35,
    value: 35,
    efficiency: 15,
    reliability: 15,
  },
  freeDeliveryThreshold: 2000,
  standardDeliveryFee: 99,
  expressDeliveryFee: 199,
  cancellableStatuses: ['Order Placed', 'Order Confirmed', 'Processing', 'Packed'] as OrderStatus[],
};

export async function getCommerceConfig(): Promise<RecommendationConfigDTO> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'recommendation_config'))
      .limit(1);
    if (!row) return DEFAULT_COMMERCE_CONFIG;
    const parsed = JSON.parse(row.value);
    return {
      strategy: parsed.strategy || DEFAULT_COMMERCE_CONFIG.strategy,
      defaultWeights: parsed.defaultWeights || DEFAULT_COMMERCE_CONFIG.defaultWeights,
      freeDeliveryThreshold:
        typeof parsed.freeDeliveryThreshold === 'number'
          ? parsed.freeDeliveryThreshold
          : DEFAULT_COMMERCE_CONFIG.freeDeliveryThreshold,
      standardDeliveryFee:
        typeof parsed.standardDeliveryFee === 'number'
          ? parsed.standardDeliveryFee
          : DEFAULT_COMMERCE_CONFIG.standardDeliveryFee,
      expressDeliveryFee:
        typeof parsed.expressDeliveryFee === 'number'
          ? parsed.expressDeliveryFee
          : DEFAULT_COMMERCE_CONFIG.expressDeliveryFee,
      cancellableStatuses: Array.isArray(parsed.cancellableStatuses)
        ? parsed.cancellableStatuses
        : DEFAULT_COMMERCE_CONFIG.cancellableStatuses,
    };
  } catch {
    return DEFAULT_COMMERCE_CONFIG;
  }
}

/**
 * Strategy Pattern: RecommendationStrategy
 * Allows administrators to tune ranking priority emphasis across
 * Balanced Decision, Budget Value, and Performance First strategies.
 */
export interface RecommendationStrategy {
  readonly name: RecommendationConfigDTO['strategy'];
  transformCriteria(criteria: RecommendationCriteriaInput): RecommendationCriteriaInput;
}

class BalancedDecisionStrategy implements RecommendationStrategy {
  readonly name = 'BALANCED_DECISION' as const;
  transformCriteria(criteria: RecommendationCriteriaInput): RecommendationCriteriaInput {
    return criteria;
  }
}

class BudgetValueStrategy implements RecommendationStrategy {
  readonly name = 'BUDGET_VALUE' as const;
  transformCriteria(criteria: RecommendationCriteriaInput): RecommendationCriteriaInput {
    return {
      ...criteria,
      priorities: {
        ...criteria.priorities,
        value: Math.min(100, Math.round(criteria.priorities.value * 1.35 + 10)),
      },
    };
  }
}

class PerformanceFirstStrategy implements RecommendationStrategy {
  readonly name = 'PERFORMANCE_FIRST' as const;
  transformCriteria(criteria: RecommendationCriteriaInput): RecommendationCriteriaInput {
    return {
      ...criteria,
      priorities: {
        ...criteria.priorities,
        performance: Math.min(100, Math.round(criteria.priorities.performance * 1.35 + 10)),
      },
    };
  }
}

export function resolveRecommendationStrategy(
  strategy: RecommendationConfigDTO['strategy']
): RecommendationStrategy {
  switch (strategy) {
    case 'BUDGET_VALUE':
      return new BudgetValueStrategy();
    case 'PERFORMANCE_FIRST':
      return new PerformanceFirstStrategy();
    case 'BALANCED_DECISION':
    default:
      return new BalancedDecisionStrategy();
  }
}

export async function executeRecommendationStrategy(
  products: ProductDTO[],
  category: CategoryDTO,
  specDefinitions: SpecDefinitionDTO[],
  criteria: RecommendationCriteriaInput
): Promise<RecommendationResponseDTO> {
  const config = await getCommerceConfig();
  const strategy = resolveRecommendationStrategy(config.strategy);
  const tunedCriteria = strategy.transformCriteria(criteria);
  return generateRecommendations(products, category, specDefinitions, tunedCriteria);
}
