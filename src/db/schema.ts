import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // GUEST | CONSUMER | ADMIN
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(), // Firebase UID or local:<uuid>
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'), // scrypt salt:hash for email/password accounts
    roleId: integer('role_id').references(() => roles.id),
    role: text('role').notNull().default('CONSUMER'), // CONSUMER | ADMIN
    avatarUrl: text('avatar_url'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_users_email').on(table.email), index('idx_users_role').on(table.role)]
);

export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  preferredCurrency: text('preferred_currency').notNull().default('INR'),
  defaultBudgetMax: doublePrecision('default_budget_max'),
  preferredCategoriesJson: text('preferred_categories_json').notNull().default('[]'),
  priorityWeightsJson: text('priority_weights_json')
    .notNull()
    .default('{"performance":0.35,"value":0.35,"efficiency":0.15,"reliability":0.15}'),
  emailNotifications: boolean('email_notifications').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    domainGroup: text('domain_group').notNull(), // Electronics | Fashion | Home Appliances | Other
    description: text('description').notNull(),
    iconName: text('icon_name').notNull().default('Layers'),
    displayOrder: integer('display_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_categories_domain').on(table.domainGroup)]
);

export const subcategories = pgTable(
  'subcategories',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_subcategories_cat_slug').on(table.categoryId, table.slug),
    index('idx_subcategories_cat').on(table.categoryId),
  ]
);

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  country: text('country').notNull().default('Global'),
  website: text('website').notNull().default(''),
  description: text('description').notNull().default(''),
  tagline: text('tagline').notNull().default(''),
  accentColor: text('accent_color').notNull().default('#D4AF37'),
  heroDescription: text('hero_description').notNull().default(''),
  soundProfile: text('sound_profile').notNull().default('chime_gold'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    brandId: integer('brand_id')
      .references(() => brands.id, { onDelete: 'restrict' })
      .notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'restrict' })
      .notNull(),
    subcategoryId: integer('subcategory_id').references(() => subcategories.id, {
      onDelete: 'set null',
    }),
    description: text('description').notNull(),
    modelNumber: text('model_number').notNull(),
    variantLabel: text('variant_label').notNull().default('Standard Edition'),
    basePrice: doublePrecision('base_price').notNull(),
    currency: text('currency').notNull().default('INR'),
    stockQuantity: integer('stock_quantity').notNull().default(25),
    taxRatePercent: doublePrecision('tax_rate_percent').notNull().default(18),
    isFeatured: boolean('is_featured').notNull().default(false),
    availabilityStatus: text('availability_status').notNull().default('IN_STOCK'), // IN_STOCK | LIMITED | OUT_OF_STOCK | DISCONTINUED
    status: text('status').notNull().default('ACTIVE'), // ACTIVE | DRAFT | ARCHIVED
    rating: doublePrecision('rating'), // Nullable when reliable rating does not exist
    reviewCount: integer('review_count').notNull().default(0),
    popularityScore: integer('popularity_score').notNull().default(50),
    model3dPreset: text('model_3d_preset').notNull().default('auto'),
    model3dUrl: text('model_3d_url').notNull().default(''),
    finishHex: text('finish_hex').notNull().default('#D4AF37'),
    isDemoData: boolean('is_demo_data').notNull().default(true),
    dataSourceLabel: text('data_source_label')
      .notNull()
      .default('CompareX Seeded Demonstration Catalog'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_products_cat').on(table.categoryId),
    index('idx_products_brand').on(table.brandId),
    index('idx_products_price').on(table.basePrice),
    index('idx_products_status').on(table.status),
  ]
);

export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    url: text('url').notNull(),
    altText: text('alt_text').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [index('idx_product_images_prod').on(table.productId)]
);

export const specificationDefinitions = pgTable(
  'specification_definitions',
  {
    id: serial('id').primaryKey(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    dataType: text('data_type').notNull().default('text'), // numeric | text | boolean | enum
    unit: text('unit').notNull().default(''),
    higherIsBetter: boolean('higher_is_better'), // null for neutral/categorical
    isMandatory: boolean('is_mandatory').notNull().default(false),
    isComparable: boolean('is_comparable').notNull().default(true),
    enumValuesJson: text('enum_values_json').notNull().default('[]'),
    weight: doublePrecision('weight').notNull().default(1.0),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uq_spec_def_cat_key').on(table.categoryId, table.key),
    index('idx_spec_def_cat').on(table.categoryId),
  ]
);

export const productSpecifications = pgTable(
  'product_specifications',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    specDefinitionId: integer('spec_definition_id')
      .references(() => specificationDefinitions.id, { onDelete: 'cascade' })
      .notNull(),
    rawValue: text('raw_value').notNull(),
    numericValue: doublePrecision('numeric_value'),
    unit: text('unit').notNull().default(''),
    normalizedValue: doublePrecision('normalized_value'),
    isConflicting: boolean('is_conflicting').notNull().default(false),
    sourceNote: text('source_note').notNull().default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_prod_spec').on(table.productId, table.specDefinitionId),
    index('idx_prod_spec_prod').on(table.productId),
  ]
);

