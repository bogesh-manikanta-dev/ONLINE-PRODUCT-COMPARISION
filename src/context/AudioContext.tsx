import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface AudioContextValue {
  muted: boolean;
  volume: number;
  ambientEnabled: boolean;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  toggleAmbient: () => void;
  stopAmbient: () => void;
  playCue: (type: 'nav' | 'compare' | 'brand' | 'cart' | 'success' | 'error') => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = useState(true); // Muted by default per UX requirement
  const [volume, setVolumeState] = useState(0.35);
  const [ambientEnabled, setAmbientEnabled] = useState(false);

  const webAudioRef = useRef<AudioContext | null>(null);
  const ambientNodesRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode } | null>(null);

  const getContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!webAudioRef.current) {
      webAudioRef.current = new Ctor();
    }
    if (webAudioRef.current.state === 'suspended') {
      webAudioRef.current.resume().catch(() => {});
    }
    return webAudioRef.current;
  }, []);

  const stopAmbient = useCallback(() => {
    const active = ambientNodesRef.current;
    const ctx = webAudioRef.current;
    if (!active || !ctx) return;
    try {
      const now = ctx.currentTime;
      active.gain.gain.setTargetAtTime(0.0001, now, 0.12);
      setTimeout(() => {
        try {
          active.osc1.stop();
          active.osc2.stop();
          active.osc1.disconnect();
          active.osc2.disconnect();
          active.gain.disconnect();
        } catch {
          // ignore
        }
      }, 300);
    } catch {
      // ignore
    }
    ambientNodesRef.current = null;
    setAmbientEnabled(false);
  }, []);

  const startAmbient = useCallback(() => {
    if (muted) return;
    const ctx = getContext();
    if (!ctx || ambientNodesRef.current) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.value = 110; // A2 subtle pad
    osc2.type = 'triangle';
    osc2.frequency.value = 164.81; // E3 fifth harmonic

    filter.type = 'lowpass';
    filter.frequency.value = 340;

    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(Math.max(0.01, volume * 0.045), ctx.currentTime, 0.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    ambientNodesRef.current = { osc1, osc2, gain };
    setAmbientEnabled(true);
  }, [getContext, muted, volume]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) {
        stopAmbient();
      }
      return next;
    });
  }, [stopAmbient]);

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      setVolumeState(clamped);
      if (ambientNodesRef.current && webAudioRef.current && !muted) {
        ambientNodesRef.current.gain.gain.setTargetAtTime(
          Math.max(0.005, clamped * 0.045),
          webAudioRef.current.currentTime,
          0.1
        );
      }
    },
    [muted]
  );

  const toggleAmbient = useCallback(() => {
    if (ambientEnabled) {
      stopAmbient();
    } else {
      if (muted) setMuted(false);
      setTimeout(() => {
        const ctx = getContext();
        if (ctx && !ambientNodesRef.current) {
          startAmbient();
        }
      }, 30);
    }
  }, [ambientEnabled, getContext, muted, startAmbient, stopAmbient]);

  const playCue = useCallback(
    (type: 'nav' | 'compare' | 'brand' | 'cart' | 'success' | 'error') => {
      if (muted || volume <= 0.01) return;
      const ctx = getContext();
      if (!ctx) return;

      const playTone = (freq: number, startOffset: number, duration: number, oscType: OscillatorType, gainScale: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + startOffset;
        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(volume * gainScale, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      };

      switch (type) {
        case 'nav':
          playTone(520, 0, 0.07, 'sine', 0.07);
          break;
        case 'brand':
          playTone(440, 0, 0.11, 'sine', 0.08);
          playTone(659.25, 0.05, 0.14, 'sine', 0.07);
          break;
        case 'compare':
          playTone(587.33, 0, 0.09, 'triangle', 0.08);
          playTone(783.99, 0.06, 0.12, 'triangle', 0.08);
          break;
        case 'cart':
          playTone(523.25, 0, 0.08, 'sine', 0.09);
          playTone(659.25, 0.05, 0.12, 'sine', 0.09);
          break;
        case 'success':
          playTone(523.25, 0, 0.1, 'sine', 0.09);
          playTone(659.25, 0.07, 0.12, 'sine', 0.09);
          playTone(783.99, 0.14, 0.22, 'sine', 0.1);
          break;
        case 'error':
          playTone(240, 0, 0.12, 'triangle', 0.08);
          playTone(190, 0.08, 0.14, 'triangle', 0.07);
          break;
      }
    },
    [getContext, muted, volume]
  );

  useEffect(() => {
    return () => {
      stopAmbient();
    };
  }, [stopAmbient]);

  return (
    <AudioCtx.Provider
      value={{
        muted,
        volume,
        ambientEnabled,
        toggleMute,
        setVolume,
        toggleAmbient,
        stopAmbient,
        playCue,
      }}
    >
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider');
  return ctx;
}
