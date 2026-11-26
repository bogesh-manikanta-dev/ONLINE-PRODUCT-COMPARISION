import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  RotateCcw,
  Search,
  Sliders,
} from 'lucide-react';
import type {
  InventoryLogDTO,
  OrderDTO,
  OrderStatus,
  ProductDTO,
  RecommendationConfigDTO,
  ReturnRequestDTO,
  ReturnStatus,
} from '../../shared/types.ts';
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Skeleton,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';
import { AdminShell } from './AdminPages.tsx';

const ORDER_STATUSES: OrderStatus[] = [
  'Order Placed',
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const RETURN_STATUSES: ReturnStatus[] = [
  'Requested',
  'Under Review',
  'Approved',
  'Rejected',
  'Demo Refund Completed',
];

export function AdminInventoryPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [logs, setLogs] = useState<InventoryLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stockDrafts, setStockDrafts] = useState<Record<number, string>>({});
  const [reasonDrafts, setReasonDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = () => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<{ products: ProductDTO[]; logs: InventoryLogDTO[] }>('/api/admin/inventory')
      .then((res) => {
        setProducts(res.products);
        setLogs(res.logs);
        const drafts: Record<number, string> = {};
        res.products.forEach((p) => {
          drafts[p.id] = String(p.stockQuantity);
        });
        setStockDrafts(drafts);
      })
      .catch((err: any) => showNotice('error', err.message || 'Unable to load inventory.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q) ||
        p.modelNumber.toLowerCase().includes(q)
    );
  }, [products, query]);

  const handleAdjust = async (productId: number) => {
    const stockQuantity = Number(stockDrafts[productId]);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      showNotice('error', 'Stock quantity must be a whole number >= 0.');
      return;
    }
    setSavingId(productId);
    try {
      await apiRequest(`/api/admin/inventory/${productId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({
          stockQuantity,
          reason: (reasonDrafts[productId] || '').trim() || 'Admin stock adjustment',
        }),
      });
      showNotice('success', 'Stock updated and logged.');
      setReasonDrafts((prev) => ({ ...prev, [productId]: '' }));
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Unable to update stock.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Inventory Control"
      subtitle="Monitor live stock counts, adjust available demonstration units, and audit inventory movements."
    >
      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs text-slate-400">Active SKUs Tracked</div>
              <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                {products.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-400">Low Stock (&le; 5 units)</div>
              <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums mt-1">
                {products.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= 5).length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-slate-400">Out of Stock</div>
              <div className="font-mono text-2xl font-bold text-red-400 tabular-nums mt-1">
                {products.filter((p) => p.stockQuantity <= 0).length}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-sm font-bold text-white">
                <Boxes className="h-4 w-4 text-sky-400" />
                <span>Product Stock Levels</span>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter SKUs..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#080F1E] border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Price (INR)</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">New Stock</th>
                    <th className="px-4 py-3 text-left font-semibold">Adjustment Reason</th>
                    <th className="px-4 py-3 text-right font-semibold">Save</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {p.brandName} · {p.variantLabel || p.modelNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                        {formatCurrency(p.basePrice, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            p.stockQuantity <= 0
                              ? 'text-red-400'
                              : p.stockQuantity <= 5
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {p.availabilityStatus.replace(/_/g, ' ')} ({p.stockQuantity})
                        </span>
                      </td>
                      <td className="px-4 py-3 w-28">
                        <Input
                          type="number"
                          min={0}
                          value={stockDrafts[p.id] ?? String(p.stockQuantity)}
                          onChange={(e) =>
                            setStockDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="h-8 text-xs font-mono"
                          aria-label={`Stock for ${p.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <Input
                          value={reasonDrafts[p.id] || ''}
                          onChange={(e) =>
                            setReasonDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          placeholder="Restock / inventory count"
                          className="h-8 text-xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={savingId === p.id}
                          onClick={() => handleAdjust(p.id)}
                        >
                          {savingId === p.id ? 'Saving...' : 'Update'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3.5">
              <h2 className="font-display text-sm font-bold text-white">Recent Inventory Logs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#080F1E] border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Time</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Delta</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Stock Shift</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Reason</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2.5 font-mono text-slate-400 tabular-nums">
                        {formatDate(l.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-white font-medium">{l.productName}</td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums ${
                          l.changeAmount >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {l.changeAmount >= 0 ? `+${l.changeAmount}` : l.changeAmount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                        {l.previousStock} &rarr; {l.newStock}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">{l.reason}</td>
                      <td className="px-4 py-2.5 text-slate-400">{l.actorEmail}</td>
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

export function AdminOrdersPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusDrafts, setStatusDrafts] = useState<Record<number, OrderStatus>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = () => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<{ orders: OrderDTO[] }>('/api/admin/orders')
      .then((res) => {
        setOrders(res.orders);
        const map: Record<number, OrderStatus> = {};
        res.orders.forEach((o) => {
          map[o.id] = o.status;
        });
        setStatusDrafts(map);
      })
      .catch((err: any) => showNotice('error', err.message || 'Failed to load orders.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const filtered = useMemo(
    () => (statusFilter ? orders.filter((o) => o.status === statusFilter) : orders),
    [orders, statusFilter]
  );

  const handleUpdateStatus = async (orderId: number) => {
    const nextStatus = statusDrafts[orderId];
    if (!nextStatus) return;
    setUpdatingId(orderId);
    try {
      await apiRequest(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          note: (noteDrafts[orderId] || '').trim() || undefined,
        }),
      });
      showNotice('success', `Order updated to "${nextStatus}".`);
      setNoteDrafts((prev) => ({ ...prev, [orderId]: '' }));
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Status update failed.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Order Fulfillment Queue"
      subtitle="Advance demonstration order milestones, monitor shipping addresses, and manage cancellations."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ClipboardList className="h-4 w-4 text-sky-400" />
          <span>{filtered.length} order(s) shown</span>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-56 h-9 text-xs"
          aria-label="Filter orders by status"
        >
          <option value="">All Order Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">No orders match this filter.</Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => (
            <Card key={order.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="font-mono text-sm font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      {order.orderNumber}
                    </button>
                    <span className="text-xs font-semibold text-white">· {order.status}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Customer: {order.userEmail || `User #${order.userId}`} · Placed{' '}
                    {formatDate(order.createdAt)} · {order.deliveryMethod}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-white tabular-nums">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </div>
                  <div className="text-[11px] text-slate-400">{order.paymentStatus}</div>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                Items:{' '}
                {order.items
                  .map((i) => `${i.productNameSnapshot} × ${i.quantity}`)
                  .join(' · ')}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end pt-1">
                <div className="sm:col-span-4">
                  <Label htmlFor={`ord-status-${order.id}`}>Update Lifecycle Status</Label>
                  <Select
                    id={`ord-status-${order.id}`}
                    value={statusDrafts[order.id] || order.status}
                    onChange={(e) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [order.id]: e.target.value as OrderStatus,
                      }))
                    }
                    disabled={order.status === 'Cancelled'}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-5">
                  <Label htmlFor={`ord-note-${order.id}`}>Milestone Note (Optional)</Label>
                  <Input
                    id={`ord-note-${order.id}`}
                    value={noteDrafts[order.id] || ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))
                    }
                    placeholder="e.g., Dispatched via hub courier"
                    disabled={order.status === 'Cancelled'}
                  />
                </div>
                <div className="sm:col-span-3 flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={updatingId === order.id || order.status === 'Cancelled'}
                    onClick={() => handleUpdateStatus(order.id)}
                  >
                    {updatingId === order.id ? 'Updating...' : 'Apply Status'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export function AdminReturnsPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [returnsList, setReturnsList] = useState<ReturnRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusDrafts, setStatusDrafts] = useState<Record<number, ReturnStatus>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = () => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<{ returns: ReturnRequestDTO[] }>('/api/admin/returns')
      .then((res) => {
        setReturnsList(res.returns);
        const map: Record<number, ReturnStatus> = {};
        res.returns.forEach((r) => {
          map[r.id] = r.status;
        });
        setStatusDrafts(map);
      })
      .catch((err: any) => showNotice('error', err.message || 'Unable to load returns.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [user]);

  const handleDecision = async (returnId: number) => {
    const nextStatus = statusDrafts[returnId];
    if (!nextStatus) return;
    setSavingId(returnId);
    try {
      await apiRequest(`/api/admin/returns/${returnId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          adminNote: (noteDrafts[returnId] || '').trim() || undefined,
        }),
      });
      showNotice('success', `Return request #${returnId} updated to "${nextStatus}".`);
      load();
    } catch (err: any) {
      showNotice('error', err.message || 'Return update failed.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Return & Demo Refund Queue"
      subtitle="Review post-delivery return requests, approve restocking, and mark simulated refunds complete."
    >
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : returnsList.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <RotateCcw className="h-6 w-6 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-400">No customer return requests recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {returnsList.map((ret) => (
            <Card key={ret.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-xs font-mono text-sky-400">
                    Return #{ret.id} · Order {ret.orderNumber || `#${ret.orderId}`}
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {ret.productNameSnapshot || `Item #${ret.orderItemId}`}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Customer: {ret.userEmail || `User #${ret.userId}`} · Requested{' '}
                    {formatDate(ret.createdAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-emerald-400">{ret.status}</div>
                  <div className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                    Demo Refund: {formatCurrency(ret.demoRefundAmount, 'INR')}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 bg-[#070D1A] border border-slate-800 rounded-lg px-3 py-2">
                Reason: {ret.reason}
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                <div className="sm:col-span-4">
                  <Label htmlFor={`ret-status-${ret.id}`}>Return Decision</Label>
                  <Select
                    id={`ret-status-${ret.id}`}
                    value={statusDrafts[ret.id] || ret.status}
                    onChange={(e) =>
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [ret.id]: e.target.value as ReturnStatus,
                      }))
                    }
                  >
                    {RETURN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-5">
                  <Label htmlFor={`ret-note-${ret.id}`}>Administrator Note</Label>
                  <Input
                    id={`ret-note-${ret.id}`}
                    value={noteDrafts[ret.id] ?? ret.adminNote}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [ret.id]: e.target.value }))
                    }
                    placeholder="Inspection & demo refund notes"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={savingId === ret.id}
                    onClick={() => handleDecision(ret.id)}
                  >
                    {savingId === ret.id ? 'Saving...' : 'Save Decision'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

export function AdminRecommendationsConfigPage({
  currentPath,
  navigate,
}: {
  currentPath: string;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { showNotice } = useCompare();

  const [config, setConfig] = useState<RecommendationConfigDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    apiRequest<{ config: RecommendationConfigDTO }>('/api/admin/recommendation-config')
      .then((res) => setConfig(res.config))
      .catch((err: any) => showNotice('error', err.message || 'Unable to load rules.'))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ config: RecommendationConfigDTO }>(
        '/api/admin/recommendation-config',
        {
          method: 'PUT',
          body: JSON.stringify(config),
        }
      );
      setConfig(res.config);
      showNotice('success', 'Recommendation strategy & delivery rules updated.');
    } catch (err: any) {
      showNotice('error', err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleCancellable = (status: OrderStatus) => {
    if (!config) return;
    const exists = config.cancellableStatuses.includes(status);
    const next = exists
      ? config.cancellableStatuses.filter((s) => s !== status)
      : [...config.cancellableStatuses, status];
    if (next.length === 0) return;
    setConfig({ ...config, cancellableStatuses: next });
  };

  return (
    <AdminShell
      currentPath={currentPath}
      navigate={navigate}
      title="Recommendation & Commerce Rules"
      subtitle="Configure the server-side Strategy Pattern preset, delivery thresholds (INR), and cancellation policy."
    >
      {loading || !config ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-sky-400" />
              <h2 className="font-display text-base font-bold text-white">
                Recommendation Scoring Strategy
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="rec-strategy">Active Strategy Pattern</Label>
                <Select
                  id="rec-strategy"
                  value={config.strategy}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      strategy: e.target.value as RecommendationConfigDTO['strategy'],
                    })
                  }
                >
                  <option value="BALANCED_DECISION">
                    Balanced Decision (Default Spec + Budget + Usage)
                  </option>
                  <option value="BUDGET_VALUE">Budget Value Priority</option>
                  <option value="PERFORMANCE_FIRST">Performance First Priority</option>
                </Select>
              </div>

              {(
                [
                  { key: 'performance', label: 'Default Spec Weight (%)' },
                  { key: 'value', label: 'Default Budget Value Weight (%)' },
                  { key: 'efficiency', label: 'Default Usage Alignment Weight (%)' },
                  { key: 'reliability', label: 'Default Completeness Weight (%)' },
                ] as const
              ).map((item) => (
                <div key={item.key}>
                  <Label htmlFor={`w-${item.key}`}>{item.label}</Label>
                  <Input
                    id={`w-${item.key}`}
                    type="number"
                    min={0}
                    max={100}
                    value={config.defaultWeights[item.key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        defaultWeights: {
                          ...config.defaultWeights,
                          [item.key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="font-display text-base font-bold text-white">
              Delivery Fee & Cancellation Policy (INR)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="cfg-free-thresh">Free Standard Delivery Above (₹)</Label>
                <Input
                  id="cfg-free-thresh"
                  type="number"
                  min={0}
                  value={config.freeDeliveryThreshold}
                  onChange={(e) =>
                    setConfig({ ...config, freeDeliveryThreshold: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="cfg-std-fee">Standard Delivery Fee (₹)</Label>
                <Input
                  id="cfg-std-fee"
                  type="number"
                  min={0}
                  value={config.standardDeliveryFee}
                  onChange={(e) =>
                    setConfig({ ...config, standardDeliveryFee: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="cfg-exp-fee">Express Delivery Fee (₹)</Label>
                <Input
                  id="cfg-exp-fee"
                  type="number"
                  min={0}
                  value={config.expressDeliveryFee}
                  onChange={(e) =>
                    setConfig({ ...config, expressDeliveryFee: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <Label>Customer-Cancellable Order Statuses</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['Order Placed', 'Order Confirmed', 'Processing', 'Packed'] as OrderStatus[]).map(
                  (st) => {
                    const checked = config.cancellableStatuses.includes(st);
                    return (
                      <label
                        key={st}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${
                          checked
                            ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                            : 'border-slate-800 bg-[#070D1A] text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCancellable(st)}
                          className="accent-sky-400"
                        />
                        <span>{st}</span>
                      </label>
                    );
                  }
                )}
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={saving}>
              <CheckCircle2 className="h-4 w-4" />
              <span>{saving ? 'Saving Rules...' : 'Save Commerce Rules'}</span>
            </Button>
          </Card>
        </form>
      )}
    </AdminShell>
  );
}