export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  website: text('website').notNull().default(''),
  reliabilityNote: text('reliability_note').notNull().default('Demo Merchant Record'),
  isAuthorizedApi: boolean('is_authorized_api').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productOffers = pgTable(
  'product_offers',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => sellers.id, { onDelete: 'cascade' })
      .notNull(),
    price: doublePrecision('price').notNull(),
    currency: text('currency').notNull().default('INR'),
    deliveryCharge: doublePrecision('delivery_charge'), // nullable when unknown
    installationCharge: doublePrecision('installation_charge'),
    warrantyCost: doublePrecision('warranty_cost'),
    requiredAccessoriesCost: doublePrecision('required_accessories_cost'),
    additionalFees: doublePrecision('additional_fees'),
    additionalFeesNote: text('additional_fees_note').notNull().default(''),
    availabilityStatus: text('availability_status').notNull().default('IN_STOCK'),
    offerUrl: text('offer_url').notNull().default(''),
    dataSource: text('data_source').notNull().default('Admin-Entered Demo Observation'),
    lastVerifiedAt: timestamp('last_verified_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_offer_prod_seller').on(table.productId, table.sellerId),
    index('idx_offer_prod').on(table.productId),
  ]
);

export const priceObservations = pgTable(
  'price_observations',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    sellerId: integer('seller_id')
      .references(() => sellers.id, { onDelete: 'cascade' })
      .notNull(),
    price: doublePrecision('price').notNull(),
    currency: text('currency').notNull().default('INR'),
    sourceLabel: text('source_label').notNull().default('Seeded Historical Snapshot (Demo)'),
    isDemoData: boolean('is_demo_data').notNull().default(true),
    observedAt: timestamp('observed_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_price_obs_prod_date').on(table.productId, table.observedAt),
    index('idx_price_obs_seller').on(table.sellerId),
  ]
);

export const comparisons = pgTable(
  'comparisons',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'restrict' })
      .notNull(),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_comparisons_user').on(table.userId)]
);

export const comparisonItems = pgTable(
  'comparison_items',
  {
    id: serial('id').primaryKey(),
    comparisonId: integer('comparison_id')
      .references(() => comparisons.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uq_comp_item').on(table.comparisonId, table.productId),
    index('idx_comp_items_comp').on(table.comparisonId),
  ]
);

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  name: text('name').notNull().default('My Wishlist'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: serial('id').primaryKey(),
    wishlistId: integer('wishlist_id')
      .references(() => wishlists.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    targetPrice: doublePrecision('target_price'),
    notes: text('notes').notNull().default(''),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_wishlist_item').on(table.wishlistId, table.productId),
    index('idx_wishlist_items_wl').on(table.wishlistId),
  ]
);

export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_recently_viewed').on(table.userId, table.productId),
    index('idx_recently_viewed_user').on(table.userId, table.viewedAt),
  ]
);

