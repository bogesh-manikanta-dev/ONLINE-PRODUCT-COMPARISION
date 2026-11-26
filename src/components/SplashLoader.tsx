import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CompareXLogo } from './CompareXLogo.tsx';

export function SplashLoader() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => {
    try {
      if (reduceMotion) return false;
      return sessionStorage.getItem('cx_splash_shown') !== '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!visible) return;
    try {
      sessionStorage.setItem('cx_splash_shown', '1');
    } catch {
      // ignore storage failure
    }
    const timer = setTimeout(() => setVisible(false), 850);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070705]"
        >
          <div className="relative flex flex-col items-center gap-4">
            <div className="absolute -inset-12 rounded-full bg-sky-500/10 blur-3xl" />
            <CompareXLogo size="lg" animated />
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="text-xs font-medium tracking-[0.22em] uppercase text-slate-400"
            >
              Compare Smarter. Choose Better.
            </motion.p>
            <div className="mt-2 h-0.5 w-36 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '0%' }}
                transition={{ duration: 0.72, ease: 'easeInOut' }}
                className="h-full w-full bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
