import React from 'react';
import type { SupplierDashboardAnalytics } from '@vosox/shared-ui';
import { firstNameOf, initialsOf, useAccess } from '../../access';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { formatWhen } from '../format';
import { loadAnalytics, loadCustomerOrders, loadRfqs, loadSupplierContext, loadSync, PAGE_SIZE } from '../live';
import { EmptyState, ErrorNote, KpiCard, Loading, NotConnected, PageHeader, StatusBadge, toneOfStatus } from '../ui';

/** Same wording as the SILA Store home. */
const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const count = (value: number | undefined, loading: boolean): string => (loading ? '…' : value == null ? '—' : String(value));

const HomeScreen: React.FC = () => {
  const go = useGo();
  const { person } = useAccess();
  const name = firstNameOf(person);
  const context = useLoad(loadSupplierContext, 'supplier-context');
  const analytics = useLoad(loadAnalytics, 'supplier-analytics');
  const orders = useLoad(() => loadCustomerOrders(0, 5), 'supplier-po-home');
  const sync = useLoad(loadSync, 'supplier-sync-home');
  const live = useLoad(
    () => loadRfqs({ supplierId: context.data!.supplierId, status: 'LIVE', limit: PAGE_SIZE }),
    context.data ? `supplier-live-${context.data.supplierId}` : null,
  );

  const kpis: SupplierDashboardAnalytics['kpis'] | undefined = analytics.data?.kpis;
  const closing = analytics.data?.upcomingDeadlines ?? [];
  const lastSync = sync.data
    ?.map((row) => row.execution)
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        band={<p className="sm-muted">{person?.organizationName || 'What needs attention, from the Cloud services already connected.'}</p>}
        aside={
          <button type="button" className="sm-avatar" aria-label="More" onClick={() => go('supplier/more')}>
            {initialsOf(person) || '•'}
          </button>
        }
      />
      <div className="sp-screen">
        <section className="sp-section">
          <h2>Today</h2>
          {analytics.loading && <Loading text="Loading RFQ figures…" />}
          {analytics.error && <ErrorNote message={analytics.error} onRetry={analytics.reload} />}
          {analytics.data && (
            <div className="sp-kpis">
              <KpiCard label="Open for bidding" value={count(kpis?.openForBidding, false)} onClick={() => go('supplier/sales/rfq')} />
              <KpiCard label="Action required" value={count(kpis?.actionRequired, false)} onClick={() => go('supplier/sales/rfq')} />
              <KpiCard label="Quotations submitted" value={count(kpis?.quotationsSubmitted, false)} onClick={() => go('supplier/sales/rfq?view=submitted')} />
              <KpiCard label="RFQs won" value={count(kpis?.rfqsWon, false)} onClick={() => go('supplier/sales/rfq?view=awarded')} />
            </div>
          )}
        </section>

        <section className="sp-section">
          <h2>RFQs closing soon</h2>
          {analytics.data && closing.length === 0 && <EmptyState title="No data" text="No RFQs are in the Cloud closing schedule." />}
          {closing.map((item) => (
            <button key={item.supplierRfqId || item.buyerRfqId} type="button" className="sp-link" onClick={() => go(`supplier/sales/rfq/${item.buyerRfqId}`)}>
              <span>
                <strong>{item.rfqNumber || item.title}</strong>
                <small>{item.buyerName || 'Customer'} · closes {formatWhen(item.endDate)}</small>
              </span>
              <StatusBadge value={item.quotationSubmitted ? 'Submitted' : 'Response open'} tone={item.quotationSubmitted ? 'ok' : 'warn'} />
            </button>
          ))}
        </section>

        <section className="sp-section">
          <h2>Live auctions</h2>
          {context.error && <ErrorNote message={context.error} onRetry={context.reload} />}
          {live.loading && <Loading />}
          {live.error && <ErrorNote message={live.error} onRetry={live.reload} />}
          {live.data && live.data.length === 0 && <EmptyState title="No live auctions" text="The Cloud RFQ list has no LIVE sourcing event right now." />}
          {live.data?.slice(0, 5).map((item) => (
            <button key={item.rfqId} type="button" className="sp-link" onClick={() => go(`supplier/sales/auction/${item.rfqId}`)}>
              <span>
                <strong>{item.number || item.title}</strong>
                <small>{item.title} · ends {formatWhen(item.endDate)}</small>
              </span>
              <StatusBadge value="LIVE" tone="warn" />
            </button>
          ))}
        </section>

        <section className="sp-section">
          <h2>Customer purchase orders</h2>
          {orders.loading && <Loading />}
          {orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}
          {orders.data && orders.data.length === 0 && <EmptyState title="No data" text="No customer purchase orders were returned." />}
          {orders.data?.map((order) => (
            <button key={order.id} type="button" className="sp-link" onClick={() => go(`supplier/orders/customer-pos/${order.id}`)}>
              <span>
                <strong>{order.poNumber}</strong>
                <small>{order.buyerName || 'Customer'} · {formatWhen(order.orderDate)}</small>
              </span>
              <StatusBadge value={order.status} tone={toneOfStatus(order.status)} />
            </button>
          ))}
        </section>

        <section className="sp-section">
          <h2>Sync</h2>
          {sync.loading && <Loading />}
          {sync.error && <ErrorNote message={sync.error} onRetry={sync.reload} />}
          {sync.data && !lastSync && <EmptyState title="No sync history" text="Supplier integrations have no recorded run yet." />}
          {lastSync && (
            <button type="button" className="sp-link" onClick={() => go('supplier/sync')}>
              <span>
                <strong>Last sync {formatWhen(lastSync.completedAt || lastSync.startedAt)}</strong>
                <small>{lastSync.recordsRead} read · {lastSync.recordsFailed} failed</small>
              </span>
              <StatusBadge value={lastSync.status} tone={toneOfStatus(lastSync.status)} />
            </button>
          )}
        </section>

        <section className="sp-section">
          <h2>Not connected yet</h2>
          <div className="sp-kpis">
            <KpiCard label="Stock risks" value="Not connected" />
            <KpiCard label="Shipments" value="Not connected" />
            <KpiCard label="Approvals" value="Not connected" />
            <KpiCard label="Payments" value="Not connected" />
          </div>
        </section>

        <section className="sp-section">
          <h2>Quick actions</h2>
          <div className="sm-grid-3">
            {[
              ['RFQ', '⚑', 'supplier/sales/rfq'],
              ['E-Auction', '◎', 'supplier/sales/auction'],
              ['Catalog', '▤', 'supplier/catalog'],
              ['Customer PO', '☰', 'supplier/orders/customer-pos'],
              ['Inventory', '▦', 'supplier/inventory'],
              ['VMI', '▣', 'supplier/vmi'],
              ['Shipments', '⇨', 'supplier/logistics'],
              ['O2C', '✓', 'supplier/o2c'],
            ].map(([label, icon, to]) => (
              <button key={to} type="button" className="sm-action" onClick={() => go(to)}>
                <span className="sm-action__icon" aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="sp-section">
          <h2>Order pipeline</h2>
          <div className="sp-card">
            <div className="sp-pipeline">
              <button type="button" className="sp-btn sp-btn--secondary" onClick={() => go('supplier/orders/customer-pos')}>Customer PO</button>
              <span>↓</span>
              {['Sales order', 'Goods issue', 'Delivery', 'Shipment', 'Invoice', 'Payment'].map((step, index, all) => (
                <React.Fragment key={step}>
                  <span className="sp-badge sp-badge--muted">{step}</span>
                  {index < all.length - 1 && <span>↓</span>}
                </React.Fragment>
              ))}
            </div>
            <p className="sp-note">Customer PO is live. The stages after it are not connected.</p>
          </div>
        </section>

        <NotConnected title="Alerts beyond RFQ, auction and sync" text="Shipment, stock, invoice and approval alerts have no Cloud feed yet." />
      </div>
    </>
  );
};

export default HomeScreen;
