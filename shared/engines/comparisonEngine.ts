import type {
  ComparisonAnalysisResult,
  ComparisonSpecRow,
  ProductDTO,
  SpecDefinitionDTO,
} from '../types.ts';

function formatMoney(amount: number, currency = 'INR'): string {
  const sym = currency === 'INR' ? '₹' : '$';
  const loc = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${sym}${Math.round(amount).toLocaleString(loc)}`;
}

export function normalizeNumericSpec(
  rawValue: string,
  unit: string,
  targetUnit: string
): { numericValue: number | null; normalizedValue: number | null } {
  const cleaned = rawValue.replace(/,/g, '').trim();
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return { numericValue: null, normalizedValue: null };
  }
  const num = Number(match[0]);
  if (!Number.isFinite(num)) {
    return { numericValue: null, normalizedValue: null };
  }

  const u = (unit || '').toLowerCase().trim();
  const rawLower = cleaned.toLowerCase();
  const target = (targetUnit || '').toLowerCase().trim();

  let normalized = num;
  if (target === 'gb') {
    if (rawLower.includes('tb') || u === 'tb') normalized = num * 1024;
    else if (rawLower.includes('mb') || u === 'mb') normalized = num / 1024;
  } else if (target === 'kg') {
    if ((rawLower.includes('g') && !rawLower.includes('kg')) || u === 'g') normalized = num / 1000;
    else if (rawLower.includes('lb') || u === 'lbs' || u === 'lb') normalized = num * 0.453592;
  } else if (target === 'g') {
    if (rawLower.includes('kg') || u === 'kg') normalized = num * 1000;
  } else if (target === 'l' || target === 'liters') {
    if (rawLower.includes('cu ft') || u === 'cu ft') normalized = num * 28.3168;
  } else if (target === 'hours' || target === 'hrs') {
    if (rawLower.includes('min') || u === 'min') normalized = num / 60;
  }

  return { numericValue: num, normalizedValue: Number(normalized.toFixed(2)) };
}

export function analyzeComparison(
  products: ProductDTO[],
  specDefinitions: SpecDefinitionDTO[]
): ComparisonAnalysisResult {
  if (products.length === 0) {
    return {
      compatible: false,
      categoryId: 0,
      categoryName: 'None',
      products: [],
      rows: [],
      priceSummary: { lowestBasePriceProductId: null, highestBasePriceProductId: null, priceSpread: 0 },
      productInsights: [],
      summaryText: 'Select 2 to 4 products from a single category to begin side-by-side comparison.',
    };
  }

  const categoryIds = new Set(products.map((p) => p.categoryId));
  const primaryCatId = products[0].categoryId;
  const primaryCatName = products[0].categoryName;

  if (categoryIds.size > 1) {
    return {
      compatible: false,
      categoryId: primaryCatId,
      categoryName: primaryCatName,
      products,
      rows: [],
      priceSummary: { lowestBasePriceProductId: null, highestBasePriceProductId: null, priceSpread: 0 },
      productInsights: [],
      summaryText:
        'Selected products belong to incompatible categories. CompareX prevents cross-category specification comparisons because metrics are not meaningfully equivalent.',
    };
  }

  const comparableDefs = [...specDefinitions]
    .filter((d) => d.isComparable)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rows: ComparisonSpecRow[] = comparableDefs.map((def) => {
    const rawEntries = products.map((product) => {
      const found = product.specifications.find(
        (s) => s.specDefinitionId === def.id || s.key === def.key
      );
      if (!found || !found.rawValue || found.rawValue.trim() === '') {
        return {
          productId: product.id,
          rawValue: null,
          numericValue: null,
          normalizedValue: null,
          isMissing: true,
          isConflicting: false,
          isBest: false,
        };
      }
      const norm =
        found.normalizedValue !== null
          ? { numericValue: found.numericValue, normalizedValue: found.normalizedValue }
          : def.dataType === 'numeric'
            ? normalizeNumericSpec(found.rawValue, found.unit || def.unit, def.unit)
            : { numericValue: found.numericValue, normalizedValue: null };

      return {
        productId: product.id,
        rawValue: found.rawValue,
        numericValue: norm.numericValue,
        normalizedValue: norm.normalizedValue,
        isMissing: false,
        isConflicting: Boolean(found.isConflicting),
        isBest: false,
      };
    });

    const presentValues = rawEntries.filter((e) => !e.isMissing);
    const normalizedSet = new Set(
      presentValues.map((e) => (e.rawValue || '').trim().toLowerCase())
    );
    const allMatch = presentValues.length === products.length && normalizedSet.size === 1;
    const hasDifference = presentValues.length > 1 && normalizedSet.size > 1;
    const hasMissingData = presentValues.length < products.length;
    const hasConflict = rawEntries.some((e) => e.isConflicting);

    // Determine best value only when numeric, higherIsBetter is specified, and values actually differ
    if (
      def.dataType === 'numeric' &&
      def.higherIsBetter !== null &&
      hasDifference &&
      presentValues.length >= 2
    ) {
      const numericVals = presentValues
        .map((e) => ({ id: e.productId, val: e.normalizedValue ?? e.numericValue }))
        .filter((v): v is { id: number; val: number } => v.val !== null);

      if (numericVals.length >= 2) {
        const bestVal = def.higherIsBetter
          ? Math.max(...numericVals.map((v) => v.val))
          : Math.min(...numericVals.map((v) => v.val));
        const allEqualNumeric = numericVals.every((v) => v.val === bestVal);
        if (!allEqualNumeric) {
          for (const entry of rawEntries) {
            const val = entry.normalizedValue ?? entry.numericValue;
            if (!entry.isMissing && val === bestVal) {
              entry.isBest = true;
            }
          }
        }
      }
    }

    return {
      specDefinitionId: def.id,
      key: def.key,
      label: def.label,
      dataType: def.dataType,
      unit: def.unit,
      higherIsBetter: def.higherIsBetter,
      values: rawEntries,
      allMatch,
      hasDifference,
      hasMissingData,
      hasConflict,
    };
  });

  const sortedByPrice = [...products].sort((a, b) => a.basePrice - b.basePrice);
  const lowestBase = sortedByPrice[0];
  const highestBase = sortedByPrice[sortedByPrice.length - 1];

  const currency = products[0]?.currency || 'INR';

  const productInsights = products.map((product) => {
    const strengths: string[] = [];
    const limitations: string[] = [];
    const missingSpecLabels: string[] = [];

    if (products.length >= 2 && product.id === lowestBase.id && lowestBase.basePrice < highestBase.basePrice) {
      const savings = highestBase.basePrice - lowestBase.basePrice;
      strengths.push(`Lowest recorded base price (saves ${formatMoney(savings, currency)} vs. highest option)`);
    }
    if (products.length >= 2 && product.id === highestBase.id && highestBase.basePrice > lowestBase.basePrice) {
      limitations.push(`Highest base price in this comparison (${formatMoney(highestBase.basePrice, currency)})`);
    }

    let presentCount = 0;
    for (const row of rows) {
      const cell = row.values.find((v) => v.productId === product.id);
      if (!cell || cell.isMissing) {
        missingSpecLabels.push(row.label);
      } else {
        presentCount++;
        if (cell.isBest) {
          strengths.push(`Leads in ${row.label} (${cell.rawValue})`);
        }
        if (cell.isConflicting) {
          limitations.push(`Conflicting source record flagged for ${row.label}`);
        }
      }
    }

    if (missingSpecLabels.length > 0) {
      limitations.push(
        `Missing ${missingSpecLabels.length} specification(s): ${missingSpecLabels.slice(0, 3).join(', ')}`
      );
    }

    const completenessPercent =
      rows.length > 0 ? Math.round((presentCount / rows.length) * 100) : 100;

    return {
      productId: product.id,
      productName: product.name,
      strengths,
      limitations,
      missingSpecLabels,
      completenessPercent,
    };
  });

  const diffCount = rows.filter((r) => r.hasDifference).length;
  const matchCount = rows.filter((r) => r.allMatch).length;
  const missingRowCount = rows.filter((r) => r.hasMissingData).length;

  const summaryParts = [
    `Comparing ${products.length} ${primaryCatName} models across ${rows.length} standardized attributes.`,
    `${diffCount} specification(s) differ and ${matchCount} match identically.`,
  ];
  if (lowestBase.basePrice < highestBase.basePrice) {
    summaryParts.push(
      `Base prices span from ${formatMoney(lowestBase.basePrice, currency)} (${lowestBase.name}) to ${formatMoney(highestBase.basePrice, currency)} (${highestBase.name}).`
    );
  }
  if (missingRowCount > 0) {
    summaryParts.push(
      `${missingRowCount} attribute row(s) contain unrecorded data, marked explicitly as "Not available" rather than penalized as zero.`
    );
  }

  return {
    compatible: true,
    categoryId: primaryCatId,
    categoryName: primaryCatName,
    products,
    rows,
    priceSummary: {
      lowestBasePriceProductId: lowestBase.id,
      highestBasePriceProductId: highestBase.id,
      priceSpread: Number((highestBase.basePrice - lowestBase.basePrice).toFixed(2)),
    },
    productInsights,
    summaryText: summaryParts.join(' '),
  };
}