export const recommendationRequests = pgTable(
  'recommendation_requests',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    categoryId: integer('category_id')
      .references(() => categories.id, { onDelete: 'cascade' })
      .notNull(),
    budgetMin: doublePrecision('budget_min'),
    budgetMax: doublePrecision('budget_max').notNull(),
    intendedUsage: text('intended_usage').notNull(),
    preferredBrandId: integer('preferred_brand_id'),
    criteriaJson: text('criteria_json').notNull(),
    resultsSummaryJson: text('results_summary_json').notNull().default('[]'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_rec_req_user').on(table.userId)]
);

// Phase 3 E-Commerce Tables: Inventory Logs, Addresses, Carts, Orders, Order History & Returns

export const inventoryLogs = pgTable(
  'inventory_logs',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    changeAmount: integer('change_amount').notNull(),
    previousStock: integer('previous_stock').notNull(),
    newStock: integer('new_stock').notNull(),
    reason: text('reason').notNull(),
    actorEmail: text('actor_email').notNull().default('system'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_inventory_logs_prod').on(table.productId, table.createdAt)]
);

export const userAddresses = pgTable(
  'user_addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    label: text('label').notNull().default('Home'),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    houseBuilding: text('house_building').notNull(),
    street: text('street').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    postalCode: text('postal_code').notNull(),
    country: text('country').notNull().default('India'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_user_addresses_user').on(table.userId)]
);

export const carts = pgTable(
  'carts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).unique(),
    guestToken: text('guest_token').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_carts_guest').on(table.guestToken)]
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id')
      .references(() => carts.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    quantity: integer('quantity').notNull().default(1),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_cart_item').on(table.cartId, table.productId),
    index('idx_cart_items_cart').on(table.cartId),
  ]
);

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderNumber: text('order_number').notNull().unique(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    status: text('status').notNull().default('Order Placed'),
    paymentMode: text('payment_mode').notNull(), // DEMO_CARD_SIMULATION | DEMO_UPI_SIMULATION | DEMO_COD_SIMULATION
    paymentStatus: text('payment_status').notNull().default('DEMO_VERIFIED'),
    shippingAddressJson: text('shipping_address_json').notNull(),
    deliveryMethod: text('delivery_method').notNull().default('STANDARD'),
    subtotal: doublePrecision('subtotal').notNull(),
    deliveryCharge: doublePrecision('delivery_charge').notNull(),
    taxAmount: doublePrecision('tax_amount').notNull(),
    totalAmount: doublePrecision('total_amount').notNull(),
    currency: text('currency').notNull().default('INR'),
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at'),
    estimatedDeliveryDate: timestamp('estimated_delivery_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_orders_user').on(table.userId, table.createdAt),
    index('idx_orders_status').on(table.status),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    brandNameSnapshot: text('brand_name_snapshot').notNull(),
    modelSnapshot: text('model_snapshot').notNull(),
    variantSnapshot: text('variant_snapshot').notNull().default(''),
    imageSnapshot: text('image_snapshot').notNull().default(''),
    unitPriceSnapshot: doublePrecision('unit_price_snapshot').notNull(),
    taxRateSnapshot: doublePrecision('tax_rate_snapshot').notNull().default(18),
    quantity: integer('quantity').notNull(),
    lineTotal: doublePrecision('line_total').notNull(),
  },
  (table) => [index('idx_order_items_order').on(table.orderId)]
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    status: text('status').notNull(),
    note: text('note').notNull().default(''),
    actorEmail: text('actor_email').notNull().default('system'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_order_history_order').on(table.orderId, table.createdAt)]
);

export const returnRequests = pgTable(
  'return_requests',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    orderItemId: integer('order_item_id')
      .references(() => orderItems.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('Requested'), // Requested | Under Review | Approved | Rejected | Demo Refund Completed
    adminNote: text('admin_note').notNull().default(''),
    demoRefundAmount: doublePrecision('demo_refund_amount').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_return_requests_order').on(table.orderId),
    index('idx_return_requests_user').on(table.userId),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email').notNull().default('system'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull().default(''),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_audit_created').on(table.createdAt)]
);

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Drizzle Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  subcategories: many(subcategories),
  products: many(products),
  specDefinitions: many(specificationDefinitions),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, { fields: [subcategories.categoryId], references: [categories.id] }),
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  subcategory: one(subcategories, {
    fields: [products.subcategoryId],
    references: [subcategories.id],
  }),
  images: many(productImages),
  specifications: many(productSpecifications),
  offers: many(productOffers),
  priceObservations: many(priceObservations),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const specificationDefinitionsRelations = relations(specificationDefinitions, ({ one }) => ({
  category: one(categories, {
    fields: [specificationDefinitions.categoryId],
    references: [categories.id],
  }),
}));

export const productSpecificationsRelations = relations(productSpecifications, ({ one }) => ({
  product: one(products, { fields: [productSpecifications.productId], references: [products.id] }),
  definition: one(specificationDefinitions, {
    fields: [productSpecifications.specDefinitionId],
    references: [specificationDefinitions.id],
  }),
}));

export const productOffersRelations = relations(productOffers, ({ one }) => ({
  product: one(products, { fields: [productOffers.productId], references: [products.id] }),
  seller: one(sellers, { fields: [productOffers.sellerId], references: [sellers.id] }),
}));

export const priceObservationsRelations = relations(priceObservations, ({ one }) => ({
  product: one(products, { fields: [priceObservations.productId], references: [products.id] }),
  seller: one(sellers, { fields: [priceObservations.sellerId], references: [sellers.id] }),
}));

export const comparisonsRelations = relations(comparisons, ({ one, many }) => ({
  user: one(users, { fields: [comparisons.userId], references: [users.id] }),
  category: one(categories, { fields: [comparisons.categoryId], references: [categories.id] }),
  items: many(comparisonItems),
}));

export const comparisonItemsRelations = relations(comparisonItems, ({ one }) => ({
  comparison: one(comparisons, {
    fields: [comparisonItems.comparisonId],
    references: [comparisons.id],
  }),
  product: one(products, { fields: [comparisonItems.productId], references: [products.id] }),
}));

export const wishlistsRelations = relations(wishlists, ({ one, many }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  items: many(wishlistItems),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  wishlist: one(wishlists, { fields: [wishlistItems.wishlistId], references: [wishlists.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  history: many(orderStatusHistory),
  returns: many(returnRequests),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [returnRequests.orderItemId], references: [orderItems.id] }),
  user: one(users, { fields: [returnRequests.userId], references: [users.id] }),
}));
