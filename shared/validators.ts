import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  preferredCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
  defaultBudgetMax: z.number().positive().nullable().optional(),
  preferredCategories: z.array(z.number().int().positive()).optional(),
  priorityWeights: z
    .object({
      performance: z.number().min(0).max(1),
      value: z.number().min(0).max(1),
      efficiency: z.number().min(0).max(1),
      reliability: z.number().min(0).max(1),
    })
    .optional(),
  emailNotifications: z.boolean().optional(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  subcategoryId: z.number().int().positive().nullable().optional(),
  description: z.string().trim().min(10).max(4000),
  modelNumber: z.string().trim().min(1).max(80),
  variantLabel: z.string().trim().min(1).max(120).default('Standard Edition'),
  basePrice: z.number().positive('Base price must be greater than zero'),
  currency: z.string().trim().min(3).max(3).default('INR'),
  stockQuantity: z.number().int().min(0).max(10000).default(25),
  taxRatePercent: z.number().min(0).max(40).default(18),
  isFeatured: z.boolean().optional().default(false),
  availabilityStatus: z.enum(['IN_STOCK', 'LIMITED', 'OUT_OF_STOCK', 'DISCONTINUED']).default('IN_STOCK'),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().min(0).default(0),
  imageUrl: z.string().trim().optional(),
  model3dPreset: z.string().trim().max(40).optional().default('auto'),
  model3dUrl: z.string().trim().max(500).optional().default(''),
  finishHex: z.string().trim().max(24).optional().default('#D4AF37'),
  specifications: z
    .array(
      z.object({
        specDefinitionId: z.number().int().positive(),
        rawValue: z.string().trim().min(1),
        numericValue: z.number().nullable().optional(),
        unit: z.string().trim().optional(),
        isConflicting: z.boolean().optional(),
        sourceNote: z.string().trim().optional(),
      })
    )
    .optional(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  domainGroup: z.enum(['Electronics', 'Fashion', 'Home Appliances', 'Other']),
  description: z.string().trim().min(4).max(500),
  iconName: z.string().trim().min(1).max(40).default('Layers'),
});

export const specDefinitionCreateSchema = z.object({
  categoryId: z.number().int().positive(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores'),
  label: z.string().trim().min(2).max(80),
  dataType: z.enum(['numeric', 'text', 'boolean', 'enum']),
  unit: z.string().trim().max(24).default(''),
  higherIsBetter: z.boolean().nullable().optional(),
  isMandatory: z.boolean().default(false),
  isComparable: z.boolean().default(true),
  enumValues: z.array(z.string().trim()).optional(),
  weight: z.number().min(0.1).max(5).default(1.0),
});

export const brandCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  country: z.string().trim().max(60).default('Global'),
  website: z.string().trim().max(200).default(''),
  description: z.string().trim().max(500).default(''),
  tagline: z.string().trim().max(160).optional().default(''),
  accentColor: z.string().trim().max(24).optional().default('#D4AF37'),
  heroDescription: z.string().trim().max(600).optional().default(''),
  soundProfile: z.string().trim().max(40).optional().default('chime_gold'),
});

export const brandUpdateSchema = brandCreateSchema.partial();

export const sellerCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  website: z.string().trim().max(200).default(''),
  reliabilityNote: z.string().trim().max(200).default('Admin-Verified Demo Merchant'),
  isAuthorizedApi: z.boolean().default(false),
});

export const offerUpsertSchema = z.object({
  productId: z.number().int().positive(),
  sellerId: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().trim().min(3).max(3).default('INR'),
  deliveryCharge: z.number().min(0).nullable().optional(),
  installationCharge: z.number().min(0).nullable().optional(),
  warrantyCost: z.number().min(0).nullable().optional(),
  requiredAccessoriesCost: z.number().min(0).nullable().optional(),
  additionalFees: z.number().min(0).nullable().optional(),
  additionalFeesNote: z.string().trim().max(300).default(''),
  availabilityStatus: z.enum(['IN_STOCK', 'LIMITED', 'OUT_OF_STOCK']).default('IN_STOCK'),
  dataSource: z.string().trim().min(2).max(120).default('Admin-Entered Observation'),
});

export const priceObservationCreateSchema = z.object({
  productId: z.number().int().positive(),
  sellerId: z.number().int().positive(),
  price: z.number().positive(),
  currency: z.string().trim().min(3).max(3).default('INR'),
  sourceLabel: z.string().trim().min(2).max(120).default('Administrator Observation'),
  observedAt: z.string().optional(),
});

export const saveComparisonSchema = z.object({
  title: z.string().trim().min(2).max(120),
  categoryId: z.number().int().positive(),
  productIds: z.array(z.number().int().positive()).min(2).max(4),
  notes: z.string().trim().max(1000).default(''),
});

export const wishlistToggleSchema = z.object({
  productId: z.number().int().positive(),
  targetPrice: z.number().positive().nullable().optional(),
  notes: z.string().trim().max(300).optional(),
});

