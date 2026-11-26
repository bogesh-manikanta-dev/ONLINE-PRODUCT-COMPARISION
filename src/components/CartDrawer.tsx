import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../context/CartContext.tsx';
import { formatCurrency } from '../lib/utils.ts';
import { Button, ProductImage } from './ui/Primitives.tsx';

export function CartDrawer({ navigate }: { navigate: (to: string) => void }) {
  const { cart, isDrawerOpen, setDrawerOpen, updateQuantity, removeItem } = useCart();
  const reduceMotion = useReducedMotion();

  const go = (to: string) => {
    setDrawerOpen(false);
    navigate(to);
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
        >
          <motion.aside
            initial={reduceMotion ? { opacity: 1 } : { x: '100%' }}
            animate={{ x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Shopping Cart Drawer"
            className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-[#080E1C] text-slate-100 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-white">Shopping Cart</h2>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} · INR Demo Store
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close shopping cart"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Notices */}
            {cart.notices.length > 0 && (
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-xs text-amber-200 space-y-1">
                {cart.notices.map((n, idx) => (
                  <p key={idx}>{n}</p>
                ))}
              </div>
            )}

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center py-12 space-y-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-[#0B1222] text-slate-500">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="font-display text-base font-semibold text-white">Your cart is empty</div>
                    <p className="text-xs text-slate-400 max-w-xs">
                      Compare specifications side by side or explore featured brands to add products here.
                    </p>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => go('/discover')}>
                    Explore Products
                  </Button>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3.5 rounded-xl border border-slate-800/90 bg-[#0B1222] p-3"
                  >
                    <button
                      type="button"
                      onClick={() => go(`/products/${item.productSlug}`)}
                      className="h-18 w-20 shrink-0 overflow-hidden rounded-lg bg-[#060B16] border border-slate-800 cursor-pointer"
                    >
                      <ProductImage src={item.primaryImage} alt={item.productName} className="h-full w-full" />
                    </button>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-sky-400 truncate">
                            {item.brandName}
                          </div>
                          <button
                            type="button"
                            onClick={() => go(`/products/${item.productSlug}`)}
                            className="text-left font-display text-sm font-semibold text-white hover:text-sky-300 line-clamp-1 cursor-pointer"
                          >
                            {item.productName}
                          </button>
                          <div className="text-[11px] text-slate-400 truncate">{item.variantLabel}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.productName}`}
                          className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center rounded-lg border border-slate-700/80 bg-[#070D1A]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="px-2 py-1 text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2.5 font-mono text-xs font-semibold text-white tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stockQuantity}
                            aria-label="Increase quantity"
                            className="px-2 py-1 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-white tabular-nums">
                            {formatCurrency(item.lineSubtotal, item.currency)}
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {item.stockQuantity} in stock
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Totals */}
            {cart.items.length > 0 && (
              <div className="border-t border-slate-800 bg-[#060B16] p-5 space-y-4">
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <dt>Subtotal</dt>
                    <dd className="font-mono text-slate-200 tabular-nums">
                      {formatCurrency(cart.subtotal, cart.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <dt>Estimated GST / Tax</dt>
                    <dd className="font-mono text-slate-200 tabular-nums">
                      {formatCurrency(cart.taxAmount, cart.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <dt>Standard Delivery</dt>
                    <dd className="font-mono text-slate-200 tabular-nums">
                      {cart.standardDeliveryCharge === 0
                        ? 'FREE'
                        : formatCurrency(cart.standardDeliveryCharge, cart.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold text-white">
                    <dt>Estimated Total</dt>
                    <dd className="font-mono text-sky-400 tabular-nums">
                      {formatCurrency(cart.estimatedTotalStandard, cart.currency)}
                    </dd>
                  </div>
                </dl>

                <div className="grid grid-cols-2 gap-2.5">
                  <Button variant="outline" size="md" onClick={() => go('/cart')}>
                    View Cart
                  </Button>
                  <Button variant="primary" size="md" onClick={() => go('/checkout')}>
                    <span>Checkout</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 text-center">
                  Demonstration pricing &amp; stock. Checkout uses simulated payment modes only.
                </p>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
