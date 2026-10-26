import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PurchaseOrderListItem } from '../../../../remote-buyer/src/api/purchaseOrderApi';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { signOut } from '../../person';
import { useLoad } from '../../useLoad';
import { CLOUD_LATER, formatMoney, formatWhen } from '../format';
import { isSupplierOnlyRole } from '../roles';
import { loadCustomerOrders, loadSync } from '../live';
import { ALERT_CATEGORIES, AUTO_ORDER_STEPS, FRAMEWORK, VMI_KPIS, type FrameworkModule } from '../modules';
import { ChipRow, EmptyState, ErrorNote, KpiCard, LaterButton, Loading, NotConnected, PageHeader, SearchField, StatusBadge, Timeline, toneOfStatus } from '../ui';

const FrameworkBody: React.FC<{ module: FrameworkModule }> = ({ module }) => {
  const go = useGo();
  const [view, setView] = useState(module.views[0]?.id ?? '');
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader eyebrow={module.eyebrow} title={module.title} intro={module.intro} />
      <div className="sp-screen">
        <SearchField value={search} onChange={setSearch} placeholder={`Search ${module.title.toLowerCase()}`} />
        <ChipRow options={module.views} value={view} onChange={setView} />
        <div className="sp-legend" aria-label="Future filters">
          {module.filters.map((filter) => <span key={filter}>{filter}</span>)}
        </div>
        {module.id === 'vmi' && view === 'dashboard' && (
          <div className="sp-kpis">
            {VMI_KPIS.map((label) => <KpiCard key={label} label={label} value="Not connected" />)}
          </div>
        )}
        {module.id === 'vmi' && (
          <div className="sp-row">
            <button type="button" className="sp-btn sp-btn--secondary" onClick={() => go('supplier/vmi/products')}>Products across customers</button>
            <button type="button" className="sp-btn sp-btn--secondary" onClick={() => go('supplier/vmi/auto-order')}>Forecast path</button>
          </div>
        )}
        {module.timeline && (view === 'pipeline' || view === 'overview') && (
          <Timeline steps={module.timeline.map((label) => ({ label, state: 'wait', detail: 'Not connected' }))} />
        )}
        <div className="sp-legend" aria-label="Fields">
          {module.fields.map((field) => <span key={field}>{field}</span>)}
        </div>
        <NotConnected title="No data available" text="This list will fill from Cloud. No sample rows are shown." />
        {search.trim() && <p className="sp-note">Search is ready for the Cloud list. There is nothing to match yet.</p>}
        {module.actions.length > 0 && (
          <div className="sp-row">
            {module.actions.map((action) => <LaterButton key={action} label={action} />)}
          </div>
        )}
        <p className="sp-note">{CLOUD_LATER}</p>
      </div>
    </>
  );
};

export const FrameworkScreen: React.FC<{ id: string }> = ({ id }) => {
  const module = FRAMEWORK[id];
  if (!module) return <NotConnected title="Unknown module" />;
  return <FrameworkBody module={module} />;
};

export const VmiProductScreen: React.FC = () => (
  <>
    <PageHeader eyebrow="VMI" title="Products across customers" intro="One product, every customer. No stock positions are available yet." />
    <div className="sp-screen">
      <div className="sp-card">
        <h2>Product</h2>
        <p className="sp-note">Customer positions such as healthy, low stock, replenishment, in transit and forecast stockout will list here.</p>
      </div>
      <NotConnected />
    </div>
  </>
);

export const AutoOrderScreen: React.FC = () => (
  <>
    <PageHeader eyebrow="VMI" title="Forecast and auto-order" intro="The future path from demand to an approved order. Nothing is ordered from this screen." />
    <div className="sp-screen">
      <Timeline steps={AUTO_ORDER_STEPS.map((label) => ({ label, state: 'wait' as const, detail: 'Not connected' }))} />
      <NotConnected title="No forecast" text="No forecasting or automatic order is running." />
    </div>
  </>
);

const O2C_STEPS = ['Customer PO', 'Sales order', 'Stock allocation', 'Goods issue', 'Delivery order', 'Shipment', 'Invoice', 'Payment', 'Statement of account'];

export const O2cScreen: React.FC = () => {
  const go = useGo();
  const orders = useLoad(() => loadCustomerOrders(0, 20), 'o2c');
  return (
    <>
      <PageHeader eyebrow="SILA O2C" title="Order to cash" intro="Customer PO is live. Every stage after it is waiting for Cloud." />
      <div className="sp-screen">
        <Timeline
          steps={O2C_STEPS.map((label, index) => ({
            label,
            state: index === 0 ? 'current' : 'wait',
            detail: index === 0 ? 'Connected' : 'Not connected',
          }))}
        />
        {orders.loading && <Loading />}
        {orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}
        {orders.data && orders.data.length === 0 && <EmptyState title="No customer POs" text="The order-to-cash list starts from customer purchase orders." />}
        {orders.data?.map((order) => (
          <button key={order.id} type="button" className="sp-link" onClick={() => go(`supplier/o2c/${order.id}`)}>
            <span>
              <strong>{order.poNumber}</strong>
              <small>{order.buyerName || 'Customer'} · {formatMoney(order.totalAmount, order.currency)}</small>
            </span>
            <StatusBadge value={order.status} tone={toneOfStatus(order.status)} />
          </button>
        ))}
      </div>
    </>
  );
};

