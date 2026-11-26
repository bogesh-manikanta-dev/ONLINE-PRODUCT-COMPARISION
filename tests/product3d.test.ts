import { describe, expect, it } from 'vitest';
import {
  CATEGORY_GEOMETRY,
  DEFAULT_FINISH_HEX,
  FALLBACK_TEXT,
  FINISH_MATERIALS,
  KEY_ROTATION_STEP,
  MAX_TILT,
  MIN_TILT,
  STUDIO_MODEL_NOTE,
  SUPPORTED_PRESETS,
  clampTilt,
  decideRender,
  finishVariants,
  normalizeDegrees,
  normalizeFinishHex,
  resolveProductViewer,
  rotateByKey,
  tiltByKey,
} from '../src/lib/product3d.ts';

describe('P3 3D presentation logic', () => {
  describe('finish colour normalisation', () => {
    it('keeps a valid six-digit hex and upper-cases it', () => {
      expect(normalizeFinishHex('#d4af37')).toBe('#D4AF37');
      expect(normalizeFinishHex('  #112233  ')).toBe('#112233');
    });

    it('expands three-digit shorthand', () => {
      expect(normalizeFinishHex('#abc')).toBe('#AABBCC');
    });

    it('falls back to design-system gold for malformed or missing values', () => {
      expect(normalizeFinishHex(undefined)).toBe(DEFAULT_FINISH_HEX);
      expect(normalizeFinishHex(null)).toBe(DEFAULT_FINISH_HEX);
      expect(normalizeFinishHex('')).toBe(DEFAULT_FINISH_HEX);
      expect(normalizeFinishHex('gold')).toBe(DEFAULT_FINISH_HEX);
      expect(normalizeFinishHex('#12345')).toBe(DEFAULT_FINISH_HEX);
      expect(normalizeFinishHex('#gggggg')).toBe(DEFAULT_FINISH_HEX);
    });
  });

  describe('viewer resolution', () => {
    it('honours an explicit supported preset before the category', () => {
      const result = resolveProductViewer({
        model3dPreset: 'headphones',
        categorySlug: 'laptops',
        finishHex: '#111111',
      });
      expect(result).toMatchObject({
        supported: true,
        geometry: 'headphones',
        source: 'preset',
        finishHex: '#111111',
      });
    });

    it('derives geometry from the category when the preset is the schema default "auto"', () => {
      const result = resolveProductViewer({ model3dPreset: 'auto', categorySlug: 'smartphones' });
      expect(result.supported).toBe(true);
      expect(result.geometry).toBe('phone');
      expect(result.source).toBe('category');
    });

    it('is unsupported when neither preset nor category can be mapped', () => {
      const result = resolveProductViewer({
        model3dPreset: 'unknown-preset',
        categorySlug: 'not-a-category',
      });
      expect(result.supported).toBe(false);
      expect(result.geometry).toBeNull();
      expect(result.source).toBe('none');
    });

    it('does not treat a model URL as renderable (no fabricated manufacturer assets)', () => {
      const result = resolveProductViewer({
        model3dPreset: 'auto',
        model3dUrl: 'https://example.com/model.glb',
        categorySlug: 'mystery',
      } as { model3dPreset?: string; categorySlug?: string });
      expect(result.supported).toBe(false);
    });
  });

  describe('catalogue integrity', () => {
    it('maps every category to an implemented geometry preset', () => {
      for (const [category, geometry] of Object.entries(CATEGORY_GEOMETRY)) {
        expect(SUPPORTED_PRESETS, `category "${category}"`).toContain(geometry);
      }
    });

    it('has no duplicate presets in the supported list', () => {
      expect(new Set(SUPPORTED_PRESETS).size).toBe(SUPPORTED_PRESETS.length);
    });
  });

  describe('capability decisions', () => {
    it('disables rendering without a WebGL context', () => {
      expect(decideRender({ webgl: false, reducedMotion: false })).toEqual({
        enabled: false,
        reason: 'no-webgl',
      });
    });

    it('respects reduced motion unless the user opts in', () => {
      expect(decideRender({ webgl: true, reducedMotion: true })).toEqual({
        enabled: false,
        reason: 'reduced-motion',
      });
      expect(decideRender({ webgl: true, reducedMotion: true }, { userInitiated: true })).toEqual({
        enabled: true,
        reason: 'ok',
      });
    });

    it('enables rendering on a capable device', () => {
      expect(decideRender({ webgl: true, reducedMotion: false })).toEqual({
        enabled: true,
        reason: 'ok',
      });
    });
  });

  describe('keyboard rotation', () => {
    it('rotates by the documented step', () => {
      expect(rotateByKey(0, 'ArrowRight')).toBe(KEY_ROTATION_STEP);
      expect(rotateByKey(KEY_ROTATION_STEP, 'ArrowLeft')).toBe(0);
    });

    it('wraps around 360 degrees in both directions', () => {
      expect(rotateByKey(0, 'ArrowLeft')).toBe(360 - KEY_ROTATION_STEP);
      expect(rotateByKey(350, 'ArrowRight')).toBe(5);
    });

    it('resets on Home and ignores unrelated keys', () => {
      expect(rotateByKey(215, 'Home')).toBe(0);
      expect(rotateByKey(215, 'Tab')).toBeNull();
      expect(rotateByKey(215, 'a')).toBeNull();
    });

    it('normalises out-of-range and non-finite angles', () => {
      expect(normalizeDegrees(-15)).toBe(345);
      expect(normalizeDegrees(360)).toBe(0);
      expect(normalizeDegrees(725)).toBe(5);
      expect(normalizeDegrees(Number.NaN)).toBe(0);
    });
  });

  describe('tilt limits', () => {
    it('clamps tilt inside the documented range', () => {
      expect(clampTilt(-999)).toBe(MIN_TILT);
      expect(clampTilt(999)).toBe(MAX_TILT);
      expect(clampTilt(0)).toBe(0);
      expect(clampTilt(Number.NaN)).toBe(0);
    });

    it('moves tilt with the vertical arrow keys only', () => {
      expect(tiltByKey(0, 'ArrowUp')).toBeLessThan(0);
      expect(tiltByKey(0, 'ArrowDown')).toBeGreaterThan(0);
      expect(tiltByKey(0, 'ArrowLeft')).toBeNull();
    });
  });

  describe('finish variants', () => {
    it('exposes three deterministic treatments anchored on the recorded finish', () => {
      const variants = finishVariants('#D4AF37');
      expect(variants).toHaveLength(3);
      expect(variants[0]).toMatchObject({ id: 'polished', hex: '#D4AF37' });
      expect(variants.map((v) => v.id)).toEqual(['polished', 'brushed', 'matte']);
      expect(finishVariants('#D4AF37')).toEqual(variants);
    });

    it('always yields valid hex colours with a matching material spec', () => {
      for (const base of ['#D4AF37', '#0A0A0A', '#FFFFFF', 'bad-value']) {
        for (const variant of finishVariants(base)) {
          expect(variant.hex).toMatch(/^#[0-9A-F]{6}$/);
          expect(FINISH_MATERIALS[variant.id]).toBeDefined();
        }
      }
    });

    it('keeps treatments visually distinct from one another', () => {
      const hexes = finishVariants('#808080').map((variant) => variant.hex);
      expect(new Set(hexes).size).toBe(3);
    });
  });

  describe('honest disclosure', () => {
    it('states that simulated models are not manufacturer assets', () => {
      expect(STUDIO_MODEL_NOTE).toMatch(/not a manufacturer/i);
    });

    it('provides fallback copy that does not promise 3D', () => {
      expect(FALLBACK_TEXT).toMatch(/not available/i);
      expect(FALLBACK_TEXT.toLowerCase()).not.toContain('official');
    });
  });
});
