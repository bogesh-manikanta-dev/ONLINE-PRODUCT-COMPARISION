export type UserRole = 'GUEST' | 'CONSUMER' | 'ADMIN';

export type SpecDataType = 'numeric' | 'text' | 'boolean' | 'enum';

export type OrderStatus =
  | 'Order Placed'
  | 'Order Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled';

export type PaymentMode =
  | 'DEMO_CARD_SIMULATION'
  | 'DEMO_UPI_SIMULATION'
  | 'DEMO_COD_SIMULATION';

export type DeliveryMethod = 'STANDARD' | 'EXPRESS';

export type ReturnStatus =
  | 'Requested'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Demo Refund Completed';

export interface CategoryDTO {
  id: number;
  name: string;
  slug: string;
  domainGroup: string;
  description: string;
  iconName: string;
  displayOrder: number;
  productCount?: number;
  subcategories?: SubcategoryDTO[];
  specDefinitions?: SpecDefinitionDTO[];
}

export interface SubcategoryDTO {
  id: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
}

export interface BrandDTO {
  id: number;
  name: string;
  slug: string;
  country: string;
  website: string;
  description: string;
  tagline: string;
  accentColor: string;
  heroDescription: string;
  soundProfile?: string;
  productCount?: number;
}

export interface BrandDetailDTO {
  brand: BrandDTO;
  categories: CategoryDTO[];
  products: ProductDTO[];
}

export interface SpecDefinitionDTO {
  id: number;
  categoryId: number;
  key: string;
  label: string;
  dataType: SpecDataType;
  unit: string;
  higherIsBetter: boolean | null;
  isMandatory: boolean;
  isComparable: boolean;
  enumValues: string[];
  weight: number;
  sortOrder: number;
}

export interface ProductSpecDTO {
  id: number;
  specDefinitionId: number;
  key: string;
  label: string;
  dataType: SpecDataType;
  unit: string;
  higherIsBetter: boolean | null;
  isMandatory: boolean;
  isComparable: boolean;
  rawValue: string;
  numericValue: number | null;
  normalizedValue: number | null;
  isConflicting: boolean;
  sourceNote: string;
}

export interface ProductOfferDTO {
  id: number;
  sellerId: number;
  sellerName: string;
  sellerWebsite: string;
  isAuthorizedApi: boolean;
  price: number;
  currency: string;
  deliveryCharge: number | null;
  installationCharge: number | null;
  warrantyCost: number | null;
  requiredAccessoriesCost: number | null;
  additionalFees: number | null;
  additionalFeesNote: string;
  estimatedTotalCost: number | null;
  hasMissingCostInfo: boolean;
  missingCostFields: string[];
  availabilityStatus: string;
  offerUrl: string;
  dataSource: string;
  lastVerifiedAt: string;
}

export interface PriceObservationDTO {
  id: number;
  productId: number;
  sellerId: number;
  sellerName: string;
  price: number;
  currency: string;
  sourceLabel: string;
  isDemoData: boolean;
  observedAt: string;
}