export const recommendationRequestSchema = z.object({
  categoryId: z.number().int().positive(),
  budgetMin: z.number().min(0).nullable().optional(),
  budgetMax: z.number().positive('Maximum budget must be positive'),
  intendedUsage: z.string().trim().min(2).max(120),
  preferredBrandId: z.number().int().positive().nullable().optional(),
  requiredSpecs: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        operator: z.enum(['gte', 'lte', 'eq']),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })
    )
    .optional(),
  importantFeatures: z.array(z.string().trim()).optional(),
  priorities: z.object({
    performance: z.number().min(0).max(100),
    value: z.number().min(0).max(100),
    efficiency: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
  }),
});

export const csvProductRowSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  brand: z.string().trim().min(1, 'Brand is required'),
  categorySlug: z.string().trim().min(1, 'Category slug is required'),
  subcategory: z.string().trim().optional().default(''),
  modelNumber: z.string().trim().min(1, 'Model number is required'),
  basePrice: z.coerce.number().positive('Base price must be a positive number'),
  currency: z.string().trim().length(3).default('INR'),
  stockQuantity: z.coerce.number().int().min(0).optional().default(20),
  availabilityStatus: z.enum(['IN_STOCK', 'LIMITED', 'OUT_OF_STOCK', 'DISCONTINUED']).default('IN_STOCK'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters'),
  specsJson: z.string().optional().default('{}'),
});

// Phase 3 E-Commerce Validators
export const cartItemAddSchema = z.object({
  productId: z.number().int().positive('Invalid product selection'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Maximum 20 units per item').default(1),
});

export const cartItemUpdateSchema = z.object({
  quantity: z.number().int().min(0, 'Quantity cannot be negative').max(20, 'Maximum 20 units per item'),
});

export const cartMergeSchema = z.object({
  guestToken: z.string().trim().min(8).max(120),
});

export const addressCreateSchema = z.object({
  label: z.string().trim().min(1, 'Address label is required').max(40).default('Home'),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{10,15}$/, 'Enter a valid 10 to 15 digit contact phone number'),
  houseBuilding: z.string().trim().min(2, 'House/Flat/Building is required').max(140),
  street: z.string().trim().min(3, 'Street/Area/Locality is required').max(180),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\-\s]{5,10}$/, 'Enter a valid 5 to 10 character postal/PIN code'),
  country: z.string().trim().min(2, 'Country is required').max(80).default('India'),
  isDefault: z.boolean().optional().default(false),
});

export const checkoutSchema = z
  .object({
    addressId: z.number().int().positive().optional(),
    shippingAddress: addressCreateSchema.omit({ isDefault: true }).optional(),
    saveAddress: z.boolean().optional().default(false),
    deliveryMethod: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
    paymentMode: z.enum(['DEMO_CARD_SIMULATION', 'DEMO_UPI_SIMULATION', 'DEMO_COD_SIMULATION']),
    idempotencyKey: z
      .string()
      .trim()
      .min(8, 'Idempotency key is required')
      .max(120),
  })
  .refine((val) => Boolean(val.addressId) || Boolean(val.shippingAddress), {
    message: 'Please choose a saved address or enter a complete shipping address',
  });

export const orderCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Please provide a brief cancellation reason').max(400),
});

export const returnRequestCreateSchema = z.object({
  orderItemId: z.number().int().positive(),
  reason: z.string().trim().min(5, 'Please explain the reason for return').max(500),
});

export const adminOrderStatusSchema = z.object({
  status: z.enum([
    'Order Placed',
    'Order Confirmed',
    'Processing',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
  ]),
  note: z.string().trim().max(300).optional().default(''),
});

export const adminInventoryAdjustSchema = z.object({
  stockQuantity: z.number().int().min(0, 'Stock cannot be negative').max(10000),
  reason: z.string().trim().min(3, 'Provide an inventory audit reason').max(250),
});

export const adminReturnDecisionSchema = z.object({
  status: z.enum(['Requested', 'Under Review', 'Approved', 'Rejected', 'Demo Refund Completed']),
  adminNote: z.string().trim().max(400).optional().default(''),
});

export const adminRecommendationConfigSchema = z.object({
  strategy: z.enum(['BALANCED_DECISION', 'BUDGET_VALUE', 'PERFORMANCE_FIRST']),
  defaultWeights: z.object({
    performance: z.number().min(0).max(100),
    value: z.number().min(0).max(100),
    efficiency: z.number().min(0).max(100),
    reliability: z.number().min(0).max(100),
  }),
  freeDeliveryThreshold: z.number().min(0).max(100000),
  standardDeliveryFee: z.number().min(0).max(10000),
  expressDeliveryFee: z.number().min(0).max(10000),
  cancellableStatuses: z
    .array(
      z.enum([
        'Order Placed',
        'Order Confirmed',
        'Processing',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Cancelled',
      ])
    )
    .min(1),
});
