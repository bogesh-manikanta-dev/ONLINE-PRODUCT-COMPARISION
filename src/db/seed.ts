import { and, eq, notInArray } from 'drizzle-orm';
import { normalizeNumericSpec } from '../../shared/engines/comparisonEngine.ts';
import {
  EXPANSION_CATEGORIES,
  EXPANSION_PRODUCTS,
  EXPANSION_SPEC_DEFS,
  EXPANSION_SUBCATEGORIES,
} from './catalog/expansion.ts';
import { db } from './index.ts';
import {
  auditLogs,
  brands,
  categories,
  priceObservations,
  productImages,
  productOffers,
  products,
  productSpecifications,
  roles,
  sellers,
  specificationDefinitions,
  subcategories,
  systemSettings,
} from './schema.ts';

// Bumped to v2 for the Phase 4 catalogue expansion: existing installations
// re-run the idempotent sync so the 19 new demo products appear, while every
// existing product row is upserted by slug and therefore preserved.
const PHASE3_SEED_VERSION = 'v2';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runPhase3SyncIfNeeded().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

export async function seedDatabase(): Promise<void> {
  await runPhase3SyncIfNeeded();
}

async function runPhase3SyncIfNeeded(): Promise<void> {
  const [setting] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, 'phase3_catalog_version'))
    .limit(1);

  if (setting?.value === PHASE3_SEED_VERSION) {
    return;
  }

  await syncPhase3Catalog();
}

const IMG = {
  HERO: '/src/assets/images/hero_comparex_studio_1795689411832.jpg',
  LAPTOP_PRO: '/src/assets/images/prod_laptop_pro_1795689412582.jpg',
  LAPTOP_DETAIL: '/src/assets/images/prod_laptop_detail_1795691710474.jpg',
  SMARTPHONE: '/src/assets/images/prod_smartphone_flagship_1795689412323.jpg',
  HEADPHONES: '/src/assets/images/prod_headphones_studio_1795689413190.jpg',
  AUDIO_DETAIL: '/src/assets/images/prod_audio_detail_1795691709450.jpg',
  SMARTWATCH: '/src/assets/images/prod_smartwatch_studio_1795694166755.jpg',
  TELEVISION: '/src/assets/images/prod_television_oled_1795691708407.jpg',
  FRIDGE: '/src/assets/images/prod_appliance_fridge_1795689414089.jpg',
  WASHER: '/src/assets/images/prod_washer_frontload_1795691708747.jpg',
  CLIMATE: '/src/assets/images/prod_home_climate_appliances_1795694168275.jpg',
  PURIFIER: '/src/assets/images/prod_purifier_kitchen_studio_1795694168312.jpg',
  WATCH: '/src/assets/images/prod_fashion_chronograph_1795689413944.jpg',
  SNEAKER: '/src/assets/images/prod_fashion_sneaker_1795689414392.jpg',
  BACKPACK: '/src/assets/images/prod_backpack_apparel_1795694167347.jpg',
  CHAIR: '/src/assets/images/prod_furniture_chair_1795689414733.jpg',
};

