import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from '@vosox/shared-ui';
import SupplierDashboard from './components/SupplierDashboard';
import SupplierProfilePage from './pages/SupplierProfilePage';
import { useSupplierAuthStore } from './store/useSupplierAuthStore';

const SupplierApp: React.FC = () => {
  const fetchPersonDetail = useSupplierAuthStore((state) => state.fetchPersonDetail);

  // SupplierApp only mounts once per authenticated session (the host shell
  // unmounts it on logout and remounts a fresh instance on login), and once on
  // a full page reload - so this single call covers both cases.
  useEffect(() => {
    fetchPersonDetail();
  }, [fetchPersonDetail]);

  return (
    <>
      <Routes>
        <Route path="profile" element={<SupplierProfilePage />} />
        {/* Dashboard sections (/dashboard, /rfqs, /catalog, …) are resolved inside the dashboard. */}
        <Route path="*" element={<SupplierDashboard />} />
      </Routes>
      <ToastContainer />
    </>
  );
};

export default SupplierApp;