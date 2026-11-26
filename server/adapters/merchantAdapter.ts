import type { ProductOfferDTO } from '../../shared/types.ts';
import { computeOfferTotals } from '../../shared/engines/costCalculator.ts';

export interface ExternalMerchantRecord {
  sellerId: number;
  sellerName: string;
  sellerWebsite: string;
  basePrice: number;
  currency: string;
  deliveryCharge?: number | null;
  installationCharge?: number | null;
  warrantyCost?: number | null;
  requiredAccessoriesCost?: number | null;
  additionalFees?: number | null;
  additionalFeesNote?: string;
  availabilityStatus: string;
  lastVerifiedAt: Date;
}

/**
 * Adapter Pattern: MerchantCatalogAdapter
 * Standardizes external or seeded merchant feed objects into CompareX's
 * transparent ProductOfferDTO schema with explicit cost breakdown.
 */
export interface MerchantCatalogAdapter {
  readonly sourceName: string;
  adaptOffer(raw: ExternalMerchantRecord, offerId: number): ProductOfferDTO;
}

export class SeededDemoCatalogAdapter implements MerchantCatalogAdapter {
  readonly sourceName = 'CompareX Seeded INR Demonstration Catalog';

  adaptOffer(raw: ExternalMerchantRecord, offerId: number): ProductOfferDTO {
    const totals = computeOfferTotals({
      price: raw.basePrice,
      deliveryCharge: raw.deliveryCharge ?? null,
      installationCharge: raw.installationCharge ?? null,
      warrantyCost: raw.warrantyCost ?? null,
      requiredAccessoriesCost: raw.requiredAccessoriesCost ?? null,
      additionalFees: raw.additionalFees ?? null,
    });

    return {
      id: offerId,
      sellerId: raw.sellerId,
      sellerName: raw.sellerName,
      sellerWebsite: raw.sellerWebsite,
      isAuthorizedApi: false,
      price: raw.basePrice,
      currency: raw.currency || 'INR',
      deliveryCharge: raw.deliveryCharge ?? null,
      installationCharge: raw.installationCharge ?? null,
      warrantyCost: raw.warrantyCost ?? null,
      requiredAccessoriesCost: raw.requiredAccessoriesCost ?? null,
      additionalFees: raw.additionalFees ?? null,
      additionalFeesNote: raw.additionalFeesNote ?? '',
      estimatedTotalCost: totals.estimatedTotalCost,
      hasMissingCostInfo: totals.hasMissingCostInfo,
      missingCostFields: totals.missingCostFields,
      availabilityStatus: raw.availabilityStatus,
      offerUrl: raw.sellerWebsite || 'https://example.com/demo-offer',
      dataSource: this.sourceName,
      lastVerifiedAt: raw.lastVerifiedAt.toISOString(),
    };
  }
}
