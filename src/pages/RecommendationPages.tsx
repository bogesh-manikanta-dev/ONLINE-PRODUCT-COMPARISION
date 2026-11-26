import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Info,
  RotateCcw,
  Scale,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RecommendationCriteriaInput, RecommendationResponseDTO } from '../../shared/types.ts';
import {
  Breadcrumbs,
  Button,
  Card,
  Input,
  Label,
  ProductImage,
  Select,
} from '../components/ui/Primitives.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';

const USAGE_OPTIONS = [
  { value: 'student_portable', label: 'Student & Portable Daily Work', desc: 'Balanced weight, battery endurance, and everyday responsiveness.' },
  { value: 'creative_work', label: 'Creative Production & Engineering', desc: 'Prioritizes compute power, memory headroom, and color-accurate displays.' },
  { value: 'gaming', label: 'High-Performance & Gaming', desc: 'Emphasizes high refresh rates, graphics throughput, and thermal capacity.' },
  { value: 'business_travel', label: 'Business Travel & Mobility', desc: 'Optimizes low carry weight, battery life, and dependable build quality.' },
  { value: 'photography', label: 'Photography & Imaging', desc: 'Focuses on sensor resolution, optical capability, and screen fidelity.' },
  { value: 'daily_commute', label: 'Daily Commute & Audio Focus', desc: 'Prioritizes noise cancellation, comfort, and multi-day endurance.' },
  { value: 'family_household', label: 'Family Household Utility', desc: 'Targets generous capacity, durability, and low hidden operating costs.' },
  { value: 'energy_efficiency', label: 'Energy Efficiency & Low Running Cost', desc: 'Weights star efficiency ratings and lower annual power draw.' },
  { value: 'everyday_value', label: 'Balanced Everyday Value', desc: 'Maximizes specification completeness per dollar within budget.' },
];

const WIZARD_STEPS = [
  { id: 1, title: 'Category' },
  { id: 2, title: 'Budget' },
  { id: 3, title: 'Usage' },
  { id: 4, title: 'Specs' },
  { id: 5, title: 'Priorities' },
  { id: 6, title: 'Review' },
];

