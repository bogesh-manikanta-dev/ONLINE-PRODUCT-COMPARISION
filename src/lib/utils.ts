import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency = 'INR'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'Not available';
  }
  const activeCurrency = currency || 'INR';
  const locale = activeCurrency === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${activeCurrency === 'INR' ? '₹' : '$'}${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