export interface ProductImageDTO {
  id: number;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductDTO {
  id: number;
  name: string;
  slug: string;
  brandId: number;
  brandName: string;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  subcategoryId: number | null;
  subcategoryName: string | null;
  description: string;
  modelNumber: string;
  variantLabel: string;
  basePrice: number;
  currency: string;
  stockQuantity: number;
  taxRatePercent: number;
  isFeatured: boolean;
  availabilityStatus: string;
  status: string;
  rating: number | null;
  reviewCount: number;
  popularityScore: number;
  model3dPreset?: string;
  model3dUrl?: string;
  finishHex?: string;
  isDemoData: boolean;
  dataSourceLabel: string;
  createdAt: string;
  updatedAt: string;
  primaryImage: string;
  images: ProductImageDTO[];
  specifications: ProductSpecDTO[];
  offers?: ProductOfferDTO[];
  lowestRecordedPrice?: number | null;
}

export interface ComparisonSpecRow {
  specDefinitionId: number;
  key: string;
  label: string;
  dataType: SpecDataType;
  unit: string;
  higherIsBetter: boolean | null;
  values: Array<{
    productId: number;
    rawValue: string | null;
    numericValue: number | null;
    normalizedValue: number | null;
    isMissing: boolean;
    isConflicting: boolean;
    isBest: boolean;
  }>;
  allMatch: boolean;
  hasDifference: boolean;
  hasMissingData: boolean;
  hasConflict: boolean;
}

export interface ComparisonPriorityWeights {
  price: number;
  performance: number;
  quality: number;
  durability: number;
  energyEfficiency: number;
  features: number;
  brandPreference: number;
  warranty: number;
}

export interface ProductComparisonScoreBreakdown {
  productId: number;
  productName: string;
  overallWeightedScore: number;
  dimensionScores: {
    priceValue: number;
    specificationStrength: number;
    qualityRating: number;
    durabilityEfficiency: number;
    featureCompleteness: number;
  };
  budgetSuitability: string;
  intendedUseSuitability: string;
  badges: Array<
    | 'Best Overall Value'
    | 'Best Budget Choice'
    | 'Best Feature-Rich Option'
    | 'Best Suitability for Selected Use Case'
  >;
}

export interface ComparisonAnalysisResult {
  compatible: boolean;
  categoryId: number;
  categoryName: string;
  products: ProductDTO[];
  rows: ComparisonSpecRow[];
  priceSummary: {
    lowestBasePriceProductId: number | null;
    highestBasePriceProductId: number | null;
    priceSpread: number;
  };
  productInsights: Array<{
    productId: number;
    productName: string;
    strengths: string[];
    limitations: string[];
    missingSpecLabels: string[];
    completenessPercent: number;
  }>;
  scoreBreakdowns?: ProductComparisonScoreBreakdown[];
  decisionVerdict?: {
    bestOverallValueId: number | null;
    bestBudgetChoiceId: number | null;
    bestFeatureRichId: number | null;
    bestForUseCaseId: number | null;
    guidanceBullets: Array<{ productId: number; productName: string; idealFor: string }>;
  };
  summaryText: string;
}

export interface RecommendationCriteriaInput {
  categoryId: number;
  budgetMin?: number | null;
  budgetMax: number;
  intendedUsage: string;
  preferredBrandId?: number | null;
  requiredSpecs?: Array<{
    key: string;
    operator: 'gte' | 'lte' | 'eq';
    value: string | number | boolean;
  }>;
  importantFeatures?: string[];
  priorities: {
    performance: number; // 0-100
    value: number;       // 0-100
    efficiency: number;  // 0-100
    reliability: number; // 0-100
  };
}

export interface RecommendationResultItem {
  product: ProductDTO;
  rank: number;
  overallScore: number;
  criterionScores: {
    specificationMatch: number;
    budgetValue: number;
    usageAlignment: number;
    dataCompleteness: number;
    brandPreference: number;
  };
  budgetSuitability: 'UNDER_BUDGET' | 'OPTIMAL_FIT' | 'STRETCH' | 'OVER_BUDGET';
  strengths: string[];
  limitations: string[];
  missingDataNotes: string[];
  keyDifferences: string[];
  explanation: string;
}

export interface RecommendationResponseDTO {
  requestId?: number;
  category: CategoryDTO;
  disclaimer: string;
  totalEvaluated: number;
  filteredOutCount: number;
  filteredOutReasons: Array<{ productId: number; productName: string; reason: string }>;
  recommendations: RecommendationResultItem[];
}

export interface DataQualityIssue {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  issueType:
    | 'MISSING_MANDATORY_SPEC'
    | 'DUPLICATE_PRODUCT'
    | 'INVALID_PRICE'
    | 'INCONSISTENT_UNIT'
    | 'CONFLICTING_SPEC'
    | 'OUTDATED_PRICE';
  entityType: 'PRODUCT' | 'SPECIFICATION' | 'OFFER';
  entityId: number;
  productId: number;
  productName: string;
  categoryName: string;
  description: string;
  suggestedAction: string;
}

export interface AuthUserDTO {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'CONSUMER' | 'ADMIN';
  avatarUrl: string | null;
  createdAt: string;
}

// Phase 3 E-Commerce DTOs
export interface CartItemDTO {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  brandName: string;
  modelNumber: string;
  variantLabel: string;
  primaryImage: string;
  unitPrice: number;
  currency: string;
  taxRatePercent: number;
  quantity: number;
  stockQuantity: number;
  availabilityStatus: string;
  lineSubtotal: number;
  lineTax: number;
}

export interface CartDTO {
  id: number;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  standardDeliveryCharge: number;
  expressDeliveryCharge: number;
  freeDeliveryThreshold: number;
  estimatedTotalStandard: number;
  estimatedTotalExpress: number;
  currency: string;
  notices: string[];
}

export interface UserAddressDTO {
  id: number;
  userId: number;
  label: string;
  fullName: string;
  phone: string;
  houseBuilding: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export interface OrderItemDTO {
  id: number;
  orderId: number;
  productId: number | null;
  productNameSnapshot: string;
  brandNameSnapshot: string;
  modelSnapshot: string;
  variantSnapshot: string;
  imageSnapshot: string;
  unitPriceSnapshot: number;
  taxRateSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderStatusHistoryDTO {
  id: number;
  orderId: number;
  status: OrderStatus;
  note: string;
  actorEmail: string;
  createdAt: string;
}

export interface ReturnRequestDTO {
  id: number;
  orderId: number;
  orderNumber?: string;
  orderItemId: number;
  productNameSnapshot?: string;
  userId: number;
  userEmail?: string;
  reason: string;
  status: ReturnStatus;
  adminNote: string;
  demoRefundAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDTO {
  id: number;
  orderNumber: string;
  userId: number;
  userEmail?: string;
  status: OrderStatus;
  paymentMode: PaymentMode;
  paymentStatus: string;
  shippingAddress: Omit<UserAddressDTO, 'id' | 'userId' | 'isDefault' | 'createdAt'>;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  deliveryCharge: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  estimatedDeliveryDate: string;
  createdAt: string;
  updatedAt: string;
  isCancellable: boolean;
  isReturnEligible: boolean;
  items: OrderItemDTO[];
  history: OrderStatusHistoryDTO[];
  returns: ReturnRequestDTO[];
}

export interface InventoryLogDTO {
  id: number;
  productId: number;
  productName?: string;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason: string;
  actorEmail: string;
  createdAt: string;
}

export interface RecommendationConfigDTO {
  strategy: 'BALANCED_DECISION' | 'BUDGET_VALUE' | 'PERFORMANCE_FIRST';
  defaultWeights: {
    performance: number;
    value: number;
    efficiency: number;
    reliability: number;
  };
  freeDeliveryThreshold: number;
  standardDeliveryFee: number;
  expressDeliveryFee: number;
  cancellableStatuses: OrderStatus[];
}
