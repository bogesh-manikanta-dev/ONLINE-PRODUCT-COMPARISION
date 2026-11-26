import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, History, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { ProductDTO } from '../../shared/types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { Breadcrumbs, Button, Card, Input, Label, ProductImage, Select, Skeleton } from '../components/ui/Primitives.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';

const RECENTLY_VIEWED_KEY = 'comparex_recently_viewed_slugs';

export function recordRecentlyViewedSlug(slug: string) {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [slug, ...list.filter((s) => s !== slug)].slice(0, 6);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function DiscoveryPage({
  navigate,
  categorySlug,
  initialQuery = '',
  initialBrandId = '',
  mode = 'discover',
}: {
  navigate: (to: string) => void;
  categorySlug?: string;
  initialQuery?: string;
  initialBrandId?: string;
  mode?: 'discover' | 'category' | 'search';
}) {
  const { categories, brands } = useCompare();

  const [q, setQ] = useState(initialQuery);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(categorySlug || '');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState(initialBrandId);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [sort, setSort] = useState<'popularity' | 'price_asc' | 'price_desc' | 'rating' | 'value'>('popularity');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ProductDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentProducts, setRecentProducts] = useState<ProductDTO[]>([]);
  const [suggestions, setSuggestions] = useState<ProductDTO[]>([]);

  useEffect(() => {
    setSelectedCategorySlug(categorySlug || '');
    setSelectedSubcategoryId('');
    setSpecKey('');
    setSpecValue('');
    setPage(1);
  }, [categorySlug]);

  useEffect(() => {
    setQ(initialQuery);
    setPage(1);
  }, [initialQuery]);

  useEffect(() => {
    if (initialBrandId) {
      setSelectedBrandId(initialBrandId);
      setPage(1);
    }
  }, [initialBrandId]);

  // Load recently viewed products from localStorage matched against catalog
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      const slugs: string[] = raw ? JSON.parse(raw) : [];
      if (slugs.length === 0) return;
      apiRequest<{ items: ProductDTO[] }>('/api/products?limit=48')
        .then((res) => {
          const ordered = slugs
            .map((s) => res.items.find((p) => p.slug === s))
            .filter((p): p is ProductDTO => Boolean(p))
            .slice(0, 4);
          setRecentProducts(ordered);
        })
        .catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  // Live keyword suggestions when typing in filter sidebar
  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      apiRequest<{ items: ProductDTO[] }>(`/api/products?q=${encodeURIComponent(trimmed)}&limit=4`)
        .then((res) => setSuggestions(res.items))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === selectedCategorySlug) || null,
    [categories, selectedCategorySlug]
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (selectedCategorySlug) params.set('category', selectedCategorySlug);
      if (selectedSubcategoryId) params.set('subcategoryId', selectedSubcategoryId);
      if (selectedBrandId) params.set('brandId', selectedBrandId);
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (minRating) params.set('minRating', minRating);
      if (specKey && specValue.trim()) {
        params.set('specKey', specKey);
        params.set('specValue', specValue.trim());
      }
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '9');

      const res = await apiRequest<{
        items: ProductDTO[];
        total: number;
        totalPages: number;
      }>(`/api/products?${params.toString()}`);

      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [
    q,
    selectedCategorySlug,
    selectedSubcategoryId,
    selectedBrandId,
    minPrice,
    maxPrice,
    minRating,
    specKey,
    specValue,
    sort,
    page,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const resetFilters = () => {
    setQ('');
    setSelectedCategorySlug(categorySlug || '');
    setSelectedSubcategoryId('');
    setSelectedBrandId('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setSpecKey('');
    setSpecValue('');
    setSort('popularity');
    setPage(1);
  };

  const sliderMaxValue = maxPrice ? Math.min(250000, Math.max(1000, Number(maxPrice))) : 250000;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumbs & Page Header */}
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            ...(mode === 'category' && activeCategory
              ? [{ label: 'Explore', to: '/discover' }, { label: activeCategory.name }]
              : mode === 'search'
                ? [{ label: 'Explore', to: '/discover' }, { label: 'Search' }]
                : [{ label: 'Explore Catalog' }]),
          ]}
        />

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wider uppercase text-sky-400 mb-1">
              {mode === 'category'
                ? activeCategory?.domainGroup || 'Category Catalog'
                : mode === 'search'
                  ? 'Search Results'
                  : 'Product Discovery'}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              {mode === 'category' && activeCategory
                ? activeCategory.name
                : mode === 'search' && q
                  ? `Results for "${q}"`
                  : 'Explore & Filter Products'}
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
              {activeCategory
                ? activeCategory.description
                : 'Search across electronics, fashion, home appliances, and furniture with specification and budget filtering.'}
            </p>
          </div>
          <div className="text-sm text-slate-300 font-mono tabular-nums">
            {total} matching product{total === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Category Quick Collections Strip */}
      {mode === 'discover' && categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedCategorySlug('');
              setSelectedSubcategoryId('');
              setPage(1);
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              !selectedCategorySlug
                ? 'border-sky-400/70 bg-sky-500/15 text-sky-300'
                : 'border-slate-800 bg-[#0B1222] text-slate-300 hover:border-slate-700 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCategorySlug(c.slug);
                setSelectedSubcategoryId('');
                setSpecKey('');
                setSpecValue('');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategorySlug === c.slug
                  ? 'border-sky-400/70 bg-sky-500/15 text-sky-300'
                  : 'border-slate-800 bg-[#0B1222] text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {c.name} ({c.productCount ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* Category Spec Overview when in Category Listing */}
      {mode === 'category' && activeCategory && activeCategory.specDefinitions && (
        <div className="rounded-xl border border-slate-800/90 bg-[#0B1222] p-5">
          <h2 className="font-display text-sm font-semibold text-white mb-1.5">
            Standardized Comparison Attributes for {activeCategory.name}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {activeCategory.specDefinitions.map((d) => `${d.label}${d.unit ? ` (${d.unit})` : ''}`).join(' · ')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Filter Sidebar */}
        <aside className="lg:col-span-3 space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
                <Filter className="h-4 w-4 text-sky-400" />
                <span>Refine Results</span>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="relative">
              <Label htmlFor="filter-q">Keyword or Model</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="filter-q"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Name, brand, model..."
                  className="pl-9"
                />
              </div>
              {suggestions.length > 0 && q.trim().length >= 2 && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-[#070D1A] p-1.5 space-y-1">
                  <div className="px-2 py-0.5 text-[11px] font-medium text-slate-400">
                    Quick Matches
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => navigate(`/products/${s.slug}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800/70 cursor-pointer"
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="font-mono text-sky-400 tabular-nums shrink-0">
                        {formatCurrency(s.basePrice, s.currency)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="filter-cat">Category</Label>
              <Select
                id="filter-cat"
                value={selectedCategorySlug}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCategorySlug(val);
                  setSelectedSubcategoryId('');
                  setSpecKey('');
                  setSpecValue('');
                  setPage(1);
                  if (mode === 'category' && val) {
                    navigate(`/category/${val}`);
                  }
                }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name} ({c.productCount ?? 0})
                  </option>
                ))}
              </Select>
            </div>

            {activeCategory && activeCategory.subcategories && activeCategory.subcategories.length > 0 && (
              <div>
                <Label htmlFor="filter-subcat">Subcategory</Label>
                <Select
                  id="filter-subcat"
                  value={selectedSubcategoryId}
                  onChange={(e) => {
                    setSelectedSubcategoryId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Subcategories</option>
                  {activeCategory.subcategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="filter-brand">Brand</Label>
              <Select
                id="filter-brand"
                value={selectedBrandId}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.productCount ?? 0})
                  </option>
                ))}
              </Select>
            </div>

            {/* Interactive Price Slider + Numeric Inputs */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="filter-price-slider" className="mb-0">
                  Max Price Ceiling
                </Label>
                <span className="font-mono text-xs text-sky-400 tabular-nums">
                  {maxPrice ? `₹${Number(maxPrice).toLocaleString('en-IN')}` : 'Any (₹2,50,000+)'}
                </span>
              </div>
              <input
                id="filter-price-slider"
                type="range"
                min={1000}
                max={250000}
                step={1000}
                value={sliderMaxValue}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxPrice(val >= 250000 ? '' : String(val));
                  setPage(1);
                }}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label htmlFor="filter-min">Min Price (₹)</Label>
                  <Input
                    id="filter-min"
                    type="number"
                    min={0}
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      setPage(1);
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="filter-max">Max Price (₹)</Label>
                  <Input
                    id="filter-max"
                    type="number"
                    min={0}
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      setPage(1);
                    }}
                    placeholder="250000"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="filter-rating">Minimum Rating</Label>
              <Select
                id="filter-rating"
                value={minRating}
                onChange={(e) => {
                  setMinRating(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any Rating (includes unrated)</option>
                <option value="4.5">4.5 stars & above</option>
                <option value="4.0">4.0 stars & above</option>
              </Select>
            </div>

            {activeCategory && activeCategory.specDefinitions && activeCategory.specDefinitions.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400" />
                  <span>Specification Filter</span>
                </div>
                <Select
                  id="filter-spec-key"
                  aria-label="Specification Filter"
                  value={specKey}
                  onChange={(e) => {
                    setSpecKey(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Select attribute...</option>
                  {activeCategory.specDefinitions.map((d) => (
                    <option key={d.id} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </Select>
                {specKey && (
                  <Input
                    value={specValue}
                    onChange={(e) => {
                      setSpecValue(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Contains value (e.g. 16 GB, OLED)"
                    aria-label="Specification match value"
                  />
                )}
              </div>
            )}
          </Card>
        </aside>

        {/* Results Grid */}
        <div className="lg:col-span-9 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-[#0B1222] px-4 py-3">
            <div className="text-xs text-slate-400">
              Showing page <span className="font-mono font-semibold text-white">{page}</span> of{' '}
              <span className="font-mono font-semibold text-white">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-xs font-semibold text-slate-300">
                Sort by
              </label>
              <Select
                id="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-52 h-9 text-xs"
              >
                <option value="popularity">Popularity</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Consumer Rating</option>
                <option value="value">Calculated Value Score</option>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-800/80 bg-red-950/60 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Skeleton key={n} className="h-[420px]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="p-10 text-center space-y-3">
              <h3 className="font-display text-lg font-semibold text-white">
                No matching products found
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Try broadening your budget range, clearing specification filters, or resetting search terms.
              </p>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Reset All Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} navigate={navigate} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-3 text-xs font-mono text-slate-300 tabular-nums">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Recently Viewed Strip */}
          {recentProducts.length > 0 && (
            <section className="pt-6 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <History className="h-4 w-4 text-sky-400" />
                <span>Recently Viewed</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recentProducts.map((rp) => (
                  <button
                    key={rp.id}
                    type="button"
                    onClick={() => navigate(`/products/${rp.slug}`)}
                    className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-[#0B1222] p-3 text-left hover:border-sky-500/50 transition-colors cursor-pointer"
                  >
                    <div className="h-12 w-16 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      <ProductImage src={rp.primaryImage} alt={rp.name} className="h-full w-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 truncate">{rp.brandName}</div>
                      <div className="text-xs font-semibold text-white truncate">{rp.name}</div>
                      <div className="font-mono text-xs font-bold text-sky-400 tabular-nums mt-0.5">
                        {formatCurrency(rp.basePrice, rp.currency)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
