import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import TabBar from './components/TabBar';
import { PoweredFooter } from './components/StateViews';
import { AccessProvider } from './access';
import { MyLocationProvider } from './location';
import { MobileBaseProvider } from './navigation';
import HomeScreen from './screens/home/HomeScreen';
import ReceiveScreen from './screens/receive/ReceiveScreen';
import ScanInvoiceScreen from './screens/receive/ScanInvoiceScreen';
import InvoiceReviewScreen from './screens/receive/InvoiceReviewScreen';
import GrnFormScreen from './screens/receive/GrnFormScreen';
import GrnDetailScreen from './screens/receive/GrnDetailScreen';
import OpenPosScreen from './screens/receive/OpenPosScreen';
import PoDetailScreen from './screens/receive/PoDetailScreen';
import HistoryScreen from './screens/receive/HistoryScreen';
import PendingGrnScreen from './screens/receive/PendingGrnScreen';
import PurchaseRequestsScreen from './screens/inventory/PurchaseRequestsScreen';
import SearchScreen from './screens/more/SearchScreen';
import SuppliersScreen from './screens/more/SuppliersScreen';
import SupplierDetailScreen from './screens/more/SupplierDetailScreen';
import SettingsScreen from './screens/more/SettingsScreen';
import AboutScreen from './screens/more/AboutScreen';
import InventoryScreen from './screens/inventory/InventoryScreen';
import LiveStockScreen from './screens/inventory/LiveStockScreen';
import MaterialStockScreen from './screens/inventory/MaterialStockScreen';
import TransfersScreen from './screens/inventory/TransfersScreen';
import TransferFormScreen from './screens/inventory/TransferFormScreen';
import TransferDetailScreen from './screens/inventory/TransferDetailScreen';
import CountListScreen from './screens/count/CountListScreen';
import CountSessionScreen from './screens/count/CountSessionScreen';
import TasksScreen from './screens/tasks/TasksScreen';
import EnquiryScreen from './screens/tasks/EnquiryScreen';
import AlertsScreen from './screens/tasks/AlertsScreen';
import SubstitutionScreen from './screens/tasks/SubstitutionScreen';
import MoreScreen from './screens/more/MoreScreen';
import ProfileScreen from './screens/more/ProfileScreen';
import HelpScreen from './screens/more/HelpScreen';
import './mobile.css';

/** Path the parent route matched (e.g. /mobile): the current path without the splat part. */
const useAppBase = (): string => {
  const { pathname } = useLocation();
  const splat = useParams()['*'] ?? '';
  const base = splat && pathname.endsWith(splat) ? pathname.slice(0, pathname.length - splat.length) : pathname;
  return base.replace(/\/+$/, '');
};

const INTER_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';

/** The prototype's font. The host page may already load it; otherwise the stylesheet is added once. */
const useInterFont = (): void => {
  useEffect(() => {
    const loaded = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some((link) =>
      link.href.includes('family=Inter'),
    );
    if (loaded) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = INTER_HREF;
    document.head.appendChild(link);
  }, []);
};

/** SILA Store: the mobile app of the SILA ME add-on, served by the host at /mobile. */
const MobileApp: React.FC = () => {
  const base = useAppBase();
  useInterFont();

  return (
    <MobileBaseProvider base={base}>
      <AccessProvider>
        <MyLocationProvider>
          <div className="sm-root">
            <div className="sm-app">
              <Routes>
                <Route index element={<Navigate to={`${base}/home`} replace />} />
                <Route path="home" element={<HomeScreen />} />

                <Route path="receive" element={<ReceiveScreen />} />
                <Route path="receive/scan" element={<ScanInvoiceScreen />} />
                <Route path="receive/invoices/:invoiceId" element={<InvoiceReviewScreen />} />
                <Route path="receive/grn/new" element={<GrnFormScreen />} />
                <Route path="receive/grns/:grnId" element={<GrnDetailScreen />} />
                <Route path="receive/pos" element={<OpenPosScreen />} />
                <Route path="receive/pos/:poId" element={<PoDetailScreen />} />
                <Route path="receive/history" element={<HistoryScreen />} />
                <Route path="receive/pending" element={<PendingGrnScreen />} />

                <Route path="inventory" element={<InventoryScreen />} />
                <Route path="inventory/stock" element={<LiveStockScreen />} />
                <Route path="inventory/stock/:materialId" element={<MaterialStockScreen />} />
                <Route path="inventory/transfers" element={<TransfersScreen />} />
                <Route path="inventory/transfers/new" element={<TransferFormScreen />} />
                <Route path="inventory/transfers/:transferId" element={<TransferDetailScreen />} />
                <Route path="inventory/counts" element={<CountListScreen />} />
                <Route path="inventory/counts/:stockCountId" element={<CountSessionScreen />} />
                <Route path="inventory/purchase-requests" element={<PurchaseRequestsScreen />} />

                <Route path="tasks" element={<TasksScreen />} />
                <Route path="tasks/alerts" element={<AlertsScreen />} />
                <Route path="tasks/enquiries/:enquiryId" element={<EnquiryScreen />} />
                <Route path="tasks/substitutions/:proposalId" element={<SubstitutionScreen />} />

                <Route path="more" element={<MoreScreen />} />
                <Route path="more/profile" element={<ProfileScreen />} />
                <Route path="more/help" element={<HelpScreen />} />
                <Route path="more/about" element={<AboutScreen />} />
                <Route path="more/settings" element={<SettingsScreen />} />
                <Route path="more/suppliers" element={<SuppliersScreen />} />
                <Route path="more/suppliers/:supplierId" element={<SupplierDetailScreen />} />
                <Route path="search" element={<SearchScreen />} />

                <Route path="*" element={<Navigate to={`${base}/home`} replace />} />
              </Routes>
              <PoweredFooter />
              <TabBar />
            </div>
          </div>
        </MyLocationProvider>
      </AccessProvider>
    </MobileBaseProvider>
  );
};

export default MobileApp;
