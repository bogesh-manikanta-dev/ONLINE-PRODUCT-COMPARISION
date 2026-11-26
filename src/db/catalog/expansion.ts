/**
 * CompareX — Phase 4 catalogue expansion (additive demo data).
 *
 * This module is intentionally free of database imports so the catalogue data
 * can be validated by unit tests without a PostgreSQL connection.
 *
 * Contract notes
 * - Every product below reuses an EXISTING brand slug from src/db/seed.ts (26 brands).
 * - `specs` keys must exactly match the specification definitions registered for
 *   that product's category, otherwise the seeding loop silently skips them
 *   (`if (!def) continue`) and the comparison engine loses its inputs.
 * - `rating` and `reviewCount` are deliberately 0: these are demonstration
 *   entries and no customer reviews are fabricated for them.
 * - No sales velocity, "sold this week" or live-price claims are made anywhere.
 *   Prices are static INR demonstration values, flagged by the existing
 *   `isDemoData` / `dataSourceLabel` columns during seeding.
 */

export interface ExpansionProduct {
  name: string;
  slug: string;
  brandSlug: string;
  categorySlug: string;
  subcategorySlug: string;
  modelNumber: string;
  variantLabel: string;
  basePrice: number;
  stockQuantity: number;
  taxRatePercent: number;
  isFeatured: boolean;
  availabilityStatus: 'IN_STOCK' | 'LIMITED';
  rating: number;
  reviewCount: number;
  popularityScore: number;
  description: string;
  primaryImage: string;
  secondaryImage: string;
  specs: Record<string, string>;
}

export interface ExpansionCategory {
  name: string;
  slug: string;
  domainGroup: string;
  description: string;
  iconName: string;
  displayOrder: number;
}

export interface ExpansionSubcategory {
  cat: string;
  name: string;
  slug: string;
  description: string;
}

export interface ExpansionSpecDef {
  categorySlug: string;
  key: string;
  label: string;
  dataType: 'numeric' | 'text' | 'boolean' | 'enum';
  unit: string;
  higherIsBetter: boolean | null;
  isMandatory: boolean;
  isComparable: boolean;
  weight: number;
  sortOrder: number;
}

// Same studio asset paths used by the existing catalogue (kept local so this
// module never imports the database layer).
const IMG = {
  HERO: '/src/assets/images/hero_comparex_studio_1795689411832.jpg',
  SMARTPHONE: '/src/assets/images/prod_smartphone_flagship_1795689412323.jpg',
  LAPTOP_PRO: '/src/assets/images/prod_laptop_pro_1795689412582.jpg',
  HEADPHONES: '/src/assets/images/prod_headphones_studio_1795689413190.jpg',
  SMARTWATCH: '/src/assets/images/prod_smartwatch_studio_1795694166755.jpg',
  TELEVISION: '/src/assets/images/prod_television_oled_1795691708407.jpg',
  FRIDGE: '/src/assets/images/prod_appliance_fridge_1795689414089.jpg',
  WASHER: '/src/assets/images/prod_washer_frontload_1795691708747.jpg',
  CLIMATE: '/src/assets/images/prod_home_climate_appliances_1795694168275.jpg',
  PURIFIER: '/src/assets/images/prod_purifier_kitchen_studio_1795694168312.jpg',
  SNEAKER: '/src/assets/images/prod_fashion_sneaker_1795689414392.jpg',
  CHAIR: '/src/assets/images/prod_furniture_chair_1795689414733.jpg',
} as const;

/** New category introduced by this phase (Personal Care). */
export const EXPANSION_CATEGORIES: ExpansionCategory[] = [
  {
    name: 'Personal Care',
    slug: 'personal-care',
    domainGroup: 'Other',
    description: 'Beard trimmers and premium hair-care styling tools.',
    iconName: 'Sparkles',
    displayOrder: 18,
  },
];

export const EXPANSION_SUBCATEGORIES: ExpansionSubcategory[] = [
  { cat: 'personal-care', name: 'Grooming', slug: 'grooming', description: 'Beard and body grooming tools' },
  { cat: 'personal-care', name: 'Hair Care', slug: 'hair-care', description: 'Styling and drying tools' },
];

