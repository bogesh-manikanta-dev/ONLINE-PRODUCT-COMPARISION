import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Box,
  Check,
  Info,
  LineChart as LineChartIcon,
  Maximize2,
  Minimize2,
  Scale,
  ShoppingBag,
  Star,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PriceObservationDTO, ProductDTO } from '../../shared/types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { Product3DViewer } from '../components/Product3DViewer.tsx';
import { Breadcrumbs, Button, Card, ProductImage, Skeleton } from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';
import { resolveProductViewer } from '../lib/product3d.ts';
import { recordRecentlyViewedSlug } from './DiscoveryPages.tsx';

export function ProductDetailPage({
  idOrSlug,
  navigate,
}: {
  idOrSlug: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { brands, compareItems, addToCompare, removeFromCompare, wishlistIds, setWishlistIds, showNotice } =
    useCompare();

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [observations, setObservations] = useState<PriceObservationDTO[]>([]);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [similarProducts, setSimilarProducts] = useState<ProductDTO[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [viewMode, setViewMode] = useState<'photo' | 'studio'>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'photo';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !reduce && window.innerWidth >= 1024 ? 'studio' : 'photo';
  });
  const [qty, setQty] = useState(1);
  const [addingCart, setAddingCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    setActiveImageIdx(0);
    setZoomed(false);

    apiRequest<{ product: ProductDTO }>(`/api/products/${encodeURIComponent(idOrSlug)}`)
      .then(async (res) => {
        if (!mounted) return;
        setProduct(res.product);
        recordRecentlyViewedSlug(res.product.slug);

        const [hist, sim] = await Promise.all([
          apiRequest<{
            observations: PriceObservationDTO[];
            lowestPrice: number | null;
          }>(`/api/products/${res.product.id}/price-history`),
          apiRequest<{ items: ProductDTO[] }>(
            `/api/products?category=${encodeURIComponent(res.product.categorySlug)}&limit=4`
          ).catch(() => ({ items: [] })),
        ]);

        if (mounted) {
          setObservations(hist.observations);
          setLowestPrice(hist.lowestPrice);
          setSimilarProducts(sim.items.filter((p) => p.id !== res.product.id).slice(0, 3));
        }
      })
      .catch((err: any) => {
        if (mounted) setError(err.message || 'Product could not be loaded.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [idOrSlug]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    if (product.images && product.images.length > 0) {
      return product.images.map((img) => ({
        url: img.url,
        alt: img.altText || product.name,
      }));
    }
    return [{ url: product.primaryImage, alt: product.name }];
  }, [product]);

  const viewerSupported = useMemo(
    () =>
      product
        ? resolveProductViewer({
            model3dPreset: product.model3dPreset,
            categorySlug: product.categorySlug,
            finishHex: product.finishHex,
          }).supported
        : false,
    [product]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <Skeleton className="h-7 w-56" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <Skeleton className="lg:col-span-6 h-[440px]" />
          <Skeleton className="lg:col-span-6 h-[440px]" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Product Unavailable</h1>
        <p className="text-sm text-slate-400">{error || 'The requested product was not found.'}</p>
        <Button variant="primary" onClick={() => navigate('/discover')}>
          Back to Discovery
        </Button>
      </div>
    );
  }

  const isInCompare = compareItems.some((p) => p.id === product.id);
  const isWishlisted = wishlistIds.has(product.id);
  const currentImg = galleryImages[activeImageIdx] || galleryImages[0];

  const handleWishlist = async () => {
    if (!user) {
      showNotice('info', 'Sign in to save items to your wishlist.');
      navigate('/login');
      return;
    }
    try {
      if (isWishlisted) {
        await apiRequest(`/api/workspace/wishlist/${product.id}`, { method: 'DELETE' });
        setWishlistIds((prev) => {
          const n = new Set(prev);
          n.delete(product.id);
          return n;
        });
        showNotice('info', 'Removed from wishlist.');
      } else {
        await apiRequest('/api/workspace/wishlist', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id }),
        });
        setWishlistIds((prev) => new Set(prev).add(product.id));
        showNotice('success', 'Added to wishlist.');
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Could not update wishlist.');
    }
  };

  const chartData = observations.map((o) => ({
    date: formatDate(o.observedAt),
    price: o.price,
    seller: o.sellerName,
  }));

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 space-y-10">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-2">
          <Breadcrumbs
            navigate={navigate}
            items={[
              { label: 'Home', to: '/' },
              { label: product.categoryName, to: `/category/${product.categorySlug}` },
              { label: product.name },
            ]}
          />
          <button
            type="button"
            onClick={() => navigate(`/category/${product.categorySlug}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {product.categoryName}</span>
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {product.isDemoData ? 'Seeded Demonstration Record' : product.dataSourceLabel}
        </span>
      </div>

      {/* Contiguous Product Module */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Image Gallery */}
        <div className="lg:col-span-6 space-y-3">
          {viewerSupported && (
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-slate-800 bg-[#0B0A08] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('photo')}
                  aria-pressed={viewMode === 'photo'}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'photo'
                      ? 'bg-sky-400/15 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('studio')}
                  aria-pressed={viewMode === 'studio'}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    viewMode === 'studio'
                      ? 'bg-sky-400/15 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Box className="h-3 w-3" aria-hidden="true" />
                  360° Studio
                </button>
              </div>
              <span className="hidden text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:inline">
                Interactive 3D
              </span>
            </div>
          )}

          {viewMode === 'studio' && viewerSupported ? (
            <Product3DViewer product={product} variant="detail" />
          ) : (
          <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0F0E0B] aspect-[4/3] group">
            <ProductImage
              src={currentImg?.url}
              alt={currentImg?.alt || product.name}
              className={`h-full w-full transition-transform duration-300 ${
                zoomed ? 'scale-125 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
            />
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? 'Reset image zoom' : 'Zoom product image'}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-[#070705]/80 backdrop-blur-md text-slate-200 hover:text-white hover:border-sky-400/60 transition-colors cursor-pointer"
            >
              {zoomed ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
          )}

          {viewMode === 'photo' && galleryImages.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img.url}-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImageIdx(idx);
                    setZoomed(false);
                  }}
                  className={`h-16 w-22 shrink-0 overflow-hidden rounded-lg border transition-all cursor-pointer ${
                    idx === activeImageIdx
                      ? 'border-sky-400 ring-2 ring-sky-400/30'
                      : 'border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductImage src={img.url} alt={img.alt} className="h-full w-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Summary & Actions */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
              <button
                type="button"
                onClick={() => {
                  const matchedBrand = brands.find((b) => b.id === product.brandId);
                  navigate(matchedBrand ? `/brands/${matchedBrand.slug}` : '/brands');
                }}
                className="font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                {product.brandName}
              </button>
              <span aria-hidden="true">·</span>
              <span>{product.categoryName}</span>
              {product.subcategoryName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.subcategoryName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">Model {product.modelNumber}</span>
              {product.variantLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">{product.variantLabel}</span>
                </>
              )}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              {product.name}
            </h1>

            <div className="flex flex-wrap items-center gap-6 rounded-xl border border-slate-800/90 bg-[#0F0E0B] p-4 mb-5">
              <div>
                <div className="text-xs text-slate-400">Recorded Base Price</div>
                <div className="font-mono text-3xl font-bold text-white tabular-nums mt-0.5">
                  {formatCurrency(product.basePrice, product.currency)}
                </div>
              </div>
              {lowestPrice !== null && (
                <div className="border-l border-slate-800 pl-5">
                  <div className="text-xs text-slate-400">Lowest Recorded</div>
                  <div className="font-mono text-xl font-semibold text-emerald-400 tabular-nums mt-0.5">
                    {formatCurrency(lowestPrice, product.currency)}
                  </div>
                </div>
              )}
              <div className="border-l border-slate-800 pl-5">
                <div className="text-xs text-slate-400">Consumer Rating</div>
                {product.rating !== null ? (
                  <div className="inline-flex items-center gap-1.5 font-mono text-base font-semibold text-white tabular-nums mt-0.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span>{product.rating.toFixed(1)}</span>
                    <span className="text-xs font-sans font-normal text-slate-400">
                      ({product.reviewCount} reviews)
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 mt-0.5">Not recorded</div>
                )}
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{product.description}</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center rounded-xl border border-slate-700 bg-[#0B0A08] p-1">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1 || product.stockQuantity <= 0}
                  className="px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center font-mono text-sm font-semibold text-white tabular-nums">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stockQuantity), 10, q + 1))}
                  disabled={qty >= Math.min(product.stockQuantity, 10) || product.stockQuantity <= 0}
                  className="px-2.5 py-1.5 text-sm font-bold text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <Button
                variant="accent"
                size="lg"
                disabled={addingCart || product.stockQuantity <= 0}
                onClick={async () => {
                  setAddingCart(true);
                  await addToCart(product.id, qty, true);
                  setAddingCart(false);
                }}
                className="flex-1 sm:flex-none"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>
                  {product.stockQuantity <= 0
                    ? 'Out of Stock'
                    : addingCart
                      ? 'Adding...'
                      : 'Add to Cart'}
                </span>
              </Button>

              <Button
                variant={isInCompare ? 'accent' : 'primary'}
                size="lg"
                onClick={() =>
                  isInCompare ? removeFromCompare(product.id) : addToCompare(product)
                }
              >
                {isInCompare ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                <span>{isInCompare ? 'In Compare' : 'Compare'}</span>
              </Button>

              <Button variant="outline" size="lg" onClick={handleWishlist}>
                <Bookmark className={`h-4 w-4 ${isWishlisted ? 'fill-current text-sky-400' : ''}`} />
                <span>{isWishlisted ? 'Wishlisted' : 'Wishlist'}</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate(`/price-history/${product.id}`)}
              >
                <LineChartIcon className="h-4 w-4 text-sky-400" />
                <span>Price History</span>
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Stock:{' '}
              <strong
                className={
                  product.stockQuantity <= 0
                    ? 'text-red-400'
                    : product.stockQuantity <= 5
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                }
              >
                {product.stockQuantity > 0
                  ? `${product.stockQuantity} unit(s) available`
                  : 'Out of Stock'}
              </strong>{' '}
              · Est. GST {product.taxRatePercent}% · Updated {formatDate(product.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Seller Offers & Hidden-Cost Awareness */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            Seller Offers & Hidden-Cost Breakdown
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Base prices are separated from delivery, installation, extended warranty, and accessory fees.
            Missing cost fields are explicitly flagged.
          </p>
        </div>

        {!product.offers || product.offers.length === 0 ? (
          <Card className="p-6 text-sm text-slate-400">
            No seller offers have been recorded for this product yet.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {product.offers.map((offer) => (
              <Card key={offer.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-white">
                      {offer.sellerName}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Source: {offer.dataSource} · Verified {formatDate(offer.lastVerifiedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Base Offer</div>
                    <div className="font-mono text-xl font-bold text-white tabular-nums">
                      {formatCurrency(offer.price, offer.currency)}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Delivery</dt>
                    <dd className="font-mono font-medium text-slate-200 tabular-nums">
                      {offer.deliveryCharge !== null ? formatCurrency(offer.deliveryCharge, offer.currency) : 'Not recorded'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Installation</dt>
                    <dd className="font-mono font-medium text-slate-200 tabular-nums">
                      {offer.installationCharge !== null
                        ? formatCurrency(offer.installationCharge, offer.currency)
                        : 'Not recorded'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Optional Warranty</dt>
                    <dd className="font-mono font-medium text-slate-200 tabular-nums">
                      {offer.warrantyCost !== null ? formatCurrency(offer.warrantyCost, offer.currency) : 'Not recorded'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-400">Required Accessories</dt>
                    <dd className="font-mono font-medium text-slate-200 tabular-nums">
                      {offer.requiredAccessoriesCost !== null
                        ? formatCurrency(offer.requiredAccessoriesCost, offer.currency)
                        : 'Not recorded'}
                    </dd>
                  </div>
                  {offer.additionalFees !== null && offer.additionalFees > 0 && (
                    <div className="col-span-2 flex justify-between pt-1.5 border-t border-slate-800">
                      <dt className="text-slate-400">Additional Fees</dt>
                      <dd className="font-mono font-medium text-slate-200 tabular-nums">
                        {formatCurrency(offer.additionalFees, offer.currency)}
                      </dd>
                    </div>
                  )}
                </dl>

                {offer.additionalFeesNote && (
                  <p className="text-xs text-slate-300 bg-[#0B0A08] border border-slate-800 rounded-lg px-3 py-2">
                    Note: {offer.additionalFeesNote}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <div>
                    <div className="text-xs text-slate-400">Estimated Total Cost</div>
                    {offer.estimatedTotalCost !== null ? (
                      <div className="font-mono text-lg font-bold text-sky-400 tabular-nums">
                        {formatCurrency(offer.estimatedTotalCost, offer.currency)}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-amber-400">
                        Cannot calculate complete estimate
                      </div>
                    )}
                  </div>
                  {offer.hasMissingCostInfo && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-amber-400">
                      <Info className="h-3.5 w-3.5 shrink-0" />
                      <span>Missing: {offer.missingCostFields.join(', ')}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Specifications Table + Price Trend Preview */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <Card className="lg:col-span-7 overflow-hidden">
          <div className="border-b border-slate-800 px-5 py-4">
            <h2 className="font-display text-lg font-bold text-white">
              Technical Specifications
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-800/80">
                {product.specifications.map((spec) => (
                  <tr key={spec.id} className="hover:bg-slate-800/35 transition-colors">
                    <td className="px-5 py-3 text-slate-400 font-medium w-2/5">{spec.label}</td>
                    <td className="px-5 py-3 font-mono text-slate-100 tabular-nums">
                      <div className="flex items-center justify-between gap-2">
                        <span>{spec.rawValue}</span>
                        {spec.isConflicting && (
                          <span className="inline-flex items-center gap-1 text-xs font-sans text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Conflicting source note
                          </span>
                        )}
                      </div>
                      {spec.isConflicting && spec.sourceNote && (
                        <p className="text-xs font-sans text-slate-400 mt-0.5">{spec.sourceNote}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="font-display text-lg font-bold text-white">
                Recorded Price Trend
              </h2>
              <button
                type="button"
                onClick={() => navigate(`/price-history/${product.id}`)}
                className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                Full Analysis
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Seeded historical observations (Demo) · Not live merchant scraping
            </p>

            {chartData.length >= 2 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pdpPriceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D9B968" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#D9B968" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A342C" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#A79E90' }} stroke="#514A41" />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#A79E90' }}
                      stroke="#514A41"
                      tickFormatter={(v) => formatCurrency(Number(v), product.currency)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F0E0B',
                        borderColor: '#514A41',
                        borderRadius: '0.75rem',
                        color: '#F3EEE4',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [
                        formatCurrency(Number(val), product.currency),
                        'Observed Price',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#D9B968"
                      strokeWidth={2.5}
                      fill="url(#pdpPriceGrad)"
                      dot={{ r: 3.5, fill: '#D9B968' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                Insufficient historical observations to plot trend.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Similar Products in Same Category */}
      {similarProducts.length > 0 && (
        <section className="pt-6 border-t border-slate-800/80 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Similar Models in {product.categoryName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Compatible models you can compare directly side-by-side with {product.name}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/category/${product.categorySlug}`)}
            >
              View All {product.categoryName}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similarProducts.map((sim) => (
              <ProductCard key={sim.id} product={sim} navigate={navigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
