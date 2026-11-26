import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Globe, Search, Sparkles } from 'lucide-react';
import type { BrandDetailDTO } from '../../shared/types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { Breadcrumbs, Button, Card, Input, Select, Skeleton } from '../components/ui/Primitives.tsx';
import { useAudio } from '../context/AudioContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';

export function BrandsDirectoryPage({ navigate }: { navigate: (to: string) => void }) {
  const { brands } = useCompare();
  const { playCue } = useAudio();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.country.toLowerCase().includes(q) ||
        b.tagline.toLowerCase().includes(q)
    );
  }, [brands, search]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-2">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Brands' }]} navigate={navigate} />
          <h1 className="font-display text-3xl font-bold text-white">Interactive Brand Showcases</h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Explore {brands.length} real-world brands across Electronics, Fashion, Home Appliances, and
            Lifestyle with curated specs and INR demo pricing.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter brands..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((brand) => (
          <Card
            key={brand.id}
            onClick={() => {
              playCue('brand');
              navigate(`/brands/${brand.slug}`);
            }}
            className="group relative overflow-hidden p-6 flex flex-col justify-between gap-4 hover:border-slate-600 transition-all cursor-pointer"
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-15 blur-2xl group-hover:opacity-30 transition-opacity"
              style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
                  />
                  {brand.country}
                </span>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {brand.productCount ?? 0} product{(brand.productCount ?? 0) === 1 ? '' : 's'}
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold text-white group-hover:text-sky-300 transition-colors">
                {brand.name}
              </h2>
              {brand.tagline && (
                <div className="text-xs font-semibold text-sky-400">{brand.tagline}</div>
              )}
              <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                {brand.description}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-sky-400">
              <span>Enter Brand Showcase</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function BrandShowcasePage({
  slug,
  navigate,
}: {
  slug: string;
  navigate: (to: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [detail, setDetail] = useState<BrandDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'popularity' | 'price_asc' | 'price_desc'>('popularity');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    apiRequest<BrandDetailDTO>(`/api/brands/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch((err: any) => {
        if (active) setError(err.message || 'Unable to load brand showcase.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const displayedProducts = useMemo(() => {
    if (!detail) return [];
    let list = [...detail.products];
    if (categoryFilter !== 'ALL') {
      list = list.filter((p) => p.categorySlug === categoryFilter);
    }
    if (sortBy === 'price_asc') list.sort((a, b) => a.basePrice - b.basePrice);
    else if (sortBy === 'price_desc') list.sort((a, b) => b.basePrice - a.basePrice);
    else list.sort((a, b) => b.popularityScore - a.popularityScore);
    return list;
  }, [detail, categoryFilter, sortBy]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-56" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Brand Showcase Not Found</h1>
        <p className="text-sm text-slate-400">{error || 'Requested brand does not exist.'}</p>
        <Button variant="primary" onClick={() => navigate('/brands')}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back to All Brands</span>
        </Button>
      </div>
    );
  }

  const { brand, categories } = detail;

  return (
    <div className="bg-[#060B16]">
      {/* Brand Accent Hero */}
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <div
          className="pointer-events-none absolute -top-32 left-1/4 h-96 w-96 rounded-full opacity-20 blur-[130px]"
          style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
        />
        <div className="relative mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 space-y-6">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Brands', to: '/brands' },
              { label: brand.name },
            ]}
            navigate={navigate}
          />

          <motion.div
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
          >
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: brand.accentColor || '#38BDF8' }}
                />
                <span>{brand.country}</span>
                <span>·</span>
                <span>Official Showcase</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-white">
                {brand.name}
              </h1>
              {brand.tagline && (
                <p className="text-lg font-semibold" style={{ color: brand.accentColor || '#38BDF8' }}>
                  {brand.tagline}
                </p>
              )}
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {brand.heroDescription || brand.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {brand.website && (
                <a
                  href={brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0B1222] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
                >
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  <span>Official Brand Site</span>
                </a>
              )}
              <Button variant="accent" size="sm" onClick={() => navigate('/recommend')}>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Smart Match</span>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filter Toolbar & Brand Catalog */}
      <section className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                categoryFilter === 'ALL'
                  ? 'bg-sky-500 text-slate-950'
                  : 'border border-slate-800 bg-[#0B1222] text-slate-300 hover:text-white'
              }`}
            >
              All Categories ({detail.products.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.slug)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  categoryFilter === c.slug
                    ? 'bg-sky-500 text-slate-950'
                    : 'border border-slate-800 bg-[#0B1222] text-slate-300 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="w-48">
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'popularity' | 'price_asc' | 'price_desc')}
              aria-label="Sort brand products"
            >
              <option value="popularity">Sort: Popularity</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedProducts.map((product) => (
            <ProductCard key={product.id} product={product} navigate={navigate} />
          ))}
        </div>
      </section>
    </div>
  );
}
