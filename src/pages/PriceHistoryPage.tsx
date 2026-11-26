import React, { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, LineChart as LineChartIcon, Store } from 'lucide-react';
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
import { Breadcrumbs, Button, Card, Label, Select, Skeleton } from '../components/ui/Primitives.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, formatDate } from '../lib/utils.ts';

export function PriceHistoryPage({
  productIdParam,
  navigate,
}: {
  productIdParam?: number;
  navigate: (to: string) => void;
}) {
  const [catalog, setCatalog] = useState<ProductDTO[]>([]);
  const [selectedId, setSelectedId] = useState<number>(productIdParam || 0);
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [observations, setObservations] = useState<PriceObservationDTO[]>([]);
  const [stats, setStats] = useState<{
    lowestPrice: number | null;
    highestPrice: number | null;
    latestPrice: number | null;
    priceChangeAmount: number | null;
    priceChangePercent: number | null;
  }>({
    lowestPrice: null,
    highestPrice: null,
    latestPrice: null,
    priceChangeAmount: null,
    priceChangePercent: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<{ items: ProductDTO[] }>('/api/products?limit=48')
      .then((res) => {
        setCatalog(res.items);
        if (!selectedId && res.items.length > 0) {
          setSelectedId(res.items[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (productIdParam) setSelectedId(productIdParam);
  }, [productIdParam]);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;
    setLoading(true);
    Promise.all([
      apiRequest<{
        product: ProductDTO;
        observations: PriceObservationDTO[];
        lowestPrice: number | null;
        highestPrice: number | null;
        latestPrice: number | null;
        priceChangeAmount: number | null;
        priceChangePercent: number | null;
      }>(`/api/products/${selectedId}/price-history`),
      apiRequest<{ product: ProductDTO }>(`/api/products/${selectedId}`).catch(() => null),
    ])
      .then(([histRes, detailRes]) => {
        if (!mounted) return;
        setProduct(detailRes?.product || histRes.product);
        setObservations(histRes.observations);
        setStats({
          lowestPrice: histRes.lowestPrice,
          highestPrice: histRes.highestPrice,
          latestPrice: histRes.latestPrice,
          priceChangeAmount: histRes.priceChangeAmount,
          priceChangePercent: histRes.priceChangePercent,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectedId]);

  const chartData = observations.map((o) => ({
    date: formatDate(o.observedAt),
    price: o.price,
    seller: o.sellerName,
  }));

  const lastObservedDate =
    observations.length > 0
      ? formatDate(observations[observations.length - 1].observedAt)
      : 'Not recorded';

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[{ label: 'Home', to: '/' }, { label: 'Price Insights' }]}
        />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <LineChartIcon className="h-4 w-4" />
              <span>Price Intelligence</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Recorded Price History
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Inspect historical price snapshots from seeded demonstration observations and administrator entries.
            </p>
          </div>

          <div className="w-full md:w-80">
            <Label htmlFor="ph-product-select">Select Product</Label>
            <Select
              id="ph-product-select"
              value={selectedId || ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedId(id);
                navigate(`/price-history/${id}`);
              }}
            >
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brandName})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <div className="text-xs text-slate-400">Latest Observed Price</div>
              <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                {formatCurrency(stats.latestPrice, product?.currency)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {observations.length} observation(s) · Last updated {lastObservedDate}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-400">Lowest Recorded Price</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                {formatCurrency(stats.lowestPrice, product?.currency)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Within recorded history</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-400">Highest Recorded Price</div>
              <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                {formatCurrency(stats.highestPrice, product?.currency)}
              </div>
              <div className="text-xs text-slate-400 mt-1">Peak recorded observation</div>
            </Card>
            <Card className="p-5">
              <div className="text-xs text-slate-400">Observed Price Delta</div>
              <div className="flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums mt-1">
                {stats.priceChangeAmount !== null ? (
                  <>
                    {stats.priceChangeAmount <= 0 ? (
                      <ArrowDownRight className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-amber-400" />
                    )}
                    <span
                      className={
                        stats.priceChangeAmount <= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }
                    >
                      {stats.priceChangeAmount > 0 ? '+' : ''}
                      {formatCurrency(stats.priceChangeAmount, product?.currency)}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 text-base">Not available</span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                {stats.priceChangePercent !== null ? `${stats.priceChangePercent}% vs earliest` : '—'}
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  {product?.name} — Historical Price Curve
                </h2>
                <p className="text-xs text-slate-400">
                  Data source clearly labeled per record. CompareX never fabricates live merchant feeds.
                </p>
              </div>
              {product && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/products/${product.slug}`)}
                >
                  Open Product Detail
                </Button>
              )}
            </div>

            {chartData.length >= 2 ? (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="priceIntelGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#334155" />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      stroke="#334155"
                      tickFormatter={(v) => formatCurrency(Number(v), product?.currency || 'INR')}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B1222',
                        borderColor: '#334155',
                        borderRadius: '0.75rem',
                        color: '#F1F5F9',
                        fontSize: '12px',
                      }}
                      formatter={(val: any, _name, item) => [
                        formatCurrency(Number(val), product?.currency || 'INR'),
                        `Observed (${item?.payload?.seller || 'Seller'})`,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#38BDF8"
                      strokeWidth={2.5}
                      fill="url(#priceIntelGrad)"
                      dot={{ r: 4, fill: '#38BDF8' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                Fewer than 2 observations recorded for this product.
              </div>
            )}
          </Card>

          {/* Multi-Seller Comparison Table */}
          {product?.offers && product.offers.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-4 flex items-center gap-2">
                <Store className="h-4 w-4 text-sky-400" />
                <h3 className="font-display text-base font-bold text-white">
                  Seller Cost Comparison ({product.offers.length} offer{product.offers.length === 1 ? '' : 's'})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#080F1E] border-b border-slate-800 text-xs text-slate-400">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Seller</th>
                      <th className="px-5 py-3 text-left font-semibold">Data Source</th>
                      <th className="px-5 py-3 text-right font-semibold">Base Price</th>
                      <th className="px-5 py-3 text-right font-semibold">Est. Total Cost</th>
                      <th className="px-5 py-3 text-right font-semibold">Last Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {product.offers.map((offer) => (
                      <tr key={offer.id} className="hover:bg-slate-800/35">
                        <td className="px-5 py-3 font-semibold text-white">{offer.sellerName}</td>
                        <td className="px-5 py-3 text-xs text-slate-400">{offer.dataSource}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-200 tabular-nums">
                          {formatCurrency(offer.price, offer.currency)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold text-sky-400 tabular-nums">
                          {offer.estimatedTotalCost !== null
                            ? formatCurrency(offer.estimatedTotalCost, offer.currency)
                            : 'Incomplete fees'}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-slate-400 tabular-nums">
                          {formatDate(offer.lastVerifiedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Observation Ledger */}
          <Card className="overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="font-display text-base font-bold text-white">
                Recorded Observations Ledger
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#080F1E] border-b border-slate-800 text-xs text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Observed Date</th>
                    <th className="px-5 py-3 text-left font-semibold">Seller</th>
                    <th className="px-5 py-3 text-left font-semibold">Source Label</th>
                    <th className="px-5 py-3 text-right font-semibold">Recorded Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {observations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-slate-800/35">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300 tabular-nums">
                        {formatDate(obs.observedAt)}
                      </td>
                      <td className="px-5 py-3 font-medium text-white">{obs.sellerName}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">
                        {obs.sourceLabel} {obs.isDemoData ? '(Demo)' : '(Verified Entry)'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-white tabular-nums">
                        {formatCurrency(obs.price, obs.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
