/**
 * CompareX — 3D studio presentation logic (P3).
 *
 * Pure, DOM-free helpers that decide *what* the 3D layer is allowed to show for a
 * product. Keeping this logic separate from the WebGL component means the
 * support/fallback rules are unit-testable without a browser or a GPU.
 *
 * Honesty rules encoded here (and asserted by tests):
 * - Every model is a procedural studio approximation built from the product's own
 *   recorded attributes. Nothing is presented as an official manufacturer asset.
 * - A product only claims 3D support when we can actually derive geometry for it.
 */

/** Metallic gold that the schema and design system use as the default finish. */
export const DEFAULT_FINISH_HEX = '#D4AF37';

export type StudioGeometry =
  | 'phone'
  | 'laptop'
  | 'television'
  | 'headphones'
  | 'watch'
  | 'appliance'
  | 'purifier'
  | 'vacuum'
  | 'bag'
  | 'footwear'
  | 'furniture'
  | 'abstract';

/** Geometry presets the renderer actually implements. Anything else falls back. */
export const SUPPORTED_PRESETS: readonly StudioGeometry[] = [
  'phone',
  'laptop',
  'television',
  'headphones',
  'watch',
  'appliance',
  'purifier',
  'vacuum',
  'bag',
  'footwear',
  'furniture',
  'abstract',
];

/**
 * Fallback mapping from a catalogue category to a geometry preset. Used when a
 * product carries the schema default preset (`auto`) or an unsupported value.
 */
export const CATEGORY_GEOMETRY: Readonly<Record<string, StudioGeometry>> = {
  smartphones: 'phone',
  laptops: 'laptop',
  televisions: 'television',
  headphones: 'headphones',
  smartwatches: 'watch',
  watches: 'watch',
  refrigerators: 'appliance',
  'washing-machines': 'appliance',
  'air-conditioners': 'appliance',
  microwaves: 'appliance',
  'kitchen-appliances': 'appliance',
  'personal-care': 'appliance',
  'vacuum-cleaners': 'vacuum',
  'air-purifiers': 'purifier',
  bags: 'bag',
  footwear: 'footwear',
  clothing: 'abstract',
  furniture: 'furniture',
};

export interface ViewerResolution {
  /** True only when a geometry preset can be derived for this product. */
  supported: boolean;
  geometry: StudioGeometry | null;
  /** Validated #rrggbb finish colour derived from the recorded `finishHex`. */
  finishHex: string;
  /** Where the geometry decision came from — useful for diagnostics and tests. */
  source: 'preset' | 'category' | 'none';
}

/**
 * Accepts `#abc` or `#aabbcc` (any case) and expands it. Anything malformed
 * falls back to the design-system gold rather than rendering a broken model.
 */
export function normalizeFinishHex(value?: string | null): string {
  if (typeof value !== 'string') return DEFAULT_FINISH_HEX;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return DEFAULT_FINISH_HEX;
}

function isSupportedPreset(value: string): value is StudioGeometry {
  return (SUPPORTED_PRESETS as readonly string[]).includes(value);
}

/**
 * Resolves how a product should be rendered in 3D.
 *
 * Precedence: an explicit supported `model3dPreset` wins, then the category
 * mapping. `model3dUrl` is deliberately NOT treated as renderable: this build
 * ships no manufacturer CAD assets, and loading a remote model would let an
 * absent or untrusted asset break the viewer. Such products fall through to the
 * gallery fallback instead of showing a broken placeholder.
 */
export function resolveProductViewer(input: {
  model3dPreset?: string | null;
  categorySlug?: string | null;
  finishHex?: string | null;
}): ViewerResolution {
  const finishHex = normalizeFinishHex(input.finishHex);
  const preset = (input.model3dPreset ?? '').trim().toLowerCase();

  if (preset && isSupportedPreset(preset)) {
    return { supported: true, geometry: preset, finishHex, source: 'preset' };
  }

  const category = (input.categorySlug ?? '').trim().toLowerCase();
  const fromCategory = CATEGORY_GEOMETRY[category];
  if (fromCategory) {
    return { supported: true, geometry: fromCategory, finishHex, source: 'category' };
  }

  return { supported: false, geometry: null, finishHex, source: 'none' };
}

