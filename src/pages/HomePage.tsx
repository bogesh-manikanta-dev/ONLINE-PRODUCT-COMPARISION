import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  PackageCheck,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { ProductDTO } from '../../shared/types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { Button, Card, Input, ProductImage, Skeleton } from '../components/ui/Primitives.tsx';
import { useAudio } from '../context/AudioContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';

const HERO_IMAGE = '/src/assets/images/hero_comparex_studio_1795689411832.jpg';

const FLOATING_SHOWCASE = [
  {
    name: 'Samsung Galaxy S24 Ultra',
    slug: 'samsung-galaxy-s24-ultra',
    category: 'Smartphones',
    price: '₹1,24,999',
    spec: '200 MP · 12 GB · 120 Hz',
    image: '/src/assets/images/prod_smartphone_flagship_1795689412323.jpg',
    positionClass: 'top-4 left-4 sm:left-6',
    delay: 0.08,
  },
  {
    name: 'ASUS ROG Zephyrus G14',
    slug: 'asus-rog-zephyrus-g14',
    category: 'Laptops',
    price: '₹1,59,990',
    spec: 'Ryzen 9 · RTX 4060 · 3K OLED',
    image: '/src/assets/images/prod_laptop_pro_1795689412582.jpg',
    positionClass: 'bottom-4 right-4 sm:right-6',
    delay: 0.16,
  },
];

const TEAM_MINDS = [
  {
    name: 'Bogesh Manikanta',
    role: 'Founder',
    initials: 'BM',
    accent: 'from-sky-400 via-blue-500 to-indigo-600',
    ring: 'border-sky-500/40',
    bio: 'Founder of CompareX, driving the platform vision, system architecture, product experience, and innovation behind intelligent product comparison and commerce.',
  },
  {
    name: 'Nikhitha',
    role: 'Co-Founder',
    initials: 'NK',
    accent: 'from-violet-400 via-purple-500 to-indigo-600',
    ring: 'border-violet-500/40',
    bio: 'Co-Founder of CompareX, contributing to strategic planning, user experience refinement, product curation, and platform growth.',
  },
  {
    name: 'Jahnavi',
    role: 'Co-Founder',
    initials: 'JH',
    accent: 'from-cyan-400 via-teal-500 to-blue-600',
    ring: 'border-cyan-500/40',
    bio: 'Co-Founder of CompareX, supporting product design alignment, quality standards, operational structure, and consumer experience excellence.',
  },
];

