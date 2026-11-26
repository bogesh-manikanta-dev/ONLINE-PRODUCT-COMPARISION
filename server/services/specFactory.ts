import { normalizeNumericSpec } from '../../shared/engines/comparisonEngine.ts';
import type { SpecDefinitionDTO } from '../../shared/types.ts';

export interface NormalizedCategorySpec {
  specDefinitionId: number;
  rawValue: string;
  numericValue: number | null;
  unit: string;
  normalizedValue: number | null;
}

/**
 * Factory Pattern: CategorySpecificationFactory
 * Resolves and normalizes product specifications dynamically according to
 * the product category's standardized schema definitions.
 */
export class CategorySpecificationFactory {
  private readonly defMapById: Map<number, SpecDefinitionDTO>;
  private readonly defMapByKey: Map<string, SpecDefinitionDTO>;

  constructor(definitions: SpecDefinitionDTO[]) {
    this.defMapById = new Map(definitions.map((d) => [d.id, d]));
    this.defMapByKey = new Map(definitions.map((d) => [d.key, d]));
  }

  normalizeInput(input: {
    specDefinitionId?: number;
    key?: string;
    rawValue: string;
    unit?: string;
  }): NormalizedCategorySpec | null {
    const def = input.specDefinitionId
      ? this.defMapById.get(input.specDefinitionId)
      : input.key
        ? this.defMapByKey.get(input.key)
        : undefined;

    if (!def) return null;

    if (def.dataType === 'numeric') {
      const norm = normalizeNumericSpec(input.rawValue, input.unit || def.unit, def.unit);
      return {
        specDefinitionId: def.id,
        rawValue: input.rawValue.trim(),
        numericValue: norm.numericValue,
        unit: def.unit,
        normalizedValue: norm.normalizedValue,
      };
    }

    return {
      specDefinitionId: def.id,
      rawValue: input.rawValue.trim(),
      numericValue: null,
      unit: input.unit || def.unit || '',
      normalizedValue: null,
    };
  }

  static resolveDefaultTaxRate(domainGroup: string): number {
    switch (domainGroup) {
      case 'Fashion':
      case 'Other':
        return 12;
      case 'Electronics':
      case 'Home Appliances':
      default:
        return 18;
    }
  }
}
