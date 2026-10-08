import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import SupplierRegistration from './components/SupplierRegistration';
import BuyersRegistration from './components/BuyersRegistration';
import { Loader } from '@vosox/shared-ui';
import BuyerAssistant from './components/assistant/BuyerAssistant';

const BuyerApp = React.lazy(() => import('remoteBuyer/BuyerApp'));
const SupplierApp = React.lazy(() => import('remoteSupplier/SupplierApp'));
const PlatformUserApp = React.lazy(() => import('remotePlatformUser/PlatformUserApp'));
const ExternalSupplierBid = React.lazy(() => import('remoteSupplier/ExternalSupplierBid'));
const MobileApp = React.lazy(() => import('remoteMobile/MobileApp'));

/** Path of the SILA Store mobile app; signing in from it returns to it. */
const MOBILE_PATH = '/mobile';

/**
 * Signed-in area. Every role uses the same role-neutral URLs (/dashboard, /rfqs, /profile, …);
 * the role decides which app is mounted, and each app only declares its role's pages.
 */
const RoleApp: React.FC = () => {
  const { isLoggedIn, userRole, isInitialized } = useAuthStore();
  if (!isInitialized) {
    return (
      <Loader
        fullScreen={true}
        message='Verifying session...'
        theme='light'
      />
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  // An outlet manager is a buyer user with the wishlist screens on top; a store manager is one who freezes the weekly bucket;
  // a cost controller is a buyer user who watches costs and stock (SILA ME).
  if (
    userRole === 'buyer' ||
    userRole === 'buyer-business-user' ||
    userRole === 'outlet-manager' ||
    userRole === 'store-manager' ||
    userRole === 'cost-controller'
  ) {
    return <BuyerApp />;
  }
  if (userRole === 'supplier' || userRole === 'supplier-business-user') {
    return <SupplierApp />;
  }
  // platform-user, buyer-admin, supplier-admin (incl. network admins)
  return <PlatformUserApp />;
};

/** SILA Store (mobile) for buyer-side users; signed-out users sign in first and come back here. */
const MobileRoute: React.FC = () => {
  const { isLoggedIn, isInitialized } = useAuthStore();
  if (!isInitialized) {
    return <Loader fullScreen={true} message='Verifying session...' theme='light' />;
  }
  if (!isLoggedIn) {
    return <Navigate to={`/?next=${MOBILE_PATH}`} replace />;
  }
  return <MobileApp />;
};

const Shell = () => {
  const { isLoggedIn, logout, isInitialized, initializeAuth } = useAuthStore();
  const { fetchAndSetAuth, setAuth, clearAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  React.useEffect(()=>{
    initializeAuth();
  },[initializeAuth])
  React.useEffect(() => {
    if (isLoggedIn) {
      fetchAndSetAuth();
    } 
  }, [isLoggedIn,fetchAndSetAuth]);

  React.useEffect(() => {
    const handleSessionExpired = () => {
      logout();
      clearAuth();
      navigate('/', { replace: true });
    };
    window.addEventListener('session:expired', handleSessionExpired);
    return () => window.removeEventListener('session:expired', handleSessionExpired);
  }, [logout, clearAuth, navigate]);

  const isAuthPage = location.pathname === '/';
  const isRegistration = location.pathname.includes('/registration');
  const isExternalBid = location.pathname.startsWith('/external-supplier/');
  const isMobile = location.pathname.startsWith(MOBILE_PATH);
  // The assistant is for all buyer-side roles and buyer administrators.
  const { userRole } = useAuthStore();
  const roleLower = (userRole ?? '').toLowerCase();
  const isBuyerSideRole =
    !roleLower.includes('supplier') &&
    (roleLower.includes('buyer') ||
      roleLower.includes('outlet') ||
      roleLower.includes('store') ||
      roleLower.includes('cost') ||
      roleLower.includes('admin'));

  const showAssistant =
    isLoggedIn && !isAuthPage && !isRegistration && !isExternalBid && !isMobile && isBuyerSideRole;
  const nextPath = new URLSearchParams(location.search).get('next') === MOBILE_PATH ? MOBILE_PATH : '/dashboard';

  return (
    <div className="app-container sila-root">
      <main className={`main-content ${!isLoggedIn || isAuthPage || isRegistration || isExternalBid || isMobile ? 'no-padding' : ''}`}>
        <React.Suspense fallback={
          <Loader
            fullScreen={true}
            message="Loading modules..."
            theme="light"
          />
        }>
          <Routes>
            <Route
              path="/"
              element={
                !isInitialized ? (
                  <Loader 
                  fullScreen={true}
                  message='Verifying session...'
                  theme='light'
                  />  
                ) :isLoggedIn ? (
                  <Navigate to={nextPath} replace />
                ) : (
                  <Login
                    onCreateAccount={() => navigate('/supplier-registration')}
                    onCreateBuyerAccount={() => navigate('/buyer-registration')}
                    onLoginSuccess={(details) => {
  useAuthStore.getState().login(details);
  setAuth({
    buyerId: details.buyerId ?? null,
    supplierId: details.supplierId ?? null,
  });
}}
                  />
                )
              }
            />

            <Route path="/supplier-registration" element={<SupplierRegistration />} />
            <Route path="/buyer-registration" element={<BuyersRegistration />} />

            {/* External Supplier Bid — unauthenticated, reached via a direct invitation link */}
            <Route path="/external-supplier/bid/:rfqId/:sessionToken" element={<ExternalSupplierBid />} />

            {/* Signed-in app for the current role, at clean URLs */}
            <Route path={`${MOBILE_PATH}/*`} element={<MobileRoute />} />

            <Route path="*" element={<RoleApp />} />
          </Routes>
        </React.Suspense>
      </main>
      {showAssistant && <BuyerAssistant />}
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}