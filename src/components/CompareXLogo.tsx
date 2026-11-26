import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface CompareXLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showWordmark?: boolean;
  className?: string;
}

export function CompareXLogo({
  variant = 'dark',
  size = 'md',
  animated = false,
  showWordmark = true,
  className = '',
}: CompareXLogoProps) {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-3xl',
  }[size];

  const textColor = variant === 'light' ? 'text-slate-950' : 'text-white';
  const subColor = variant === 'light' ? 'text-sky-600' : 'text-sky-400';

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`relative flex items-center justify-center rounded-xl ${iconSizes} ${
          variant === 'light'
            ? 'bg-slate-950 shadow-md'
            : 'bg-gradient-to-br from-[#0F1B33] to-[#060B16] border border-sky-400/30 shadow-[0_0_24px_-6px_rgba(56,189,248,0.65)]'
        }`}
      >
        <svg viewBox="0 0 40 40" className="h-[72%] w-[72%]" fill="none" aria-hidden="true">
          <motion.path
            d="M10 10L19 20L10 30"
            stroke="#38BDF8"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
            animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
          <motion.path
            d="M30 10L21 20L30 30"
            stroke="#8B5CF6"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
            animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
          />
          <motion.circle
            cx="20"
            cy="20"
            r="2.4"
            fill="#F8FAFC"
            initial={shouldAnimate ? { scale: 0 } : false}
            animate={shouldAnimate ? { scale: 1 } : undefined}
            transition={{ duration: 0.3, delay: 0.35 }}
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={`font-display font-extrabold tracking-tight ${textSizes} ${textColor}`}>
          Compare<span className={subColor}>X</span>
        </span>
      )}
    </span>
  );
}