export function RecommendationQuestionnairePage({ navigate }: { navigate: (to: string) => void }) {
  const { categories, brands, setLastRecommendation, showNotice } = useCompare();
  const shouldReduceMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.id || 1);
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('80000');
  const [intendedUsage, setIntendedUsage] = useState('student_portable');
  const [preferredBrandId, setPreferredBrandId] = useState('');
  const [importantFeatures, setImportantFeatures] = useState<string[]>([]);
  const [reqSpecKey, setReqSpecKey] = useState('');
  const [reqSpecOp, setReqSpecOp] = useState<'gte' | 'lte' | 'eq'>('gte');
  const [reqSpecVal, setReqSpecVal] = useState('');

  const [priorities, setPriorities] = useState({
    performance: 75,
    value: 75,
    efficiency: 50,
    reliability: 60,
  });

  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === Number(categoryId)) || categories[0] || null,
    [categories, categoryId]
  );

  const toggleImportantFeature = (key: string) => {
    setImportantFeatures((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedCategory) return;
    setSubmitting(true);
    try {
      const payload: RecommendationCriteriaInput = {
        categoryId: selectedCategory.id,
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: Number(budgetMax) || 80000,
        intendedUsage,
        preferredBrandId: preferredBrandId ? Number(preferredBrandId) : null,
        importantFeatures,
        requiredSpecs:
          reqSpecKey && reqSpecVal.trim()
            ? [
                {
                  key: reqSpecKey,
                  operator: reqSpecOp,
                  value: Number.isFinite(Number(reqSpecVal)) ? Number(reqSpecVal) : reqSpecVal.trim(),
                },
              ]
            : [],
        priorities,
      };

      const res = await apiRequest<RecommendationResponseDTO>('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      sessionStorage.setItem('comparex_last_criteria', JSON.stringify(payload));
      setLastRecommendation(res);
      navigate('/recommendations/results');
    } catch (err: any) {
      showNotice('error', err.message || 'Could not compute recommendations.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedBrandName =
    brands.find((b) => String(b.id) === String(preferredBrandId))?.name || 'No preference';
  const selectedUsageLabel =
    USAGE_OPTIONS.find((u) => u.value === intendedUsage)?.label || intendedUsage;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs navigate={navigate} items={[{ label: 'Home', to: '/' }, { label: 'Smart Recommendations' }]} />
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
          <Compass className="h-4 w-4" />
          <span>Explainable Decision Support</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
          Smart Recommendation Wizard
        </h1>
        <p className="text-sm text-slate-400">
          Step through your category, budget ceiling, intended usage, mandatory thresholds, and priority weights.
        </p>
      </div>

      {/* 6-Step Progress Stepper */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {WIZARD_STEPS.map((s) => {
          const isCurrent = step === s.id;
          const isCompleted = step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                isCurrent
                  ? 'border-sky-400 bg-sky-500/15 text-white'
                  : isCompleted
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-[#0F0E0B] text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-mono text-xs font-bold shrink-0">
                {isCompleted ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : `0${s.id}`}
              </span>
              <span className="text-xs font-semibold truncate">{s.title}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <motion.div
          key={step}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {step === 1 && (
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Step 1 · Choose Product Category
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select the category whose specifications and models you want to evaluate.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => {
                  const active = selectedCategory?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(c.id);
                        setImportantFeatures([]);
                        setReqSpecKey('');
                      }}
                      className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-sky-500/15 text-white'
                          : 'border-slate-800 bg-[#0B0A08] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-[11px] font-medium text-sky-400">{c.domainGroup}</div>
                      <div className="font-display text-sm font-bold mt-0.5">{c.name}</div>
                      <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                        {c.productCount ?? 0} models
                      </div>
                    </button>
                  );
                })}
              </div>
              <div>
                <Label htmlFor="rec-category">Or Select Directly</Label>
                <Select
                  id="rec-category"
                  value={selectedCategory?.id || ''}
                  onChange={(e) => {
                    setCategoryId(Number(e.target.value));
                    setImportantFeatures([]);
                    setReqSpecKey('');
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.domainGroup})
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Step 2 · Set Budget & Brand Preference
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Define your maximum spending cap and optional brand preference.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rec-budget-slider" className="mb-0">
                    Target Budget Ceiling (INR)
                  </Label>
                  <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">
                    ₹{Number(budgetMax || 80000).toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  id="rec-budget-slider"
                  type="range"
                  min={2000}
                  max={250000}
                  step={2000}
                  value={Math.min(250000, Math.max(2000, Number(budgetMax) || 80000))}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="w-full accent-sky-400 cursor-pointer"
                />
                <div className="flex flex-wrap gap-2">
                  {[25000, 75000, 150000, 225000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBudgetMax(String(preset))}
                      className="rounded-lg border border-slate-700 bg-[#0B0A08] px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-sky-400 hover:text-white cursor-pointer"
                    >
                      ₹{preset.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rec-budget-min">Minimum Budget (₹ Optional)</Label>
                  <Input
                    id="rec-budget-min"
                    type="number"
                    min={0}
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="rec-budget-max">Target Maximum Budget (₹)</Label>
                  <Input
                    id="rec-budget-max"
                    type="number"
                    min={500}
                    required
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    placeholder="80000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="rec-brand">Preferred Brand (Optional)</Label>
                  <Select
                    id="rec-brand"
                    value={preferredBrandId}
                    onChange={(e) => setPreferredBrandId(e.target.value)}
                  >
                    <option value="">No brand preference</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Card>
          )}

          {step === 3 && (
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Step 3 · Primary Intended Usage
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Usage selection guides how our deterministic scoring algorithm evaluates domain trade-offs.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {USAGE_OPTIONS.map((opt) => {
                  const active = intendedUsage === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setIntendedUsage(opt.value)}
                      className={`rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-sky-500/15 text-white'
                          : 'border-slate-800 bg-[#0B0A08] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-display text-sm font-semibold">{opt.label}</div>
                      <p className="text-xs text-slate-400 mt-1">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              <div>
                <Label htmlFor="rec-usage">Selected Usage Profile</Label>
                <Select
                  id="rec-usage"
                  value={intendedUsage}
                  onChange={(e) => setIntendedUsage(e.target.value)}
                >
                  {USAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Step 4 · Mandatory Threshold & Emphasized Attributes
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Filter out products missing a hard requirement and boost features that matter most to you.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="rec-req-key">Mandatory Specification (Optional)</Label>
                  <Select
                    id="rec-req-key"
                    value={reqSpecKey}
                    onChange={(e) => setReqSpecKey(e.target.value)}
                  >
                    <option value="">None</option>
                    {(selectedCategory?.specDefinitions || []).map((d) => (
                      <option key={d.id} value={d.key}>
                        {d.label} {d.unit ? `(${d.unit})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rec-req-op">Condition</Label>
                  <Select
                    id="rec-req-op"
                    value={reqSpecOp}
                    onChange={(e) => setReqSpecOp(e.target.value as 'gte' | 'lte' | 'eq')}
                    disabled={!reqSpecKey}
                  >
                    <option value="gte">At least (&gt;=)</option>
                    <option value="lte">At most (&lt;=)</option>
                    <option value="eq">Matches / Contains</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rec-req-val">Threshold Value</Label>
                  <Input
                    id="rec-req-val"
                    value={reqSpecVal}
                    onChange={(e) => setReqSpecVal(e.target.value)}
                    disabled={!reqSpecKey}
                    placeholder="e.g. 16 or Yes"
                  />
                </div>
              </div>

              {selectedCategory?.specDefinitions && selectedCategory.specDefinitions.length > 0 && (
                <div>
                  <Label>Important Specifications to Emphasize</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-1">
                    {selectedCategory.specDefinitions.map((def) => {
                      const checked = importantFeatures.includes(def.key);
                      return (
                        <label
                          key={def.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium cursor-pointer transition-colors ${
                            checked
                              ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                              : 'border-slate-800 bg-[#0B0A08] text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleImportantFeature(def.key)}
                            className="accent-sky-400"
                          />
                          <span className="truncate">{def.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {step === 5 && (
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-sky-400" />
                <h2 className="font-display text-lg font-bold text-white">
                  Step 5 · Calibrate Priority Weights
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Adjust how strongly each scoring dimension affects final rank order.
              </p>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {[
                  { key: 'performance', label: 'Technical Specification Strength' },
                  { key: 'value', label: 'Budget & Price-to-Feature Value' },
                  { key: 'efficiency', label: 'Intended Usage Alignment' },
                  { key: 'reliability', label: 'Spec Completeness & Ratings' },
                ].map((item) => {
                  const k = item.key as keyof typeof priorities;
                  return (
                    <div key={item.key} className="space-y-2 rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-200">
                        <span>{item.label}</span>
                        <span className="font-mono text-sky-400 tabular-nums">{priorities[k]}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={priorities[k]}
                        onChange={(e) =>
                          setPriorities((prev) => ({ ...prev, [k]: Number(e.target.value) }))
                        }
                        className="w-full accent-sky-400 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {step === 6 && (
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Step 6 · Review & Generate Recommendations
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Confirm your criteria before running the transparent deterministic scoring engine.
                </p>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                  <dt className="text-xs text-slate-400">Category</dt>
                  <dd className="font-semibold text-white mt-0.5">{selectedCategory?.name}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                  <dt className="text-xs text-slate-400">Budget Range</dt>
                  <dd className="font-mono font-semibold text-white mt-0.5 tabular-nums">
                    {budgetMin ? `₹${Number(budgetMin).toLocaleString('en-IN')}` : '₹0'} — ₹
                    {Number(budgetMax || 80000).toLocaleString('en-IN')}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                  <dt className="text-xs text-slate-400">Intended Usage</dt>
                  <dd className="font-semibold text-white mt-0.5">{selectedUsageLabel}</dd>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                  <dt className="text-xs text-slate-400">Preferred Brand</dt>
                  <dd className="font-semibold text-white mt-0.5">{selectedBrandName}</dd>
                </div>
                <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-[#0B0A08] p-4">
                  <dt className="text-xs text-slate-400">Priority Weights</dt>
                  <dd className="font-mono text-xs text-sky-300 mt-1 tabular-nums">
                    Specs {priorities.performance}% · Value {priorities.value}% · Usage {priorities.efficiency}% · Reliability {priorities.reliability}%
                  </dd>
                </div>
              </dl>
            </Card>
          )}
        </motion.div>

        {/* Wizard Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate('/discover'))}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{step > 1 ? 'Previous Step' : 'Cancel'}</span>
            </Button>
          </div>

          <div className="flex gap-3">
            {step < 6 ? (
              <Button type="button" variant="primary" size="lg" onClick={() => setStep((s) => s + 1)}>
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" variant="accent" size="lg" disabled={submitting}>
                <span>{submitting ? 'Calculating Scores...' : 'Generate Explainable Recommendations'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export function RecommendationResultsPage({ navigate }: { navigate: (to: string) => void }) {
  const { addToCart } = useCart();
  const { lastRecommendation, setLastRecommendation, setCompareList, showNotice } = useCompare();
  const shouldReduceMotion = useReducedMotion();

  const storedCriteria = useMemo(() => {
    try {
      const raw = sessionStorage.getItem('comparex_last_criteria');
      return raw ? (JSON.parse(raw) as RecommendationCriteriaInput) : null;
    } catch {
      return null;
    }
  }, []);

  const [priorities, setPriorities] = useState(
    storedCriteria?.priorities || { performance: 75, value: 75, efficiency: 50, reliability: 60 }
  );
  const [budgetMax, setBudgetMax] = useState(
    storedCriteria?.budgetMax ? String(storedCriteria.budgetMax) : '80000'
  );
  const [recalculating, setRecalculating] = useState(false);

  if (!lastRecommendation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">
          No Active Recommendation Session
        </h1>
        <p className="text-sm text-slate-400">
          Complete the Smart Recommendation Wizard to view ranked results and criterion scores.
        </p>
        <Button variant="primary" onClick={() => navigate('/recommend')}>
          Open Recommendation Wizard
        </Button>
      </div>
    );
  }

  const handleRecalculate = async () => {
    if (!storedCriteria) return;
    setRecalculating(true);
    try {
      const updatedCriteria: RecommendationCriteriaInput = {
        ...storedCriteria,
        budgetMax: Number(budgetMax) || storedCriteria.budgetMax,
        priorities,
      };
      const res = await apiRequest<RecommendationResponseDTO>('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify(updatedCriteria),
      });
      sessionStorage.setItem('comparex_last_criteria', JSON.stringify(updatedCriteria));
      setLastRecommendation(res);
      showNotice('success', 'Recommendation scores recalculated.');
    } catch (err: any) {
      showNotice('error', err.message || 'Recalculation failed.');
    } finally {
      setRecalculating(false);
    }
  };

  const compareTopMatches = () => {
    const top = lastRecommendation.recommendations.slice(0, 4).map((r) => r.product);
    if (top.length >= 2) {
      setCompareList(top);
      navigate('/compare');
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      <div className="border-b border-slate-800/80 pb-6 space-y-3">
        <Breadcrumbs
          navigate={navigate}
          items={[
            { label: 'Home', to: '/' },
            { label: 'Recommendations', to: '/recommend' },
            { label: 'Results' },
          ]}
        />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-400 mb-1">
              Recommendation Results · {lastRecommendation.category.name}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Ranked Matches & Score Breakdown
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              {lastRecommendation.disclaimer}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/recommend')}>
              <RotateCcw className="h-3.5 w-3.5" />
              New Wizard
            </Button>
            {lastRecommendation.recommendations.length >= 2 && (
              <Button variant="primary" size="sm" onClick={compareTopMatches}>
                <Scale className="h-3.5 w-3.5" />
                Compare Top {Math.min(4, lastRecommendation.recommendations.length)}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Live Priority Recalculation Sidebar */}
        <aside className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-4">
            <h2 className="font-display text-base font-bold text-white">
              Adjust Priorities & Recalculate
            </h2>
            <div>
              <Label htmlFor="recalc-budget">Maximum Budget (₹)</Label>
              <Input
                id="recalc-budget"
                type="number"
                min={500}
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
              />
            </div>

            {[
              { key: 'performance', label: 'Performance' },
              { key: 'value', label: 'Budget Value' },
              { key: 'efficiency', label: 'Usage Alignment' },
              { key: 'reliability', label: 'Completeness & Ratings' },
            ].map((item) => {
              const k = item.key as keyof typeof priorities;
              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span>{item.label}</span>
                    <span className="font-mono text-sky-400 tabular-nums">{priorities[k]}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={priorities[k]}
                    onChange={(e) =>
                      setPriorities((prev) => ({ ...prev, [k]: Number(e.target.value) }))
                    }
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              );
            })}

            <Button
              type="button"
              variant="accent"
              className="w-full"
              onClick={handleRecalculate}
              disabled={recalculating || !storedCriteria}
            >
              {recalculating ? 'Recalculating...' : 'Recalculate Scores'}
            </Button>
          </Card>

          {lastRecommendation.filteredOutCount > 0 && (
            <Card className="p-5 space-y-2.5">
              <h3 className="font-display text-sm font-bold text-white">
                Filtered Out ({lastRecommendation.filteredOutCount})
              </h3>
              <ul className="space-y-2 text-xs text-slate-400">
                {lastRecommendation.filteredOutReasons.map((f) => (
                  <li key={f.productId} className="border-t border-slate-800 pt-2 first:border-t-0 first:pt-0">
                    <span className="font-semibold text-slate-200">{f.productName}:</span> {f.reason}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>

        {/* Ranked Recommendations */}
        <div className="lg:col-span-8 space-y-6">
          {lastRecommendation.recommendations.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <h2 className="font-display text-lg font-bold text-white">
                No products matched all mandatory constraints
              </h2>
              <p className="text-sm text-slate-400">
                Increase your maximum budget or relax mandatory specification filters on the left.
              </p>
            </Card>
          ) : (
            lastRecommendation.recommendations.map((rec) => {
              const scoreChart = [
                { name: 'Specs', score: rec.criterionScores.specificationMatch },
                { name: 'Value', score: rec.criterionScores.budgetValue },
                { name: 'Usage', score: rec.criterionScores.usageAlignment },
                { name: 'Data', score: rec.criterionScores.dataCompleteness },
              ];

              return (
                <Card key={rec.product.id} className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row gap-5 justify-between border-b border-slate-800 pb-5">
                    <div className="flex gap-4">
                      <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-[#0B0A08]">
                        <ProductImage
                          src={rec.product.primaryImage}
                          alt={rec.product.name}
                          className="h-full w-full"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-sky-400 mb-1">
                          Rank #{rec.rank} · {rec.product.brandName} ·{' '}
                          {rec.budgetSuitability.replace(/_/g, ' ')}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${rec.product.slug}`)}
                          className="font-display text-xl font-bold text-white hover:text-sky-400 text-left transition-colors cursor-pointer"
                        >
                          {rec.product.name}
                        </button>
                        <div className="font-mono text-lg font-bold text-slate-200 tabular-nums mt-1">
                          {formatCurrency(rec.product.basePrice, rec.product.currency)}
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <div className="text-xs text-slate-400">Weighted Fit Score</div>
                      <div className="font-mono text-3xl font-bold text-sky-400 tabular-nums">
                        {rec.overallScore}
                        <span className="text-sm font-normal text-slate-500"> / 100</span>
                      </div>
                      <div className="mt-2 h-1.5 w-32 sm:ml-auto rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={shouldReduceMotion ? { width: `${rec.overallScore}%` } : { width: 0 }}
                          animate={{ width: `${rec.overallScore}%` }}
                          transition={{ duration: 0.45 }}
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed">{rec.explanation}</p>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-12 items-center">
                    <div className="md:col-span-5 h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreChart} layout="vertical" margin={{ left: 8, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3A342C" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#A79E90' }}
                            stroke="#514A41"
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 11, fill: '#DDD4C6' }}
                            stroke="#514A41"
                            width={48}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0F0E0B',
                              borderColor: '#514A41',
                              borderRadius: '0.75rem',
                              color: '#F3EEE4',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="score" fill="#D9B968" radius={[0, 5, 5, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <h4 className="font-semibold text-emerald-400 mb-1.5">Strengths</h4>
                        <ul className="space-y-1 text-slate-300 list-disc pl-4">
                          {rec.strengths.length > 0 ? (
                            rec.strengths.map((s, idx) => <li key={idx}>{s}</li>)
                          ) : (
                            <li>Consistent baseline performance</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-400 mb-1.5">Limitations</h4>
                        <ul className="space-y-1 text-slate-300 list-disc pl-4">
                          {rec.limitations.length > 0 ? (
                            rec.limitations.map((l, idx) => <li key={idx}>{l}</li>)
                          ) : (
                            <li>No major compromises noted</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {rec.missingDataNotes.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-[#0B0A08] px-3.5 py-2.5 text-xs text-slate-300">
                      <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                      <span>{rec.missingDataNotes.join(' · ')}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
                    <span>{rec.keyDifferences.join(' · ')}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="accent"
                        size="sm"
                        disabled={rec.product.stockQuantity <= 0}
                        onClick={() => addToCart(rec.product.id, 1, true)}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>{rec.product.stockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/products/${rec.product.slug}`)}
                      >
                        Inspect Full Details
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
