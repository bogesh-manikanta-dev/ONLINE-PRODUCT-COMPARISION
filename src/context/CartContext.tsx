import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CartDTO } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';
import { useAuth } from './AuthContext.tsx';
import { useAudio } from './AudioContext.tsx';
import { useCompare } from './CompareContext.tsx';

const GUEST_CART_TOKEN_KEY = 'cx_guest_cart_token';

function getOrCreateGuestCartToken(): string {
  try {
    let token = localStorage.getItem(GUEST_CART_TOKEN_KEY);
    if (!token || token.length < 8) {
      token = `cx_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(GUEST_CART_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return `cx_fallback_${Date.now()}`;
  }
}

interface CartContextValue {
  cart: CartDTO;
  loading: boolean;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: number, quantity?: number, openDrawer?: boolean) => Promise<boolean>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  setCartDirect: (nextCart: CartDTO) => void;
}

const EMPTY_CART: CartDTO = {
  id: 0,
  items: [],
  itemCount: 0,
  subtotal: 0,
  taxAmount: 0,
  standardDeliveryCharge: 0,
  expressDeliveryCharge: 0,
  freeDeliveryThreshold: 2000,
  estimatedTotalStandard: 0,
  estimatedTotalExpress: 0,
  currency: 'INR',
  notices: [],
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showNotice } = useCompare();
  const { playCue } = useAudio();

  const [cart, setCart] = useState<CartDTO>(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const getCartHeaders = useCallback((): Record<string, string> => {
    if (user) return {};
    return { 'x-cart-token': getOrCreateGuestCartToken() };
  }, [user]);

  const refreshCart = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ cart: CartDTO }>('/api/cart', {
        headers: getCartHeaders(),
      });
      setCart(res.cart);
    } catch {
      // Keep current state cleanly
    } finally {
      setLoading(false);
    }
  }, [getCartHeaders]);

  // Load cart and merge guest cart when user authenticates
  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (user) {
        try {
          const guestToken = localStorage.getItem(GUEST_CART_TOKEN_KEY);
          if (guestToken && guestToken.length >= 8) {
            const merged = await apiRequest<{ cart: CartDTO }>('/api/cart/merge', {
              method: 'POST',
              body: JSON.stringify({ guestToken }),
            });
            localStorage.removeItem(GUEST_CART_TOKEN_KEY);
            if (active) setCart(merged.cart);
            return;
          }
        } catch {
          // fallback to normal refresh
        }
      }
      if (active) {
        await refreshCart();
      }
    };
    sync();
    return () => {
      active = false;
    };
  }, [user, refreshCart]);

  const addToCart = useCallback(
    async (productId: number, quantity = 1, openDrawer = true): Promise<boolean> => {
      try {
        const res = await apiRequest<{ cart: CartDTO }>('/api/cart/items', {
          method: 'POST',
          headers: getCartHeaders(),
          body: JSON.stringify({ productId, quantity }),
        });
        setCart(res.cart);
        playCue('cart');
        showNotice('success', 'Added item to your shopping cart.');
        if (openDrawer) setDrawerOpen(true);
        return true;
      } catch (err: any) {
        playCue('error');
        showNotice('error', err.message || 'Could not add item to cart.');
        return false;
      }
    },
    [getCartHeaders, playCue, showNotice]
  );

  const updateQuantity = useCallback(
    async (itemId: number, quantity: number) => {
      try {
        const res = await apiRequest<{ cart: CartDTO }>(`/api/cart/items/${itemId}`, {
          method: 'PATCH',
          headers: getCartHeaders(),
          body: JSON.stringify({ quantity }),
        });
        setCart(res.cart);
      } catch (err: any) {
        playCue('error');
        showNotice('error', err.message || 'Could not update item quantity.');
      }
    },
    [getCartHeaders, playCue, showNotice]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      try {
        const res = await apiRequest<{ cart: CartDTO }>(`/api/cart/items/${itemId}`, {
          method: 'DELETE',
          headers: getCartHeaders(),
        });
        setCart(res.cart);
        showNotice('info', 'Item removed from cart.');
      } catch (err: any) {
        showNotice('error', err.message || 'Could not remove item.');
      }
    },
    [getCartHeaders, showNotice]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        isDrawerOpen,
        setDrawerOpen,
        refreshCart,
        addToCart,
        updateQuantity,
        removeItem,
        setCartDirect: setCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