interface SeedSpecDef {
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

interface SeedProduct {
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

async function syncPhase3Catalog(): Promise<void> {
  // 1. Roles
  await db
    .insert(roles)
    .values([
      { name: 'GUEST', description: 'Unauthenticated visitor able to browse, compare, and build a cart' },
      { name: 'CONSUMER', description: 'Registered consumer with checkout, orders, saved comparisons, wishlist, and addresses' },
      { name: 'ADMIN', description: 'System administrator with full catalog, inventory, orders, returns, and quality controls' },
    ])
    .onConflictDoNothing();

  // 2. Default recommendation & commerce config in system_settings
  await db
    .insert(systemSettings)
    .values({
      key: 'recommendation_config',
      value: JSON.stringify({
        strategy: 'BALANCED_DECISION',
        defaultWeights: { performance: 35, value: 35, efficiency: 15, reliability: 15 },
        freeDeliveryThreshold: 2000,
        standardDeliveryFee: 99,
        expressDeliveryFee: 199,
        cancellableStatuses: ['Order Placed', 'Order Confirmed', 'Processing', 'Packed'],
      }),
    })
    .onConflictDoNothing();

  // 3. Categories (17 consumer categories across 4 domain groups)
  const categoryInputs = [
    { name: 'Smartphones', slug: 'smartphones', domainGroup: 'Electronics', description: 'Flagship, performance, and everyday 5G smartphones.', iconName: 'Smartphone', displayOrder: 1 },
    { name: 'Laptops', slug: 'laptops', domainGroup: 'Electronics', description: 'Ultrabooks, creator machines, and developer notebooks.', iconName: 'Laptop', displayOrder: 2 },
    { name: 'Headphones', slug: 'headphones', domainGroup: 'Electronics', description: 'Studio ANC over-ear and wireless commuter headphones.', iconName: 'Headphones', displayOrder: 3 },
    { name: 'Smartwatches', slug: 'smartwatches', domainGroup: 'Electronics', description: 'Health, fitness, and connected wrist wearables.', iconName: 'Watch', displayOrder: 4 },
    { name: 'Televisions', slug: 'televisions', domainGroup: 'Electronics', description: '4K QLED and smart home cinema displays.', iconName: 'Tv', displayOrder: 5 },
    { name: 'Footwear', slug: 'footwear', domainGroup: 'Fashion', description: 'Performance running trainers and lifestyle sneakers.', iconName: 'Footprints', displayOrder: 6 },
    { name: 'Bags', slug: 'bags', domainGroup: 'Fashion', description: 'Laptop backpacks and everyday urban travel packs.', iconName: 'Briefcase', displayOrder: 7 },
    { name: 'Watches', slug: 'watches', domainGroup: 'Fashion', description: 'Classic stainless steel, resin, and chronograph timepieces.', iconName: 'Clock', displayOrder: 8 },
    { name: 'Clothing', slug: 'clothing', domainGroup: 'Fashion', description: 'Essential denim, cotton apparel, and daily wardrobe staples.', iconName: 'Shirt', displayOrder: 9 },
    { name: 'Refrigerators', slug: 'refrigerators', domainGroup: 'Home Appliances', description: 'Convertible inverter double-door and side-by-side cooling.', iconName: 'Refrigerator', displayOrder: 10 },
    { name: 'Washing Machines', slug: 'washing-machines', domainGroup: 'Home Appliances', description: 'Inverter front-load and high-efficiency laundry systems.', iconName: 'Waves', displayOrder: 11 },
    { name: 'Air Conditioners', slug: 'air-conditioners', domainGroup: 'Home Appliances', description: 'Inverter split ACs engineered for tropical climate efficiency.', iconName: 'Wind', displayOrder: 12 },
    { name: 'Microwaves', slug: 'microwaves', domainGroup: 'Home Appliances', description: 'Convection and rotisserie smart kitchen microwave ovens.', iconName: 'Flame', displayOrder: 13 },
    { name: 'Vacuum Cleaners', slug: 'vacuum-cleaners', domainGroup: 'Home Appliances', description: 'High-suction dry and wet canister home vacuum cleaners.', iconName: 'Sparkles', displayOrder: 14 },
    { name: 'Furniture', slug: 'furniture', domainGroup: 'Other', description: 'Ergonomic work chairs and modular workspace seating.', iconName: 'Armchair', displayOrder: 15 },
    { name: 'Kitchen Appliances', slug: 'kitchen-appliances', domainGroup: 'Other', description: 'High-wattage mixer grinders and daily prep appliances.', iconName: 'Utensils', displayOrder: 16 },
    { name: 'Air Purifiers', slug: 'air-purifiers', domainGroup: 'Other', description: 'HEPA filtration and real-time indoor air quality purifiers.', iconName: 'Leaf', displayOrder: 17 },
    ...EXPANSION_CATEGORIES,
  ];

  const catBySlug = new Map<string, typeof categories.$inferSelect>();
  for (const c of categoryInputs) {
    const [row] = await db
      .insert(categories)
      .values(c)
      .onConflictDoUpdate({
        target: categories.slug,
        set: {
          name: c.name,
          domainGroup: c.domainGroup,
          description: c.description,
          iconName: c.iconName,
          displayOrder: c.displayOrder,
        },
      })
      .returning();
    catBySlug.set(c.slug, row);
  }

  // 4. Subcategories
  const subInputs = [
    { cat: 'smartphones', name: 'Flagship Phones', slug: 'flagship', description: 'Top-tier camera & silicon' },
    { cat: 'smartphones', name: 'Value Flagship', slug: 'value-flagship', description: 'High-refresh performance smartphones' },
    { cat: 'laptops', name: 'Ultrabooks', slug: 'ultrabooks', description: 'Thin & light productivity laptops' },
    { cat: 'laptops', name: 'Creator & Gaming', slug: 'creator-gaming', description: 'High-wattage CPU & GPU notebooks' },
    { cat: 'headphones', name: 'Over-Ear ANC', slug: 'over-ear-anc', description: 'Active noise-canceling headphones' },
    { cat: 'smartwatches', name: 'Connected Wearables', slug: 'connected-wearables', description: 'Fitness & health tracking smartwatches' },
    { cat: 'televisions', name: '4K QLED & Smart TV', slug: '4k-qled', description: 'Quantum-dot 4K displays' },
    { cat: 'footwear', name: 'Running & Training', slug: 'running-training', description: 'Responsive road running trainers' },
    { cat: 'footwear', name: 'Lifestyle Sneakers', slug: 'lifestyle-sneakers', description: 'Everyday court & street sneakers' },
    { cat: 'bags', name: 'Tech Backpacks', slug: 'tech-backpacks', description: 'Padded laptop & travel backpacks' },
    { cat: 'watches', name: 'Analog & Digital Classics', slug: 'analog-digital', description: 'Everyday steel & sport watches' },
    { cat: 'clothing', name: 'Denim & Tops', slug: 'denim-tops', description: 'Everyday wardrobe essentials' },
    { cat: 'refrigerators', name: 'Double Door Inverter', slug: 'double-door-inverter', description: 'Frost-free family cooling' },
    { cat: 'washing-machines', name: 'Front Load', slug: 'front-load', description: 'Inverter front-load washers' },
    { cat: 'air-conditioners', name: 'Inverter Split AC', slug: 'inverter-split', description: '1.5 Ton 5-Star inverter ACs' },
    { cat: 'microwaves', name: 'Convection Oven', slug: 'convection-oven', description: 'Multi-stage convection microwaves' },
    { cat: 'vacuum-cleaners', name: 'Canister Vacuum', slug: 'canister-vacuum', description: 'Bagless cyclonic floor vacuums' },
    { cat: 'furniture', name: 'Ergonomic Seating', slug: 'ergonomic-seating', description: 'Lumbar-supported desk chairs' },
    { cat: 'kitchen-appliances', name: 'Mixer Grinders', slug: 'mixer-grinders', description: 'Heavy-duty wet & dry grinding' },
    { cat: 'air-purifiers', name: 'HEPA Purifiers', slug: 'hepa-purifiers', description: 'H13 HEPA indoor purification' },
    ...EXPANSION_SUBCATEGORIES,
  ];

  const subByKey = new Map<string, typeof subcategories.$inferSelect>();
  for (const s of subInputs) {
    const cat = catBySlug.get(s.cat)!;
    const [row] = await db
      .insert(subcategories)
      .values({ categoryId: cat.id, name: s.name, slug: s.slug, description: s.description })
      .onConflictDoUpdate({
        target: [subcategories.categoryId, subcategories.slug],
        set: { name: s.name, description: s.description },
      })
      .returning();
    subByKey.set(`${s.cat}:${s.slug}`, row);
  }

  // 5. Real-World Brands (26 brands)
  const brandInputs = [
    { name: 'Samsung', slug: 'samsung', country: 'South Korea', website: 'https://www.samsung.com/in/', tagline: 'Next-Gen Galaxy, Display & Home Ecosystems', accentColor: '#38BDF8', description: 'Global consumer electronics leader spanning flagship Galaxy devices, QLED TVs, and digital inverter appliances.', heroDescription: 'Compare flagship Galaxy silicon, QLED cinema panels, and convertible digital inverter appliances engineered for connected living.' },
    { name: 'Apple', slug: 'apple', country: 'United States', website: 'https://www.apple.com/in/', tagline: 'Precision Silicon & Seamless Ecosystem', accentColor: '#A78BFA', description: 'Creator-grade iPhone hardware, Apple Watch health sensors, and tightly integrated software ecosystems.', heroDescription: 'Explore Apple smartphones and wearables evaluated across display luminance, battery endurance, and build longevity.' },
    { name: 'OnePlus', slug: 'oneplus', country: 'China', website: 'https://www.oneplus.in/', tagline: 'Fast & Smooth Flagship Engineering', accentColor: '#F43F5E', description: 'High-refresh AMOLED smartphones with ultra-fast charging and OxygenOS responsiveness.', heroDescription: 'Built around fast-charging architecture, smooth 120Hz panels, and competitive performance-per-rupee.' },
    { name: 'Xiaomi', slug: 'xiaomi', country: 'China', website: 'https://www.mi.com/in/', tagline: 'Innovation Accessible to Everyone', accentColor: '#FB923C', description: 'High-value smartphones and smart consumer hardware combining Leica-tuned optics with aggressive pricing.', heroDescription: 'High-spec mobile hardware benchmarked objectively for camera resolution, charging speed, and value.' },
    { name: 'Dell', slug: 'dell', country: 'United States', website: 'https://www.dell.com/en-in', tagline: 'Precision Business & Creator Laptops', accentColor: '#60A5FA', description: 'Precision-milled XPS ultrabooks and enterprise notebooks trusted by engineers and designers.', heroDescription: 'Evaluate Dell laptops across sustained CPU performance, display clarity, and aluminum chassis durability.' },
    { name: 'HP', slug: 'hp', country: 'United States', website: 'https://www.hp.com/in-en/', tagline: 'Engineered for Everyday Productivity', accentColor: '#22D3EE', description: 'Versatile Pavilion and Envy laptops balancing portable acoustics, keyboard comfort, and battery runtime.', heroDescription: 'Compare HP everyday and student notebooks with transparent storage, weight, and battery specs.' },
    { name: 'Lenovo', slug: 'lenovo', country: 'China', website: 'https://www.lenovo.com/in/en/', tagline: 'Smarter Technology for All', accentColor: '#EF4444', description: 'Yoga ultrabooks and Think-series machines crafted for reliability, thermal discipline, and travel.', heroDescription: 'Slim anodized ultrabooks and multi-mode laptops built for coders, analysts, and frequent travelers.' },
    { name: 'ASUS', slug: 'asus', country: 'Taiwan', website: 'https://www.asus.com/in/', tagline: 'In Search of Incredible Hardware', accentColor: '#818CF8', description: 'ROG performance gaming laptops and OLED Zenbooks pushing thermal and display boundaries.', heroDescription: 'Compare ASUS high-refresh displays, discrete graphics thermals, and OLED portable engineering.' },
    { name: 'Sony', slug: 'sony', country: 'Japan', website: 'https://www.sony.co.in/', tagline: 'Reference Acoustic & Optical Precision', accentColor: '#C084FC', description: 'Industry-benchmark active noise-canceling headphones and acoustic engineering.', heroDescription: 'Experience acoustic fidelity benchmarked on battery endurance, multi-mic ANC isolation, and comfort.' },
    { name: 'JBL', slug: 'jbl', country: 'United States', website: 'https://in.jbl.com/', tagline: 'Signature Pure Bass Wireless Audio', accentColor: '#F97316', description: 'Accessible, long-endurance wireless headphones tuned for energetic daily listening.', heroDescription: 'Compare everyday JBL wireless headphones with marathon battery life and lightweight folding comfort.' },
    { name: 'Nike', slug: 'nike', country: 'United States', website: 'https://www.nike.com/in/', tagline: 'Engineered Propulsion & Cushioning', accentColor: '#34D399', description: 'Responsive ZoomX and React road-running trainers built for daily mileage and tempo sessions.', heroDescription: 'Compare cushioning foam responsiveness, breathable mesh uppers, and outsole grip metrics.' },
    { name: 'Adidas', slug: 'adidas', country: 'Germany', website: 'https://www.adidas.co.in/', tagline: 'Performance Cushioning & Street Heritage', accentColor: '#38BDF8', description: 'Ultraboost energy-return trainers and continental rubber outsoles for road and city wear.', heroDescription: 'Benchmark Adidas Boost cushioning, heel lockdown, and multi-surface durability.' },
    { name: 'Puma', slug: 'puma', country: 'Germany', website: 'https://in.puma.com/', tagline: 'Forever Faster Everyday Footwear', accentColor: '#FBBF24', description: 'Lightweight casual and retro court sneakers built for all-day comfort and urban style.', heroDescription: 'Clean everyday sneakers evaluated for weight, insole cushioning, and breathable construction.' },
    { name: 'American Tourister', slug: 'american-tourister', country: 'United States', website: 'https://www.americantourister.in/', tagline: 'Durable Travel & Tech Carry', accentColor: '#2DD4BF', description: 'Weather-resistant laptop backpacks and structured travel packs built for daily commuting.', heroDescription: 'Compare capacity in liters, padded laptop sleeve protection, and water resistance across daily packs.' },
    { name: 'Casio', slug: 'casio', country: 'Japan', website: 'https://www.casio.com/in/', tagline: 'Shock-Resistant Precision Timekeeping', accentColor: '#94A3B8', description: 'Iconic G-Shock toughness and quartz reliability engineered for decades of dependable wear.', heroDescription: 'Compare 200m water resistance, shock protection, and multi-year battery precision.' },
    { name: 'Fossil', slug: 'fossil', country: 'United States', website: 'https://www.fossil.com/en-in/', tagline: 'Modern Vintage Chronograph Craft', accentColor: '#D97706', description: 'Classic stainless steel chronographs pairing tailored aesthetics with everyday water resistance.', heroDescription: 'Timeless chronograph dials evaluated by case diameter, movement type, and crystal durability.' },
    { name: "Levi's", slug: 'levis', country: 'United States', website: 'https://www.levi.in/', tagline: 'Authentic Denim Craft Since 1873', accentColor: '#3B82F6', description: 'Iconic 511 and classic denim silhouettes woven for durable everyday fit and comfort.', heroDescription: 'Compare denim fabric weight, cotton-elastane stretch, and tailored fit architecture.' },
    { name: 'H&M', slug: 'hm', country: 'Sweden', website: 'https://www2.hm.com/en_in/', tagline: 'Modern Essentials & Conscious Fabrics', accentColor: '#E11D48', description: 'Clean everyday wardrobe basics focusing on breathable cotton cuts and versatile layering.', heroDescription: 'Minimalist daily wear compared by fabric GSM, fit consistency, and care simplicity.' },
    { name: 'LG', slug: 'lg', country: 'South Korea', website: 'https://www.lg.com/in/', tagline: 'Smart Inverter & ThinQ Home Care', accentColor: '#EC4899', description: 'Smart Inverter frost-free refrigerators and AI Direct Drive appliances for Indian households.', heroDescription: 'Evaluate LG appliances on BEE star ratings, inverter compressors, and annual energy draw.' },
    { name: 'Whirlpool', slug: 'whirlpool', country: 'United States', website: 'https://www.whirlpoolindia.com/', tagline: 'Every Day, Care & Clean Laundry', accentColor: '#6366F1', description: '6th Sense front-load washing machines with built-in heaters and sanitize steam cycles.', heroDescription: 'Compare spin RPM, drum capacity, and energy efficiency for busy family laundry routines.' },
    { name: 'Bosch', slug: 'bosch', country: 'Germany', website: 'https://www.bosch-home.in/', tagline: 'German Precision Home Engineering', accentColor: '#0EA5E9', description: 'EcoSilence Drive front-load washers designed for ultra-quiet vibration control and fabric care.', heroDescription: 'German-engineered home appliances benchmarked for silent motor performance and water efficiency.' },
    { name: 'Daikin', slug: 'daikin', country: 'Japan', website: 'https://www.daikinindia.com/', tagline: 'Japanese Inverter Climate Mastery', accentColor: '#06B6D4', description: '1.5 Ton 5-Star inverter split air conditioners engineered for high-ambient cooling.', heroDescription: 'Compare ISEER cooling efficiency, ambient temperature tolerance, and inverter acoustic levels.' },
    { name: 'IFB', slug: 'ifb', country: 'India', website: 'https://www.ifbappliances.com/', tagline: 'Built for Indian Kitchens & Homes', accentColor: '#F59E0B', description: 'Convection microwave ovens with rotisserie, stainless steel cavities, and multi-stage cooking.', heroDescription: 'Practical kitchen appliances compared by cavity capacity, power output, and preset versatility.' },
    { name: 'Philips', slug: 'philips', country: 'Netherlands', website: 'https://www.philips.co.in/', tagline: 'Dependable Domestic & Kitchen Innovation', accentColor: '#3B82F6', description: 'High-wattage mixer grinders and bagless home vacuum cleaners built for heavy daily operation.', heroDescription: 'Evaluate Philips domestic motors on suction/grinding wattage, noise discipline, and jar/filter sets.' },
    { name: 'IKEA', slug: 'ikea', country: 'Sweden', website: 'https://www.ikea.com/in/en/', tagline: 'Democratic Scandinavian Ergonomics', accentColor: '#FACC15', description: 'Functional, tested ergonomic workspace seating designed for long study and work sessions.', heroDescription: 'Compare lumbar support, breathable mesh construction, and 10-year tested structural durability.' },
    { name: 'Dyson', slug: 'dyson', country: 'United Kingdom', website: 'https://www.dyson.in/', tagline: 'Precision Airflow & HEPA Engineering', accentColor: '#A855F7', description: 'Sealed HEPA H13 air purifiers with real-time particulate sensing and Air Multiplier projection.', heroDescription: 'Precision air quality systems benchmarked by CADR airflow, HEPA capture efficiency, and room coverage.' },
  ];

  const brandBySlug = new Map<string, typeof brands.$inferSelect>();
  for (const b of brandInputs) {
    const [row] = await db
      .insert(brands)
      .values(b)
      .onConflictDoUpdate({
        target: brands.slug,
        set: {
          name: b.name,
          country: b.country,
          website: b.website,
          tagline: b.tagline,
          accentColor: b.accentColor,
          description: b.description,
          heroDescription: b.heroDescription,
        },
      })
      .returning();
    brandBySlug.set(b.slug, row);
  }

  // 6. Sellers
  const sellerInputs = [
    { name: 'Manufacturer Direct (Demo)', slug: 'manufacturer-direct', website: 'https://example.com/direct', reliabilityNote: 'Official Brand Storefront (Demo)', isAuthorizedApi: false },
    { name: 'CompareX Verified Retail (Demo)', slug: 'comparex-verified-retail', website: 'https://example.com/comparex-retail', reliabilityNote: 'CompareX Primary Demo Fulfillment', isAuthorizedApi: false },
    { name: 'CromaTech Direct (Demo)', slug: 'cromatech-direct', website: 'https://example.com/cromatech', reliabilityNote: 'Seeded Electronics Retail Partner', isAuthorizedApi: false },
    { name: 'HomeSelect Appliances (Demo)', slug: 'homeselect-appliances', website: 'https://example.com/homeselect', reliabilityNote: 'Seeded Appliance & Living Partner', isAuthorizedApi: false },
    { name: 'UrbanStyle Mercantile (Demo)', slug: 'urbanstyle-mercantile', website: 'https://example.com/urbanstyle', reliabilityNote: 'Seeded Fashion & Carry Partner', isAuthorizedApi: false },
  ];

  const sellerBySlug = new Map<string, typeof sellers.$inferSelect>();
  for (const s of sellerInputs) {
    const [row] = await db
      .insert(sellers)
      .values(s)
      .onConflictDoUpdate({
        target: sellers.slug,
        set: { name: s.name, reliabilityNote: s.reliabilityNote },
      })
      .returning();
    sellerBySlug.set(s.slug, row);
  }

  // 7. Specification Definitions across all 17 categories
  const specDefsInput: SeedSpecDef[] = [
    // Smartphones
    { categorySlug: 'smartphones', key: 'processor', label: 'Chipset', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'smartphones', key: 'ram', label: 'Memory (RAM)', dataType: 'numeric', unit: 'GB', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 2 },
    { categorySlug: 'smartphones', key: 'storage', label: 'Storage', dataType: 'numeric', unit: 'GB', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'smartphones', key: 'camera', label: 'Main Camera', dataType: 'numeric', unit: 'MP', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 4 },
    { categorySlug: 'smartphones', key: 'display', label: 'Display', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 5 },
    { categorySlug: 'smartphones', key: 'battery', label: 'Battery Capacity', dataType: 'numeric', unit: 'mAh', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 6 },
    { categorySlug: 'smartphones', key: 'refresh_rate', label: 'Refresh Rate', dataType: 'numeric', unit: 'Hz', higherIsBetter: true, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 7 },

    // Laptops
    { categorySlug: 'laptops', key: 'processor', label: 'Processor', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.4, sortOrder: 1 },
    { categorySlug: 'laptops', key: 'ram', label: 'Memory (RAM)', dataType: 'numeric', unit: 'GB', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'laptops', key: 'storage', label: 'SSD Storage', dataType: 'numeric', unit: 'GB', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'laptops', key: 'display', label: 'Display Panel', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },
    { categorySlug: 'laptops', key: 'battery', label: 'Battery Life', dataType: 'numeric', unit: 'hours', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 5 },
    { categorySlug: 'laptops', key: 'graphics', label: 'Graphics', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 1.0, sortOrder: 6 },
    { categorySlug: 'laptops', key: 'weight', label: 'Weight', dataType: 'numeric', unit: 'kg', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 7 },

    // Headphones
    { categorySlug: 'headphones', key: 'battery', label: 'Battery Life', dataType: 'numeric', unit: 'hours', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'headphones', key: 'anc', label: 'Active Noise Canceling', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'headphones', key: 'driver_size', label: 'Driver Size', dataType: 'numeric', unit: 'mm', higherIsBetter: true, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 3 },
    { categorySlug: 'headphones', key: 'weight', label: 'Weight', dataType: 'numeric', unit: 'g', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },
    { categorySlug: 'headphones', key: 'bluetooth', label: 'Bluetooth Version', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 0.8, sortOrder: 5 },

    // Smartwatches
    { categorySlug: 'smartwatches', key: 'case_size', label: 'Case Size', dataType: 'numeric', unit: 'mm', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 1 },
    { categorySlug: 'smartwatches', key: 'battery', label: 'Battery Life', dataType: 'numeric', unit: 'hours', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'smartwatches', key: 'display', label: 'Display', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'smartwatches', key: 'water_resistance', label: 'Water Resistance', dataType: 'numeric', unit: 'm', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },
    { categorySlug: 'smartwatches', key: 'gps', label: 'Dual-Frequency GPS', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 1.0, sortOrder: 5 },

    // Televisions
    { categorySlug: 'televisions', key: 'screen_size', label: 'Screen Size', dataType: 'numeric', unit: 'inches', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 1 },
    { categorySlug: 'televisions', key: 'panel_type', label: 'Panel Technology', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'televisions', key: 'refresh_rate', label: 'Refresh Rate', dataType: 'numeric', unit: 'Hz', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'televisions', key: 'hdmi_21', label: 'HDMI 2.1 Ports', dataType: 'numeric', unit: 'ports', higherIsBetter: true, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 4 },

    // Footwear
    { categorySlug: 'footwear', key: 'weight', label: 'Single Shoe Weight', dataType: 'numeric', unit: 'g', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 1 },
    { categorySlug: 'footwear', key: 'cushion_foam', label: 'Midsole Cushioning', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 2 },
    { categorySlug: 'footwear', key: 'upper_material', label: 'Upper Material', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 3 },
    { categorySlug: 'footwear', key: 'heel_drop', label: 'Heel-to-Toe Drop', dataType: 'numeric', unit: 'mm', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 0.8, sortOrder: 4 },

    // Bags
    { categorySlug: 'bags', key: 'capacity', label: 'Volume Capacity', dataType: 'numeric', unit: 'L', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'bags', key: 'laptop_sleeve', label: 'Max Laptop Fit', dataType: 'numeric', unit: 'inches', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 2 },
    { categorySlug: 'bags', key: 'water_resistant', label: 'Water Resistant', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'bags', key: 'weight', label: 'Empty Weight', dataType: 'numeric', unit: 'g', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Watches
    { categorySlug: 'watches', key: 'case_diameter', label: 'Case Diameter', dataType: 'numeric', unit: 'mm', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 1 },
    { categorySlug: 'watches', key: 'movement', label: 'Movement Type', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 2 },
    { categorySlug: 'watches', key: 'water_resistance', label: 'Water Resistance', dataType: 'numeric', unit: 'm', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 3 },
    { categorySlug: 'watches', key: 'strap_material', label: 'Strap Material', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Clothing
    { categorySlug: 'clothing', key: 'fabric_composition', label: 'Fabric Composition', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'clothing', key: 'fit_style', label: 'Fit Profile', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 2 },
    { categorySlug: 'clothing', key: 'gsm_weight', label: 'Fabric Weight', dataType: 'numeric', unit: 'GSM', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 3 },
    { categorySlug: 'clothing', key: 'care_mode', label: 'Care Instructions', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 0.8, sortOrder: 4 },

    // Refrigerators
    { categorySlug: 'refrigerators', key: 'capacity', label: 'Total Capacity', dataType: 'numeric', unit: 'L', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'refrigerators', key: 'energy_rating', label: 'BEE Star Rating', dataType: 'numeric', unit: 'stars', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'refrigerators', key: 'annual_energy', label: 'Annual Energy Use', dataType: 'numeric', unit: 'kWh', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 3 },
    { categorySlug: 'refrigerators', key: 'cooling_tech', label: 'Compressor Tech', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Washing Machines
    { categorySlug: 'washing-machines', key: 'capacity', label: 'Drum Capacity', dataType: 'numeric', unit: 'kg', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'washing-machines', key: 'spin_speed', label: 'Max Spin Speed', dataType: 'numeric', unit: 'RPM', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 2 },
    { categorySlug: 'washing-machines', key: 'energy_rating', label: 'BEE Star Rating', dataType: 'numeric', unit: 'stars', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 3 },
    { categorySlug: 'washing-machines', key: 'steam_cycle', label: 'Inbuilt Heater / Steam', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Air Conditioners
    { categorySlug: 'air-conditioners', key: 'tonnage', label: 'Cooling Capacity', dataType: 'numeric', unit: 'Ton', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 1 },
    { categorySlug: 'air-conditioners', key: 'energy_rating', label: 'BEE Star Rating', dataType: 'numeric', unit: 'stars', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'air-conditioners', key: 'iseer', label: 'ISEER Efficiency', dataType: 'numeric', unit: '', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 3 },
    { categorySlug: 'air-conditioners', key: 'condenser', label: 'Condenser Coil', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Microwaves
    { categorySlug: 'microwaves', key: 'capacity', label: 'Cavity Capacity', dataType: 'numeric', unit: 'L', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'microwaves', key: 'power_watts', label: 'Microwave Power', dataType: 'numeric', unit: 'W', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 2 },
    { categorySlug: 'microwaves', key: 'cooking_mode', label: 'Cooking Mode', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    { categorySlug: 'microwaves', key: 'rotisserie', label: 'Motorized Rotisserie', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: false, isComparable: true, weight: 0.9, sortOrder: 4 },

    // Vacuum Cleaners
    { categorySlug: 'vacuum-cleaners', key: 'power_watts', label: 'Motor Power', dataType: 'numeric', unit: 'W', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'vacuum-cleaners', key: 'dust_capacity', label: 'Dust Tank Capacity', dataType: 'numeric', unit: 'L', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 2 },
    { categorySlug: 'vacuum-cleaners', key: 'hepa_filter', label: 'Washable HEPA Filter', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 3 },
    { categorySlug: 'vacuum-cleaners', key: 'weight', label: 'Unit Weight', dataType: 'numeric', unit: 'kg', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },

    // Furniture
    { categorySlug: 'furniture', key: 'material', label: 'Frame & Upholstery', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 1 },
    { categorySlug: 'furniture', key: 'weight_capacity', label: 'Max Load Rating', dataType: 'numeric', unit: 'kg', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 2 },
    { categorySlug: 'furniture', key: 'warranty', label: 'Warranty Coverage', dataType: 'numeric', unit: 'years', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.2, sortOrder: 3 },
    { categorySlug: 'furniture', key: 'lumbar_support', label: 'Adjustable Lumbar', dataType: 'boolean', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 4 },

    // Kitchen Appliances
    { categorySlug: 'kitchen-appliances', key: 'power_watts', label: 'Motor Wattage', dataType: 'numeric', unit: 'W', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 1 },
    { categorySlug: 'kitchen-appliances', key: 'jar_count', label: 'Stainless Jars Included', dataType: 'numeric', unit: 'jars', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 2 },
    { categorySlug: 'kitchen-appliances', key: 'speed_settings', label: 'Speed Controls', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 0.9, sortOrder: 3 },
    { categorySlug: 'kitchen-appliances', key: 'warranty', label: 'Motor Warranty', dataType: 'numeric', unit: 'years', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 4 },

    // Air Purifiers
    { categorySlug: 'air-purifiers', key: 'cadr', label: 'Clean Air Delivery (CADR)', dataType: 'numeric', unit: 'm3/h', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.4, sortOrder: 1 },
    { categorySlug: 'air-purifiers', key: 'coverage_area', label: 'Room Coverage', dataType: 'numeric', unit: 'sq ft', higherIsBetter: true, isMandatory: true, isComparable: true, weight: 1.3, sortOrder: 2 },
    { categorySlug: 'air-purifiers', key: 'hepa_grade', label: 'Filtration Grade', dataType: 'text', unit: '', higherIsBetter: null, isMandatory: true, isComparable: true, weight: 1.1, sortOrder: 3 },
    ...EXPANSION_SPEC_DEFS,
    { categorySlug: 'air-purifiers', key: 'noise_db', label: 'Sleep Mode Noise', dataType: 'numeric', unit: 'dB', higherIsBetter: false, isMandatory: true, isComparable: true, weight: 1.0, sortOrder: 4 },
  ];

  const defByCatKey = new Map<string, typeof specificationDefinitions.$inferSelect>();
  for (const d of specDefsInput) {
    const cat = catBySlug.get(d.categorySlug)!;
    const [row] = await db
      .insert(specificationDefinitions)
      .values({
        categoryId: cat.id,
        key: d.key,
        label: d.label,
        dataType: d.dataType,
        unit: d.unit,
        higherIsBetter: d.higherIsBetter,
        isMandatory: d.isMandatory,
        isComparable: d.isComparable,
        enumValuesJson: '[]',
        weight: d.weight,
        sortOrder: d.sortOrder,
      })
      .onConflictDoUpdate({
        target: [specificationDefinitions.categoryId, specificationDefinitions.key],
        set: {
          label: d.label,
          dataType: d.dataType,
          unit: d.unit,
          higherIsBetter: d.higherIsBetter,
          isMandatory: d.isMandatory,
          isComparable: d.isComparable,
          weight: d.weight,
          sortOrder: d.sortOrder,
        },
      })
      .returning();
    defByCatKey.set(`${d.categorySlug}:${d.key}`, row);
  }

  // 8. 31 Authentic Real-World Brand Products (INR Demonstration Catalog)
  const phase3Products: SeedProduct[] = [
    // --- ELECTRONICS (13) ---
    {
      name: 'Samsung Galaxy S24 Ultra',
      slug: 'samsung-galaxy-s24-ultra',
      brandSlug: 'samsung',
      categorySlug: 'smartphones',
      subcategorySlug: 'flagship',
      modelNumber: 'SM-S928B-256',
      variantLabel: 'Titanium Gray • 12GB / 256GB',
      basePrice: 124999,
      stockQuantity: 18,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.9,
      reviewCount: 640,
      popularityScore: 99,
      description: 'Titanium-framed flagship smartphone featuring Snapdragon 8 Gen 3, integrated S Pen, 200MP quad telephoto optics, and a flat Dynamic AMOLED 2X anti-reflective display.',
      primaryImage: IMG.SMARTPHONE,
      secondaryImage: IMG.HERO,
      specs: { processor: 'Snapdragon 8 Gen 3', ram: '12 GB', storage: '256 GB', camera: '200 MP', display: '6.8-inch QHD+ AMOLED 2X', battery: '5000 mAh', refresh_rate: '120 Hz' },
    },
    {
      name: 'Apple iPhone 15 Pro',
      slug: 'apple-iphone-15-pro',
      brandSlug: 'apple',
      categorySlug: 'smartphones',
      subcategorySlug: 'flagship',
      modelNumber: 'MTUX3HN/A',
      variantLabel: 'Natural Titanium • 256GB',
      basePrice: 134900,
      stockQuantity: 14,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 790,
      popularityScore: 98,
      description: 'Aerospace-grade titanium chassis powered by the 3nm A17 Pro chip, customizable Action button, USB-C 10Gbps transfer, and ProRAW 48MP computational imaging.',
      primaryImage: IMG.SMARTPHONE,
      secondaryImage: IMG.HERO,
      specs: { processor: 'Apple A17 Pro (3nm)', ram: '8 GB', storage: '256 GB', camera: '48 MP', display: '6.1-inch Super Retina XDR OLED', battery: '3274 mAh', refresh_rate: '120 Hz' },
    },
    {
      name: 'OnePlus 12 5G',
      slug: 'oneplus-12-5g',
      brandSlug: 'oneplus',
      categorySlug: 'smartphones',
      subcategorySlug: 'value-flagship',
      modelNumber: 'CPH2573-12',
      variantLabel: 'Flowy Emerald • 12GB / 256GB',
      basePrice: 64999,
      stockQuantity: 28,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.7,
      reviewCount: 520,
      popularityScore: 94,
      description: 'Value flagship built with Hasselblad 4th-gen camera tuning, 100W SuperVOOC wired charging, cryo-velocity vapor cooling, and a bright 2K ProXDR AMOLED panel.',
      primaryImage: IMG.SMARTPHONE,
      secondaryImage: IMG.HERO,
      specs: { processor: 'Snapdragon 8 Gen 3', ram: '12 GB', storage: '256 GB', camera: '50 MP', display: '6.82-inch 2K ProXDR AMOLED', battery: '5400 mAh', refresh_rate: '120 Hz' },
    },
    {
      name: 'Xiaomi 14',
      slug: 'xiaomi-14-5g',
      brandSlug: 'xiaomi',
      categorySlug: 'smartphones',
      subcategorySlug: 'value-flagship',
      modelNumber: '23127PN0CG',
      variantLabel: 'Jade Green • 12GB / 512GB',
      basePrice: 69999,
      stockQuantity: 22,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 310,
      popularityScore: 89,
      description: 'Compact flagship co-engineered with Leica Summilux optical lenses, LTPO CrystalRes AMOLED screen, and rapid 90W HyperCharge support.',
      primaryImage: IMG.SMARTPHONE,
      secondaryImage: IMG.HERO,
      specs: { processor: 'Snapdragon 8 Gen 3', ram: '12 GB', storage: '512 GB', camera: '50 MP', display: '6.36-inch 1.5K LTPO AMOLED', battery: '4610 mAh', refresh_rate: '120 Hz' },
    },
    {
      name: 'Dell XPS 13 (9340)',
      slug: 'dell-xps-13-9340',
      brandSlug: 'dell',
      categorySlug: 'laptops',
      subcategorySlug: 'ultrabooks',
      modelNumber: 'XPS9340-U7-16',
      variantLabel: 'Platinum Silver • 16GB / 512GB',
      basePrice: 139990,
      stockQuantity: 9,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.7,
      reviewCount: 215,
      popularityScore: 93,
      description: 'CNC-machined aluminum ultrabook featuring Intel Core Ultra 7 silicon, edge-to-edge InfinityEdge display, and seamless glass haptic touchpad.',
      primaryImage: IMG.LAPTOP_PRO,
      secondaryImage: IMG.LAPTOP_DETAIL,
      specs: { processor: 'Intel Core Ultra 7 155H', ram: '16 GB', storage: '512 GB', display: '13.4-inch FHD+ InfinityEdge', battery: '16 hours', graphics: 'Intel Arc Graphics', weight: '1.19 kg' },
    },
    {
      name: 'HP Pavilion 15',
      slug: 'hp-pavilion-15-eg',
      brandSlug: 'hp',
      categorySlug: 'laptops',
      subcategorySlug: 'ultrabooks',
      modelNumber: '15-eg3082TU',
      variantLabel: 'Natural Silver • 16GB / 512GB',
      basePrice: 64990,
      stockQuantity: 24,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.5,
      reviewCount: 410,
      popularityScore: 88,
      description: 'Balanced student and office laptop pairing 13th Gen Intel Core i5 efficiency with dual B&O tuned speakers and anti-glare micro-edge panel.',
      primaryImage: IMG.LAPTOP_PRO,
      secondaryImage: IMG.LAPTOP_DETAIL,
      specs: { processor: 'Intel Core i5-1340P', ram: '16 GB', storage: '512 GB', display: '15.6-inch FHD IPS Anti-Glare', battery: '9 hours', graphics: 'Intel Iris Xe', weight: '1.74 kg' },
    },
    {
      name: 'Lenovo Yoga Slim 7',
      slug: 'lenovo-yoga-slim-7',
      brandSlug: 'lenovo',
      categorySlug: 'laptops',
      subcategorySlug: 'ultrabooks',
      modelNumber: '83CV002DIN',
      variantLabel: 'Luna Grey • 16GB / 1TB OLED',
      basePrice: 99990,
      stockQuantity: 15,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 195,
      popularityScore: 91,
      description: 'Ultra-thin creator notebook with Dolby Vision PureSight OLED display, Intel Evo certification, and whisper-quiet dual-fan cooling.',
      primaryImage: IMG.LAPTOP_PRO,
      secondaryImage: IMG.LAPTOP_DETAIL,
      specs: { processor: 'Intel Core Ultra 5 125H', ram: '16 GB', storage: '1024 GB', display: '14-inch WUXGA OLED', battery: '14 hours', graphics: 'Intel Arc Graphics', weight: '1.39 kg' },
    },
    {
      name: 'ASUS ROG Zephyrus G14',
      slug: 'asus-rog-zephyrus-g14',
      brandSlug: 'asus',
      categorySlug: 'laptops',
      subcategorySlug: 'creator-gaming',
      modelNumber: 'GA403UV-QS086WS',
      variantLabel: 'Eclipse Gray • RTX 4060 / 16GB / 1TB',
      basePrice: 159990,
      stockQuantity: 5,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'LIMITED',
      rating: 4.9,
      reviewCount: 280,
      popularityScore: 96,
      description: 'CNC aluminum 14-inch powerhouse pairing AMD Ryzen 9 8945HS, NVIDIA RTX 4060 graphics, and a 3K 120Hz Nebula OLED panel.',
      primaryImage: IMG.LAPTOP_PRO,
      secondaryImage: IMG.LAPTOP_DETAIL,
      specs: { processor: 'AMD Ryzen 9 8945HS', ram: '16 GB', storage: '1024 GB', display: '14-inch 3K 120Hz OLED', battery: '11 hours', graphics: 'NVIDIA RTX 4060 8GB', weight: '1.50 kg' },
    },
    {
      name: 'Sony WH-1000XM5',
      slug: 'sony-wh-1000xm5',
      brandSlug: 'sony',
      categorySlug: 'headphones',
      subcategorySlug: 'over-ear-anc',
      modelNumber: 'WH1000XM5-BLK',
      variantLabel: 'Midnight Black • Wireless ANC',
      basePrice: 29990,
      stockQuantity: 32,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 890,
      popularityScore: 97,
      description: 'Reference active noise-canceling wireless headphones powered by dual V1/QN1 processors, 8-microphone isolation, and LDAC hi-res wireless audio.',
      primaryImage: IMG.HEADPHONES,
      secondaryImage: IMG.AUDIO_DETAIL,
      specs: { battery: '30 hours', anc: 'Yes', driver_size: '30 mm', weight: '250 g', bluetooth: '5.2' },
    },
    {
      name: 'JBL Tune 770NC',
      slug: 'jbl-tune-770nc',
      brandSlug: 'jbl',
      categorySlug: 'headphones',
      subcategorySlug: 'over-ear-anc',
      modelNumber: 'JBLT770NCBLK',
      variantLabel: 'Matte Black • Adaptive ANC',
      basePrice: 5999,
      stockQuantity: 45,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.4,
      reviewCount: 615,
      popularityScore: 86,
      description: 'Lightweight folding over-ear headphones delivering JBL Pure Bass sound, adaptive noise canceling, and up to 70 hours of ANC-off endurance.',
      primaryImage: IMG.HEADPHONES,
      secondaryImage: IMG.AUDIO_DETAIL,
      specs: { battery: '44 hours', anc: 'Yes', driver_size: '40 mm', weight: '232 g', bluetooth: '5.3' },
    },
    {
      name: 'Apple Watch Series 9',
      slug: 'apple-watch-series-9',
      brandSlug: 'apple',
      categorySlug: 'smartwatches',
      subcategorySlug: 'connected-wearables',
      modelNumber: 'MR9A3HN/A',
      variantLabel: 'Midnight Aluminum • 45mm GPS',
      basePrice: 41900,
      stockQuantity: 21,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 430,
      popularityScore: 94,
      description: 'S9 SiP smartwatch with 2,000-nit Always-On Retina OLED display, Double Tap gesture control, ECG, and Precision Finding.',
      primaryImage: IMG.SMARTWATCH,
      secondaryImage: IMG.HERO,
      specs: { case_size: '45 mm', battery: '18 hours', display: '2000-nit Always-On OLED', water_resistance: '50 m', gps: 'Yes' },
    },
    {
      name: 'Samsung Galaxy Watch 6',
      slug: 'samsung-galaxy-watch-6',
      brandSlug: 'samsung',
      categorySlug: 'smartwatches',
      subcategorySlug: 'connected-wearables',
      modelNumber: 'SM-R940NZKAINU',
      variantLabel: 'Graphite • 44mm Bluetooth',
      basePrice: 29999,
      stockQuantity: 26,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 350,
      popularityScore: 89,
      description: 'Sapphire crystal Wear OS smartwatch offering BIA body composition analysis, advanced sleep coaching, and slim bezel AMOLED optics.',
      primaryImage: IMG.SMARTWATCH,
      secondaryImage: IMG.HERO,
      specs: { case_size: '44 mm', battery: '40 hours', display: '1.5-inch Sapphire Super AMOLED', water_resistance: '50 m', gps: 'Yes' },
    },
    {
      name: 'Samsung 55-inch Crystal 4K QLED TV',
      slug: 'samsung-55-crystal-4k-qled',
      brandSlug: 'samsung',
      categorySlug: 'televisions',
      subcategorySlug: '4k-qled',
      modelNumber: 'QA55Q60DAULXL',
      variantLabel: 'AirSlim Obsidian • 55-inch 4K',
      basePrice: 59990,
      stockQuantity: 11,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.7,
      reviewCount: 270,
      popularityScore: 92,
      description: '100% Color Volume Quantum Dot 4K television featuring Dual LED contrast tuning, Quantum HDR, and sleek AirSlim wall-ready profile.',
      primaryImage: IMG.TELEVISION,
      secondaryImage: IMG.HERO,
      specs: { screen_size: '55 inches', panel_type: '4K QLED Dual LED', refresh_rate: '60 Hz', hdmi_21: '3 ports' },
    },

    // --- FASHION (8) ---
    {
      name: 'Nike Air Zoom Pegasus 40',
      slug: 'nike-air-zoom-pegasus-40',
      brandSlug: 'nike',
      categorySlug: 'footwear',
      subcategorySlug: 'running-training',
      modelNumber: 'DV3853-001',
      variantLabel: 'Black / White • UK 9',
      basePrice: 11495,
      stockQuantity: 30,
      taxRatePercent: 12,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.7,
      reviewCount: 495,
      popularityScore: 92,
      description: 'Neutral road-running trainer combining dual Air Zoom units with responsive React midsole foam and engineered single-layer mesh support.',
      primaryImage: IMG.SNEAKER,
      secondaryImage: IMG.HERO,
      specs: { weight: '265 g', cushion_foam: 'Nike React + Dual Air Zoom', upper_material: 'Engineered Breathable Mesh', heel_drop: '10 mm' },
    },
    {
      name: 'Adidas Ultraboost Light',
      slug: 'adidas-ultraboost-light',
      brandSlug: 'adidas',
      categorySlug: 'footwear',
      subcategorySlug: 'running-training',
      modelNumber: 'HQ6339',
      variantLabel: 'Core Black / Solar • UK 9',
      basePrice: 17999,
      stockQuantity: 16,
      taxRatePercent: 12,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 380,
      popularityScore: 90,
      description: '30% lighter Light BOOST midsole compound paired with adaptive Primeknit+ sock fit and high-traction Continental rubber outsole.',
      primaryImage: IMG.SNEAKER,
      secondaryImage: IMG.HERO,
      specs: { weight: '293 g', cushion_foam: 'Light BOOST Midsole', upper_material: 'Primeknit+ Forged Mesh', heel_drop: '10 mm' },
    },
    {
      name: 'Puma Smash v2 Sneakers',
      slug: 'puma-smash-v2-sneakers',
      brandSlug: 'puma',
      categorySlug: 'footwear',
      subcategorySlug: 'lifestyle-sneakers',
      modelNumber: '365215-01',
      variantLabel: 'Puma Black / White • UK 9',
      basePrice: 4499,
      stockQuantity: 50,
      taxRatePercent: 12,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.4,
      reviewCount: 740,
      popularityScore: 87,
      description: 'Tennis-inspired everyday low-top sneaker crafted with soft suede-look upper, SoftFoam+ comfort footbed, and grippy rubber cupsole.',
      primaryImage: IMG.SNEAKER,
      secondaryImage: IMG.HERO,
      specs: { weight: '320 g', cushion_foam: 'SoftFoam+ Comfort Sockliner', upper_material: 'Suede & Synthetic Leather', heel_drop: '6 mm' },
    },
    {
      name: 'American Tourister Fizz Laptop Backpack',
      slug: 'american-tourister-fizz-backpack',
      brandSlug: 'american-tourister',
      categorySlug: 'bags',
      subcategorySlug: 'tech-backpacks',
      modelNumber: 'AT-FIZZ-32L-BLK',
      variantLabel: 'Graphite Black • 32 Liters',
      basePrice: 2299,
      stockQuantity: 55,
      taxRatePercent: 12,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.5,
      reviewCount: 910,
      popularityScore: 90,
      description: 'Ergonomic three-compartment tech commuter backpack with padded 15.6-inch laptop sleeve, air-mesh back panel, and rain-repellent polyester.',
      primaryImage: IMG.BACKPACK,
      secondaryImage: IMG.HERO,
      specs: { capacity: '32 L', laptop_sleeve: '15.6 inches', water_resistant: 'Yes', weight: '620 g' },
    },
    {
      name: 'Casio G-Shock GA-2100',
      slug: 'casio-g-shock-ga-2100',
      brandSlug: 'casio',
      categorySlug: 'watches',
      subcategorySlug: 'analog-digital',
      modelNumber: 'GA-2100-1A1DR',
      variantLabel: 'Stealth Matte Black • Carbon Core',
      basePrice: 8495,
      stockQuantity: 29,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.9,
      reviewCount: 1120,
      popularityScore: 96,
      description: 'Octagonal Carbon Core Guard G-Shock pairing slim 11.8mm profile with analog-digital dual readout, world time, and 200m water resistance.',
      primaryImage: IMG.WATCH,
      secondaryImage: IMG.HERO,
      specs: { case_diameter: '45.4 mm', movement: 'Analog-Digital Quartz', water_resistance: '200 m', strap_material: 'High-Density Resin' },
    },
    {
      name: 'Fossil Townsman Chronograph',
      slug: 'fossil-townsman-chronograph',
      brandSlug: 'fossil',
      categorySlug: 'watches',
      subcategorySlug: 'analog-digital',
      modelNumber: 'FS5437',
      variantLabel: 'Midnight Blue Dial / Brown Leather • 44mm',
      basePrice: 12495,
      stockQuantity: 14,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 410,
      popularityScore: 85,
      description: 'Architectural 1960s-inspired chronograph timepiece combining brushed stainless steel bezel, dual sub-dials, and quick-release leather strap.',
      primaryImage: IMG.WATCH,
      secondaryImage: IMG.HERO,
      specs: { case_diameter: '44 mm', movement: 'Quartz Chronograph', water_resistance: '50 m', strap_material: 'Genuine Leather' },
    },
    {
      name: "Levi's 511 Slim Fit Jeans",
      slug: 'levis-511-slim-fit-jeans',
      brandSlug: 'levis',
      categorySlug: 'clothing',
      subcategorySlug: 'denim-tops',
      modelNumber: '18298-1244',
      variantLabel: 'Dark Indigo Rinse • 32W x 32L',
      basePrice: 3199,
      stockQuantity: 42,
      taxRatePercent: 12,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 680,
      popularityScore: 88,
      description: 'Modern slim silhouette sitting below the waist with slim leg from hip to ankle, tailored in Water<Less stretch cotton twill denim.',
      primaryImage: IMG.BACKPACK,
      secondaryImage: IMG.HERO,
      specs: { fabric_composition: '98% Cotton, 2% Elastane', fit_style: 'Slim Fit', gsm_weight: '340 GSM', care_mode: 'Machine Wash Cold' },
    },
    {
      name: 'H&M Relaxed Fit Cotton T-Shirt',
      slug: 'hm-relaxed-fit-cotton-tshirt',
      brandSlug: 'hm',
      categorySlug: 'clothing',
      subcategorySlug: 'denim-tops',
      modelNumber: 'HM-0685816-BLK',
      variantLabel: 'Charcoal Black • Size L',
      basePrice: 999,
      stockQuantity: 65,
      taxRatePercent: 12,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.4,
      reviewCount: 820,
      popularityScore: 84,
      description: 'Heavyweight combed cotton jersey crewneck tee cut in an effortless relaxed drape with dropped shoulders and ribbed collar trim.',
      primaryImage: IMG.BACKPACK,
      secondaryImage: IMG.HERO,
      specs: { fabric_composition: '100% Combed Organic Cotton', fit_style: 'Relaxed Fit', gsm_weight: '220 GSM', care_mode: 'Machine Wash 40C' },
    },

    // --- HOME APPLIANCES (7) ---
    {
      name: 'LG 260L 3-Star Smart Inverter Refrigerator',
      slug: 'lg-260l-smart-inverter-fridge',
      brandSlug: 'lg',
      categorySlug: 'refrigerators',
      subcategorySlug: 'double-door-inverter',
      modelNumber: 'GL-S292RDSX',
      variantLabel: 'Dazzle Steel • 260L Convertible',
      basePrice: 28990,
      stockQuantity: 12,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 510,
      popularityScore: 91,
      description: 'Frost-free double-door refrigerator equipped with Smart Inverter Compressor, multi-air flow cooling vents, and convertible freezer flexibility.',
      primaryImage: IMG.FRIDGE,
      secondaryImage: IMG.CLIMATE,
      specs: { capacity: '260 L', energy_rating: '3 stars', annual_energy: '198 kWh', cooling_tech: 'Smart Inverter Frost-Free' },
    },
    {
      name: 'Samsung 324L Convertible 5-in-1 Refrigerator',
      slug: 'samsung-324l-convertible-fridge',
      brandSlug: 'samsung',
      categorySlug: 'refrigerators',
      subcategorySlug: 'double-door-inverter',
      modelNumber: 'RT34C4523S8/HL',
      variantLabel: 'Elegant Inox • 324L Twin Cooling',
      basePrice: 36990,
      stockQuantity: 10,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.7,
      reviewCount: 390,
      popularityScore: 90,
      description: 'Twin Cooling Plus 5-in-1 convertible refrigerator maintaining separate humidity zones to keep produce crisp without odor transfer.',
      primaryImage: IMG.FRIDGE,
      secondaryImage: IMG.CLIMATE,
      specs: { capacity: '324 L', energy_rating: '3 stars', annual_energy: '225 kWh', cooling_tech: 'Digital Inverter Twin Cooling' },
    },
    {
      name: 'Whirlpool 7kg Front Load Washing Machine',
      slug: 'whirlpool-7kg-front-load-washer',
      brandSlug: 'whirlpool',
      categorySlug: 'washing-machines',
      subcategorySlug: 'front-load',
      modelNumber: 'XS7010BWW52E',
      variantLabel: 'Crystal White • 7 kg SteamCare',
      basePrice: 28490,
      stockQuantity: 15,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.5,
      reviewCount: 320,
      popularityScore: 86,
      description: '6th Sense SoftMove inverter front-load washer with inbuilt 60C sanitize heater, 1000 RPM spin extraction, and zero-pressure fill tech.',
      primaryImage: IMG.WASHER,
      secondaryImage: IMG.CLIMATE,
      specs: { capacity: '7 kg', spin_speed: '1000 RPM', energy_rating: '5 stars', steam_cycle: 'Yes' },
    },
    {
      name: 'Bosch 7kg Serie 4 Washing Machine',
      slug: 'bosch-7kg-serie-4-washer',
      brandSlug: 'bosch',
      categorySlug: 'washing-machines',
      subcategorySlug: 'front-load',
      modelNumber: 'WAJ2426AIN',
      variantLabel: 'Silver Inox • 7 kg EcoSilence',
      basePrice: 32990,
      stockQuantity: 11,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 445,
      popularityScore: 93,
      description: 'German-engineered EcoSilence Drive front-load washer featuring VarioDrum gentle wave motion, AllergyPlus sanitize, and anti-vibration panels.',
      primaryImage: IMG.WASHER,
      secondaryImage: IMG.CLIMATE,
      specs: { capacity: '7 kg', spin_speed: '1200 RPM', energy_rating: '5 stars', steam_cycle: 'Yes' },
    },
    {
      name: 'Daikin 1.5 Ton 5-Star Inverter Split AC',
      slug: 'daikin-1-5t-5star-inverter-ac',
      brandSlug: 'daikin',
      categorySlug: 'air-conditioners',
      subcategorySlug: 'inverter-split',
      modelNumber: 'MTKM50U',
      variantLabel: 'Matte White • 1.5 Ton Dew Clean',
      basePrice: 45490,
      stockQuantity: 8,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 530,
      popularityScore: 94,
      description: 'High-efficiency 5-Star inverter split AC with Patented Swing Compressor, Dew Clean evaporator self-wash, and 54C ambient cooling reliability.',
      primaryImage: IMG.CLIMATE,
      secondaryImage: IMG.PURIFIER,
      specs: { tonnage: '1.5 Ton', energy_rating: '5 stars', iseer: '5.2', condenser: '100% Copper Coil' },
    },
    {
      name: 'IFB 30L Convection Microwave Oven',
      slug: 'ifb-30l-convection-microwave',
      brandSlug: 'ifb',
      categorySlug: 'microwaves',
      subcategorySlug: 'convection-oven',
      modelNumber: '30BRC2',
      variantLabel: 'Mirror Black • 30L Rotisserie',
      basePrice: 14990,
      stockQuantity: 19,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.6,
      reviewCount: 410,
      popularityScore: 87,
      description: 'Family-sized 30-liter stainless-steel cavity convection oven equipped with motorized rotisserie, 101 auto-cook menus, and steam clean.',
      primaryImage: IMG.PURIFIER,
      secondaryImage: IMG.CLIMATE,
      specs: { capacity: '30 L', power_watts: '900 W', cooking_mode: 'Convection + Grill + Solo', rotisserie: 'Yes' },
    },
    {
      name: 'Philips PowerPro FC9352 Vacuum Cleaner',
      slug: 'philips-powerpro-fc9352-vacuum',
      brandSlug: 'philips',
      categorySlug: 'vacuum-cleaners',
      subcategorySlug: 'canister-vacuum',
      modelNumber: 'FC9352/01',
      variantLabel: 'Deep Blue • 1900W PowerCyclone 5',
      basePrice: 9499,
      stockQuantity: 23,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.5,
      reviewCount: 620,
      popularityScore: 86,
      description: 'Bagless cyclonic canister vacuum with 1900W motor delivering 370W suction power, Allergy H13 filtration, and MultiClean floor nozzle.',
      primaryImage: IMG.CLIMATE,
      secondaryImage: IMG.PURIFIER,
      specs: { power_watts: '1900 W', dust_capacity: '1.5 L', hepa_filter: 'Yes', weight: '4.5 kg' },
    },

    // --- HOME & LIFESTYLE / OTHER (3) ---
    {
      name: 'IKEA Markus Ergonomic Office Chair',
      slug: 'ikea-markus-office-chair',
      brandSlug: 'ikea',
      categorySlug: 'furniture',
      subcategorySlug: 'ergonomic-seating',
      modelNumber: '702.611.50',
      variantLabel: 'Vissle Dark Grey • High-Back Mesh',
      basePrice: 14990,
      stockQuantity: 17,
      taxRatePercent: 12,
      isFeatured: true,
      availabilityStatus: 'IN_STOCK',
      rating: 4.8,
      reviewCount: 790,
      popularityScore: 93,
      description: '10-year warranty high-back ergonomic workspace chair featuring breathable mesh backrest, synchronized tilt lock, and integrated lumbar support.',
      primaryImage: IMG.CHAIR,
      secondaryImage: IMG.HERO,
      specs: { material: 'Steel Frame & Breathable Mesh', weight_capacity: '110 kg', warranty: '10 years', lumbar_support: 'Yes' },
    },
    {
      name: 'Philips HL7756/00 750W Mixer Grinder',
      slug: 'philips-hl7756-mixer-grinder',
      brandSlug: 'philips',
      categorySlug: 'kitchen-appliances',
      subcategorySlug: 'mixer-grinders',
      modelNumber: 'HL7756/00',
      variantLabel: 'Matte Black • 750W Turbo Motor (3 Jars)',
      basePrice: 3799,
      stockQuantity: 38,
      taxRatePercent: 18,
      isFeatured: false,
      availabilityStatus: 'IN_STOCK',
      rating: 4.5,
      reviewCount: 1420,
      popularityScore: 91,
      description: 'Heavy-duty 750W copper motor engineered for continuous 25-minute spice and batter grinding with leak-proof food-grade stainless jars.',
      primaryImage: IMG.PURIFIER,
      secondaryImage: IMG.HERO,
      specs: { power_watts: '750 W', jar_count: '3 jars', speed_settings: '3 Speed + Pulse', warranty: '5 years' },
    },
    {
      name: 'Dyson Pure Cool Air Purifier',
      slug: 'dyson-pure-cool-tp07',
      brandSlug: 'dyson',
      categorySlug: 'air-purifiers',
      subcategorySlug: 'hepa-purifiers',
      modelNumber: 'TP07-WHT-SLV',
      variantLabel: 'White / Silver • HEPA H13 Tower',
      basePrice: 43900,
      stockQuantity: 6,
      taxRatePercent: 18,
      isFeatured: true,
      availabilityStatus: 'LIMITED',
      rating: 4.7,
      reviewCount: 245,
      popularityScore: 90,
      description: 'Fully sealed HEPA H13 and activated carbon tower purifier capturing 99.95% of 0.1-micron particulates with 350-degree oscillation.',
      primaryImage: IMG.PURIFIER,
      secondaryImage: IMG.CLIMATE,
      specs: { cadr: '361 m3/h', coverage_area: '600 sq ft', hepa_grade: 'True HEPA H13 + Carbon', noise_db: '43 dB' },
    },

    // Phase 4 expansion (19 additional demo products, defined in
    // ./catalog/expansion.ts so the catalogue is testable without a database).
    ...EXPANSION_PRODUCTS,
  ];

  // Archive any old Phase 2 fictional slugs so active catalog strictly showcases Phase 3 products
  const phase3Slugs = phase3Products.map((p) => p.slug);
  await db
    .update(products)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(notInArray(products.slug, phase3Slugs));

  const sDirect = sellerBySlug.get('manufacturer-direct')!;
  const sRetail = sellerBySlug.get('comparex-verified-retail')!;
  const sCroma = sellerBySlug.get('cromatech-direct')!;
  const sHome = sellerBySlug.get('homeselect-appliances')!;
  const sUrban = sellerBySlug.get('urbanstyle-mercantile')!;

  const now = new Date();
  const monthsAgo = (m: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    return d;
  };

  for (const p of phase3Products) {
    const brand = brandBySlug.get(p.brandSlug)!;
    const cat = catBySlug.get(p.categorySlug)!;
    const sub = subByKey.get(`${p.categorySlug}:${p.subcategorySlug}`);

    const [prodRow] = await db
      .insert(products)
      .values({
        name: p.name,
        slug: p.slug,
        brandId: brand.id,
        categoryId: cat.id,
        subcategoryId: sub?.id ?? null,
        description: p.description,
        modelNumber: p.modelNumber,
        variantLabel: p.variantLabel,
        basePrice: p.basePrice,
        currency: 'INR',
        stockQuantity: p.stockQuantity,
        taxRatePercent: p.taxRatePercent,
        isFeatured: p.isFeatured,
        availabilityStatus: p.availabilityStatus,
        status: 'ACTIVE',
        rating: p.rating,
        reviewCount: p.reviewCount,
        popularityScore: p.popularityScore,
        isDemoData: true,
        dataSourceLabel: 'CompareX Seeded INR Demonstration Catalog',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: products.slug,
        set: {
          name: p.name,
          brandId: brand.id,
          categoryId: cat.id,
          subcategoryId: sub?.id ?? null,
          description: p.description,
          modelNumber: p.modelNumber,
          variantLabel: p.variantLabel,
          basePrice: p.basePrice,
          currency: 'INR',
          stockQuantity: p.stockQuantity,
          taxRatePercent: p.taxRatePercent,
          isFeatured: p.isFeatured,
          availabilityStatus: p.availabilityStatus,
          status: 'ACTIVE',
          rating: p.rating,
          reviewCount: p.reviewCount,
          popularityScore: p.popularityScore,
          dataSourceLabel: 'CompareX Seeded INR Demonstration Catalog',
          updatedAt: now,
        },
      })
      .returning();

    // Product Images
    await db.delete(productImages).where(eq(productImages.productId, prodRow.id));
    await db.insert(productImages).values([
      {
        productId: prodRow.id,
        url: p.primaryImage,
        altText: `${p.name} studio photograph`,
        isPrimary: true,
        sortOrder: 0,
      },
      {
        productId: prodRow.id,
        url: p.secondaryImage,
        altText: `${p.name} secondary angle`,
        isPrimary: false,
        sortOrder: 1,
      },
    ]);

    // Specifications
    for (const [key, rawValue] of Object.entries(p.specs)) {
      const def = defByCatKey.get(`${p.categorySlug}:${key}`);
      if (!def) continue;
      const norm =
        def.dataType === 'numeric'
          ? normalizeNumericSpec(rawValue, def.unit, def.unit)
          : { numericValue: null, normalizedValue: null };

      await db
        .insert(productSpecifications)
        .values({
          productId: prodRow.id,
          specDefinitionId: def.id,
          rawValue,
          numericValue: norm.numericValue,
          unit: def.unit,
          normalizedValue: norm.normalizedValue,
          isConflicting: false,
          sourceNote: 'Seeded Manufacturer Datasheet (Demo)',
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [productSpecifications.productId, productSpecifications.specDefinitionId],
          set: {
            rawValue,
            numericValue: norm.numericValue,
            unit: def.unit,
            normalizedValue: norm.normalizedValue,
            isConflicting: false,
            updatedAt: now,
          },
        });
    }

    // Offers (2 transparent INR offers per product)
    const secondarySeller =
      cat.domainGroup === 'Electronics'
        ? sCroma
        : cat.domainGroup === 'Fashion'
          ? sUrban
          : sHome;

    const delivFee = p.basePrice >= 2000 ? 0 : 99;
    await db
      .insert(productOffers)
      .values([
        {
          productId: prodRow.id,
          sellerId: sRetail.id,
          price: p.basePrice,
          currency: 'INR',
          deliveryCharge: delivFee,
          installationCharge: 0,
          warrantyCost: 0,
          requiredAccessoriesCost: 0,
          additionalFees: 0,
          additionalFeesNote: 'Standard GST included; demo catalog fulfillment',
          availabilityStatus: p.availabilityStatus,
          offerUrl: 'https://example.com/offer',
          dataSource: 'CompareX Seeded INR Retail Offer (Demo)',
          lastVerifiedAt: now,
          updatedAt: now,
        },
        {
          productId: prodRow.id,
          sellerId: secondarySeller.id,
          price: Math.round(p.basePrice * 1.03),
          currency: 'INR',
          deliveryCharge: 149,
          installationCharge: cat.domainGroup === 'Home Appliances' ? 499 : 0,
          warrantyCost: 0,
          requiredAccessoriesCost: 0,
          additionalFees: 0,
          additionalFeesNote: 'Includes partner handling fee (Demo)',
          availabilityStatus: p.availabilityStatus,
          offerUrl: 'https://example.com/offer-alt',
          dataSource: 'Seeded Partner Merchant Offer (Demo)',
          lastVerifiedAt: now,
          updatedAt: now,
        },
      ])
      .onConflictDoUpdate({
        target: [productOffers.productId, productOffers.sellerId],
        set: {
          price: p.basePrice,
          currency: 'INR',
          deliveryCharge: delivFee,
          lastVerifiedAt: now,
          updatedAt: now,
        },
      });

    // Historical 5-month INR Price Observations (if none exist for this product yet)
    const existingObs = await db
      .select({ id: priceObservations.id })
      .from(priceObservations)
      .where(and(eq(priceObservations.productId, prodRow.id)))
      .limit(1);

    if (existingObs.length === 0) {
      await db.insert(priceObservations).values([
        { productId: prodRow.id, sellerId: sDirect.id, price: Math.round(p.basePrice * 1.08), currency: 'INR', sourceLabel: 'Launch MSRP Snapshot (Demo)', isDemoData: true, observedAt: monthsAgo(4) },
        { productId: prodRow.id, sellerId: sRetail.id, price: Math.round(p.basePrice * 1.05), currency: 'INR', sourceLabel: 'Seasonal Snapshot (Demo)', isDemoData: true, observedAt: monthsAgo(3) },
        { productId: prodRow.id, sellerId: sRetail.id, price: Math.round(p.basePrice * 1.02), currency: 'INR', sourceLabel: 'Festive Window Snapshot (Demo)', isDemoData: true, observedAt: monthsAgo(2) },
        { productId: prodRow.id, sellerId: sRetail.id, price: Math.round(p.basePrice * 0.99), currency: 'INR', sourceLabel: 'Lowest Recorded Snapshot (Demo)', isDemoData: true, observedAt: monthsAgo(1) },
        { productId: prodRow.id, sellerId: sRetail.id, price: p.basePrice, currency: 'INR', sourceLabel: 'Current Demo Price', isDemoData: true, observedAt: now },
      ]);
    }
  }

  await db
    .insert(systemSettings)
    .values({ key: 'phase3_catalog_version', value: PHASE3_SEED_VERSION })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: PHASE3_SEED_VERSION, updatedAt: now },
    });

  await db.insert(auditLogs).values({
    actorEmail: 'system',
    action: 'PHASE3_CATALOG_SYNC',
    entityType: 'CATALOG',
    entityId: PHASE3_SEED_VERSION,
    detailsJson: JSON.stringify({ productsSeeded: phase3Products.length, brandsCount: brandInputs.length }),
  });

  console.log(`CompareX Phase 3 INR catalog synced (${phase3Products.length} products, ${brandInputs.length} brands).`);
}
