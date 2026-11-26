import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Menu,
  Package,
  Scale,
  Search,
  ShoppingBag,
  Trash2,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ProductDTO } from '../../shared/types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useAudio } from '../context/AudioContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useCompare } from '../context/CompareContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency } from '../lib/utils.ts';
import { CartDrawer } from './CartDrawer.tsx';
import { CompareXLogo } from './CompareXLogo.tsx';
import { Button, Input, ProductImage } from './ui/Primitives.tsx';

export function Layout({
  currentPath,
  navigate,
  children,
}: {
  currentPath: string;
  navigate: (to: string) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { cart, setDrawerOpen } = useCart();
  const { muted, volume, ambientEnabled, toggleMute, setVolume, toggleAmbient, stopAmbient, playCue } =
    useAudio();
  const { categories, compareItems, wishlistIds, removeFromCompare, clearCompare, notice, clearNotice } =
    useCompare();
  const shouldReduceMotion = useReducedMotion();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<ProductDTO[]>([]);
  const [searching, setSearching] = useState(false);

  const catMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const navLinks = [
    { label: 'Explore', path: '/discover' },
    { label: 'Brands', path: '/brands' },
    { label: `Compare (${compareItems.length})`, path: '/compare' },
    { label: 'Recommend', path: '/recommend' },
    { label: 'Orders', path: '/orders' },
    user?.role === 'ADMIN'
      ? { label: 'Admin', path: '/admin' }
      : { label: 'Dashboard', path: '/dashboard' },
  ];

  // Stop/fade ambient audio when navigating between views
  useEffect(() => {
    stopAmbient();
  }, [currentPath, stopAmbient]);

  const handleNav = (path: string) => {
    playCue('nav');
    setMobileMenuOpen(false);
    setCatMenuOpen(false);
    setAudioMenuOpen(false);
    setSearchOverlayOpen(false);
    navigate(path);
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) {
        setCatMenuOpen(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setAudioMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCatMenuOpen(false);
        setAudioMenuOpen(false);
        setSearchOverlayOpen(false);
        setMobileMenuOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOverlayOpen((v) => !v);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (searchOverlayOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [searchOverlayOpen]);

  useEffect(() => {
    if (!searchOverlayOpen) return;
    const trimmed = searchText.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiRequest<{ items: ProductDTO[] }>(`/api/products?q=${encodeURIComponent(trimmed)}&limit=6`)
        .then((res) => setSuggestions(res.items))
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [searchText, searchOverlayOpen]);

  const handleOverlaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    handleNav(q ? `/search?q=${encodeURIComponent(q)}` : '/discover');
  };

  const groupedCategories = categories.reduce<Record<string, typeof categories>>((acc, cat) => {
    const g = cat.domainGroup || 'Other';
    if (!acc[g]) acc[g] = [];
    acc[g].push(cat);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-[#060B16] text-slate-100">
      <CartDrawer navigate={navigate} />

      {/* Sticky Dark Glass Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#060B16]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/');
            }}
            className="whitespace-nowrap shrink-0 group"
          >
            <CompareXLogo size="md" />
          </a>

          {/* Primary Navigation */}
          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-300">
            <a
              href="/discover"
              onClick={(e) => {
                e.preventDefault();
                handleNav('/discover');
              }}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors ${
                currentPath === '/discover' || currentPath.startsWith('/search')
                  ? 'text-white font-semibold'
                  : 'hover:text-white'
              }`}
            >
              Explore
              {(currentPath === '/discover' || currentPath.startsWith('/search')) && (
                <motion.span
                  layoutId={shouldReduceMotion ? undefined : 'cx-nav-indicator'}
                  className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-violet-500"
                />
              )}
            </a>

            {/* Categories Dropdown */}
            <div ref={catMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setCatMenuOpen((v) => !v)}
                aria-expanded={catMenuOpen}
                className={`relative inline-flex items-center gap-1 py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  currentPath.startsWith('/category/') ? 'text-white font-semibold' : 'hover:text-white'
                }`}
              >
                <span>Categories</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-150 ${
                    catMenuOpen ? 'rotate-180 text-sky-400' : 'text-slate-400'
                  }`}
                />
              </button>

              <AnimatePresence>
                {catMenuOpen && (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    transition={{ duration: 0.16 }}
                    className="absolute left-0 top-full mt-3 w-[640px] max-h-[75vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0B1222]/95 backdrop-blur-xl p-5 shadow-2xl"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                      <span className="font-display text-xs font-semibold text-sky-400">
                        17 Consumer Categories
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNav('/discover')}
                        className="text-xs font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>All Products</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      {Object.entries(groupedCategories).map(([group, cats]) => (
                        <div key={group} className="space-y-1">
                          <div className="text-xs font-semibold text-slate-400 px-2 pb-1">{group}</div>
                          {cats.map((cat) => (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleNav(`/category/${cat.slug}`)}
                              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800/70 hover:text-white transition-colors cursor-pointer"
                            >
                              <span className="truncate">{cat.name}</span>
                              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                {cat.productCount ?? 0}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {navLinks.slice(1).map((link) => {
              const isActive =
                currentPath === link.path ||
                (link.path !== '/' && currentPath.startsWith(link.path));
              return (
                <a
                  key={link.path}
                  href={link.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNav(link.path);
                  }}
                  className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    isActive ? 'text-white font-semibold' : 'hover:text-white'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId={shouldReduceMotion ? undefined : 'cx-nav-indicator'}
                      className="absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full bg-gradient-to-r from-sky-400 to-violet-500"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Compact Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOverlayOpen(true)}
              aria-label="Open product search"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-800 bg-[#0B1222] px-2.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">Search</span>
            </button>

            {/* Web Audio Mute / Volume Control */}
            <div ref={audioMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAudioMenuOpen((v) => !v)}
                aria-label={muted ? 'Audio muted — open audio controls' : 'Audio enabled — open audio controls'}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                  !muted
                    ? 'border-sky-500/50 bg-sky-500/10 text-sky-400'
                    : 'border-slate-800 bg-[#0B1222] text-slate-400 hover:border-slate-700 hover:text-white'
                }`}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {audioMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-slate-800 bg-[#0B1222] p-4 shadow-2xl space-y-3 z-50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Sound Cues</span>
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                    >
                      {muted ? 'Unmute' : 'Mute'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Volume</span>
                      <span className="font-mono tabular-nums">{Math.round(volume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(volume * 100)}
                      onChange={(e) => setVolume(Number(e.target.value) / 100)}
                      aria-label="Audio volume"
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-300">Ambient Pad</span>
                    <button
                      type="button"
                      onClick={toggleAmbient}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                        ambientEnabled
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {ambientEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNav('/wishlist')}
              aria-label="Wishlist"
              className={`hidden md:inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                currentPath === '/wishlist'
                  ? 'border-sky-500/60 bg-sky-500/10 text-sky-300'
                  : 'border-slate-800 bg-[#0B1222] text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              {wishlistIds.size > 0 && (
                <span className="font-mono text-[11px] text-sky-400 tabular-nums">
                  {wishlistIds.size}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open shopping cart"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0B1222] px-2.5 text-xs font-medium text-slate-200 hover:border-sky-500/60 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-sky-400" />
              <span className="hidden sm:inline">Cart</span>
              <span className="font-mono text-[11px] font-bold text-sky-400 tabular-nums">
                ({cart.itemCount})
              </span>
            </button>

            {user ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNav('/profile')}
                className="hidden sm:inline-flex"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>{user.name.split(' ')[0]}</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleNav('/login')}
                className="hidden sm:inline-flex"
              >
                Sign In
              </Button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="xl:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#0B1222] text-slate-200 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              className="xl:hidden overflow-hidden border-t border-slate-800 bg-[#0B1222] px-4 py-4 space-y-1.5"
            >
              {navLinks.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => handleNav(link.path)}
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/70"
                >
                  {link.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNav('/cart')}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/70"
              >
                Shopping Cart ({cart.itemCount})
              </button>
              <button
                type="button"
                onClick={() => handleNav('/wishlist')}
                className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-800/70"
              >
                Wishlist
              </button>
              <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                {user ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNav('/profile')}
                      className="flex-1"
                    >
                      Profile ({user.name.split(' ')[0]})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        logout();
                        handleNav('/');
                      }}
                      className="flex-1"
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleNav('/login')}
                      className="flex-1"
                    >
                      Sign In
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNav('/signup')}
                      className="flex-1"
                    >
                      Sign Up
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Search Overlay Modal */}
      <AnimatePresence>
        {searchOverlayOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-md pt-20 px-4"
            onClick={() => setSearchOverlayOpen(false)}
          >
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#0B1222] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleOverlaySubmit} className="flex items-center gap-3 border-b border-slate-800 p-4">
                <Search className="h-5 w-5 text-sky-400 shrink-0" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search Samsung, Apple, Nike, Daikin, Dyson, or model numbers..."
                  className="border-0 bg-transparent px-0 focus-visible:ring-0 text-base"
                />
                <Button type="submit" variant="primary" size="sm">
                  Search
                </Button>
                <button
                  type="button"
                  onClick={() => setSearchOverlayOpen(false)}
                  aria-label="Close search overlay"
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>

              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                {searchText.trim() ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-400">
                      {searching ? 'Searching catalog...' : `Matching Products (${suggestions.length})`}
                    </div>
                    {!searching && suggestions.length === 0 ? (
                      <p className="text-sm text-slate-400 py-3">
                        No immediate matches. Press Enter to run a full filtered search.
                      </p>
                    ) : (
                      suggestions.map((prod) => (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleNav(`/products/${prod.slug}`)}
                          className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-[#070D1A] p-3 text-left hover:border-sky-500/50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-12 w-16 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                              <ProductImage src={prod.primaryImage} alt={prod.name} className="h-full w-full" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-slate-400 truncate">
                                {prod.brandName} · {prod.categoryName}
                              </div>
                              <div className="font-display text-sm font-semibold text-white truncate">
                                {prod.name}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-sm font-semibold text-sky-400 tabular-nums shrink-0">
                            {formatCurrency(prod.basePrice, prod.currency)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-400">Browse Categories</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleNav(`/category/${cat.slug}`)}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#070D1A] px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-500/50 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="truncate">{cat.name}</span>
                          <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast / Status Notification */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={`border-b px-4 py-2.5 text-sm ${
              notice.type === 'error'
                ? 'bg-red-950/90 border-red-800/80 text-red-100'
                : notice.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-800/80 text-emerald-100'
                  : 'bg-sky-950/90 border-sky-800/80 text-sky-100'
            }`}
          >
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 sm:px-6 lg:px-8">
              <span className="font-medium">{notice.message}</span>
              <button
                type="button"
                onClick={clearNotice}
                aria-label="Dismiss message"
                className="text-xs font-semibold underline shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">{children}</main>

      {/* Sticky Comparison Tray */}
      <AnimatePresence>
        {compareItems.length > 0 && currentPath !== '/compare' && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            className="sticky bottom-0 z-30 border-t border-slate-700/80 bg-[#0B1222]/95 backdrop-blur-xl text-white shadow-2xl"
          >
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3 overflow-x-auto py-0.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 whitespace-nowrap shrink-0">
                  <Scale className="h-4 w-4" />
                  <span>Compare ({compareItems.length}/4)</span>
                </div>
                <div className="flex items-center gap-2">
                  {compareItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#060B16] px-2.5 py-1 text-xs whitespace-nowrap"
                    >
                      <span className="max-w-[130px] truncate text-slate-200">{item.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCompare(item.id)}
                        aria-label={`Remove ${item.name} from compare`}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={clearCompare}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
                <Button
                  variant="accent"
                  size="sm"
                  onClick={() => navigate('/compare')}
                  disabled={compareItems.length < 2}
                >
                  <span>Compare Now</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#050912] text-slate-300">
        <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="space-y-3">
              <CompareXLogo size="sm" />
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Compare Smarter. Choose Better. Structured consumer product comparison, brand showcases,
                smart recommendations, and demonstration e-commerce fulfillment.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white mb-3">Discovery &amp; Intelligence</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => navigate('/discover')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Explore Catalog
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/brands')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Brand Showcases
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/compare')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Comparison Engine
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/recommend')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Smart Recommendations
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/price-history')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Price Insights
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white mb-3">Shopping &amp; Account</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => navigate('/cart')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Shopping Cart
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/orders')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Orders &amp; Tracking
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/returns')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Returns &amp; Refunds (Demo)
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/addresses')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Saved Addresses
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/dashboard')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Consumer Dashboard
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white mb-3">Administration &amp; Trust</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => navigate('/admin')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Admin Console
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/admin/orders')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Order Management
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/admin/inventory')} className="hover:text-sky-400 transition-colors cursor-pointer">
                    Inventory Control
                  </button>
                </li>
                <li className="text-xs text-slate-500 pt-2 leading-relaxed">
                  All prices (INR), stock counts, payments, and order tracking timelines are seeded
                  demonstration simulations.
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-sky-400" />
              CompareX E-Commerce &amp; Decision Support Platform · Software Engineering Capstone
            </span>
            <div className="flex items-center gap-4">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Sign Out ({user.email})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