export const EXPANSION_SPEC_DEFS: ExpansionSpecDef[] = [
  { categorySlug: 'personal-care', key: 'power_watts', label: 'Motor Power', dataType: 'numeric', unit: 'W', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 1 },
  { categorySlug: 'personal-care', key: 'runtime_minutes', label: 'Cordless Runtime', dataType: 'numeric', unit: 'minutes', higherIsBetter: true, isMandatory: false, isComparable: true, weight: 1.1, sortOrder: 2 },
  { categorySlug: 'personal-care', key: 'water_resistant', label: 'Water Resistant Body', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 3 },
  { categorySlug: 'personal-care', key: 'attachments', label: 'Included Attachments', dataType: 'numeric', unit: '', higherIsBetter: true, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 4 },
];

export const EXPANSION_PRODUCTS: ExpansionProduct[] = [
  // --- SMARTPHONES (+2) ---
  {
    name: 'Samsung Galaxy S24 FE',
    slug: 'samsung-galaxy-s24-fe',
    brandSlug: 'samsung',
    categorySlug: 'smartphones',
    subcategorySlug: 'flagship',
    modelNumber: 'SM-S721BZKGINS',
    variantLabel: 'Graphite • 8GB / 256GB',
    basePrice: 59999,
    stockQuantity: 24,
    taxRatePercent: 18,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 64,
    description: 'Fan Edition flagship that carries Galaxy AI photo assist, a 6.7-inch 120Hz Dynamic AMOLED 2X panel and an aluminium frame into a more accessible 8GB/256GB configuration.',
    primaryImage: IMG.SMARTPHONE,
    secondaryImage: IMG.HERO,
    specs: { processor: 'Exynos 2400e', ram: '8 GB', storage: '256 GB', camera: '50 MP', display: '6.7-inch Dynamic AMOLED 2X', battery: '4700 mAh', refresh_rate: '120 Hz' },
  },
  {
    name: 'OnePlus Nord 4',
    slug: 'oneplus-nord-4',
    brandSlug: 'oneplus',
    categorySlug: 'smartphones',
    subcategorySlug: 'value-flagship',
    modelNumber: 'CPH2621',
    variantLabel: 'Mercurial Silver • 12GB / 256GB',
    basePrice: 33999,
    stockQuantity: 32,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 62,
    description: 'All-metal unibody mid-premium smartphone pairing Snapdragon 7+ Gen 3 with a 5500mAh battery, 100W SUPERVOOC charging and a 120Hz 1.5K AMOLED display.',
    primaryImage: IMG.SMARTPHONE,
    secondaryImage: IMG.HERO,
    specs: { processor: 'Snapdragon 7+ Gen 3', ram: '12 GB', storage: '256 GB', camera: '50 MP', display: '6.74-inch 1.5K AMOLED', battery: '5500 mAh', refresh_rate: '120 Hz' },
  },

  // --- LAPTOPS (+2) ---
  {
    name: 'Apple MacBook Air 13 (M3)',
    slug: 'apple-macbook-air-13-m3',
    brandSlug: 'apple',
    categorySlug: 'laptops',
    subcategorySlug: 'ultrabooks',
    modelNumber: 'MRXV3HN/A',
    variantLabel: 'Midnight • 8GB / 256GB SSD',
    basePrice: 114900,
    stockQuantity: 12,
    taxRatePercent: 18,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 68,
    description: 'Fanless 1.24kg ultrabook built on the Apple M3 chip, with a 13.6-inch Liquid Retina display, MagSafe charging and an 18-hour rated battery.',
    primaryImage: IMG.LAPTOP_PRO,
    secondaryImage: IMG.HERO,
    specs: { processor: 'Apple M3 (8-core CPU)', ram: '8 GB', storage: '256 GB', display: '13.6-inch Liquid Retina', battery: '18 hours', graphics: '8-core integrated GPU', weight: '1.24 kg' },
  },
  {
    name: 'Lenovo IdeaPad Slim 5',
    slug: 'lenovo-ideapad-slim-5',
    brandSlug: 'lenovo',
    categorySlug: 'laptops',
    subcategorySlug: 'ultrabooks',
    modelNumber: '83DC004XIN',
    variantLabel: 'Cloud Grey • 16GB / 512GB SSD',
    basePrice: 62990,
    stockQuantity: 20,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 60,
    description: 'Aluminium-clad productivity notebook with a Ryzen 7 7730U, 16GB dual-channel memory, a 15.6-inch 300-nit IPS panel and a backlit keyboard.',
    primaryImage: IMG.LAPTOP_PRO,
    secondaryImage: IMG.HERO,
    specs: { processor: 'AMD Ryzen 7 7730U', ram: '16 GB', storage: '512 GB', display: '15.6-inch FHD IPS 300 nits', battery: '10 hours', graphics: 'AMD Radeon integrated', weight: '1.46 kg' },
  },

  // --- TELEVISIONS (+2) ---
  {
    name: 'LG OLED evo C3 55-inch',
    slug: 'lg-oled-evo-c3-55',
    brandSlug: 'lg',
    categorySlug: 'televisions',
    subcategorySlug: '4k-qled',
    modelNumber: 'OLED55C3PSA',
    variantLabel: '55-inch • 4K OLED evo',
    basePrice: 129990,
    stockQuantity: 7,
    taxRatePercent: 18,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 66,
    description: 'Self-lit 4K OLED evo panel with per-pixel contrast, a 120Hz refresh rate for console gaming, and four HDMI 2.1 ports supporting VRR and ALLM.',
    primaryImage: IMG.TELEVISION,
    secondaryImage: IMG.HERO,
    specs: { screen_size: '55 inches', panel_type: '4K OLED evo (self-lit pixels)', refresh_rate: '120 Hz', hdmi_21: '4 ports' },
  },
  {
    name: 'Sony Bravia X90L 55-inch',
    slug: 'sony-bravia-x90l-55',
    brandSlug: 'sony',
    categorySlug: 'televisions',
    subcategorySlug: '4k-qled',
    modelNumber: 'XR-55X90L',
    variantLabel: '55-inch • 4K Full Array LED',
    basePrice: 119900,
    stockQuantity: 9,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 63,
    description: 'Full Array LED 4K television driven by the Cognitive Processor XR, with X-Motion Clarity smoothing, Google TV and four HDMI 2.1 inputs.',
    primaryImage: IMG.TELEVISION,
    secondaryImage: IMG.HERO,
    specs: { screen_size: '55 inches', panel_type: '4K Full Array LED', refresh_rate: '120 Hz', hdmi_21: '4 ports' },
  },

  // --- HEADPHONES / AUDIO (+2) ---
  {
    name: 'Sony WH-CH720N Wireless ANC Headphones',
    slug: 'sony-wh-ch720n',
    brandSlug: 'sony',
    categorySlug: 'headphones',
    subcategorySlug: 'over-ear-anc',
    modelNumber: 'WHCH720N/B',
    variantLabel: 'Black • Wireless ANC',
    basePrice: 8990,
    stockQuantity: 28,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 61,
    description: 'Lightweight 192g over-ear headphone with dual noise sensor ANC, 30mm drivers, multipoint Bluetooth 5.2 and a 35-hour rated battery.',
    primaryImage: IMG.HEADPHONES,
    secondaryImage: IMG.HERO,
    specs: { battery: '35 hours', anc: 'Yes', driver_size: '30 mm', weight: '192 g', bluetooth: 'Bluetooth 5.2' },
  },
  {
    name: 'JBL Live 770NC Wireless Headphones',
    slug: 'jbl-live-770nc',
    brandSlug: 'jbl',
    categorySlug: 'headphones',
    subcategorySlug: 'over-ear-anc',
    modelNumber: 'JBLLIVE770NCBLK',
    variantLabel: 'Black • Adaptive ANC',
    basePrice: 9999,
    stockQuantity: 34,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 59,
    description: 'Adaptive noise-cancelling over-ear headphone with 40mm JBL Signature Sound drivers, Personi-Fi hearing profiling and up to 65 hours of playback.',
    primaryImage: IMG.HEADPHONES,
    secondaryImage: IMG.HERO,
    specs: { battery: '65 hours', anc: 'Yes', driver_size: '40 mm', weight: '232 g', bluetooth: 'Bluetooth 5.3' },
  },

  // --- SMARTWATCHES (+2) ---
  {
    name: 'Apple Watch SE (2nd Gen)',
    slug: 'apple-watch-se-2nd-gen',
    brandSlug: 'apple',
    categorySlug: 'smartwatches',
    subcategorySlug: 'connected-wearables',
    modelNumber: 'MRE03HN/A',
    variantLabel: 'Midnight • 40mm GPS',
    basePrice: 29900,
    stockQuantity: 16,
    taxRatePercent: 18,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 65,
    description: '40mm aluminium GPS smartwatch with a Retina LTPO OLED display, crash and fall detection, sleep staging and 50m water resistance.',
    primaryImage: IMG.SMARTWATCH,
    secondaryImage: IMG.HERO,
    specs: { case_size: '40 mm', battery: '18 hours', display: 'Retina LTPO OLED', water_resistance: '50 m', gps: 'Yes' },
  },
  {
    name: 'Samsung Galaxy Watch FE',
    slug: 'samsung-galaxy-watch-fe',
    brandSlug: 'samsung',
    categorySlug: 'smartwatches',
    subcategorySlug: 'connected-wearables',
    modelNumber: 'SM-R861N',
    variantLabel: 'Black • 40mm Bluetooth',
    basePrice: 19999,
    stockQuantity: 21,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 58,
    description: '40mm Super AMOLED smartwatch offering body composition analysis, sleep coaching, an ECG-capable sensor array and 5ATM water resistance.',
    primaryImage: IMG.SMARTWATCH,
    secondaryImage: IMG.HERO,
    specs: { case_size: '40 mm', battery: '30 hours', display: 'Super AMOLED', water_resistance: '50 m', gps: 'Yes' },
  },

  // --- HOME APPLIANCES (+4) ---
  {
    name: 'LG 242L 4-Star Smart Inverter Refrigerator',
    slug: 'lg-242l-smart-inverter-fridge',
    brandSlug: 'lg',
    categorySlug: 'refrigerators',
    subcategorySlug: 'double-door-inverter',
    modelNumber: 'GL-S292RPZX',
    variantLabel: 'Shiny Steel • 242L Double Door',
    basePrice: 24990,
    stockQuantity: 18,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 57,
    description: 'Frost-free double-door refrigerator with a 4-star rated Smart Inverter Compressor, stabiliser-free operation and a humidity-controlled vegetable crisper.',
    primaryImage: IMG.FRIDGE,
    secondaryImage: IMG.CLIMATE,
    specs: { capacity: '242 L', energy_rating: '4 stars', annual_energy: '168 kWh', cooling_tech: 'Smart Inverter Frost-Free' },
  },
  {
    name: 'IFB 7kg Front Load Washing Machine',
    slug: 'ifb-7kg-front-load-washer',
    brandSlug: 'ifb',
    categorySlug: 'washing-machines',
    subcategorySlug: 'front-load',
    modelNumber: 'DIVA-AQUA-VX-7010',
    variantLabel: 'White • 7 kg / 1200 RPM',
    basePrice: 27990,
    stockQuantity: 13,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 57,
    description: 'Front-load washer with a 1200 RPM spin, 3D Wash System jets, inbuilt heater for hot-wash cycles and a child-lock equipped digital display.',
    primaryImage: IMG.WASHER,
    secondaryImage: IMG.CLIMATE,
    specs: { capacity: '7 kg', spin_speed: '1200 RPM', energy_rating: '5 stars', steam_cycle: 'Yes' },
  },
  {
    name: 'LG 1.5 Ton 5-Star AI Dual Inverter Split AC',
    slug: 'lg-1-5t-5star-ai-dual-inverter-ac',
    brandSlug: 'lg',
    categorySlug: 'air-conditioners',
    subcategorySlug: 'inverter-split',
    modelNumber: 'PS-Q19YNZE',
    variantLabel: 'White • 1.5 Ton Dual Inverter',
    basePrice: 42990,
    stockQuantity: 10,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 62,
    description: '5-star inverter split AC with a dual-rotor compressor, 6-in-1 convertible cooling modes, HD filter with anti-virus protection and a copper condenser.',
    primaryImage: IMG.CLIMATE,
    secondaryImage: IMG.PURIFIER,
    specs: { tonnage: '1.5 Ton', energy_rating: '5 stars', iseer: '5.2', condenser: '100% Copper Coil' },
  },
  {
    name: 'Samsung 23L Convection Microwave Oven',
    slug: 'samsung-23l-convection-microwave',
    brandSlug: 'samsung',
    categorySlug: 'microwaves',
    subcategorySlug: 'convection-oven',
    modelNumber: 'MC23A5025CT',
    variantLabel: 'Black • 23L Convection',
    basePrice: 12490,
    stockQuantity: 22,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 56,
    description: '23-litre convection microwave combining solo, grill and convection modes with ceramic enamel cavity, dough proofing and auto-cook presets.',
    primaryImage: IMG.PURIFIER,
    secondaryImage: IMG.CLIMATE,
    specs: { capacity: '23 L', power_watts: '800 W', cooking_mode: 'Convection + Grill + Solo', rotisserie: 'No' },
  },

  // --- FURNITURE (+1) ---
  {
    name: 'IKEA Järvfjället Ergonomic Office Chair',
    slug: 'ikea-jarvfjallet-office-chair',
    brandSlug: 'ikea',
    categorySlug: 'furniture',
    subcategorySlug: 'ergonomic-seating',
    modelNumber: '504.942.71',
    variantLabel: 'Gunnared Dark Grey • High-Back',
    basePrice: 17990,
    stockQuantity: 14,
    taxRatePercent: 12,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 59,
    description: 'High-back workspace chair with an adjustable lumbar support, tilt tension control, 10-year frame warranty and a woven Gunnared fabric seat.',
    primaryImage: IMG.CHAIR,
    secondaryImage: IMG.HERO,
    specs: { material: 'Steel Frame & Woven Fabric', weight_capacity: '110 kg', warranty: '10 years', lumbar_support: 'Yes' },
  },

  // --- KITCHEN APPLIANCES (+1) ---
  {
    name: 'Bosch TrueMixx Pro 1000W Mixer Grinder',
    slug: 'bosch-truemixx-pro-mixer-grinder',
    brandSlug: 'bosch',
    categorySlug: 'kitchen-appliances',
    subcategorySlug: 'mixer-grinders',
    modelNumber: 'MGM8842MIN',
    variantLabel: 'Black • 1000W (4 Jars)',
    basePrice: 5999,
    stockQuantity: 26,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 60,
    description: '1000W copper-wound mixer grinder with four stainless steel jars, Stone Pounding Technology for wet grinding and a 5-year motor warranty.',
    primaryImage: IMG.PURIFIER,
    secondaryImage: IMG.HERO,
    specs: { power_watts: '1000 W', jar_count: '4 jars', speed_settings: '3 Speed + Pulse', warranty: '5 years' },
  },

  // --- FASHION (+1) ---
  {
    name: "Nike Air Force 1 '07",
    slug: 'nike-air-force-1-07',
    brandSlug: 'nike',
    categorySlug: 'footwear',
    subcategorySlug: 'lifestyle-sneakers',
    modelNumber: 'CW2288-111',
    variantLabel: 'Triple White • UK 9',
    basePrice: 9695,
    stockQuantity: 40,
    taxRatePercent: 12,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 64,
    description: 'Court-born low-top sneaker in full-grain leather with an encapsulated Nike Air sole unit, perforated toe box and a pivot-point rubber outsole.',
    primaryImage: IMG.SNEAKER,
    secondaryImage: IMG.HERO,
    specs: { weight: '410 g', cushion_foam: 'Encapsulated Nike Air Sole', upper_material: 'Full-Grain Leather', heel_drop: '10 mm' },
  },

  // --- PERSONAL CARE (+2, new category) ---
  {
    name: 'Philips BT3211 Cordless Beard Trimmer',
    slug: 'philips-bt3211-beard-trimmer',
    brandSlug: 'philips',
    categorySlug: 'personal-care',
    subcategorySlug: 'grooming',
    modelNumber: 'BT3211/15',
    variantLabel: 'Black • 60-min Runtime',
    basePrice: 1795,
    stockQuantity: 45,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'IN_STOCK',
    rating: 0,
    reviewCount: 0,
    popularityScore: 55,
    description: 'Cordless beard trimmer with DuraPower motor, 20 length settings, three clip-on combs and a full-body water-resistant housing for dry or wet use.',
    primaryImage: IMG.PURIFIER,
    secondaryImage: IMG.HERO,
    specs: { power_watts: '7 W', runtime_minutes: '60 minutes', water_resistant: 'Yes', attachments: '3' },
  },
  {
    name: 'Dyson Supersonic Hair Dryer',
    slug: 'dyson-supersonic-hair-dryer',
    brandSlug: 'dyson',
    categorySlug: 'personal-care',
    subcategorySlug: 'hair-care',
    modelNumber: 'HD08',
    variantLabel: 'Iron / Fuchsia • 1600W',
    basePrice: 34900,
    stockQuantity: 8,
    taxRatePercent: 18,
    isFeatured: false,
    availabilityStatus: 'LIMITED',
    rating: 0,
    reviewCount: 0,
    popularityScore: 61,
    description: 'Corded styling dryer with a V9 digital motor spinning at 110,000 RPM, intelligent heat control measuring air temperature 40 times per second, and five magnetic attachments.',
    primaryImage: IMG.HERO,
    secondaryImage: IMG.PURIFIER,
    specs: { power_watts: '1600 W', runtime_minutes: 'Corded (continuous)', water_resistant: 'No', attachments: '5' },
  },
];