export const O2cDetailScreen: React.FC = () => {
  const { poId = '' } = useParams();
  const go = useGo();
  const orders = useLoad(() => loadCustomerOrders(0, 100), 'o2c-detail');
  const order = orders.data?.find((item) => item.id === poId) ?? null;
  return (
    <>
      <PageHeader eyebrow="Order to cash" title={order?.poNumber || 'Order'} back={() => go('supplier/o2c')} />
      <div className="sp-screen">
        {orders.loading && <Loading />}
        {order && <OrderFacts order={order} />}
        {!orders.loading && !order && !orders.error && <EmptyState title="Order not in the latest page" text="Choose the order from the order-to-cash list." />}
        <Timeline
          steps={[
            { label: 'PO', state: order ? 'done' : 'open', detail: order ? order.poNumber : 'Not loaded' },
            { label: 'SO', state: 'open', detail: 'Not connected' },
            { label: 'Goods issue', state: 'open', detail: 'Not connected' },
            { label: 'Delivery', state: 'open', detail: 'Not connected' },
            { label: 'Shipment', state: 'open', detail: 'Not connected' },
            { label: 'Invoice', state: 'open', detail: 'Not connected' },
            { label: 'Payment', state: 'open', detail: 'Not connected' },
          ]}
        />
      </div>
    </>
  );
};

const OrderFacts: React.FC<{ order: PurchaseOrderListItem }> = ({ order }) => (
  <dl className="sp-facts">
    <div><dt>Customer</dt><dd>{order.buyerName || '—'}</dd></div>
    <div><dt>Customer PO</dt><dd>{order.poNumber}</dd></div>
    <div><dt>Order value</dt><dd>{formatMoney(order.totalAmount, order.currency)}</dd></div>
    <div><dt>Currency</dt><dd>{order.currency || '—'}</dd></div>
    <div><dt>Requested delivery</dt><dd>—</dd></div>
    <div><dt>Current stage</dt><dd>Customer PO · {formatWhen(order.orderDate)}</dd></div>
  </dl>
);

export const AlertsScreen: React.FC = () => {
  const go = useGo();
  const sync = useLoad(loadSync, 'alert-sync');
  const failures = (sync.data ?? []).filter((row) => (row.execution?.status || '').toUpperCase() === 'FAILED' || (row.execution?.recordsFailed ?? 0) > 0);
  return (
    <>
      <PageHeader eyebrow="Alerts" title="Alerts and actions" intro="RFQ, auction and sync alerts use Cloud data. The other categories are not connected." />
      <div className="sp-screen">
        {ALERT_CATEGORIES.map((category) => (
          <article key={category.id} className="sp-card">
            <div className="sp-row">
              <h2>{category.label}</h2>
              <StatusBadge value={category.live ? 'Live' : 'Not connected'} tone={category.live ? 'info' : 'muted'} />
            </div>
            {category.id === 'rfq' && (
              <button type="button" className="sp-btn sp-btn--secondary" onClick={() => go('supplier/sales/rfq?view=closing')}>Open closing RFQs</button>
            )}
            {category.id === 'auction' && (
              <button type="button" className="sp-btn sp-btn--secondary" onClick={() => go('supplier/sales/auction')}>Open live auctions</button>
            )}
            {category.id === 'integration' && sync.loading && <Loading />}
            {category.id === 'integration' && sync.error && <ErrorNote message={sync.error} onRetry={sync.reload} />}
            {category.id === 'integration' && sync.data && failures.length === 0 && <EmptyState title="No integration failures" text="The latest supplier sync runs have no failed records." />}
            {category.id === 'integration' && failures.map((row) => (
              <p key={row.configuration.id} className="sp-note">{row.configuration.name}: {row.execution?.errorMessageSafe || `${row.execution?.recordsFailed ?? 0} failed`}</p>
            ))}
            {!category.live && <p className="sp-note">No data. This alert is not connected.</p>}
          </article>
        ))}
      </div>
    </>
  );
};

export const MoreHub: React.FC = () => {
  const go = useGo();
  const { person } = useAccess();
  const items = [
    ['Catalog', 'supplier/catalog', 'Live'],
    ['VMI', 'supplier/vmi', 'Not connected'],
    ['Fulfilment', 'supplier/fulfilment', 'Not connected'],
    ['Logistics', 'supplier/logistics', 'Not connected'],
    ['SILA O2C', 'supplier/o2c', 'PO live'],
    ['Finance', 'supplier/finance', 'Not connected'],
    ['Customers', 'supplier/customers', 'From purchase orders'],
    ['Approvals', 'supplier/approvals', 'Not connected'],
    ['Alerts & Actions', 'supplier/alerts', 'Partial'],
    ['Sync', 'supplier/sync', 'Live'],
    ...(isSupplierOnlyRole(person?.roleName) ? [] : [['Buyer home', 'home', 'Store operations']]),
  ];
  const [leaving, setLeaving] = useState(false);
  const logOut = async () => {
    setLeaving(true);
    try {
      await signOut();
    } catch {
      setLeaving(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="More" title="More" intro="The rest of SILA Store." />
      <div className="sp-screen">
        {items.map(([label, to, hint]) => (
          <button key={to} type="button" className="sp-link" onClick={() => go(to)}>
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
        <button type="button" className="sm-btn" onClick={logOut} disabled={leaving}>
          {leaving ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </>
  );
};
