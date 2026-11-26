import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import type * as ThreeTypes from 'three';
import type { ProductDTO } from '../../shared/types.ts';
import {
  FALLBACK_TEXT,
  FINISH_MATERIALS,
  STUDIO_MODEL_NOTE,
  clampTilt,
  decideRender,
  finishVariants,
  normalizeDegrees,
  resolveProductViewer,
  rotateByKey,
  tiltByKey,
  type StudioGeometry,
} from '../lib/product3d.ts';

type MeshStandard = ThreeTypes.MeshStandardMaterial;
type RoundedBoxCtor = new (
  width: number,
  height: number,
  depth: number,
  segments?: number,
  radius?: number
) => ThreeTypes.BufferGeometry;

export interface Product3DViewerProps {
  product: ProductDTO;
  /** `card` renders a compact, interaction-on-demand preview; `detail` the full studio. */
  variant?: 'card' | 'detail';
  className?: string;
}

function detectWebGL(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const ctx =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return Boolean(ctx);
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Builds the procedural studio model for a geometry preset. */
function buildModel(
  THREE: typeof import('three'),
  geometry: StudioGeometry,
  RoundedBox: RoundedBoxCtor | null,
  body: MeshStandard,
  gold: MeshStandard,
  screen: MeshStandard
): ThreeTypes.Group {
  const group = new THREE.Group();
  const box = (w: number, h: number, d: number, r = 0.06) =>
    RoundedBox ? new RoundedBox(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
  const mesh = (geo: ThreeTypes.BufferGeometry, mat: MeshStandard) => {
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    return m;
  };

  switch (geometry) {
    case 'phone': {
      mesh(box(0.92, 1.86, 0.1, 0.09), body);
      const glass = mesh(new THREE.PlaneGeometry(0.82, 1.74), screen);
      glass.position.z = 0.056;
      const bump = mesh(box(0.4, 0.4, 0.035, 0.02), body);
      bump.position.set(-0.2, 0.66, 0.06);
      for (const [x, y] of [
        [-0.28, 0.74],
        [-0.12, 0.74],
        [-0.28, 0.58],
      ]) {
        const lens = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24), screen);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(x, y, 0.085);
      }
      const trim = mesh(new THREE.TorusGeometry(0.455, 0.012, 8, 64), gold);
      trim.scale.set(1, 2.03, 1);
      break;
    }
    case 'laptop': {
      const base = mesh(box(1.92, 0.09, 1.28, 0.04), body);
      base.position.y = -0.28;
      const keys = mesh(new THREE.PlaneGeometry(1.6, 0.72), screen);
      keys.rotation.x = -Math.PI / 2;
      keys.position.set(0, -0.226, 0.05);
      const lid = mesh(box(1.92, 1.22, 0.055, 0.04), body);
      lid.position.set(0, 0.36, -0.62);
      lid.rotation.x = -0.28;
      const display = mesh(new THREE.PlaneGeometry(1.72, 1.02), screen);
      display.position.set(0, 0.36, -0.588);
      display.rotation.x = -0.28;
      break;
    }
    case 'television': {
      mesh(box(2.24, 1.28, 0.06, 0.03), body);
      const panel = mesh(new THREE.PlaneGeometry(2.1, 1.14), screen);
      panel.position.z = 0.036;
      const neck = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 20), gold);
      neck.position.y = -0.83;
      const foot = mesh(box(0.72, 0.05, 0.36, 0.02), body);
      foot.position.y = -1.02;
      break;
    }
    case 'headphones': {
      const band = mesh(new THREE.TorusGeometry(0.62, 0.062, 16, 64, Math.PI), body);
      band.position.y = 0.18;
      for (const sign of [-1, 1]) {
        const cup = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 40), body);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(sign * 0.62, 0.14, 0);
        const pad = mesh(new THREE.TorusGeometry(0.26, 0.075, 12, 40), gold);
        pad.rotation.y = Math.PI / 2;
        pad.position.set(sign * 0.53, 0.14, 0);
      }
      break;
    }
    case 'watch': {
      const caseMesh = mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 48), body);
      caseMesh.rotation.x = Math.PI / 2;
      const face = mesh(new THREE.CircleGeometry(0.37, 48), screen);
      face.position.z = 0.085;
      const bezel = mesh(new THREE.TorusGeometry(0.4, 0.028, 12, 56), gold);
      bezel.position.z = 0.075;
      for (const sign of [-1, 1]) {
        const strap = mesh(box(0.42, 0.78, 0.09, 0.045), body);
        strap.position.set(0, sign * 0.86, 0);
      }
      break;
    }
    case 'appliance': {
      mesh(box(1.4, 1.9, 1.24, 0.07), body);
      const door = mesh(box(1.24, 1.5, 0.05, 0.03), screen);
      door.position.set(0, 0.06, 0.63);
      const handle = mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 16), gold);
      handle.position.set(0.5, 0.06, 0.7);
      const kick = mesh(box(1.3, 0.06, 0.06, 0.02), gold);
      kick.position.set(0, -0.9, 0.63);
      break;
    }
    case 'purifier': {
      const tower = mesh(new THREE.CylinderGeometry(0.52, 0.56, 1.5, 48), body);
      const top = mesh(new THREE.TorusGeometry(0.5, 0.045, 12, 56), gold);
      top.rotation.x = Math.PI / 2;
      top.position.y = 0.75;
      for (let i = 0; i < 7; i += 1) {
        const vent = mesh(box(0.9, 0.022, 0.03, 0.01), screen);
        vent.position.set(0, 0.3 - i * 0.09, 0.545);
      }
      break;
    }
    case 'vacuum': {
      const canister = mesh(new THREE.SphereGeometry(0.52, 40, 28), body);
      canister.position.y = -0.34;
      canister.scale.set(1.15, 0.95, 1);
      const wand = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.5, 20), gold);
      wand.position.set(0.34, 0.44, 0);
      wand.rotation.z = -0.22;
      const handle = mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 40, Math.PI), body);
      handle.position.set(0.06, 1.16, 0);
      break;
    }
    case 'bag': {
      mesh(box(1.34, 1.02, 0.56, 0.1), body);
      const handle = mesh(new THREE.TorusGeometry(0.3, 0.045, 12, 48, Math.PI), gold);
      handle.position.y = 0.5;
      const clasp = mesh(box(0.18, 0.1, 0.06, 0.02), gold);
      clasp.position.set(0, 0.12, 0.3);
      const band = mesh(box(1.36, 0.05, 0.58, 0.01), gold);
      band.position.y = -0.2;
      break;
    }
    case 'footwear': {
      const sole = mesh(box(1.9, 0.16, 0.72, 0.07), gold);
      sole.position.y = -0.34;
      const upper = mesh(box(1.62, 0.5, 0.64, 0.14), body);
      upper.position.set(-0.06, -0.05, 0);
      const heel = mesh(box(0.46, 0.46, 0.6, 0.1), body);
      heel.position.set(-0.66, 0.12, 0);
      for (let i = 0; i < 3; i += 1) {
        const lace = mesh(box(0.42, 0.03, 0.5, 0.01), gold);
        lace.position.set(0.28 + i * 0.16, 0.2, 0);
      }
      break;
    }
    case 'furniture': {
      const seat = mesh(box(1.6, 0.16, 1.2, 0.05), body);
      seat.position.y = 0.05;
      const back = mesh(box(1.6, 1.0, 0.16, 0.05), body);
      back.position.set(0, 0.6, -0.52);
      for (const [x, z] of [
        [-0.66, -0.44],
        [0.66, -0.44],
        [-0.66, 0.44],
        [0.66, 0.44],
      ]) {
        const leg = mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.62, 16), gold);
        leg.position.set(x, -0.34, z);
      }
      break;
    }
    default: {
      const knot = mesh(new THREE.TorusKnotGeometry(0.52, 0.17, 128, 24), gold);
      knot.rotation.x = 0.4;
      const core = mesh(new THREE.IcosahedronGeometry(0.3, 1), body);
      break;
    }
  }

  return group;
}