/**
 * Catalogue spec contract: the specification keys registered for each category.
 * Mirrors the definitions in src/db/seed.ts and is asserted by the seed tests so
 * a typo in `specs` can never silently drop a comparable attribute.
 */
export const CATEGORY_SPEC_KEYS: Record<string, string[]> = {
  smartphones: ['processor', 'ram', 'storage', 'camera', 'display', 'battery', 'refresh_rate'],
  laptops: ['processor', 'ram', 'storage', 'display', 'battery', 'graphics', 'weight'],
  headphones: ['battery', 'anc', 'driver_size', 'weight', 'bluetooth'],
  smartwatches: ['case_size', 'battery', 'display', 'water_resistance', 'gps'],
  televisions: ['screen_size', 'panel_type', 'refresh_rate', 'hdmi_21'],
  footwear: ['weight', 'cushion_foam', 'upper_material', 'heel_drop'],
  bags: ['capacity', 'laptop_sleeve', 'water_resistant', 'weight'],
  watches: ['case_diameter', 'movement', 'water_resistance', 'strap_material'],
  clothing: ['fabric_composition', 'fit_style', 'gsm_weight', 'care_mode'],
  refrigerators: ['capacity', 'energy_rating', 'annual_energy', 'cooling_tech'],
  'washing-machines': ['capacity', 'spin_speed', 'energy_rating', 'steam_cycle'],
  'air-conditioners': ['tonnage', 'energy_rating', 'iseer', 'condenser'],
  microwaves: ['capacity', 'power_watts', 'cooking_mode', 'rotisserie'],
  'vacuum-cleaners': ['power_watts', 'dust_capacity', 'hepa_filter', 'weight'],
  furniture: ['material', 'weight_capacity', 'warranty', 'lumbar_support'],
  'kitchen-appliances': ['power_watts', 'jar_count', 'speed_settings', 'warranty'],
  'air-purifiers': ['cadr', 'coverage_area', 'hepa_grade', 'noise_db'],
  'personal-care': ['power_watts', 'runtime_minutes', 'water_resistant', 'attachments'],
};

