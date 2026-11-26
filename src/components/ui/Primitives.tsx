import React, { useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, ChevronRight, Package, X } from 'lucide-react';
import { cn } from '../../lib/utils.ts';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060B16] disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_6px_22px_-6px_rgba(56,189,248,0.55)] hover:from-sky-400 hover:to-blue-500',
        accent:
          'bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_6px_22px_-6px_rgba(139,92,246,0.5)] hover:from-blue-500 hover:to-violet-500',
        outline:
          'border border-slate-700/90 bg-[#0B1222]/90 text-slate-100 hover:bg-[#131F38] hover:border-slate-500',
        ghost: 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
        danger: 'bg-red-600/90 text-white hover:bg-red-500 shadow-sm',
      },
      size: {
        sm: 'h-9 px-3.5 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-6 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800/90 bg-[#0B1222] text-slate-100 shadow-[0_14px_34px_-20px_rgba(2,6,23,0.9)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-700/80 bg-[#070D1A] px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-slate-700/80 bg-[#070D1A] px-3 py-2 text-sm text-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:border-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-xs font-semibold text-slate-300 mb-1.5', className)}
      {...props}
    >
      {children}
    </label>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-[#0B1222] via-[#131F38] to-[#0B1222] border border-slate-800/60',
        className
      )}
    />
  );
}

export function ProductImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-gradient-to-br from-[#0F182D] to-[#070C18] text-slate-400 p-4 text-center',
          className
        )}
        aria-label={alt}
      >
        <Package className="h-8 w-8 text-sky-400/70 mb-2" />
        <span className="text-xs font-medium text-slate-300 line-clamp-2 max-w-[180px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

export function Breadcrumbs({
  items,
  navigate,
}: {
  items: Array<{ label: string; to?: string }>;
  navigate: (to: string) => void;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />}
            {item.to && !isLast ? (
              <button
                type="button"
                onClick={() => navigate(item.to!)}
                className="hover:text-sky-400 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-200 font-medium' : ''}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-[#0B1222] p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border',
                destructive
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-sky-500/30 bg-sky-500/10 text-sky-400'
              )}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 id="confirm-dialog-title" className="font-display text-lg font-bold text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
