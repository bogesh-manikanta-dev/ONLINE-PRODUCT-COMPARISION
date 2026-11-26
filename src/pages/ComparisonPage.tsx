import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookmarkCheck,
  Check,
  Plus,
  Scale,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type { ComparisonAnalysisResult, ProductDTO } from '../../shared/types.ts';
import {
  Breadcrumbs,
  Button,
  Card,
  Input,
  Label,
  ProductImage,
  Select,
  Skeleton,
} from '../components/ui/Primitives.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';

export function ComparisonPage({ navigate }: { navigate: (to: string) => void }) {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { compareItems, addToCompare, removeFromCompare, clearCompare, showNotice } = useCompare();

  const [analysis, setAnalysis] = useState<ComparisonAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowFilter, setRowFilter] = useState<'all' | 'diff' | 'match'>('all');

  const [catalogCandidates, setCatalogCandidates] = useState<ProductDTO[]>([]);
  const [selectedAddId, setSelectedAddId] = useState('');

  const [saveTitle, setSaveTitle] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const catParam = compareItems.length > 0 ? `&categoryId=${compareItems[0].categoryId}` : '';
    apiRequest<{ items: ProductDTO[] }>(`/api/products?limit=40${catParam}`)
      .then((res) => setCatalogCandidates(res.items))
      .catch(() => {});
  }, [compareItems]);

  useEffect(() => {
    if (compareItems.length < 2) {
      setAnalysis(null);
      setError('');
      return;
    }

    let mounted = true;
    setLoading(true);
    setError('');
    apiRequest<ComparisonAnalysisResult>('/api/compare/analyze', {
      method: 'POST',
      body: JSON.stringify({ productIds: compareItems.map((p) => p.id) }),
    })
      .then((res) => {
        if (mounted) {
          setAnalysis(res);
          if (!saveTitle && res.products.length >= 2) {
            setSaveTitle(
              `${res.categoryName}: ${res.products.map((p) => p.name.split(' ')[0]).join(' vs ')}`
            );
          }
        }
      })
      .catch((err: any) => {
        if (mounted) setError(err.message || 'Could not analyze comparison.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [compareItems]);

  const handleQuickAdd = () => {
    const id = Number(selectedAddId);
    const found = catalogCandidates.find((p) => p.id === id);
    if (found) {
      addToCompare(found);
      setSelectedAddId('');
    }
  };

  const handleSaveComparison = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showNotice('info', 'Please sign in to save comparisons to your account.');
      navigate('/login');
      return;
    }
    if (!analysis || !analysis.compatible) return;
    setSaving(true);
    try {
      await apiRequest('/api/workspace/comparisons', {
        method: 'POST',
        body: JSON.stringify({
          title: saveTitle.trim() || `${analysis.categoryName} Comparison`,
          categoryId: analysis.categoryId,
          productIds: analysis.products.map((p) => p.id),
          notes: saveNotes.trim(),
        }),
      });
      showNotice('success', 'Comparison saved to your workspace.');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not save comparison.');
    } finally {
      setSaving(false);
    }
  };

  const availableToAdd = catalogCandidates.filter(
    (p) => !compareItems.some((c) => c.id === p.id)
  );

  const visibleRows = (analysis?.rows || []).filter((r) => {
    if (rowFilter === 'diff') return r.hasDifference || r.hasMissingData || r.hasConflict;
    if (rowFilter === 'match') return r.allMatch;
    return true;
  });

  // Group specifications logically for clear matrix scanning
  const groupedSections = useMemo(() => {
    const numericRows = visibleRows.filter((r) => r.dataType === 'numeric');
    const descriptiveRows = visibleRows.filter((r) => r.dataType !== 'numeric');
    const sections: Array<{ title: string; rows: typeof visibleRows }> = [];
    if (numericRows.length > 0) {
      sections.push({ title: 'Measurable Benchmarks & Capacity', rows: numericRows });
    }
    if (descriptiveRows.length > 0) {
      sections.push({ title: 'Features, Architecture & Build', rows: descriptiveRows });
    }
    return sections;
  }, [visibleRows]);

  // Conditional Spec-Advantage Indicator: only shown when strict rules pass
  const specAdvantage = useMemo(() => {
    if (!analysis || !analysis.compatible || analysis.products.length < 2) return null;
    const comparableNumericRows = analysis.rows.filter(
      (r) => r.dataType === 'numeric' && r.higherIsBetter !== null
    );
    if (comparableNumericRows.length === 0) return null;

    const counts = new Map<number, number>();
    for (const p of analysis.products) counts.set(p.id, 0);
    for (const row of comparableNumericRows) {
      for (const cell of row.values) {
        if (cell.isBest) {
          counts.set(cell.productId, (counts.get(cell.productId) || 0) + 1);
        }
      }
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length < 2 || sorted[0][1] === 0 || sorted[0][1] === sorted[1][1]) return null;

    const leaderId = sorted[0][0];
    const insight = analysis.productInsights.find((i) => i.productId === leaderId);
    if (!insight || insight.completenessPercent < 75) return null;

    return {
      productId: leaderId,
      productName: insight.productName,
      wins: sorted[0][1],
      totalNumeric: comparableNumericRows.length,
      completeness: insight.completenessPercent,
    };
  }, [analysis]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs navigate={navigate} items={[{ label: 'Home', to: '/' }, { label: 'Compare' }]} />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              <Scale className="h-4 w-4" />
              <span>Side-by-Side Comparison Engine</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Product Comparison Matrix
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Compare up to 4 compatible products. Missing data is explicitly preserved and never penalized as zero.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {compareItems.length < 4 && availableToAdd.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  aria-label="Add product to comparison"
                  value={selectedAddId}
                  onChange={(e) => setSelectedAddId(e.target.value)}
                  className="w-60 h-9 text-xs"
                >
                  <option value="">
                    {compareItems.length > 0
                      ? `Add ${compareItems[0].categoryName} model...`
                      : 'Select a product to start...'}
                  </option>
                  {availableToAdd.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.basePrice, p.currency)})
                    </option>
                  ))}
                </Select>
                <Button variant="outline" size="sm" onClick={handleQuickAdd} disabled={!selectedAddId}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            )}
            {compareItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCompare}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Empty or single-item guidance */}
      {compareItems.length < 2 && (
        <Card className="p-10 text-center space-y-4">
          <h2 className="font-display text-xl font-semibold text-white">
            {compareItems.length === 0
              ? 'No products selected for comparison'
              : `1 product selected (${compareItems[0].name}) — add at least 1 more ${compareItems[0].categoryName} model`}
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Choose another product from the dropdown above or browse our catalog to compare 2 to 4 compatible products side by side.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/discover')}>
              Browse Catalog
            </Button>
            {compareItems.length === 1 && (
              <Button variant="outline" onClick={() => removeFromCompare(compareItems[0].id)}>
                Remove {compareItems[0].name}
              </Button>
            )}
          </div>
        </Card>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-800/80 bg-red-950/60 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && <Skeleton className="h-96 w-full" />}

      {analysis && analysis.compatible && !loading && (
        <>
          {/* Summary Banner + Conditional Spec Advantage */}
          <Card className="p-6 bg-gradient-to-br from-[#12100D] via-[#0F0E0B] to-[#17140F] border-slate-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-sky-400">
                Comparison Summary · {analysis.categoryName}
              </div>
              {specAdvantage && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                  <Award className="h-3.5 w-3.5 text-sky-400" />
                  <span>
                    Leading Spec Profile: {specAdvantage.productName} ({specAdvantage.wins}/
                    {specAdvantage.totalNumeric} measurable leads, {specAdvantage.completeness}% complete)
                  </span>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{analysis.summaryText}</p>
          </Card>

          {/* Filter Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-slate-800 bg-[#0F0E0B]">
              {[
                { id: 'all', label: `Full Matrix (${analysis.rows.length})` },
                {
                  id: 'diff',
                  label: `Visual Difference Mode (${analysis.rows.filter((r) => r.hasDifference || r.hasMissingData || r.hasConflict).length})`,
                },
                {
                  id: 'match',
                  label: `Matching Specs (${analysis.rows.filter((r) => r.allMatch).length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRowFilter(tab.id as typeof rowFilter)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    rowFilter === tab.id
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400">
              Highlighted cells indicate leading numeric values where higher/lower direction is defined.
            </span>
          </div>

          {/* Side-by-Side Comparison Matrix with Sticky Column Header */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
              <table className="w-full text-sm border-collapse min-w-[700px]">
                <thead className="sticky top-0 z-20 bg-[#110F0D] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.9)]">
                  <tr className="border-b border-slate-800">
                    <th className="p-4 text-left font-display text-xs font-semibold text-slate-400 w-56 align-bottom">
                      Specification
                    </th>
                    {analysis.products.map((prod) => (
                      <th
                        key={prod.id}
                        className="p-4 text-left align-top min-w-[210px] border-l border-slate-800"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <span className="text-xs font-medium text-sky-400">{prod.brandName}</span>
                          <button
                            type="button"
                            onClick={() => removeFromCompare(prod.id)}
                            aria-label={`Remove ${prod.name}`}
                            className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div
                          onClick={() => navigate(`/products/${prod.slug}`)}
                          className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-800 bg-[#0B0A08] mb-3 cursor-pointer"
                        >
                          <ProductImage src={prod.primaryImage} alt={prod.name} className="h-full w-full" />
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${prod.slug}`)}
                          className="font-display text-sm font-bold text-white hover:text-sky-400 text-left line-clamp-2 transition-colors cursor-pointer"
                        >
                          {prod.name}
                        </button>
                        <div className="mt-1.5 flex flex-wrap items-baseline gap-2 font-mono text-base font-bold text-white tabular-nums">
                          <span>{formatCurrency(prod.basePrice, prod.currency)}</span>
                          {analysis.priceSummary.lowestBasePriceProductId === prod.id &&
                            analysis.priceSummary.priceSpread > 0 && (
                              <span className="text-xs font-sans font-semibold text-emerald-400">
                                Lowest Base Price
                              </span>
                            )}
                        </div>
                        <div className="mt-2.5">
                          <Button
                            variant="accent"
                            size="sm"
                            disabled={prod.stockQuantity <= 0}
                            onClick={() => addToCart(prod.id, 1, true)}
                            className="w-full"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>{prod.stockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {groupedSections.map((section) => (
                    <React.Fragment key={section.title}>
                      <tr className="bg-[#0C0B09]">
                        <td
                          colSpan={analysis.products.length + 1}
                          className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-sky-400 border-t border-slate-800"
                        >
                          {section.title}
                        </td>
                      </tr>
                      {section.rows.map((row) => (
                        <tr
                          key={row.specDefinitionId}
                          className={
                            row.hasDifference
                              ? 'bg-sky-500/[0.03]'
                              : row.allMatch
                                ? 'bg-emerald-500/[0.02]'
                                : ''
                          }
                        >
                          <td className="p-4 font-medium text-slate-300 align-top">
                            <div>{row.label}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {row.allMatch
                                ? 'Identical'
                                : row.hasDifference
                                  ? 'Differs'
                                  : row.hasMissingData
                                    ? 'Incomplete'
                                    : ''}
                            </div>
                          </td>
                          {row.values.map((cell) => (
                            <td
                              key={cell.productId}
                              className={`p-4 border-l border-slate-800 align-top font-mono tabular-nums ${
                                cell.isBest
                                  ? 'bg-sky-500/10 text-white font-semibold'
                                  : 'text-slate-300'
                              }`}
                            >
                              {cell.isMissing ? (
                                <span className="font-sans text-xs italic text-slate-500">
                                  Not available
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span>{cell.rawValue}</span>
                                    {cell.isBest && (
                                      <Check className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                                    )}
                                  </div>
                                  {cell.isConflicting && (
                                    <div className="inline-flex items-center gap-1 font-sans text-xs text-amber-400">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>Conflicting record</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Strengths & Limitations per Product */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {analysis.productInsights.map((ins) => (
              <Card key={ins.productId} className="p-5 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="font-display text-sm font-bold text-white line-clamp-1">
                    {ins.productName}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                    Spec Completeness: {ins.completenessPercent}%
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-emerald-400 mb-1.5">Strengths</h4>
                  {ins.strengths.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                      {ins.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Balanced across specifications.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-amber-400 mb-1.5">Limitations & Gaps</h4>
                  {ins.limitations.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                      {ins.limitations.map((l, idx) => (
                        <li key={idx}>{l}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No major limitations identified.</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Save Comparison Form */}
          <Card className="p-6">
            <form
              onSubmit={handleSaveComparison}
              className="grid grid-cols-1 gap-4 md:grid-cols-12 items-end"
            >
              <div className="md:col-span-4">
                <Label htmlFor="save-comp-title">Save Comparison Title</Label>
                <Input
                  id="save-comp-title"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  required
                  placeholder="e.g., Fall Semester Laptop Shortlist"
                />
              </div>
              <div className="md:col-span-5">
                <Label htmlFor="save-comp-notes">Decision Notes (Optional)</Label>
                <Input
                  id="save-comp-notes"
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Battery life matters most for travel..."
                />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" variant="primary" className="w-full" disabled={saving}>
                  <BookmarkCheck className="h-4 w-4" />
                  <span>{saving ? 'Saving...' : user ? 'Save Comparison' : 'Sign In to Save'}</span>
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