/** Numeric spec keys per category, used by the tests to assert parseability. */
export const CATEGORY_NUMERIC_SPEC_KEYS: Record<string, string[]> = {
  smartphones: ['ram', 'storage', 'camera', 'battery', 'refresh_rate'],
  laptops: ['ram', 'storage', 'battery', 'weight'],
  headphones: ['battery', 'driver_size', 'weight'],
  smartwatches: ['case_size', 'battery', 'water_resistance'],
  televisions: ['screen_size', 'refresh_rate', 'hdmi_21'],
  footwear: ['weight', 'heel_drop'],
  bags: ['capacity', 'laptop_sleeve', 'weight'],
  watches: ['case_diameter', 'water_resistance'],
  clothing: ['gsm_weight'],
  refrigerators: ['capacity', 'energy_rating', 'annual_energy'],
  'washing-machines': ['capacity', 'spin_speed', 'energy_rating'],
  'air-conditioners': ['tonnage', 'energy_rating', 'iseer'],
  microwaves: ['capacity', 'power_watts'],
  'vacuum-cleaners': ['power_watts', 'dust_capacity', 'weight'],
  furniture: ['weight_capacity', 'warranty'],
  'kitchen-appliances': ['power_watts', 'jar_count', 'warranty'],
  'air-purifiers': ['cadr', 'coverage_area', 'noise_db'],
  'personal-care': ['power_watts', 'runtime_minutes', 'attachments'],
};
