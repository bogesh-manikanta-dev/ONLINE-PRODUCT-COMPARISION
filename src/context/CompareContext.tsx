import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { BrandDTO, CategoryDTO, ProductDTO, RecommendationResponseDTO } from '../../shared/types.ts';
import { apiRequest } from '../lib/api.ts';

interface CompareContextValue {
  compareItems: ProductDTO[];
  categories: CategoryDTO[];
  brands: BrandDTO[];
  wishlistIds: Set<number>;
  lastRecommendation: RecommendationResponseDTO | null;
  setLastRecommendation: (rec: RecommendationResponseDTO | null) => void;
  notice: { type: 'info' | 'error' | 'success'; message: string } | null;
  clearNotice: () => void;
  showNotice: (type: 'info' | 'error' | 'success', message: string) => void;
  addToCompare: (product: ProductDTO) => void;
  removeFromCompare: (productId: number) => void;
  setCompareList: (products: ProductDTO[]) => void;
  clearCompare: () => void;
  refreshMetadata: () => Promise<void>;
  setWishlistIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareItems, setCompareItems] = useState<ProductDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [brands, setBrands] = useState<BrandDTO[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());
  const [lastRecommendation, setLastRecommendation] = useState<RecommendationResponseDTO | null>(null);
  const [notice, setNotice] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);

  const showNotice = useCallback((type: 'info' | 'error' | 'success', message: string) => {
    setNotice({ type, message });
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const refreshMetadata = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        apiRequest<{ categories: CategoryDTO[] }>('/api/categories'),
        apiRequest<{ brands: BrandDTO[] }>('/api/brands'),
      ]);
      setCategories(catRes.categories);
      setBrands(brandRes.brands);
    } catch (err) {
      console.error('Metadata load error:', err);
    }
  }, []);

  useEffect(() => {
    refreshMetadata();
  }, [refreshMetadata]);

  const addToCompare = useCallback(
    (product: ProductDTO) => {
      setCompareItems((prev) => {
        if (prev.some((p) => p.id === product.id)) {
          showNotice('info', `${product.name} is already in your comparison tray.`);
          return prev;
        }
        if (prev.length >= 4) {
          showNotice('error', 'You can compare up to 4 products at a time. Remove one to add another.');
          return prev;
        }
        if (prev.length > 0 && prev[0].categoryId !== product.categoryId) {
          showNotice(
            'error',
            `Incompatible category: ${product.name} (${product.categoryName}) cannot be compared alongside ${prev[0].categoryName}. Clear your tray or select another ${prev[0].categoryName} item.`
          );
          return prev;
        }
        showNotice('success', `Added ${product.name} to comparison (${prev.length + 1}/4).`);
        return [...prev, product];
      });
    },
    [showNotice]
  );

  const removeFromCompare = useCallback((productId: number) => {
    setCompareItems((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const setCompareList = useCallback((products: ProductDTO[]) => {
    setCompareItems(products.slice(0, 4));
  }, []);

  const clearCompare = useCallback(() => {
    setCompareItems([]);
  }, []);

  return (
    <CompareContext.Provider
      value={{
        compareItems,
        categories,
        brands,
        wishlistIds,
        lastRecommendation,
        setLastRecommendation,
        notice,
        clearNotice,
        showNotice,
        addToCompare,
        removeFromCompare,
        setCompareList,
        clearCompare,
        refreshMetadata,
        setWishlistIds,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider');
  return ctx;
}
