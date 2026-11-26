import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Compass,
  KeyRound,
  LayoutDashboard,
  LineChart as LineChartIcon,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
  User,
} from 'lucide-react';
import type { OrderDTO, ProductDTO, ReturnRequestDTO, UserAddressDTO } from '../../shared/types.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import {
  Breadcrumbs,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
  Select,
  Skeleton,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';

interface SavedComparisonDTO {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  notes: string;
  createdAt: string;
  products: ProductDTO[];
}

interface WishlistEntryDTO {
  id: number;
  productId: number;
  targetPrice: number | null;
  notes: string;
  addedAt: string;
  product: ProductDTO;
}

export function ConsumerDashboardPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { categories, setCompareList, setWishlistIds } = useCompare();

  const [loading, setLoading] = useState(true);
  const [savedComparisons, setSavedComparisons] = useState<SavedComparisonDTO[]>([]);
  const [wishlist, setWishlist] = useState<WishlistEntryDTO[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductDTO[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderDTO[]>([]);
  const [demoFeatured, setDemoFeatured] = useState<ProductDTO[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    if (!user) {
      apiRequest<{ items: ProductDTO[] }>('/api/products?sort=popularity&limit=3')
        .then((res) => {
          if (mounted) setDemoFeatured(res.items);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return;
    }

    apiRequest<{
      savedComparisons: SavedComparisonDTO[];
      wishlist: WishlistEntryDTO[];
      recentlyViewed: ProductDTO[];
      recentRecommendations: any[];
      recentOrders?: OrderDTO[];
    }>('/api/workspace/dashboard')
      .then((res) => {
        if (!mounted) return;
        setSavedComparisons(res.savedComparisons);
        setWishlist(res.wishlist);
        setRecentlyViewed(res.recentlyViewed);
        setRecommendations(res.recentRecommendations);
        setRecentOrders(res.recentOrders || []);
        setWishlistIds(new Set(res.wishlist.map((w) => w.productId)));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, setWishlistIds]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <Card className="p-8 bg-gradient-to-br from-[#12100D] via-[#0F0E0B] to-[#17140F] border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Consumer Workspace
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Sign in to access your personal comparisons and wishlist
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Guests can freely browse products, compare up to 4 models, and run recommendations.
              Create a free account to persist saved comparisons, wishlists, and view history.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="accent" onClick={() => navigate('/login')}>
              Sign In
            </Button>
            <Button variant="outline" onClick={() => navigate('/signup')}>
              Create Account
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4">
            Recommended Starting Points (Demonstration Catalog)
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {demoFeatured.map((p) => (
              <ProductCard key={p.id} product={p} navigate={navigate} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Header & Welcome Banner */}
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]}
        />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <LayoutDashboard className="h-4 w-4" />
              <span>Consumer Workspace</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Your saved comparisons, wishlist items, viewing history, and decision insights.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
              <Package className="h-4 w-4 text-sky-400" />
              Orders
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/addresses')}>
              <MapPin className="h-4 w-4 text-sky-400" />
              Addresses
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/returns')}>
              <RotateCcw className="h-4 w-4 text-sky-400" />
              Returns
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              Profile & Preferences
            </Button>
            <Button variant="accent" size="sm" onClick={() => navigate('/recommend')}>
              <Compass className="h-4 w-4" />
              New Recommendation
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          {/* Real Account Summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Recent Orders</div>
                <div className="font-mono text-3xl font-bold text-emerald-400 tabular-nums mt-1">
                  {recentOrders.length}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
                Track
              </Button>
            </Card>
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Saved Comparisons</div>
                <div className="font-mono text-3xl font-bold text-white tabular-nums mt-1">
                  {savedComparisons.length}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/saved-comparisons')}>
                Manage
              </Button>
            </Card>
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Wishlist Products</div>
                <div className="font-mono text-3xl font-bold text-sky-400 tabular-nums mt-1">
                  {wishlist.length}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/wishlist')}>
                View All
              </Button>
            </Card>
            <Card className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Recently Viewed</div>
                <div className="font-mono text-3xl font-bold text-white tabular-nums mt-1">
                  {recentlyViewed.length}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/discover')}>
                Discover
              </Button>
            </Card>
          </div>

          {recentOrders.length > 0 && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-sky-400" />
                  <h2 className="font-display text-lg font-bold text-white">Recent Orders</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/orders')}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  View all orders
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recentOrders.slice(0, 4).map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0B0A08] p-4"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold text-sky-400">
                        {ord.orderNumber}
                      </div>
                      <div className="text-sm font-semibold text-white mt-0.5 truncate">
                        {ord.status} · {ord.items.length} item(s)
                      </div>
                      <div className="text-xs text-slate-400">
                        {formatCurrency(ord.totalAmount, ord.currency)} · {formatDate(ord.createdAt)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/orders/${ord.id}`)}
                    >
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Recent Comparisons */}
            <Card className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Recent Saved Comparisons
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/saved-comparisons')}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  View all
                </button>
              </div>
              {savedComparisons.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">
                  No saved comparisons yet. Select 2–4 products in Compare to save them here.
                </p>
              ) : (
                <div className="space-y-3">
                  {savedComparisons.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0B0A08] p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">
                          {c.categoryName} · {formatDate(c.createdAt)}
                        </div>
                        <div className="font-semibold text-sm text-white truncate">{c.title}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCompareList(c.products);
                          navigate('/compare');
                        }}
                      >
                        Reopen
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Recommendations & Insights */}
            <Card className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-white">
                  Recent Recommendation Sessions
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/recommend')}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Run wizard
                </button>
              </div>
              {recommendations.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">
                  You have not run the Smart Recommendation Wizard while signed in yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-slate-800 bg-[#0B0A08] p-3.5"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {rec.categoryName} · {rec.intendedUsage.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-sky-400 tabular-nums">
                          Max ₹{Number(rec.budgetMax).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1.5">
                        Top result:{' '}
                        <strong className="text-white">
                          {rec.resultsSummary?.[0]?.name || 'Calculated'}{' '}
                          {rec.resultsSummary?.[0]?.score
                            ? `(${rec.resultsSummary[0].score}/100)`
                            : ''}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Wishlist Price Intelligence Preview */}
          {wishlist.length > 0 && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4 text-sky-400" />
                  <h2 className="font-display text-lg font-bold text-white">
                    Wishlist Price Snapshots
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/wishlist')}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Open Wishlist
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wishlist.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B0A08] p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 truncate">
                        {entry.product.brandName} · {entry.product.categoryName}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/products/${entry.product.slug}`)}
                        className="text-sm font-semibold text-white hover:text-sky-400 truncate block text-left cursor-pointer"
                      >
                        {entry.product.name}
                      </button>
                      <div className="font-mono text-xs text-sky-400 tabular-nums mt-0.5">
                        {formatCurrency(entry.product.basePrice, entry.product.currency)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/price-history/${entry.product.id}`)}
                    >
                      History
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold text-white">
                Recently Viewed Products
              </h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {recentlyViewed.map((p) => (
                  <ProductCard key={p.id} product={p} navigate={navigate} />
                ))}
              </div>
            </section>
          )}

          {/* Category Shortcuts */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-bold text-white">Category Shortcuts</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0F0E0B] px-4 py-3 text-left text-sm font-semibold text-white hover:border-sky-500/50 transition-colors cursor-pointer"
                >
                  <span className="truncate">{cat.name}</span>
                  <ArrowRight className="h-4 w-4 text-sky-400 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function SavedComparisonsPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { setCompareList, showNotice } = useCompare();
  const [items, setItems] = useState<SavedComparisonDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SavedComparisonDTO | null>(null);

  const load = () => {
    setLoading(true);
    apiRequest<{ comparisons: SavedComparisonDTO[] }>('/api/workspace/comparisons')
      .then((res) => setItems(res.comparisons))
      .catch((err: any) => showNotice('error', err.message || 'Could not load comparisons.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/workspace/comparisons/${deleteTarget.id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      showNotice('info', 'Saved comparison deleted.');
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to delete comparison.');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Saved Comparisons</h1>
        <p className="text-sm text-slate-400">Sign in to view and reopen your saved comparisons.</p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="border-b border-slate-800/80 pb-5 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Saved Comparisons' },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Saved Comparisons
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Reopen any comparison matrix or manage your saved evaluations.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/compare')}>
            <Scale className="h-4 w-4 text-sky-400" />
            New Comparison
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">You have no saved comparisons yet.</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/discover')}>
            Browse Products
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((comp) => (
            <Card
              key={comp.id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="text-xs text-sky-400">
                  {comp.categoryName} · Saved {formatDate(comp.createdAt)}
                </div>
                <h2 className="font-display text-lg font-bold text-white">{comp.title}</h2>
                <p className="text-xs text-slate-300">
                  {comp.products.map((p) => p.name).join(' vs. ')}
                </p>
                {comp.notes && <p className="text-xs text-slate-400 italic">Note: {comp.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setCompareList(comp.products);
                    navigate('/compare');
                  }}
                >
                  Reopen Matrix
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(comp)}
                  aria-label="Delete saved comparison"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Saved Comparison"
        description={`Are you sure you want to remove "${deleteTarget?.title || ''}" from your saved comparisons?`}
        confirmLabel="Delete Comparison"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export function WishlistPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { setWishlistIds } = useCompare();
  const [items, setItems] = useState<WishlistEntryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiRequest<{ items: WishlistEntryDTO[] }>('/api/workspace/wishlist')
      .then((res) => {
        setItems(res.items);
        setWishlistIds(new Set(res.items.map((i) => i.productId)));
      })
      .finally(() => setLoading(false));
  }, [user, setWishlistIds]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Personal Wishlist</h1>
        <p className="text-sm text-slate-400">Sign in to view and manage your saved products.</p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="border-b border-slate-800/80 pb-5 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Wishlist' },
          ]}
        />
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <Bookmark className="h-4 w-4" />
              <span>Saved Products</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Your Wishlist</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/discover')}>
            Explore Catalog
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">Your wishlist is currently empty.</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/discover')}>
            Discover Products
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((entry) => (
            <ProductCard key={entry.id} product={entry.product} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfilePage({ navigate }: { navigate: (to: string) => void }) {
  const { user, refreshUser, logout } = useAuth();
  const { showNotice } = useCompare();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState('INR');
  const [defaultBudgetMax, setDefaultBudgetMax] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    apiRequest<{ user: any; preferences: any }>('/api/auth/me')
      .then((res) => {
        if (res.preferences) {
          setCurrency(res.preferences.preferredCurrency || 'INR');
          setDefaultBudgetMax(
            res.preferences.defaultBudgetMax ? String(res.preferences.defaultBudgetMax) : ''
          );
        }
      })
      .catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Profile & Preferences</h1>
        <p className="text-sm text-slate-400">Sign in to manage your account details.</p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          preferredCurrency: currency,
          defaultBudgetMax: defaultBudgetMax ? Number(defaultBudgetMax) : null,
        }),
      });
      await refreshUser();
      showNotice('success', 'Profile and preferences updated.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showNotice('success', 'Password changed successfully.');
    } catch (err: any) {
      showNotice('error', err.message || 'Password change failed.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-5 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Profile & Preferences' },
          ]}
        />
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <User className="h-4 w-4" />
              <span>Account Settings · {user.role}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Profile & Preferences
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <h2 className="font-display text-base font-bold text-white">Personal Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="prof-name">Display Name</Label>
              <Input
                id="prof-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="prof-email">Email Address</Label>
              <Input id="prof-email" value={user.email} disabled />
            </div>
            <div>
              <Label htmlFor="prof-curr">Preferred Currency</Label>
              <Select
                id="prof-curr"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="prof-budget">Default Max Budget (₹)</Label>
              <Input
                id="prof-budget"
                type="number"
                min={0}
                value={defaultBudgetMax}
                onChange={(e) => setDefaultBudgetMax(e.target.value)}
                placeholder="e.g., 75000"
              />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-base font-bold text-white">Change Password</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pw-current">Current Password</Label>
              <Input
                id="pw-current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pw-new">New Password</Label>
              <Input
                id="pw-new"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters + number"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" disabled={pwSaving}>
            {pwSaving ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function AddressesPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [addresses, setAddresses] = useState<UserAddressDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [houseBuilding, setHouseBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [isDefault, setIsDefault] = useState(true);

  const load = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<{ addresses: UserAddressDTO[] }>('/api/addresses')
      .then((res) => setAddresses(res.addresses))
      .catch((err: any) => showNotice('error', err.message || 'Unable to load addresses.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Saved Shipping Addresses</h1>
        <p className="text-sm text-slate-400">Sign in to manage your delivery addresses.</p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </div>
    );
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest('/api/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label,
          fullName,
          phone,
          houseBuilding,
          street,
          city,
          state: stateVal,
          postalCode,
          country,
          isDefault,
        }),
      });
      setFullName('');
      setPhone('');
      setHouseBuilding('');
      setStreet('');
      setCity('');
      setStateVal('');
      setPostalCode('');
      showNotice('success', 'Shipping address saved.');
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Could not save address.');
    } finally {
      setSaving(false);
    }
  };

  const handleMakeDefault = async (id: number) => {
    try {
      await apiRequest(`/api/addresses/${id}/default`, { method: 'PATCH' });
      showNotice('success', 'Default shipping address updated.');
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to update default address.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/addresses/${id}`, { method: 'DELETE' });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      showNotice('info', 'Address removed.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not remove address.');
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-5 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Addresses' },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <MapPin className="h-4 w-4" />
              <span>Delivery Book</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Saved Shipping Addresses
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/checkout')}>
            Go to Checkout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-6 space-y-4">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : addresses.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">
              No saved addresses yet. Add one on the right for faster demonstration checkout.
            </Card>
          ) : (
            addresses.map((addr) => (
              <Card key={addr.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-white">
                        {addr.label}
                      </span>
                      {addr.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">
                      {addr.fullName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{addr.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!addr.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMakeDefault(addr.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(addr.id)}
                      aria-label="Delete address"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {addr.houseBuilding}, {addr.street}, {addr.city}, {addr.state} —{' '}
                  <span className="font-mono">{addr.postalCode}</span>, {addr.country}
                </p>
              </Card>
            ))
          )}
        </div>

        <Card className="lg:col-span-6 p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <h2 className="font-display text-base font-bold text-white">Add New Address</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="addr-label">Label</Label>
                <Input
                  id="addr-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  placeholder="Home / Office"
                />
              </div>
              <div>
                <Label htmlFor="addr-name">Full Name</Label>
                <Input
                  id="addr-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label htmlFor="addr-phone">Phone Number</Label>
                <Input
                  id="addr-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  minLength={7}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <Label htmlFor="addr-house">House / Flat / Building</Label>
                <Input
                  id="addr-house"
                  value={houseBuilding}
                  onChange={(e) => setHouseBuilding(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="addr-street">Street / Locality</Label>
                <Input
                  id="addr-street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="addr-city">City</Label>
                <Input
                  id="addr-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="addr-state">State</Label>
                <Input
                  id="addr-state"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="addr-pin">Postal / PIN Code</Label>
                <Input
                  id="addr-pin"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              <div>
                <Label htmlFor="addr-country">Country</Label>
                <Input
                  id="addr-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="accent-sky-400"
              />
              Make this my default shipping address
            </label>
            <Button type="submit" variant="primary" disabled={saving}>
              <Plus className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Address'}</span>
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export function ReturnsPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const [returnsList, setReturnsList] = useState<ReturnRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiRequest<{ returns: ReturnRequestDTO[] }>('/api/returns')
      .then((res) => setReturnsList(res.returns))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Return Requests</h1>
        <p className="text-sm text-slate-400">Sign in to inspect your order return status.</p>
        <Button variant="primary" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <div className="border-b border-slate-800/80 pb-5 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Orders', to: '/orders' },
            { label: 'Returns' },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <RotateCcw className="h-4 w-4" />
              <span>Post-Delivery Assistance</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Return Requests & Demo Refunds
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : returnsList.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">
            You have no return requests. Delivered orders can initiate returns directly from the order detail page.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/orders')}>
            View Orders
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {returnsList.map((ret) => (
            <Card key={ret.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/${ret.orderId}`)}
                    className="font-mono text-xs font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    Order {ret.orderNumber || `#${ret.orderId}`}
                  </button>
                  <div className="font-display text-base font-bold text-white mt-0.5">
                    {ret.productNameSnapshot || `Order Item #${ret.orderItemId}`}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Submitted {formatDate(ret.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-emerald-400">{ret.status}</div>
                  <div className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                    Demo Refund: {formatCurrency(ret.demoRefundAmount, 'INR')}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                <strong className="text-slate-200">Reason:</strong> {ret.reason}
              </p>
              {ret.adminNote && (
                <p className="text-xs text-sky-300 bg-[#0B0A08] border border-slate-800 rounded-lg px-3 py-2">
                  Administrator Note: {ret.adminNote}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