export function Product3DViewer({ product, variant = 'detail', className = '' }: Product3DViewerProps) {
  const resolution = useMemo(
    () =>
      resolveProductViewer({
        model3dPreset: product.model3dPreset,
        categorySlug: product.categorySlug,
        finishHex: product.finishHex,
      }),
    [product.model3dPreset, product.categorySlug, product.finishHex]
  );

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [finishId, setFinishId] = useState('polished');
  const [spin, setSpin] = useState(variant === 'detail');
  const [yawLabel, setYawLabel] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const invalidateRef = useRef<(() => void) | null>(null);
  const applyRef = useRef<((yaw: number, tilt: number) => void) | null>(null);
  const bodyMaterialsRef = useRef<MeshStandard[]>([]);
  const spinRef = useRef(spin);
  const yawRef = useRef(0);
  const tiltRef = useRef(0);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const describedBy = useId();

  const finishOptions = useMemo(() => finishVariants(product.finishHex), [product.finishHex]);

  useEffect(() => {
    setWebgl(detectWebGL());
    const initial = prefersReducedMotion();
    setReducedMotion(initial);
    if (initial) setSpin(false);

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) setSpin(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    spinRef.current = spin;
    invalidateRef.current?.();
  }, [spin]);

  const decision = decideRender(
    { webgl: webgl === true, reducedMotion },
    { userInitiated: optedIn }
  );
  const mounted = resolution.supported && decision.enabled;

  // Scene lifecycle — three.js is imported on demand so it never enters the main bundle.
  useEffect(() => {
    if (!mounted) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | null = null;
    setStatus('loading');

    const boot = async () => {
      try {
        const THREE = await import('three');
        let RoundedBox: RoundedBoxCtor | null = null;
        try {
          const mod = await import('three/examples/jsm/geometries/RoundedBoxGeometry.js');
          RoundedBox = mod.RoundedBoxGeometry as unknown as RoundedBoxCtor;
        } catch {
          RoundedBox = null;
        }
        if (disposed) return;

        const dprCap = variant === 'card' ? 1.5 : 2;
        const renderer = new THREE.WebGLRenderer({
          antialias: (window.devicePixelRatio || 1) <= 1.5,
          alpha: true,
          powerPreference: 'low-power',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;display:block;';
        host.insertBefore(renderer.domElement, host.firstChild);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        camera.position.set(0, variant === 'card' ? 0.5 : 0.62, variant === 'card' ? 5.6 : 4.9);
        camera.lookAt(0, 0, 0);

        const pmrem = new THREE.PMREMGenerator(renderer);
        try {
          const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
          const envScene = new RoomEnvironment();
          const envTarget = pmrem.fromScene(envScene, 0.05);
          scene.environment = envTarget.texture;
          envScene.dispose?.();
        } catch {
          // Env reflections are an enhancement; direct lighting below still carries the model.
        }

        scene.add(new THREE.AmbientLight(0xfff3da, 0.55));
        const key = new THREE.DirectionalLight(0xfff1c9, 2.6);
        key.position.set(3.2, 4.2, 4.6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xd4af37, 3.1);
        rim.position.set(-4.2, 1.6, -3.4);
        scene.add(rim);
        const fill = new THREE.DirectionalLight(0x8fa6ff, 0.75);
        fill.position.set(-2.4, -1.2, 3.2);
        scene.add(fill);

        const body = new THREE.MeshStandardMaterial({
          color: new THREE.Color(finishOptions[0].hex),
          metalness: FINISH_MATERIALS.polished.metalness,
          roughness: FINISH_MATERIALS.polished.roughness,
          envMapIntensity: 1.15,
        });
        const gold = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#D4AF37'),
          metalness: 1,
          roughness: 0.22,
          envMapIntensity: 1.3,
        });
        const screen = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#08080b'),
          metalness: 0.25,
          roughness: 0.14,
          emissive: new THREE.Color('#2a2109'),
          emissiveIntensity: 0.55,
        });
        bodyMaterialsRef.current = [body];

        const model = buildModel(THREE, resolution.geometry ?? 'abstract', RoundedBox, body, gold, screen);
        scene.add(model);

        const floor = new THREE.Mesh(
          new THREE.CircleGeometry(3.1, 64),
          new THREE.MeshBasicMaterial({ color: 0x07070a, transparent: true, opacity: 0.6 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -1.06;
        scene.add(floor);

        const halo = new THREE.Mesh(
          new THREE.RingGeometry(1.5, 1.515, 96),
          new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.34 })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = -1.05;
        scene.add(halo);

        const apply = (yaw: number, tilt: number) => {
          model.rotation.y = THREE.MathUtils.degToRad(yaw);
          model.rotation.x = THREE.MathUtils.degToRad(tilt);
        };
        applyRef.current = apply;

        let dirty = true;
        const invalidate = () => {
          dirty = true;
        };
        invalidateRef.current = invalidate;

        const resize = () => {
          const w = host.clientWidth || 1;
          const h = host.clientHeight || 1;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          invalidate();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();

        let visible = true;
        const io = new IntersectionObserver(
          (entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            if (visible) invalidate();
          },
          { threshold: 0.01 }
        );
        io.observe(host);

        let frame = 0;
        const tick = () => {
          frame = requestAnimationFrame(tick);
          if (!visible || disposed) return;
          if (spinRef.current && !dragRef.current) {
            yawRef.current = normalizeDegrees(yawRef.current + 0.35);
            apply(yawRef.current, tiltRef.current);
            dirty = true;
          }
          if (!dirty) return;
          dirty = false;
          renderer.render(scene, camera);
        };
        tick();
        apply(yawRef.current, tiltRef.current);
        setStatus('ready');

        cleanup = () => {
          cancelAnimationFrame(frame);
          ro.disconnect();
          io.disconnect();
          invalidateRef.current = null;
          applyRef.current = null;
          bodyMaterialsRef.current = [];
          scene.traverse((obj) => {
            const m = obj as ThreeTypes.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as ThreeTypes.Material | ThreeTypes.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((entry) => entry.dispose());
            else mat?.dispose();
          });
          pmrem.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
        };
      } catch {
        if (!disposed) setStatus('error');
      }
    };

    void boot();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [mounted, resolution.geometry, product.id, variant, finishOptions]);

  // Finish changes only retint existing materials — no scene rebuild.
  useEffect(() => {
    const variantSpec = finishOptions.find((option) => option.id === finishId) ?? finishOptions[0];
    const materialSpec = FINISH_MATERIALS[variantSpec.id] ?? FINISH_MATERIALS.polished;
    for (const material of bodyMaterialsRef.current) {
      material.color.set(variantSpec.hex);
      material.metalness = materialSpec.metalness;
      material.roughness = materialSpec.roughness;
    }
    invalidateRef.current?.();
  }, [finishId, finishOptions]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const nextYaw = rotateByKey(yawRef.current, event.key);
    const nextTilt = tiltByKey(tiltRef.current, event.key);
    if (nextYaw === null && nextTilt === null) return;
    event.preventDefault();
    if (nextYaw !== null) {
      yawRef.current = nextYaw;
      setYawLabel(nextYaw);
    }
    if (nextTilt !== null) tiltRef.current = nextTilt;
    applyRef.current?.(yawRef.current, tiltRef.current);
    invalidateRef.current?.();
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (status !== 'ready') return;
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    yawRef.current = normalizeDegrees(yawRef.current + dx * 0.45);
    tiltRef.current = clampTilt(tiltRef.current + dy * 0.16);
    applyRef.current?.(yawRef.current, tiltRef.current);
    invalidateRef.current?.();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setYawLabel(Math.round(yawRef.current));
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const resetView = () => {
    yawRef.current = 0;
    tiltRef.current = 0;
    setYawLabel(0);
    applyRef.current?.(0, 0);
    invalidateRef.current?.();
  };

  const frameClass =
    variant === 'card'
      ? 'h-full w-full bg-gradient-to-b from-[#151518] via-[#0b0b0d] to-black'
      : 'aspect-square w-full rounded-3xl border border-white/10 bg-gradient-to-b from-[#17171b] via-[#0b0b0d] to-black';

  const fallbackReason =
    !resolution.supported
      ? FALLBACK_TEXT
      : decision.reason === 'no-webgl'
        ? 'This browser or device cannot create a WebGL context, so the 3D studio preview is unavailable. The gallery images remain fully interactive.'
        : 'Reduced-motion is enabled on this device. The 3D preview is paused to respect that setting.';

  const showFallback = !mounted && !(resolution.supported && decision.reason === 'reduced-motion');

  if (showFallback) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#141417] to-black p-4 text-center ${frameClass} ${className}`}
      >
        {product.primaryImage ? (
          <img
            src={product.primaryImage}
            alt={`${product.name} product image`}
            className="max-h-full max-w-full rounded-xl object-contain opacity-90"
            loading="lazy"
          />
        ) : (
          <Box className="h-8 w-8 text-gold-400" aria-hidden="true" />
        )}
        {variant === 'detail' && (
          <p className="text-[11px] leading-relaxed text-slate-400">{fallbackReason}</p>
        )}
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#141417] to-black p-6 text-center ${frameClass} ${className}`}
      >
        <Sparkles className="h-7 w-7 text-gold-400" aria-hidden="true" />
        <p className="max-w-xs text-xs leading-relaxed text-slate-400">{fallbackReason}</p>
        <button
          type="button"
          onClick={() => setOptedIn(true)}
          className="rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-xs font-medium text-gold-300 transition hover:bg-gold-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          Load 3D preview anyway
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={hostRef}
        role="application"
        tabIndex={0}
        aria-label={`${product.name} 3D studio viewer. Drag to rotate, or use the left and right arrow keys.`}
        aria-describedby={describedBy}
        onKeyDown={handleKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${frameClass} ${status === 'ready' ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.16),transparent_62%)]" />

        {status !== 'ready' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-gold-300">
            {status === 'error' ? (
              <>
                <Box className="h-6 w-6" aria-hidden="true" />
                <p className="px-6 text-center text-[11px] text-slate-400">
                  The 3D preview could not start on this device. Gallery images are still available.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <p className="text-[11px] tracking-wide text-slate-400">Rendering studio model…</p>
              </>
            )}
          </div>
        )}

        {status === 'ready' && variant === 'detail' && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSpin((value) => !value)}
              aria-pressed={spin}
              className="rounded-full border border-white/15 bg-black/60 p-1.5 text-gold-300 backdrop-blur transition hover:border-gold-400/50 hover:text-gold-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              title={spin ? 'Pause auto-rotation' : 'Start auto-rotation'}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{spin ? 'Pause auto-rotation' : 'Start auto-rotation'}</span>
            </button>
            <button
              type="button"
              onClick={resetView}
              className="rounded-full border border-white/15 bg-black/60 p-1.5 text-gold-300 backdrop-blur transition hover:border-gold-400/50 hover:text-gold-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
              title="Reset view"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Reset view</span>
            </button>
          </div>
        )}

        {variant === 'detail' && status === 'ready' && (
          <div className="absolute bottom-3 left-3 z-20 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-medium tracking-wide text-slate-300 backdrop-blur">
            <span className="text-gold-300">{yawLabel}°</span> · drag or arrow keys
          </div>
        )}
      </div>

      <p id={describedBy} className="sr-only">
        {STUDIO_MODEL_NOTE}
      </p>

      {variant === 'detail' && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
              Finish
            </span>
            {finishOptions.map((option) => {
              const active = option.id === finishId;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFinishId(option.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
                    active
                      ? 'border-gold-400/60 bg-gold-400/10 text-gold-200'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/20"
                    style={{ backgroundColor: option.hex }}
                    aria-hidden="true"
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">{STUDIO_MODEL_NOTE}</p>
        </div>
      )}
    </div>
  );
}