export interface RenderCapabilities {
  /** Whether a WebGL context could actually be created. */
  webgl: boolean;
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
}

export interface RenderDecision {
  enabled: boolean;
  reason: 'ok' | 'no-webgl' | 'reduced-motion';
}

/**
 * Decides whether the canvas may be mounted automatically.
 *
 * Reduced motion is respected by *not* auto-mounting; the user can still opt in
 * explicitly (`userInitiated`), in which case motion is user-driven only.
 */
export function decideRender(
  caps: RenderCapabilities,
  options: { userInitiated?: boolean } = {}
): RenderDecision {
  if (!caps.webgl) return { enabled: false, reason: 'no-webgl' };
  if (caps.reducedMotion && !options.userInitiated) {
    return { enabled: false, reason: 'reduced-motion' };
  }
  return { enabled: true, reason: 'ok' };
}

/** Degrees of yaw applied per arrow-key press. */
export const KEY_ROTATION_STEP = 15;

export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Keyboard yaw control. Returns the next yaw in degrees, or null when the key is
 * not a rotation key (so callers can leave the event alone).
 */
export function rotateByKey(currentYaw: number, key: string, step = KEY_ROTATION_STEP): number | null {
  switch (key) {
    case 'ArrowLeft':
      return normalizeDegrees(currentYaw - step);
    case 'ArrowRight':
      return normalizeDegrees(currentYaw + step);
    case 'Home':
    case 'Escape':
      return 0;
    default:
      return null;
  }
}

/** Vertical tilt limits so the model can never be flipped under the floor. */
export const MIN_TILT = -18;
export const MAX_TILT = 22;

export function clampTilt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_TILT, Math.max(MIN_TILT, value));
}

export function tiltByKey(currentTilt: number, key: string, step = 6): number | null {
  switch (key) {
    case 'ArrowUp':
      return clampTilt(currentTilt - step);
    case 'ArrowDown':
      return clampTilt(currentTilt + step);
    default:
      return null;
  }
}

export interface FinishVariant {
  id: string;
  label: string;
  hex: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeFinishHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function toHex(value: number): string {
  const clamped = Math.min(255, Math.max(0, Math.round(value)));
  return clamped.toString(16).padStart(2, '0').toUpperCase();
}

function shift(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${toHex(r + amount)}${toHex(g + amount)}${toHex(b + amount)}`;
}

/**
 * Derives the finish treatments shown as swatches. These are *presentation*
 * variants of the single recorded `finishHex` — they are not separate SKUs, and
 * the UI labels them as treatments so nothing is misrepresented.
 */
export function finishVariants(baseHex?: string | null): FinishVariant[] {
  const base = normalizeFinishHex(baseHex);
  return [
    { id: 'polished', label: 'Polished', hex: base },
    { id: 'brushed', label: 'Brushed', hex: shift(base, -14) },
    { id: 'matte', label: 'Matte', hex: shift(base, 18) },
  ];
}

/** Roughness/metalness per treatment, used by the renderer's materials. */
export const FINISH_MATERIALS: Readonly<Record<string, { metalness: number; roughness: number }>> = {
  polished: { metalness: 0.92, roughness: 0.18 },
  brushed: { metalness: 0.85, roughness: 0.42 },
  matte: { metalness: 0.35, roughness: 0.78 },
};

/** Shown in the viewer chrome so no simulated model is mistaken for a real one. */
export const STUDIO_MODEL_NOTE =
  'Interactive studio approximation built from this product’s recorded specification and finish — not a manufacturer CAD or official brand asset.';

export const FALLBACK_TEXT =
  'A 3D studio preview is not available for this product. The gallery images remain fully interactive.';
