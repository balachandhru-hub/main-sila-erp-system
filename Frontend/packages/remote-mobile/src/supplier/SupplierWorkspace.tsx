import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useMobileBase } from '../navigation';
import SupplierShell from './SupplierShell';
import { AlertsScreen, AutoOrderScreen, FrameworkScreen, MoreHub, O2cDetailScreen, O2cScreen, VmiProductScreen } from './screens/FrameworkScreens';
import HomeScreen from './screens/HomeScreen';
import { CatalogDetailScreen, CatalogScreen, CustomerDetailScreen, CustomerPoDetail, CustomerPoScreen, CustomersScreen, OrdersHub, SyncScreen } from './screens/OrderCatalogSync';
import { AuctionDetailScreen, AuctionListScreen, RfqDetailScreen, RfqListScreen, SalesHub } from './screens/SalesScreens';
import './supplier.css';

/** Supplier workspace inside the existing PWA. The signed-in session is unchanged. */
const SupplierWorkspace: React.FC = () => {
  const base = useMobileBase();
  return (
    <div className="sp-root">
      <SupplierShell>
        <Routes>
          <Route path="supplier" element={<HomeScreen />} />
          <Route path="supplier/sales" element={<SalesHub />} />
          <Route path="supplier/sales/rfq" element={<RfqListScreen />} />
          <Route path="supplier/sales/rfq/:rfqId" element={<RfqDetailScreen />} />
          <Route path="supplier/sales/auction" element={<AuctionListScreen />} />
          <Route path="supplier/sales/auction/:rfqId" element={<AuctionDetailScreen />} />
          <Route path="supplier/orders" element={<OrdersHub />} />
          <Route path="supplier/orders/customer-pos" element={<CustomerPoScreen />} />
          <Route path="supplier/orders/customer-pos/:poId" element={<CustomerPoDetail />} />
          <Route path="supplier/orders/sales-orders" element={<FrameworkScreen id="sales-orders" />} />
          <Route path="supplier/inventory" element={<FrameworkScreen id="inventory" />} />
          <Route path="supplier/catalog" element={<CatalogScreen />} />
          <Route path="supplier/catalog/:catalogId" element={<CatalogDetailScreen />} />
          <Route path="supplier/vmi" element={<FrameworkScreen id="vmi" />} />
          <Route path="supplier/vmi/products" element={<VmiProductScreen />} />
          <Route path="supplier/vmi/auto-order" element={<AutoOrderScreen />} />
          <Route path="supplier/fulfilment" element={<FrameworkScreen id="fulfilment" />} />
          <Route path="supplier/logistics" element={<FrameworkScreen id="logistics" />} />
          <Route path="supplier/o2c" element={<O2cScreen />} />
          <Route path="supplier/o2c/:poId" element={<O2cDetailScreen />} />
          <Route path="supplier/finance" element={<FrameworkScreen id="finance" />} />
          <Route path="supplier/customers" element={<CustomersScreen />} />
          <Route path="supplier/customers/:customerId" element={<CustomerDetailScreen />} />
          <Route path="supplier/approvals" element={<FrameworkScreen id="approvals" />} />
          <Route path="supplier/alerts" element={<AlertsScreen />} />
          <Route path="supplier/sync" element={<SyncScreen />} />
          <Route path="supplier/more" element={<MoreHub />} />
          <Route path="*" element={<Navigate to={`${base}/supplier`} replace />} />
        </Routes>
      </SupplierShell>
    </div>
  );
};

export default SupplierWorkspace;