export function HomePage({ navigate }: { navigate: (to: string) => void }) {
  const { categories, brands, setCompareList } = useCompare();
  const { playCue } = useAudio();
  const shouldReduceMotion = useReducedMotion();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductDTO[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [featured, setFeatured] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    apiRequest<{ items: ProductDTO[] }>('/api/products?sort=popularity&limit=8')
      .then((res) => {
        if (mounted) setFeatured(res.items);
      })
      .catch((err) => console.error('Failed loading featured products:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<{ items: ProductDTO[] }>(`/api/products?q=${encodeURIComponent(trimmed)}&limit=5`)
        .then((res) => {
          setSuggestions(res.items);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]));
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const q = searchQuery.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/discover');
  };

  const launchPresetComparison = async (slugs: string[]) => {
    playCue('compare');
    try {
      const res = await apiRequest<{ items: ProductDTO[] }>('/api/products?limit=48');
      const found = res.items.filter((p) => slugs.includes(p.slug));
      if (found.length >= 2) {
        setCompareList(found);
      }
      navigate('/compare');
    } catch {
      navigate('/compare');
    }
  };

  const spotlightBrands = brands.slice(0, 10);

  return (
    <div className="bg-[#060B16]">
      {/* 1. Full-Screen Cinematic Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/80 cx-grid-bg">
        <div className="pointer-events-none absolute -top-36 left-1/3 h-96 w-96 rounded-full bg-sky-500/15 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-24 right-1/4 h-96 w-96 rounded-full bg-violet-600/15 blur-[130px]" />

        <div className="relative mx-auto max-w-[1440px] px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-16 lg:pb-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Copy & 3 Core CTAs */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lg:col-span-6 space-y-6"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
                Compare Smarter. Choose Better.
              </p>

              <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[52px] leading-[1.08]">
                Discover Better. Compare Smarter.{' '}
                <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  Shop with Confidence.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                CompareX brings together structured product intelligence, interactive brand
                showcases, transparent comparisons, smart recommendations, and a seamless shopping
                experience in one unified platform.
              </p>

              {/* Interactive Search */}
              <div ref={searchBoxRef} className="relative max-w-xl">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex flex-col sm:flex-row gap-2 rounded-2xl border border-slate-700/80 bg-[#0B1222]/90 p-2 shadow-2xl"
                >
                  <div className="relative flex-1 flex items-center">
                    <Search className="absolute left-3.5 h-4 w-4 text-sky-400 pointer-events-none" />
                    <Input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      placeholder="Search Samsung, Apple, Sony, Nike, Daikin, Dyson..."
                      aria-label="Search products"
                      className="border-0 bg-transparent pl-10 focus-visible:ring-0"
                    />
                  </div>
                  <Button type="submit" variant="primary" size="md">
                    <span>Search Catalog</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-700/80 bg-[#0B1222]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false);
                          navigate(`/products/${item.slug}`);
                        }}
                        className="flex w-full items-center justify-between gap-4 border-b border-slate-800/80 last:border-0 px-4 py-3 text-left hover:bg-slate-800/70 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-12 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                            <ProductImage src={item.primaryImage} alt={item.name} className="h-full w-full" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{item.name}</div>
                            <div className="text-xs text-slate-400 truncate">
                              {item.brandName} · {item.categoryName}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-sky-400 tabular-nums shrink-0">
                          {formatCurrency(item.basePrice, item.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Primary CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="primary" size="lg" onClick={() => navigate('/discover')}>
                  <Compass className="h-4 w-4" />
                  <span>Explore Products</span>
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  onClick={() =>
                    launchPresetComparison(['samsung-galaxy-s24-ultra', 'apple-iphone-15-pro', 'oneplus-12-5g'])
                  }
                >
                  <Scale className="h-4 w-4" />
                  <span>Compare Products</span>
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate('/brands')}>
                  <ShoppingBag className="h-4 w-4 text-sky-400" />
                  <span>Shop Now</span>
                </Button>
              </div>
            </motion.div>

            {/* Right Studio Stage */}
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-6 relative"
            >
              <div className="relative aspect-[16/11] w-full overflow-hidden rounded-3xl border border-slate-700/70 bg-[#0B1222] shadow-[0_30px_80px_-24px_rgba(56,189,248,0.3)]">
                <ProductImage
                  src={HERO_IMAGE}
                  alt="CompareX flagship hardware studio composition"
                  className="h-full w-full"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#060B16]/85 via-transparent to-[#060B16]/35" />

                {FLOATING_SHOWCASE.map((card) => (
                  <motion.button
                    key={card.slug}
                    type="button"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: card.delay, duration: 0.35 }}
                    onClick={() => navigate(`/products/${card.slug}`)}
                    className={`hidden sm:flex absolute ${card.positionClass} items-center gap-3 rounded-2xl border border-slate-700/80 bg-[#060B16]/90 backdrop-blur-xl p-2.5 pr-4 text-left shadow-2xl hover:border-sky-400/70 transition-all cursor-pointer`}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-900 shrink-0">
                      <ProductImage src={card.image} alt={card.name} className="h-full w-full" />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-sky-400">{card.category}</div>
                      <div className="font-display text-xs font-bold text-white leading-tight">{card.name}</div>
                      <div className="font-mono text-[11px] text-slate-300 tabular-nums mt-0.5">
                        {card.price} · {card.spec}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. Featured Brands Interactive Showcase */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 border-b border-slate-800/60">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400 mb-1.5">
              Interactive Brand Discovery
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Featured Real-World Brands
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a brand showcase to explore its engineering philosophy, category lineup, and INR demo pricing.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/brands')}>
            <span>All {brands.length || 26} Brands</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {spotlightBrands.map((brand) => (
            <button
              key={brand.id}
              type="button"
              onClick={() => {
                playCue('brand');
                navigate(`/brands/${brand.slug}`);
              }}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0B1222] p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 cursor-pointer"
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-15 blur-xl transition-opacity group-hover:opacity-35"
                style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
              />
              <div className="flex items-center justify-between gap-2 mb-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
                />
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {brand.productCount ?? 0} items
                </span>
              </div>
              <div className="font-display text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                {brand.name}
              </div>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                {brand.tagline || brand.country}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sky-400">
                <span>Open Showcase</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Trending Collections & Curated Products */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 border-b border-slate-800/60">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-violet-400 mb-1.5">
              Trending Collections · INR Demo Catalog
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Popular Products Ready to Compare &amp; Shop
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Add items directly to your shopping cart or queue up to 4 products for side-by-side analysis.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/discover')}>
            <span>View Full Catalog (31 Products)</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} navigate={navigate} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Category Strip */}
      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 border-b border-slate-800/60">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="font-display text-xl font-bold text-white">
            Browse All {categories.length || 17} Standardized Categories
          </h2>
          <span className="text-xs text-slate-400">
            Electronics · Fashion · Home Appliances · Home &amp; Lifestyle
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/category/${cat.slug}`)}
              className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0B1222] p-3.5 text-left hover:border-sky-500/60 hover:bg-[#101A30] transition-colors cursor-pointer"
            >
              <div className="text-[11px] font-medium text-slate-500">{cat.domainGroup}</div>
              <div className="font-display text-sm font-semibold text-white mt-1 truncate">{cat.name}</div>
              <div className="font-mono text-[11px] text-sky-400 mt-2 tabular-nums">
                {cat.productCount ?? 0} product{(cat.productCount ?? 0) === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 5. Comparison Engine & Smart Recommendation Engine Showcase */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 border-b border-slate-800/60">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-7 sm:p-8 flex flex-col justify-between space-y-6 bg-gradient-to-br from-[#0B1222] to-[#081022]">
            <div className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                <Scale className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Side-by-Side Comparison Intelligence
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Evaluate up to 4 products from compatible categories with normalized units, automatic
                best-value highlights, difference-only filtering, and explicit transparency on unrecorded metrics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="primary"
                size="md"
                onClick={() =>
                  launchPresetComparison(['samsung-galaxy-s24-ultra', 'apple-iphone-15-pro', 'oneplus-12-5g'])
                }
              >
                <span>Compare Flagship Phones</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() =>
                  launchPresetComparison(['dell-xps-13-9340', 'lenovo-yoga-slim-7', 'asus-rog-zephyrus-g14'])
                }
              >
                Compare Laptops
              </Button>
            </div>
          </Card>

          <Card className="p-7 sm:p-8 flex flex-col justify-between space-y-6 bg-gradient-to-br from-[#0B1222] to-[#110D28]">
            <div className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-400">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl font-bold text-white">
                Explainable Decision Support Engine
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Set your INR budget ceiling, intended usage profile, and priority weights across Performance,
                Value, Efficiency, and Reliability to receive ranked, transparent trade-off explanations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="accent" size="md" onClick={() => navigate('/recommend')}>
                <Sparkles className="h-4 w-4" />
                <span>Launch Recommendation Wizard</span>
              </Button>
              <Button variant="outline" size="md" onClick={() => navigate('/price-history')}>
                <BarChart3 className="h-4 w-4 text-sky-400" />
                <span>View Price Insights</span>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* 6. Customer Experience Highlights */}
      <section className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 border-b border-slate-800/60">
        <div className="max-w-2xl mb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-400 mb-1.5">
            Complete E-Commerce Ecosystem
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Built for Confident End-to-End Shopping
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShoppingBag,
              title: 'Persistent Cart & Stock Guards',
              desc: 'Database-backed cart synced across guest and authenticated sessions with real-time stock checks and automatic merge on sign-in.',
            },
            {
              icon: ShieldCheck,
              title: 'Server-Verified INR Totals',
              desc: 'Unit prices, category GST rates, delivery thresholds, and payment simulations are validated and calculated strictly on the server.',
            },
            {
              icon: Truck,
              title: 'Idempotent 6-Step Checkout',
              desc: 'Guided checkout with saved shipping addresses, delivery speed selection, and idempotency protection against duplicate orders.',
            },
            {
              icon: PackageCheck,
              title: 'Order Timeline, Cancel & Returns',
              desc: 'Track order milestones, cancel pre-shipment orders with automatic stock restoration, or submit post-delivery return requests.',
            },
          ].map((item) => (
            <Card key={item.title} className="p-6 space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/80 bg-[#070D1A] text-sky-400">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-white">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* 7. Meet the Minds Behind CompareX */}
      <section className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
            Leadership &amp; Vision
          </p>
          <h2 className="font-display text-3xl font-bold text-white">
            Meet the Minds Behind CompareX
          </h2>
          <p className="text-sm text-slate-400">
            The founding team shaping intelligent consumer comparison and unified e-commerce.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {TEAM_MINDS.map((member) => (
            <Card
              key={member.name}
              className="relative overflow-hidden p-7 flex flex-col justify-between space-y-5 bg-gradient-to-b from-[#0E172C] to-[#080E1C]"
            >
              <div className="flex items-center gap-4">
                {/* Custom Replaceable Geometric Vector Monogram Portrait Placeholder */}
                <div
                  aria-label={`${member.name} portrait placeholder`}
                  className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border ${member.ring} bg-[#060B16] shadow-lg overflow-hidden`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${member.accent} opacity-20`} />
                  <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full opacity-25" aria-hidden="true">
                    <circle cx="32" cy="24" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-slate-300" />
                    <path d="M16 54c2-10 9-15 16-15s14 5 16 15" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-slate-300" />
                  </svg>
                  <span className="relative font-display text-lg font-extrabold tracking-tight text-white">
                    {member.initials}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white">{member.name}</h3>
                  <p className="font-mono text-xs font-semibold text-sky-400 uppercase tracking-wider mt-0.5">
                    {member.role}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{member.bio}</p>

              <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>CompareX Core Leadership</span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
