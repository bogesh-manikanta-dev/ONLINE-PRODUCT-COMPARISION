import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import type { ProductDTO } from '../shared/types.ts';
import { Product3DViewer } from './components/Product3DViewer.tsx';

/**
 * TEMPORARY browser-verification harness for P3.
 * Not part of the application: deleted after verification.
 */

function makeProduct(overrides: Record<string, unknown>): ProductDTO {
  const now = new Date().toISOString();
  return {
    id: 1,
    name: 'Aurelia X1 Pro',
    slug: 'aurelia-x1-pro',
    brandId: 1,
    brandName: 'Aurelia',
    brandSlug: 'aurelia',
    categoryId: 1,
    categoryName: 'Smartphones',
    categorySlug: 'smartphones',
    subcategoryId: null,
    subcategoryName: null,
    description: 'Verification harness product.',
    modelNumber: 'AX1-PRO',
    variantLabel: 'Standard Edition',
    basePrice: 1299,
    currency: 'USD',
    stockQuantity: 12,
    taxRatePercent: 8,
    isFeatured: true,
    availabilityStatus: 'IN_STOCK',
    status: 'ACTIVE',
    rating: 4.6,
    reviewCount: 128,
    popularityScore: 91,
    model3dPreset: 'auto',
    model3dUrl: '',
    finishHex: '#D4AF37',
    isDemoData: true,
    dataSourceLabel: 'Seeded Demonstration Record',
    createdAt: now,
    updatedAt: now,
    primaryImage: '',
    images: [],
    specifications: [],
    ...overrides,
  } as unknown as ProductDTO;
}

const supported = makeProduct({});
const unsupported = makeProduct({
  id: 2,
  name: 'Unmapped Category Item',
  slug: 'unmapped-category-item',
  categorySlug: 'no-such-category',
  categoryName: 'Unmapped',
  finishHex: '#B8C0CC',
});

function simulateDrag() {
  const host = document.querySelector('[role="application"]') as HTMLElement | null;
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const base = {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    clientY: rect.top + rect.height / 2,
  };
  host.dispatchEvent(new PointerEvent('pointerdown', { ...base, clientX: rect.left + 100 }));
  host.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX: rect.left + 160 }));
  host.dispatchEvent(new PointerEvent('pointerup', { ...base, clientX: rect.left + 160 }));
}

function Harness() {
  return (
    <div className="min-h-screen bg-black p-6 text-slate-200">
      <h1 className="text-2xl font-semibold text-gold-400">P3 3D verification harness</h1>
      <button
        type="button"
        onClick={simulateDrag}
        className="mt-4 rounded-full border border-gold-500/40 px-4 py-2 text-sm text-gold-300"
      >
        Simulate drag
      </button>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm uppercase tracking-widest text-slate-400">Supported product</h2>
          <div className="max-w-md">
            <Product3DViewer product={supported} variant="detail" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm uppercase tracking-widest text-slate-400">Unsupported product</h2>
          <div className="max-w-md">
            <Product3DViewer product={unsupported} variant="detail" />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm uppercase tracking-widest text-slate-400">Card variant</h2>
          <div className="max-w-sm">
            <Product3DViewer product={supported} variant="card" />
          </div>
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Harness />);
