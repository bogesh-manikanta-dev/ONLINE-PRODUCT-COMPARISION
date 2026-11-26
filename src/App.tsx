import React, { Component, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Layout } from './components/Layout.tsx';
import { SplashLoader } from './components/SplashLoader.tsx';
import { Button, Card } from './components/ui/Primitives.tsx';
import { AudioProvider } from './context/AudioContext.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { CompareProvider } from './context/CompareContext.tsx';
import {
  AdminInventoryPage,
  AdminOrdersPage,
  AdminRecommendationsConfigPage,
  AdminReturnsPage,
} from './pages/AdminCommercePages.tsx';
import {
  AdminBrandsPage,
  AdminCategoriesPage,
  AdminDashboardPage,
  AdminProductsPage,
  AdminSellersPage,
} from './pages/AdminPages.tsx';
import {
  AdminAuditLogsPage,
  AdminCsvImportPage,
  AdminDataQualityPage,
  AdminUsersPage,
} from './pages/AdminQualityAndCsvPages.tsx';
import { AuthPage } from './pages/AuthPages.tsx';
import { BrandShowcasePage, BrandsDirectoryPage } from './pages/BrandsPages.tsx';
import { CartPage, CheckoutPage } from './pages/CartCheckoutPages.tsx';
import { ComparisonPage } from './pages/ComparisonPage.tsx';
import {
  AddressesPage,
  ConsumerDashboardPage,
  ProfilePage,
  ReturnsPage,
  SavedComparisonsPage,
  WishlistPage,
} from './pages/ConsumerWorkspacePages.tsx';
import { DiscoveryPage } from './pages/DiscoveryPages.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { OrderDetailPage, OrdersListPage } from './pages/OrdersPages.tsx';
import { PriceHistoryPage } from './pages/PriceHistoryPage.tsx';
import { ProductDetailPage } from './pages/ProductDetailPage.tsx';
import {
  RecommendationQuestionnairePage,
  RecommendationResultsPage,
} from './pages/RecommendationPages.tsx';

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || 'An unexpected interface error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#070705] p-6">
          <Card className="max-w-md p-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-slate-400">{this.state.message}</p>
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            >
              Return Home
            </Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFoundPage({ navigate }: { navigate: (to: string) => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-5">
      <div className="font-mono text-sm font-bold text-sky-400">404</div>
      <h1 className="font-display text-3xl font-bold text-white">Page Not Found</h1>
      <p className="text-sm text-slate-400">
        The CompareX route you requested does not exist or may have moved.
      </p>
      <div className="flex justify-center gap-3">
        <Button variant="primary" onClick={() => navigate('/')}>
          Go Home
        </Button>
        <Button variant="outline" onClick={() => navigate('/discover')}>
          Browse Catalog
        </Button>
      </div>
    </div>
  );
}

function RouterView() {
  const shouldReduceMotion = useReducedMotion();
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  useEffect(() => {
    const onPop = () => {
      setLocationState({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    const url = new URL(to, window.location.origin);
    window.history.pushState({}, '', url.pathname + url.search);
    setLocationState({ pathname: url.pathname, search: url.search });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const path = locationState.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(locationState.search);

  const renderPage = () => {
    if (path === '/') return <HomePage navigate={navigate} />;
    if (path === '/signup') return <AuthPage mode="signup" navigate={navigate} />;
    if (path === '/login') return <AuthPage mode="login" navigate={navigate} />;
    if (path === '/dashboard') return <ConsumerDashboardPage navigate={navigate} />;
    if (path === '/discover') {
      return (
        <DiscoveryPage
          mode="discover"
          initialBrandId={params.get('brandId') || ''}
          navigate={navigate}
        />
      );
    }

    if (path.startsWith('/category/')) {
      const slug = decodeURIComponent(path.slice('/category/'.length));
      return <DiscoveryPage mode="category" categorySlug={slug} navigate={navigate} />;
    }

    if (path === '/search') {
      return (
        <DiscoveryPage
          mode="search"
          initialQuery={params.get('q') || ''}
          navigate={navigate}
        />
      );
    }

    if (path === '/brands') return <BrandsDirectoryPage navigate={navigate} />;
    if (path.startsWith('/brands/')) {
      const slug = decodeURIComponent(path.slice('/brands/'.length));
      return <BrandShowcasePage slug={slug} navigate={navigate} />;
    }

    if (path.startsWith('/products/')) {
      const idOrSlug = decodeURIComponent(path.slice('/products/'.length));
      return <ProductDetailPage idOrSlug={idOrSlug} navigate={navigate} />;
    }

    if (path === '/compare') return <ComparisonPage navigate={navigate} />;
    if (path === '/recommend') return <RecommendationQuestionnairePage navigate={navigate} />;
    if (path === '/recommendations/results') return <RecommendationResultsPage navigate={navigate} />;
    if (path === '/saved-comparisons') return <SavedComparisonsPage navigate={navigate} />;
    if (path === '/wishlist') return <WishlistPage navigate={navigate} />;

    if (path === '/cart') return <CartPage navigate={navigate} />;
    if (path === '/checkout') return <CheckoutPage navigate={navigate} />;
    if (path === '/orders') return <OrdersListPage navigate={navigate} />;
    if (path.startsWith('/orders/')) {
      const id = Number(path.slice('/orders/'.length));
      if (!Number.isInteger(id) || id <= 0) return <NotFoundPage navigate={navigate} />;
      return <OrderDetailPage orderId={id} navigate={navigate} />;
    }
    if (path === '/addresses') return <AddressesPage navigate={navigate} />;
    if (path === '/returns') return <ReturnsPage navigate={navigate} />;

    if (path === '/price-history') return <PriceHistoryPage navigate={navigate} />;
    if (path.startsWith('/price-history/')) {
      const id = Number(path.slice('/price-history/'.length));
      return <PriceHistoryPage productIdParam={Number.isFinite(id) ? id : undefined} navigate={navigate} />;
    }

    if (path === '/profile') return <ProfilePage navigate={navigate} />;

    if (path === '/admin') return <AdminDashboardPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/products') return <AdminProductsPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/inventory') return <AdminInventoryPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/orders') return <AdminOrdersPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/returns') return <AdminReturnsPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/categories') return <AdminCategoriesPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/brands') return <AdminBrandsPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/sellers') return <AdminSellersPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/recommendations') {
      return <AdminRecommendationsConfigPage currentPath={path} navigate={navigate} />;
    }
    if (path === '/admin/csv-import') return <AdminCsvImportPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/users') return <AdminUsersPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/data-quality') return <AdminDataQualityPage currentPath={path} navigate={navigate} />;
    if (path === '/admin/audit-logs') return <AdminAuditLogsPage currentPath={path} navigate={navigate} />;

    return <NotFoundPage navigate={navigate} />;
  };

  return (
    <Layout currentPath={path} navigate={navigate}>
      <AnimatePresence mode="wait">
        <motion.div
          key={path + locationState.search}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <SplashLoader />
      <AuthProvider>
        <AudioProvider>
          <CompareProvider>
            <CartProvider>
              <RouterView />
            </CartProvider>
          </CompareProvider>
        </AudioProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
