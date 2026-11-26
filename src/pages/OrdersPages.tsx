import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Truck,
  XCircle,
} from 'lucide-react';
import type { OrderDTO, OrderStatus } from '../../shared/types.ts';
import {
  Breadcrumbs,
  Button,
  Card,
  Input,
  Label,
  ProductImage,
  Skeleton,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';

const TIMELINE_STAGES: OrderStatus[] = [
  'Order Placed',
  'Order Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export function OrdersListPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiRequest<{ orders: OrderDTO[] }>('/api/orders')
      .then((res) => setOrders(res.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center space-y-4">
          <Package className="mx-auto h-10 w-10 text-sky-400" />
          <h1 className="font-display text-2xl font-bold text-white">Sign in to View Orders</h1>
          <p className="text-sm text-slate-400">
            Access your CompareX demonstration order history, tracking timelines, cancellations, and returns.
          </p>
          <Button variant="primary" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-2">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Orders' }]} navigate={navigate} />
          <h1 className="font-display text-3xl font-bold text-white">Your Orders &amp; Tracking</h1>
          <p className="text-sm text-slate-400">
            Track simulated delivery stages, cancel eligible pre-shipment orders, reorder, or request returns.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/returns')}>
          View Return Requests
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <Package className="mx-auto h-10 w-10 text-slate-500" />
          <h2 className="font-display text-xl font-bold text-white">No Orders Placed Yet</h2>
          <p className="text-sm text-slate-400">
            Explore our INR demonstration catalog and complete a guided checkout to track an order here.
          </p>
          <Button variant="primary" onClick={() => navigate('/discover')}>
            Explore Products
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div>
                    <div className="text-slate-400">Order Number</div>
                    <div className="font-mono text-sm font-bold text-white">{order.orderNumber}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Placed On</div>
                    <div className="text-slate-200">{formatDate(order.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Total (INR)</div>
                    <div className="font-mono font-bold text-sky-400 tabular-nums">
                      {formatCurrency(order.totalAmount, order.currency)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      order.status === 'Cancelled'
                        ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                        : order.status === 'Delivered'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {order.status}
                  </span>
                  <Button variant="primary" size="sm" onClick={() => navigate(`/orders/${order.id}`)}>
                    Track &amp; Manage
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#070D1A] p-2.5 border border-slate-800/70">
                    <div className="h-12 w-14 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      <ProductImage src={item.imageSnapshot} alt={item.productNameSnapshot} className="h-full w-full" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{item.productNameSnapshot}</div>
                      <div className="text-[11px] text-slate-400">
                        Qty {item.quantity} · {formatCurrency(item.lineTotal, order.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage({
  orderId,
  navigate,
}: {
  orderId: number;
  navigate: (to: string) => void;
}) {
  const { user } = useAuth();
  const { setCartDirect, setDrawerOpen } = useCart();
  const { showNotice } = useCompare();

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Changed mind before shipment');
  const [cancelling, setCancelling] = useState(false);

  const [returnTargetItemId, setReturnTargetItemId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ order: OrderDTO }>(`/api/orders/${orderId}`);
      setOrder(res.order);
    } catch (err: any) {
      setError(err.message || 'Order could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (user && Number.isInteger(orderId) && orderId > 0) {
      loadOrder();
    } else {
      setLoading(false);
    }
  }, [user, orderId, loadOrder]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const res = await apiRequest<{ order: OrderDTO }>(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason }),
      });
      setOrder(res.order);
      setCancelModalOpen(false);
      showNotice('info', `Order ${res.order.orderNumber} was cancelled and stock was restored.`);
    } catch (err: any) {
      showNotice('error', err.message || 'Unable to cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    try {
      const res = await apiRequest<{ cart: any; notices: string[] }>(`/api/orders/${order.id}/reorder`, {
        method: 'POST',
      });
      setCartDirect(res.cart);
      setDrawerOpen(true);
      showNotice(
        'success',
        res.notices.length > 0 ? res.notices.join(' ') : 'Items added back to your cart.'
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Could not reorder items.');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !returnTargetItemId) return;
    setSubmittingReturn(true);
    try {
      await apiRequest(`/api/orders/${order.id}/returns`, {
        method: 'POST',
        body: JSON.stringify({ orderItemId: returnTargetItemId, reason: returnReason }),
      });
      setReturnTargetItemId(null);
      setReturnReason('');
      showNotice('success', 'Return request submitted for administrator review.');
      await loadOrder();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to submit return request.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-10 space-y-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">Order Unavailable</h1>
        <p className="text-sm text-slate-400">{error || 'Please sign in to view this order.'}</p>
        <Button variant="primary" onClick={() => navigate('/orders')}>
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Orders</span>
        </Button>
      </div>
    );
  }

  const activeStageIndex = TIMELINE_STAGES.indexOf(order.status);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-2">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Orders', to: '/orders' },
              { label: order.orderNumber },
            ]}
            navigate={navigate}
          />
          <h1 className="font-display text-3xl font-bold text-white">{order.orderNumber}</h1>
          <p className="text-xs text-slate-400">
            Placed on {formatDate(order.createdAt)} · Simulated Delivery Estimate:{' '}
            <strong className="text-slate-200">{formatDate(order.estimatedDeliveryDate)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" size="sm" onClick={handleReorder}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reorder to Cart</span>
          </Button>
          {order.isCancellable && (
            <Button variant="danger" size="sm" onClick={() => setCancelModalOpen(true)}>
              <XCircle className="h-3.5 w-3.5" />
              <span>Cancel Order</span>
            </Button>
          )}
        </div>
      </div>

      {/* Simulated Tracking Notice */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1222] px-4 py-3 text-xs text-slate-400 flex items-center gap-2.5">
        <Truck className="h-4 w-4 text-sky-400 shrink-0" />
        <span>
          Simulated Order Tracking: Delivery stages are updated inside CompareX by administrators for academic and e-commerce demonstration.
        </span>
      </div>

      {/* Animated Status Timeline */}
      {order.status === 'Cancelled' ? (
        <Card className="p-6 border-red-500/40 bg-red-950/20 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-display text-lg font-bold">
            <XCircle className="h-5 w-5" />
            <span>Order Cancelled</span>
          </div>
          <p className="text-sm text-slate-300">
            Reason: {order.cancellationReason || 'Cancelled before shipment'}. Inventory quantities were automatically restored.
          </p>
        </Card>
      ) : (
        <Card className="p-6 space-y-5">
          <h2 className="font-display text-lg font-bold text-white">Fulfillment Timeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {TIMELINE_STAGES.map((stage, idx) => {
              const reached = activeStageIndex >= idx;
              const current = order.status === stage;
              return (
                <div
                  key={stage}
                  className={`rounded-xl border p-3 transition-all ${
                    current
                      ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_20px_-6px_rgba(56,189,248,0.5)]'
                      : reached
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-slate-800 bg-[#070D1A] opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${
                        current ? 'text-sky-400' : reached ? 'text-emerald-400' : 'text-slate-600'
                      }`}
                    />
                    <span className="font-mono text-[10px] text-slate-400">0{idx + 1}</span>
                  </div>
                  <div className="text-xs font-semibold text-white leading-tight">{stage}</div>
                </div>
              );
            })}
          </div>

          {!order.isCancellable && order.status !== 'Delivered' && (
            <div className="text-xs text-amber-300 flex items-center gap-2 pt-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                Cancellation is disabled because this order has already entered "{order.status}" stage.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Items + Return Trigger + Address/Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Order Items</h2>
          <div className="divide-y divide-slate-800/80">
            {order.items.map((item) => {
              const existingRet = order.returns.find((r) => r.orderItemId === item.id);
              return (
                <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-16 w-18 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                      <ProductImage src={item.imageSnapshot} alt={item.productNameSnapshot} className="h-full w-full" />
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold text-white">
                        {item.productNameSnapshot}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.brandNameSnapshot} · {item.variantSnapshot} · Qty {item.quantity}
                      </div>
                      <div className="text-xs text-slate-500">
                        Unit: {formatCurrency(item.unitPriceSnapshot, order.currency)} + {item.taxRateSnapshot}% GST
                      </div>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <div className="font-mono text-sm font-bold text-white tabular-nums">
                      {formatCurrency(item.lineTotal, order.currency)}
                    </div>
                    {existingRet ? (
                      <span className="text-[11px] font-semibold text-amber-300">
                        Return: {existingRet.status}
                      </span>
                    ) : order.isReturnEligible ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReturnTargetItemId(item.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Request Return</span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-white">Payment &amp; Totals</h2>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <dt>Subtotal</dt>
                <dd className="font-mono text-white tabular-nums">{formatCurrency(order.subtotal, order.currency)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>GST / Tax</dt>
                <dd className="font-mono text-white tabular-nums">{formatCurrency(order.taxAmount, order.currency)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>Delivery ({order.deliveryMethod})</dt>
                <dd className="font-mono text-white tabular-nums">
                  {order.deliveryCharge === 0 ? 'FREE' : formatCurrency(order.deliveryCharge, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold text-white">
                <dt>Total</dt>
                <dd className="font-mono text-sky-400 tabular-nums">{formatCurrency(order.totalAmount, order.currency)}</dd>
              </div>
            </dl>
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              Mode: {order.paymentMode} ({order.paymentStatus})
            </div>
          </Card>

          <Card className="p-6 space-y-2">
            <h2 className="font-display text-base font-bold text-white">Shipping Address</h2>
            <div className="text-xs text-slate-300 space-y-0.5">
              <div className="font-semibold text-white">{order.shippingAddress.fullName}</div>
              <div className="text-slate-400">{order.shippingAddress.phone}</div>
              <div>
                {order.shippingAddress.houseBuilding}, {order.shippingAddress.street}
              </div>
              <div>
                {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.postalCode}
              </div>
              <div>{order.shippingAddress.country}</div>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-white">Event History</h2>
            <div className="space-y-2.5 text-xs">
              {order.history.map((h) => (
                <div key={h.id} className="border-l-2 border-sky-500/40 pl-3 py-0.5">
                  <div className="font-semibold text-white">{h.status}</div>
                  {h.note && <div className="text-slate-400">{h.note}</div>}
                  <div className="text-[10px] text-slate-500">{formatDate(h.createdAt)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Cancel Order Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Confirm Order Cancellation</h3>
            <p className="text-xs text-slate-400">
              Cancelling {order.orderNumber} will immediately restore product inventory quantities.
            </p>
            <div>
              <Label>Cancellation Reason</Label>
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)}>
                Keep Order
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={cancelling || cancelReason.trim().length < 3}
                onClick={handleCancelOrder}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Return Request Modal */}
      {returnTargetItemId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white">Submit Return Request (Demo)</h3>
            <p className="text-xs text-slate-400">
              Refund amounts shown are simulated demonstration refunds processed once reviewed by an administrator.
            </p>
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <Label>Reason for Return</Label>
                <Input
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Describe item condition or reason..."
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" type="button" onClick={() => setReturnTargetItemId(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={submittingReturn}>
                  {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
