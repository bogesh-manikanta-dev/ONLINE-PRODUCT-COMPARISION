import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Bookmark, Box, Check, Scale, ShoppingBag, Star } from 'lucide-react';
import type { ProductDTO } from '../../shared/types.ts';
import { Product3DViewer } from './Product3DViewer.tsx';
import { resolveProductViewer } from '../lib/product3d.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useAudio } from '../context/AudioContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';
import { Button, Card, ProductImage } from './ui/Primitives.tsx';

export function ProductCard({
  product,
  navigate,
}: {
  product: ProductDTO;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { playCue } = useAudio();
  const { compareItems, addToCompare, removeFromCompare, wishlistIds, setWishlistIds, showNotice } =
    useCompare();
  const [adding, setAdding] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const can3d = useMemo(
    () =>
      resolveProductViewer({
        model3dPreset: product.model3dPreset,
        categorySlug: product.categorySlug,
        finishHex: product.finishHex,
      }).supported,
    [product.model3dPreset, product.categorySlug, product.finishHex]
  );

  const isInCompare = compareItems.some((p) => p.id === product.id);
  const isWishlisted = wishlistIds.has(product.id);
  const isOutOfStock = product.stockQuantity <= 0 || product.availabilityStatus === 'OUT_OF_STOCK';

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    playCue('compare');
    if (isInCompare) {
      removeFromCompare(product.id);
    } else {
      addToCompare(product);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock || adding) return;
    setAdding(true);
    await addToCart(product.id, 1, true);
    setAdding(false);
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      showNotice('info', 'Please sign in to save products to your wishlist.');
      navigate('/login');
      return;
    }
    try {
      if (isWishlisted) {
        await apiRequest(`/api/workspace/wishlist/${product.id}`, { method: 'DELETE' });
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
        showNotice('info', `Removed ${product.name} from wishlist.`);
      } else {
        await apiRequest('/api/workspace/wishlist', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id }),
        });
        setWishlistIds((prev) => new Set(prev).add(product.id));
        showNotice('success', `Saved ${product.name} to wishlist.`);
      }
    } catch (err: any) {
      showNotice('error', err.message || 'Could not update wishlist.');
    }
  };

  const topSpecs = product.specifications.slice(0, 3);

  return (
    <Card
      onClick={() => navigate(`/products/${product.slug}`)}
      className="group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/45 hover:shadow-[0_22px_48px_-20px_rgba(217,185,104,0.22)] cursor-pointer"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0B0A08] border-b border-slate-800/80">
        {show3d ? (
          <div
            className="absolute inset-0 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Product3DViewer product={product} variant="card" className="h-full w-full" />
          </div>
        ) : (
          <ProductImage
            src={product.primaryImage}
            alt={product.name}
            className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070705]/75 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
        {can3d && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShow3d((value) => !value);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-pressed={show3d}
            aria-label={show3d ? `Show photos of ${product.name}` : `View ${product.name} in 3D`}
            className="absolute bottom-3 left-3 z-20 inline-flex items-center gap-1 rounded-lg border border-slate-700/80 bg-[#070705]/85 px-2 py-1 text-[11px] font-medium text-slate-100 backdrop-blur-md transition-colors hover:border-sky-400/60 hover:text-white cursor-pointer"
          >
            <Box className="h-3 w-3 text-sky-400" aria-hidden="true" />
            {show3d ? 'Photos' : '3D'}
          </button>
        )}
        <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#070705]/85 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-100">
            <span>View Details</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-sky-400" />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 truncate">
          <span className="font-semibold text-sky-400">{product.brandName}</span>
          <span aria-hidden="true">·</span>
          <span>{product.categoryName}</span>
          <span aria-hidden="true">·</span>
          <span className={isOutOfStock ? 'text-red-400' : product.stockQuantity <= 6 ? 'text-amber-400' : 'text-emerald-400'}>
            {isOutOfStock
              ? 'Out of stock'
              : product.stockQuantity <= 6
                ? `${product.stockQuantity} left`
                : 'In stock'}
          </span>
        </div>

        <h3 className="font-display text-base font-semibold text-white leading-snug line-clamp-2 mb-1 group-hover:text-sky-300 transition-colors">
          {product.name}
        </h3>
        {product.variantLabel && (
          <div className="text-[11px] text-slate-400 truncate mb-2">{product.variantLabel}</div>
        )}

        <div className="flex items-baseline justify-between gap-2 mb-4">
          <span className="font-mono text-lg font-bold text-white tabular-nums">
            {formatCurrency(product.basePrice, product.currency)}
          </span>
          {product.rating !== null ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 tabular-nums">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)} ({product.reviewCount})
            </span>
          ) : (
            <span className="text-xs text-slate-500">No rating recorded</span>
          )}
        </div>

        <dl className="space-y-1.5 border-t border-slate-800/80 pt-3 mb-4 text-xs flex-1">
          {topSpecs.length > 0 ? (
            topSpecs.map((spec) => (
              <div key={spec.id} className="flex items-center justify-between gap-3">
                <dt className="text-slate-400 truncate">{spec.label}</dt>
                <dd className="font-mono font-medium text-slate-200 tabular-nums text-right truncate">
                  {spec.rawValue}
                </dd>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">Specifications pending entry</div>
          )}
        </dl>

        <div className="flex items-center gap-2 pt-3 border-t border-slate-800/80">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isOutOfStock || adding}
            onClick={handleAddToCart}
            className="flex-1"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{isOutOfStock ? 'Sold Out' : adding ? 'Adding...' : 'Add to Cart'}</span>
          </Button>
          <Button
            type="button"
            variant={isInCompare ? 'accent' : 'outline'}
            size="sm"
            onClick={handleCompareToggle}
            aria-label={isInCompare ? 'Remove from comparison' : 'Add to comparison'}
            className="px-2.5"
          >
            {isInCompare ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant={isWishlisted ? 'primary' : 'outline'}
            size="sm"
            onClick={handleWishlistToggle}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className="px-2.5"
          >
            <Bookmark className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
