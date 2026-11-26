export interface OfferCostInputs {
  price: number;
  deliveryCharge: number | null;
  installationCharge: number | null;
  warrantyCost: number | null;
  requiredAccessoriesCost: number | null;
  additionalFees: number | null;
}

export interface ComputedOfferCosts {
  estimatedTotalCost: number | null;
  hasMissingCostInfo: boolean;
  missingCostFields: string[];
  knownExtraCosts: number;
}

export function computeOfferTotals(input: OfferCostInputs): ComputedOfferCosts {
  const missingCostFields: string[] = [];

  if (input.deliveryCharge === null || input.deliveryCharge === undefined) {
    missingCostFields.push('Delivery charge');
  }
  if (input.installationCharge === null || input.installationCharge === undefined) {
    missingCostFields.push('Installation charge');
  }
  if (input.warrantyCost === null || input.warrantyCost === undefined) {
    missingCostFields.push('Warranty cost');
  }
  if (input.requiredAccessoriesCost === null || input.requiredAccessoriesCost === undefined) {
    missingCostFields.push('Required accessories');
  }

  const knownExtraCosts =
    (input.deliveryCharge ?? 0) +
    (input.installationCharge ?? 0) +
    (input.warrantyCost ?? 0) +
    (input.requiredAccessoriesCost ?? 0) +
    (input.additionalFees ?? 0);

  // Only calculate a full estimated total when at least deliveryCharge is explicitly recorded
  const canEstimate = input.deliveryCharge !== null && input.deliveryCharge !== undefined;

  return {
    estimatedTotalCost: canEstimate ? Number((input.price + knownExtraCosts).toFixed(2)) : null,
    hasMissingCostInfo: missingCostFields.length > 0,
    missingCostFields,
    knownExtraCosts: Number(knownExtraCosts.toFixed(2)),
  };
}
