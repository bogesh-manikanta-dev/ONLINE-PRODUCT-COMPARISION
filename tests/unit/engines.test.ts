import { describe, expect, it } from 'vitest';
import { analyzeComparison, normalizeNumericSpec } from '../../shared/engines/comparisonEngine.ts';
import { computeOfferTotals } from '../../shared/engines/costCalculator.ts';
import { generateRecommendations } from '../../shared/engines/recommendationEngine.ts';
import type { CategoryDTO, ProductDTO, SpecDefinitionDTO } from '../../shared/types.ts';
import { validateProductCsv } from '../../src/lib/csv.ts';
import {
  hashPassword,
  sanitizeUrl,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../../src/lib/security.ts';

const laptopCategory: CategoryDTO = {
  id: 1,
  name: 'Laptops',
  slug: 'laptops',
  domainGroup: 'Electronics',
  description: 'Notebooks and ultrabooks',
  iconName: 'Laptop',
  displayOrder: 1,
};

const laptopDefs: SpecDefinitionDTO[] = [
  {
    id: 1,
    categoryId: 1,
    key: 'ram',
    label: 'Memory (RAM)',
    dataType: 'numeric',
    unit: 'GB',
    higherIsBetter: true,
    isMandatory: true,
    isComparable: true,
    enumValues: [],
    weight: 1.3,
    sortOrder: 1,
  },
  {
    id: 2,
    categoryId: 1,
    key: 'battery',
    label: 'Battery Life',
    dataType: 'numeric',
    unit: 'hours',
    higherIsBetter: true,
    isMandatory: true,
    isComparable: true,
    enumValues: [],
    weight: 1.2,
    sortOrder: 2,
  },
  {
    id: 3,
    categoryId: 1,
    key: 'weight',
    label: 'Weight',
    dataType: 'numeric',
    unit: 'kg',
    higherIsBetter: false,
    isMandatory: true,
    isComparable: true,
    enumValues: [],
    weight: 1.0,
    sortOrder: 3,
  },
];

function makeProduct(overrides: Partial<ProductDTO> & { id: number; name: string }): ProductDTO {
  return {
    slug: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    brandId: 1,
    brandName: 'ApexTech',
    categoryId: 1,
    categoryName: 'Laptops',
    categorySlug: 'laptops',
    subcategoryId: null,
    subcategoryName: null,
    description: 'Test laptop model',
    modelNumber: `M-${overrides.id}`,
    variantLabel: '16GB · 512GB',
    basePrice: 85000,
    currency: 'INR',
    stockQuantity: 15,
    taxRatePercent: 18,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    status: 'ACTIVE',
    rating: 4.7,
    reviewCount: 50,
    popularityScore: 80,
    isDemoData: true,
    dataSourceLabel: 'Test Data',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    primaryImage: '',
    images: [],
    specifications: [],
    ...overrides,
  };
}

describe('Unit Normalization & Comparison Engine', () => {
  it('normalizes TB to GB and g to kg accurately', () => {
    expect(normalizeNumericSpec('1 TB', 'TB', 'GB').normalizedValue).toBe(1024);
    expect(normalizeNumericSpec('1200 g', 'g', 'kg').normalizedValue).toBe(1.2);
  });

  it('TC09 & TC12: compares two compatible products and highlights differences vs matches', () => {
    const p1 = makeProduct({
      id: 1,
      name: 'Laptop A',
      basePrice: 1000,
      specifications: [
        {
          id: 10,
          specDefinitionId: 1,
          key: 'ram',
          label: 'Memory (RAM)',
          dataType: 'numeric',
          unit: 'GB',
          higherIsBetter: true,
          isMandatory: true,
          isComparable: true,
          rawValue: '16 GB',
          numericValue: 16,
          normalizedValue: 16,
          isConflicting: false,
          sourceNote: '',
        },
        {
          id: 11,
          specDefinitionId: 2,
          key: 'battery',
          label: 'Battery Life',
          dataType: 'numeric',
          unit: 'hours',
          higherIsBetter: true,
          isMandatory: true,
          isComparable: true,
          rawValue: '12 hours',
          numericValue: 12,
          normalizedValue: 12,
          isConflicting: false,
          sourceNote: '',
        },
      ],
    });
    const p2 = makeProduct({
      id: 2,
      name: 'Laptop B',
      basePrice: 1400,
      specifications: [
        {
          id: 12,
          specDefinitionId: 1,
          key: 'ram',
          label: 'Memory (RAM)',
          dataType: 'numeric',
          unit: 'GB',
          higherIsBetter: true,
          isMandatory: true,
          isComparable: true,
          rawValue: '32 GB',
          numericValue: 32,
          normalizedValue: 32,
          isConflicting: false,
          sourceNote: '',
        },
        {
          id: 13,
          specDefinitionId: 2,
          key: 'battery',
          label: 'Battery Life',
          dataType: 'numeric',
          unit: 'hours',
          higherIsBetter: true,
          isMandatory: true,
          isComparable: true,
          rawValue: '12 hours',
          numericValue: 12,
          normalizedValue: 12,
          isConflicting: false,
          sourceNote: '',
        },
      ],
    });

    const result = analyzeComparison([p1, p2], laptopDefs);
    expect(result.compatible).toBe(true);
    const ramRow = result.rows.find((r) => r.key === 'ram')!;
    const batRow = result.rows.find((r) => r.key === 'battery')!;
    const weightRow = result.rows.find((r) => r.key === 'weight')!;

    expect(ramRow.hasDifference).toBe(true);
    expect(ramRow.values.find((v) => v.productId === 2)?.isBest).toBe(true);
    expect(batRow.allMatch).toBe(true);
    // TC13: Missing specs must stay explicitly marked missing, never coerced to zero
    expect(weightRow.hasMissingData).toBe(true);
    expect(weightRow.values[0].isMissing).toBe(true);
    expect(weightRow.values[0].numericValue).toBeNull();
  });

  it('TC10: supports up to four compatible products simultaneously', () => {
    const prods = [1, 2, 3, 4].map((id) => makeProduct({ id, name: `Laptop ${id}`, basePrice: 900 + id * 100 }));
    const result = analyzeComparison(prods, laptopDefs);
    expect(result.compatible).toBe(true);
    expect(result.products).toHaveLength(4);
  });

  it('TC11: prevents comparison across incompatible categories', () => {
    const laptop = makeProduct({ id: 1, name: 'Laptop', categoryId: 1, categoryName: 'Laptops' });
    const fridge = makeProduct({ id: 2, name: 'Fridge', categoryId: 5, categoryName: 'Refrigerators' });
    const result = analyzeComparison([laptop, fridge], laptopDefs);
    expect(result.compatible).toBe(false);
    expect(result.rows).toHaveLength(0);
  });
});

describe('Explainable Recommendation Engine', () => {
  const prods: ProductDTO[] = [
    makeProduct({
      id: 1,
      name: 'Budget Ultrabook',
      basePrice: 800,
      rating: 4.5,
      specifications: [
        {
          id: 1, specDefinitionId: 1, key: 'ram', label: 'RAM', dataType: 'numeric', unit: 'GB',
          higherIsBetter: true, isMandatory: true, isComparable: true, rawValue: '16 GB', numericValue: 16, normalizedValue: 16, isConflicting: false, sourceNote: '',
        },
        {
          id: 2, specDefinitionId: 2, key: 'battery', label: 'Battery', dataType: 'numeric', unit: 'hours',
          higherIsBetter: true, isMandatory: true, isComparable: true, rawValue: '16 hours', numericValue: 16, normalizedValue: 16, isConflicting: false, sourceNote: '',
        },
      ],
    }),
    makeProduct({
      id: 2,
      name: 'Power Workstation',
      basePrice: 1500,
      rating: 4.8,
      specifications: [
        {
          id: 3, specDefinitionId: 1, key: 'ram', label: 'RAM', dataType: 'numeric', unit: 'GB',
          higherIsBetter: true, isMandatory: true, isComparable: true, rawValue: '32 GB', numericValue: 32, normalizedValue: 32, isConflicting: false, sourceNote: '',
        },
        {
          id: 4, specDefinitionId: 2, key: 'battery', label: 'Battery', dataType: 'numeric', unit: 'hours',
          higherIsBetter: true, isMandatory: true, isComparable: true, rawValue: '10 hours', numericValue: 10, normalizedValue: 10, isConflicting: false, sourceNote: '',
        },
      ],
    }),
    makeProduct({
      id: 3,
      name: 'Overpriced Flagship',
      basePrice: 3000,
      rating: 4.9,
      specifications: [],
    }),
  ];

  it('TC14 & TC15: filters out extreme over-budget products and recalculates on weight shift', () => {
    const valueFirst = generateRecommendations(prods, laptopCategory, laptopDefs, {
      categoryId: 1,
      budgetMax: 1500,
      intendedUsage: 'student_portable',
      priorities: { performance: 10, value: 100, efficiency: 20, reliability: 20 },
    });

    expect(valueFirst.filteredOutCount).toBe(1);
    expect(valueFirst.recommendations[0].product.id).toBe(1);
    expect(valueFirst.disclaimer).toContain('No single product is objectively best');

    const perfFirst = generateRecommendations(prods, laptopCategory, laptopDefs, {
      categoryId: 1,
      budgetMax: 1500,
      intendedUsage: 'creative_work',
      priorities: { performance: 100, value: 10, efficiency: 10, reliability: 80 },
    });

    expect(perfFirst.recommendations[0].overallScore).not.toBe(
      valueFirst.recommendations[0].overallScore
    );
  });
});

describe('Hidden-Cost Awareness & CSV Validation & Security', () => {
  it('TC22: separates base price from additional costs and flags missing delivery info', () => {
    const complete = computeOfferTotals({
      price: 1000,
      deliveryCharge: 50,
      installationCharge: 100,
      warrantyCost: 120,
      requiredAccessoriesCost: 30,
      additionalFees: 0,
    });
    expect(complete.estimatedTotalCost).toBe(1300);
    expect(complete.hasMissingCostInfo).toBe(false);

    const incomplete = computeOfferTotals({
      price: 1000,
      deliveryCharge: null,
      installationCharge: null,
      warrantyCost: 0,
      requiredAccessoriesCost: 0,
      additionalFees: 0,
    });
    expect(incomplete.estimatedTotalCost).toBeNull();
    expect(incomplete.hasMissingCostInfo).toBe(true);
    expect(incomplete.missingCostFields).toContain('Delivery charge');
  });

  it('TC19 & TC20: rejects invalid CSV and accepts valid CSV rows', () => {
    const badCsv = `name,brand,categorySlug,modelNumber,basePrice,description\n"Test","Brand","laptops","M1",-50,"Desc"`;
    const badRes = validateProductCsv(badCsv);
    expect(badRes.errors.length).toBeGreaterThan(0);

    const goodCsv = `name,brand,categorySlug,modelNumber,basePrice,description\n"Valid Book","ApexTech","laptops","VB-1",999,"Valid description text here"`;
    const goodRes = validateProductCsv(goodCsv);
    expect(goodRes.errors).toHaveLength(0);
    expect(goodRes.validRows).toHaveLength(1);
  });

  it('hashes passwords with scrypt, signs tokens, and blocks unsafe URLs', () => {
    const hash = hashPassword('SecurePass123');
    expect(verifyPassword('SecurePass123', hash)).toBe(true);
    expect(verifyPassword('WrongPass123', hash)).toBe(false);

    const token = signSessionToken({ userId: 7, uid: 'u7', email: 'a@b.com', role: 'CONSUMER' });
    const verified = verifySessionToken(token);
    expect(verified?.userId).toBe(7);

    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('https://example.com/item')).toBe('https://example.com/item');
  });
});
