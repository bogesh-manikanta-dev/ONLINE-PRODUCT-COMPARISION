import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FolderTree,
  History,
  LayoutGrid,
  LineChart as LineChartIcon,
  Package,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import type { ProductDTO } from '../../shared/types.ts';
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

export function AdminShell({
  currentPath,
  navigate,
  title,
  subtitle,
  children,
}: {
  currentPath: string;
  navigate: (to: string) => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { user, claimAdminAccess, loginWithGoogle } = useAuth();
  const { showNotice } = useCompare();
  const [passcode, setPasscode] = useState('');
  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<{ isConfigured: boolean }>('/api/auth/admin-bootstrap-status')
      .then((res) => setAdminConfigured(res.isConfigured))
      .catch(() => {});
  }, []);

  if (!user || user.role !== 'ADMIN') {
    const handleClaim = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await claimAdminAccess({ passcode, email: user?.email });
        showNotice('success', 'Administrator access granted.');
      } catch (err: any) {
        showNotice('error', err.message || 'Verification failed.');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="mx-auto max-w-lg px-4 py-14 space-y-6">
        <Card className="p-6 sm:p-8 space-y-5 bg-[#0B1222]/90 backdrop-blur-xl border-slate-700/80">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <Shield className="h-4 w-4" />
            <span>Administrator Authorization Required</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            CompareX Admin Console
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {user
              ? `Signed in as ${user.email} (${user.role}). Administrator privileges are enforced on the server.`
              : 'Sign in with an Administrator account or verify the administrator passcode below.'}
          </p>

          <form onSubmit={handleClaim} className="space-y-3 border-t border-slate-800 pt-4">
            <Label htmlFor="admin-gate-pass">
              {adminConfigured === false
                ? 'First-Run Setup: Set Administrator Passcode (8+ chars)'
                : 'Enter Administrator Passcode'}
            </Label>
            <Input
              id="admin-gate-pass"
              type="password"
              required
              minLength={8}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Minimum 8 characters"
            />
            <Button type="submit" variant="primary" className="w-full" disabled={submitting}>
              {submitting
                ? 'Verifying...'
                : adminConfigured === false
                  ? 'Claim Admin Access'
                  : 'Unlock Admin Console'}
            </Button>
          </form>

          {!user && (
            <Button type="button" variant="outline" className="w-full" onClick={() => loginWithGoogle()}>
              Sign In with Google (Owner Admin)
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const navItems = [
    { path: '/admin', label: 'Overview', icon: LayoutGrid },
    { path: '/admin/products', label: 'Products', icon: Package },
    { path: '/admin/inventory', label: 'Inventory', icon: Boxes },
    { path: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { path: '/admin/returns', label: 'Returns Queue', icon: RotateCcw },
    { path: '/admin/categories', label: 'Categories & Specs', icon: FolderTree },
    { path: '/admin/brands', label: 'Brands', icon: Building2 },
    { path: '/admin/sellers', label: 'Sellers & Prices', icon: Store },
    { path: '/admin/recommendations', label: 'Rec & Commerce Rules', icon: Sliders },
    { path: '/admin/csv-import', label: 'CSV Import', icon: FileSpreadsheet },
    { path: '/admin/users', label: 'Users & Roles', icon: Users },
    { path: '/admin/data-quality', label: 'Data Quality', icon: AlertTriangle },
    { path: '/admin/audit-logs', label: 'Audit Logs', icon: History },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <Card className="p-3 space-y-1 lg:sticky lg:top-24">
            <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sky-400 border-b border-slate-800 mb-1">
              Administration
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </Card>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          <div className="border-b border-slate-800/80 pb-4 space-y-2">
            <Breadcrumbs
              navigate={navigate}
              items={[
                { label: 'Home', to: '/' },
                { label: 'Admin', to: '/admin' },
                ...(currentPath !== '/admin' ? [{ label: title }] : []),
              ]}
            />
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{title}</h1>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<{ stats: any; recentAuditLogs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    apiRequest<{ stats: any; recentAuditLogs: any[] }>('/api/admin/overview')
      .then(setData)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Administrator Dashboard"
      subtitle="Monitor catalog coverage, data quality health, and recent system audit events."
    >
      {loading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Catalog Products', value: data.stats.products, accent: 'text-white' },
              { label: 'Total Orders', value: data.stats.orders ?? 0, accent: 'text-sky-400' },
              { label: 'Pending Returns', value: data.stats.pendingReturns ?? 0, accent: 'text-amber-400' },
              { label: 'Registered Users', value: data.stats.users, accent: 'text-white' },
              {
                label: 'Data Quality Score',
                value: `${data.stats.dataQualityScore}/100`,
                accent: 'text-emerald-400',
              },
            ].map((kpi) => (
              <Card key={kpi.label} className="p-4">
                <div className="text-xs text-slate-400">{kpi.label}</div>
                <div className={`font-mono text-2xl font-bold tabular-nums mt-1 ${kpi.accent}`}>
                  {kpi.value}
                </div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-white">Recent Audit Logs</h2>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/admin/audit-logs')}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  Full Audit Trail
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/data-quality')}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  Data Quality ({data.stats.openQualityIssues} open issues)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#080F1E] border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Timestamp</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Actor</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Action</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Entity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {data.recentAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono text-slate-400 tabular-nums">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-200">{log.actorEmail}</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-sky-400">{log.action}</td>
                      <td className="px-4 py-2.5 text-slate-300">
                        {log.entityType} #{log.entityId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AdminShell>
  );
}

export function AdminProductsPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { categories, brands, refreshMetadata, showNotice } = useCompare();

  const [productsList, setProductsList] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductDTO | null>(null);

  const [tableQuery, setTableQuery] = useState('');
  const [tableCatFilter, setTableCatFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [variantLabel, setVariantLabel] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('25');
  const [taxRatePercent, setTaxRatePercent] = useState('18');
  const [description, setDescription] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState('IN_STOCK');
  const [imageUrl, setImageUrl] = useState('/src/assets/images/prod_laptop_pro_1795689412582.jpg');
  const [specValues, setSpecValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const loadProducts = () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    apiRequest<{ items: ProductDTO[] }>('/api/admin/products')
      .then((res) => setProductsList(res.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, [user]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(String(categories[0].id));
    if (!brandId && brands.length > 0) setBrandId(String(brands[0].id));
  }, [categories, brands]);

  const activeCategory = categories.find((c) => c.id === Number(categoryId));

  const filteredProducts = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return productsList
      .filter((p) => {
        if (tableCatFilter && String(p.categoryId) !== tableCatFilter) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.modelNumber.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const cmp =
          sortBy === 'price'
            ? a.basePrice - b.basePrice
            : a.name.localeCompare(b.name);
        return sortAsc ? cmp : -cmp;
      });
  }, [productsList, tableQuery, tableCatFilter, sortBy, sortAsc]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pagedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  const startEdit = (p: ProductDTO) => {
    setEditingId(p.id);
    setName(p.name);
    setBrandId(String(p.brandId));
    setCategoryId(String(p.categoryId));
    setModelNumber(p.modelNumber);
    setVariantLabel(p.variantLabel || '');
    setBasePrice(String(p.basePrice));
    setStockQuantity(String(p.stockQuantity));
    setTaxRatePercent(String(p.taxRatePercent));
    setDescription(p.description);
    setAvailabilityStatus(p.availabilityStatus);
    setImageUrl(p.primaryImage || '');
    const map: Record<number, string> = {};
    p.specifications.forEach((s) => {
      map[s.specDefinitionId] = s.rawValue;
    });
    setSpecValues(map);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setModelNumber('');
    setVariantLabel('');
    setBasePrice('');
    setStockQuantity('25');
    setTaxRatePercent('18');
    setDescription('');
    setSpecValues({});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const specifications = Object.entries(specValues)
        .filter(([, val]) => val.trim() !== '')
        .map(([defId, rawValue]) => ({
          specDefinitionId: Number(defId),
          rawValue: rawValue.trim(),
        }));

      const payload = {
        name,
        brandId: Number(brandId),
        categoryId: Number(categoryId),
        modelNumber,
        variantLabel: variantLabel.trim(),
        basePrice: Number(basePrice),
        currency: 'INR',
        stockQuantity: Number(stockQuantity) || 0,
        taxRatePercent: Number(taxRatePercent) || 18,
        availabilityStatus,
        status: 'ACTIVE',
        description,
        imageUrl,
        specifications,
      };

      if (editingId) {
        await apiRequest(`/api/admin/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showNotice('success', 'Product updated.');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showNotice('success', 'Product created.');
      }
      resetForm();
      loadProducts();
      refreshMetadata();
    } catch (err: any) {
      showNotice('error', err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/products/${deleteTarget.id}`, { method: 'DELETE' });
      showNotice('info', 'Product deleted.');
      loadProducts();
      refreshMetadata();
    } catch (err: any) {
      showNotice('error', err.message || 'Delete failed.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Product Management"
      subtitle="Create, update, or remove catalog products and category-specific technical specifications."
    >
      <Card className="p-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">
              {editingId ? `Editing Product #${editingId}` : 'Add New Product'}
            </h2>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label htmlFor="adm-p-name">Product Name</Label>
              <Input id="adm-p-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="adm-p-brand">Brand</Label>
              <Select id="adm-p-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="adm-p-cat">Category</Label>
              <Select
                id="adm-p-cat"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSpecValues({});
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="adm-p-model">Model Number</Label>
              <Input
                id="adm-p-model"
                value={modelNumber}
                onChange={(e) => setModelNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="adm-p-price">Base Price (₹ INR)</Label>
              <Input
                id="adm-p-price"
                type="number"
                step="1"
                min="1"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="adm-p-variant">Variant Label</Label>
              <Input
                id="adm-p-variant"
                value={variantLabel}
                onChange={(e) => setVariantLabel(e.target.value)}
                placeholder="e.g., 256GB · Titanium Gray"
              />
            </div>
            <div>
              <Label htmlFor="adm-p-stock">Stock Quantity</Label>
              <Input
                id="adm-p-stock"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adm-p-tax">GST Rate (%)</Label>
              <Input
                id="adm-p-tax"
                type="number"
                min="0"
                max="50"
                value={taxRatePercent}
                onChange={(e) => setTaxRatePercent(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="adm-p-avail">Availability</Label>
              <Select
                id="adm-p-avail"
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
              >
                <option value="IN_STOCK">In Stock</option>
                <option value="LIMITED">Limited</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
                <option value="DISCONTINUED">Discontinued</option>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="adm-p-desc">Description</Label>
              <Input
                id="adm-p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Label htmlFor="adm-p-img">Image Path / URL</Label>
              <Input id="adm-p-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
          </div>

          {activeCategory?.specDefinitions && activeCategory.specDefinitions.length > 0 && (
            <div className="pt-3 border-t border-slate-800">
              <div className="text-xs font-semibold text-sky-400 mb-3">
                {activeCategory.name} Specification Values
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeCategory.specDefinitions.map((def) => (
                  <div key={def.id}>
                    <Label htmlFor={`spec-${def.id}`}>
                      {def.label} {def.unit ? `(${def.unit})` : ''} {def.isMandatory ? '*' : ''}
                    </Label>
                    <Input
                      id={`spec-${def.id}`}
                      value={specValues[def.id] || ''}
                      onChange={(e) =>
                        setSpecValues((prev) => ({ ...prev, [def.id]: e.target.value }))
                      }
                      placeholder={def.unit ? `e.g. 16 ${def.unit}` : 'Value'}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" disabled={saving}>
            <Plus className="h-4 w-4" />
            <span>{saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}</span>
          </Button>
        </form>
      </Card>

      {/* Searchable, Filterable & Paginated Catalog Table */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={tableQuery}
                onChange={(e) => {
                  setTableQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search products or models..."
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Select
              value={tableCatFilter}
              onChange={(e) => {
                setTableCatFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter table by category"
              className="w-48 h-9 text-xs"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="text-xs font-mono text-slate-400 tabular-nums">
            {filteredProducts.length} product(s)
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#080F1E] border-b border-slate-800 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'name') setSortAsc((v) => !v);
                        else {
                          setSortBy('name');
                          setSortAsc(true);
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                    >
                      <span>Product</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Model</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'price') setSortAsc((v) => !v);
                        else {
                          setSortBy('price');
                          setSortAsc(false);
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                    >
                      <span>Base Price</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {pagedProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/35">
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.categoryName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{p.modelNumber}</td>
                    <td className="px-4 py-3 text-right font-mono text-white tabular-nums">
                      {formatCurrency(p.basePrice, p.currency)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Catalog Product"
        description={`Are you sure you want to permanently remove "${deleteTarget?.name || ''}" and its specifications? This action is logged in the audit trail.`}
        confirmLabel="Delete Product"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminShell>
  );
}

export function AdminCategoriesPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { categories, refreshMetadata, showNotice } = useCompare();

  const [catName, setCatName] = useState('');
  const [domainGroup, setDomainGroup] = useState('Electronics');
  const [catDesc, setCatDesc] = useState('');

  const [specCatId, setSpecCatId] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specLabel, setSpecLabel] = useState('');
  const [specType, setSpecType] = useState<'numeric' | 'text' | 'boolean' | 'enum'>('numeric');
  const [specUnit, setSpecUnit] = useState('');
  const [higherIsBetter, setHigherIsBetter] = useState('true');
  const [isMandatory, setIsMandatory] = useState(true);
  const [deleteSpecTarget, setDeleteSpecTarget] = useState<{ id: number; label: string } | null>(null);

  useEffect(() => {
    if (!specCatId && categories.length > 0) setSpecCatId(String(categories[0].id));
  }, [categories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: catName, domainGroup, description: catDesc }),
      });
      setCatName('');
      setCatDesc('');
      await refreshMetadata();
      showNotice('success', 'Category created.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not create category.');
    }
  };

  const handleCreateSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/spec-definitions', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: Number(specCatId),
          key: specKey,
          label: specLabel,
          dataType: specType,
          unit: specUnit,
          higherIsBetter: higherIsBetter === 'null' ? null : higherIsBetter === 'true',
          isMandatory,
          isComparable: true,
        }),
      });
      setSpecKey('');
      setSpecLabel('');
      setSpecUnit('');
      await refreshMetadata();
      showNotice('success', 'Specification definition added.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not add specification definition.');
    }
  };

  const confirmDeleteSpec = async () => {
    if (!deleteSpecTarget) return;
    try {
      await apiRequest(`/api/admin/spec-definitions/${deleteSpecTarget.id}`, { method: 'DELETE' });
      await refreshMetadata();
      showNotice('info', 'Specification definition removed.');
    } catch (err: any) {
      showNotice('error', err.message || 'Delete failed.');
    } finally {
      setDeleteSpecTarget(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Category & Specification Management"
      subtitle="Introduce new consumer categories and configure normalized specification schemas without code rewrites."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <form onSubmit={handleCreateCategory} className="space-y-3">
            <h2 className="font-display text-base font-bold text-white">Add Category</h2>
            <div>
              <Label htmlFor="cat-name">Category Name</Label>
              <Input
                id="cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                required
                placeholder="e.g., Air Conditioners"
              />
            </div>
            <div>
              <Label htmlFor="cat-domain">Domain Group</Label>
              <Select
                id="cat-domain"
                value={domainGroup}
                onChange={(e) => setDomainGroup(e.target.value)}
              >
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home Appliances">Home Appliances</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                required
                placeholder="Split and inverter climate control systems"
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Create Category
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <form onSubmit={handleCreateSpec} className="space-y-3">
            <h2 className="font-display text-base font-bold text-white">
              Add Specification Definition
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sp-cat">Category</Label>
                <Select id="sp-cat" value={specCatId} onChange={(e) => setSpecCatId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sp-key">Field Key (snake_case)</Label>
                <Input
                  id="sp-key"
                  value={specKey}
                  onChange={(e) => setSpecKey(e.target.value)}
                  required
                  placeholder="cooling_capacity"
                />
              </div>
              <div>
                <Label htmlFor="sp-label">Display Label</Label>
                <Input
                  id="sp-label"
                  value={specLabel}
                  onChange={(e) => setSpecLabel(e.target.value)}
                  required
                  placeholder="Cooling Capacity"
                />
              </div>
              <div>
                <Label htmlFor="sp-type">Data Type</Label>
                <Select
                  id="sp-type"
                  value={specType}
                  onChange={(e) => setSpecType(e.target.value as any)}
                >
                  <option value="numeric">Numeric</option>
                  <option value="text">Text</option>
                  <option value="boolean">Boolean</option>
                  <option value="enum">Enum</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="sp-unit">Unit</Label>
                <Input
                  id="sp-unit"
                  value={specUnit}
                  onChange={(e) => setSpecUnit(e.target.value)}
                  placeholder="BTU, GB, kg"
                />
              </div>
              <div>
                <Label htmlFor="sp-dir">Scoring Direction</Label>
                <Select
                  id="sp-dir"
                  value={higherIsBetter}
                  onChange={(e) => setHigherIsBetter(e.target.value)}
                >
                  <option value="true">Higher is better</option>
                  <option value="false">Lower is better</option>
                  <option value="null">Neutral / Categorical</option>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isMandatory}
                onChange={(e) => setIsMandatory(e.target.checked)}
                className="accent-sky-400"
              />
              Mandatory specification (flagged in Data Quality if missing)
            </label>
            <Button type="submit" variant="primary" size="sm">
              Add Specification Field
            </Button>
          </form>
        </Card>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat.id} className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="font-display text-base font-bold text-white">{cat.name}</h3>
                <p className="text-xs text-slate-400">
                  {cat.domainGroup} · slug: <span className="font-mono text-sky-400">{cat.slug}</span>
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {cat.specDefinitions?.length || 0} spec fields
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(cat.specDefinitions || []).map((def) => (
                <div
                  key={def.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070D1A] px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-white truncate">{def.label}</div>
                    <div className="font-mono text-slate-400 truncate">
                      {def.key} · {def.dataType} {def.unit ? `(${def.unit})` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteSpecTarget({ id: def.id, label: def.label })}
                    aria-label={`Remove ${def.label}`}
                    className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteSpecTarget)}
        title="Remove Specification Field"
        description={`Are you sure you want to remove "${deleteSpecTarget?.label || ''}" from this category schema?`}
        confirmLabel="Remove Field"
        onConfirm={confirmDeleteSpec}
        onCancel={() => setDeleteSpecTarget(null)}
      />
    </AdminShell>
  );
}

export function AdminBrandsPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { brands, refreshMetadata, showNotice } = useCompare();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [tagline, setTagline] = useState('');
  const [accentColor, setAccentColor] = useState('#38BDF8');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/brands', {
        method: 'POST',
        body: JSON.stringify({ name, country, description, tagline, accentColor }),
      });
      setName('');
      setCountry('');
      setDescription('');
      setTagline('');
      await refreshMetadata();
      showNotice('success', 'Brand created.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not create brand.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/api/admin/brands/${deleteTarget.id}`, { method: 'DELETE' });
      await refreshMetadata();
      showNotice('info', 'Brand deleted.');
    } catch (err: any) {
      showNotice('error', err.message || 'Cannot delete brand.');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Brand Management"
      subtitle="Manage manufacturer and brand records linked to catalog products and brand showcases."
    >
      <Card className="p-5">
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-6 items-end">
          <div className="sm:col-span-2">
            <Label htmlFor="br-name">Brand Name</Label>
            <Input id="br-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="br-country">Country</Label>
            <Input id="br-country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="br-tagline">Showcase Tagline</Label>
            <Input
              id="br-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g., Engineered for clarity"
            />
          </div>
          <div>
            <Label htmlFor="br-accent">Accent Hex</Label>
            <Input
              id="br-accent"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              placeholder="#38BDF8"
            />
          </div>
          <div className="sm:col-span-5">
            <Label htmlFor="br-desc">Description</Label>
            <Input
              id="br-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary">
            Add Brand
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#080F1E] border-b border-slate-800 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Brand</th>
                <th className="px-4 py-3 text-left font-semibold">Country</th>
                <th className="px-4 py-3 text-right font-semibold">Products</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {brands.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/35">
                  <td className="px-4 py-3 font-semibold text-white">{b.name}</td>
                  <td className="px-4 py-3 text-slate-300">{b.country}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                    {b.productCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: b.id, name: b.name })}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Brand"
        description={`Delete "${deleteTarget?.name || ''}"? Brands linked to existing products cannot be removed.`}
        confirmLabel="Delete Brand"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminShell>
  );
}

export function AdminSellersPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [sellersList, setSellersList] = useState<any[]>([]);
  const [offersList, setOffersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<ProductDTO[]>([]);

  const [sellerName, setSellerName] = useState('');
  const [sellerNote, setSellerNote] = useState('Administrator Verified Merchant');

  const [offerProdId, setOfferProdId] = useState('');
  const [offerSellerId, setOfferSellerId] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [installationCharge, setInstallationCharge] = useState('');
  const [warrantyCost, setWarrantyCost] = useState('');
  const [accessoriesCost, setAccessoriesCost] = useState('0');
  const [feesNote, setFeesNote] = useState('');

  const [obsProdId, setObsProdId] = useState('');
  const [obsSellerId, setObsSellerId] = useState('');
  const [obsPrice, setObsPrice] = useState('');
  const [obsSourceLabel, setObsSourceLabel] = useState('Manual Administrator Verification');

  const [offerSearch, setOfferSearch] = useState('');

  const load = () => {
    if (user?.role !== 'ADMIN') return;
    Promise.all([
      apiRequest<{ sellers: any[]; offers: any[] }>('/api/admin/sellers'),
      apiRequest<{ items: ProductDTO[] }>('/api/admin/products'),
    ]).then(([sRes, pRes]) => {
      setSellersList(sRes.sellers);
      setOffersList(sRes.offers);
      setProductsList(pRes.items);
      if (!offerProdId && pRes.items.length > 0) setOfferProdId(String(pRes.items[0].id));
      if (!obsProdId && pRes.items.length > 0) setObsProdId(String(pRes.items[0].id));
      if (!offerSellerId && sRes.sellers.length > 0) setOfferSellerId(String(sRes.sellers[0].id));
      if (!obsSellerId && sRes.sellers.length > 0) setObsSellerId(String(sRes.sellers[0].id));
    });
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleAddSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/sellers', {
        method: 'POST',
        body: JSON.stringify({ name: sellerName, reliabilityNote: sellerNote }),
      });
      setSellerName('');
      load();
      showNotice('success', 'Seller added.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not add seller.');
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/offers', {
        method: 'POST',
        body: JSON.stringify({
          productId: Number(offerProdId),
          sellerId: Number(offerSellerId),
          price: Number(offerPrice),
          deliveryCharge: deliveryCharge !== '' ? Number(deliveryCharge) : null,
          installationCharge: installationCharge !== '' ? Number(installationCharge) : null,
          warrantyCost: warrantyCost !== '' ? Number(warrantyCost) : null,
          requiredAccessoriesCost: accessoriesCost !== '' ? Number(accessoriesCost) : null,
          additionalFeesNote: feesNote,
          dataSource: 'Administrator Entered Observation',
        }),
      });
      setOfferPrice('');
      load();
      showNotice('success', 'Offer & price observation recorded.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not save offer.');
    }
  };

  const handleLogObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/price-observations', {
        method: 'POST',
        body: JSON.stringify({
          productId: Number(obsProdId),
          sellerId: Number(obsSellerId),
          price: Number(obsPrice),
          currency: 'INR',
          sourceLabel: obsSourceLabel.trim() || 'Manual Administrator Verification',
        }),
      });
      setObsPrice('');
      showNotice('success', 'Historical price observation appended to ledger.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not log price observation.');
    }
  };

  const filteredOffers = offersList.filter((o) => {
    const q = offerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(o.productName).toLowerCase().includes(q) ||
      String(o.sellerName).toLowerCase().includes(q)
    );
  });

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Seller & Price Management"
      subtitle="Manage merchants, record delivery/installation/warranty costs, and log historical price observations."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 p-5">
          <form onSubmit={handleAddSeller} className="space-y-3">
            <h2 className="font-display text-base font-bold text-white">Add Seller</h2>
            <div>
              <Label htmlFor="sel-name">Seller Name</Label>
              <Input
                id="sel-name"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sel-note">Source Reliability Note</Label>
              <Input
                id="sel-note"
                value={sellerNote}
                onChange={(e) => setSellerNote(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" size="sm">
              Create Seller
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-8 p-5">
          <form onSubmit={handleSaveOffer} className="space-y-3">
            <h2 className="font-display text-base font-bold text-white">
              Record Offer & Additional Costs
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="off-prod">Product</Label>
                <Select
                  id="off-prod"
                  value={offerProdId}
                  onChange={(e) => setOfferProdId(e.target.value)}
                >
                  {productsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="off-sel">Seller</Label>
                <Select
                  id="off-sel"
                  value={offerSellerId}
                  onChange={(e) => setOfferSellerId(e.target.value)}
                >
                  {sellersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="off-price">Observed Price (₹)</Label>
                <Input
                  id="off-price"
                  type="number"
                  step="1"
                  min="1"
                  required
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="off-del">Delivery (₹)</Label>
                <Input
                  id="off-del"
                  type="number"
                  min="0"
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="off-inst">Installation (₹ opt.)</Label>
                <Input
                  id="off-inst"
                  type="number"
                  min="0"
                  value={installationCharge}
                  onChange={(e) => setInstallationCharge(e.target.value)}
                  placeholder="Leave blank if unknown"
                />
              </div>
              <div>
                <Label htmlFor="off-war">Warranty (₹ opt.)</Label>
                <Input
                  id="off-war"
                  type="number"
                  min="0"
                  value={warrantyCost}
                  onChange={(e) => setWarrantyCost(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="off-acc">Required Accessories (₹)</Label>
                <Input
                  id="off-acc"
                  type="number"
                  min="0"
                  value={accessoriesCost}
                  onChange={(e) => setAccessoriesCost(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="off-note">Additional Fees Note</Label>
                <Input
                  id="off-note"
                  value={feesNote}
                  onChange={(e) => setFeesNote(e.target.value)}
                  placeholder="e.g., Wall mount or recycling fee"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" size="sm">
              Save Offer & Log Observation
            </Button>
          </form>
        </Card>
      </div>

      {/* Standalone Historical Price Observation Logger */}
      <Card className="p-5">
        <form onSubmit={handleLogObservation} className="space-y-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-sky-400" />
            <h2 className="font-display text-base font-bold text-white">
              Log Standalone Historical Price Observation
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
            <div>
              <Label htmlFor="obs-prod">Product</Label>
              <Select id="obs-prod" value={obsProdId} onChange={(e) => setObsProdId(e.target.value)}>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="obs-sel">Seller</Label>
              <Select id="obs-sel" value={obsSellerId} onChange={(e) => setObsSellerId(e.target.value)}>
                {sellersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="obs-price">Observed Price (₹)</Label>
              <Input
                id="obs-price"
                type="number"
                step="1"
                min="1"
                required
                value={obsPrice}
                onChange={(e) => setObsPrice(e.target.value)}
                placeholder="e.g. 74999"
              />
            </div>
            <div>
              <Label htmlFor="obs-src">Source Label</Label>
              <Input
                id="obs-src"
                value={obsSourceLabel}
                onChange={(e) => setObsSourceLabel(e.target.value)}
                required
              />
            </div>
          </div>
          <Button type="submit" variant="accent" size="sm">
            Record Price Point
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={offerSearch}
              onChange={(e) => setOfferSearch(e.target.value)}
              placeholder="Filter offers by product or seller..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {filteredOffers.length} offer(s)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#080F1E] border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Product</th>
                <th className="px-4 py-3 text-left font-semibold">Seller</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Delivery</th>
                <th className="px-4 py-3 text-left font-semibold">Last Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredOffers.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/35">
                  <td className="px-4 py-2.5 font-medium text-white">{o.productName}</td>
                  <td className="px-4 py-2.5 text-slate-300">{o.sellerName}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white tabular-nums">
                    {formatCurrency(o.price, o.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                    {o.deliveryCharge !== null
                      ? formatCurrency(o.deliveryCharge, o.currency)
                      : 'Not recorded'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-400 tabular-nums">
                    {formatDate(o.lastVerifiedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
