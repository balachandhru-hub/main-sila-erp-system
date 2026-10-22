import React from 'react';
import { getInventoryHome, getRecentAlerts } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getPurchaseRecommendations } from '../../../../remote-buyer/src/api/silaMe/silaInventoryControlApi';
import { getReceivingDashboard, type SilaReceivingTask } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { silaHomeCapabilities } from '../../../../remote-buyer/src/components/silaMe/silaHomeCapabilities';
import ScreenHeader from '../../components/ScreenHeader';
import LocationPicker from '../../components/LocationPicker';
import { MobileIcon, type MobileIconName } from '../../components/MobileIcons';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { firstNameOf, initialsOf, useAccess } from '../../access';
import { formatDateTime } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

interface QuickAction {
  label: string;
  icon: MobileIconName;
  to: string;
  show: boolean;
}

const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const HomeScreen: React.FC = () => {
  const go = useGo();
  const { person, can } = useAccess();
  const caps = silaHomeCapabilities(true, can);
  const { locations, location, setLocationId, loading: locLoading, error: locError, reload: reloadLocations } = useMyLocation();
  const dashboard = useLoad(
    () => getReceivingDashboard({ locationId: location?.id }),
    caps.viewReceiving || caps.viewInvoices || caps.viewCreditMemos
      ? (location ? `home-ops-${location.id}` : 'home-ops')
      : null,
  );
  const summary = useLoad(
    () => getInventoryHome(location?.id),
    caps.viewInventory ? (location ? `home-inv-${location.id}` : 'home-inv') : null,
  );
  const alerts = useLoad(() => getRecentAlerts(5), caps.viewInventory ? 'alerts' : null);
  const recommendations = useLoad(
    () => getPurchaseRecommendations({ locationId: location?.id }),
    caps.recommendation ? (location ? `home-rec-${location.id}` : 'home-rec') : null,
  );
  const data = dashboard.data;
  const kpis = data?.kpis;
  const tasks = (data?.tasks ?? []).filter((task) => {
    if (task.type === 'PROCESS_INVOICE') return caps.processInvoices;
    if (task.type === 'APPROVE_INVOICE') return caps.approveInvoices;
    if (task.type === 'INVOICE') return caps.viewInvoices;
    if (task.type === 'CREDIT_MEMO') return caps.viewCreditMemos || caps.processCreditMemos;
    return caps.viewReceiving;
  });
  const exceptions = (data?.exceptions ?? []).filter((row) => {
    if (row.exception.toLowerCase().includes('invoice')) return caps.viewInvoices;
    if (row.exception.toLowerCase().includes('credit memo')) return caps.viewCreditMemos;
    return caps.viewReceiving;
  });
  const approvals = (data?.approvals ?? []).filter((row) => {
    if (row.type === 'Transfer Approval') return caps.approveTransfer || caps.viewInventory;
    if (row.type === 'Credit Memo Approval') return caps.approveCreditMemos;
    if (row.type === 'Invoice Approval') return caps.approveInvoices;
    return caps.approvals;
  });

  const actions: QuickAction[] = [
    { label: 'Scan Invoice', icon: 'scan', to: 'receive/scan', show: caps.processInvoices },
    { label: 'Receive Goods', icon: 'receive', to: 'receive/pos?mode=receive', show: caps.receive },
    { label: 'Find PO', icon: 'purchaseOrders', to: 'receive/pos', show: caps.viewReceiving },
    { label: 'GRN History', icon: 'receive', to: 'receive/history', show: caps.viewReceiving },
    { label: 'Invoices', icon: 'scan', to: 'receive/posted-invoices', show: caps.viewInvoices },
    { label: 'Credit memos', icon: 'scan', to: 'receive/credit-memos', show: caps.viewCreditMemos },
    { label: 'Recommendations', icon: 'purchaseOrders', to: 'inventory/recommendations', show: caps.recommendation },
    { label: 'Live Stock', icon: 'inventory', to: 'inventory/stock', show: caps.viewInventory },
    { label: 'Raise ITO', icon: 'transfer', to: 'inventory/transfers/new', show: caps.viewInventory && can.manageTransfer },
    { label: 'Approvals', icon: 'approvals', to: 'tasks', show: caps.approveCount || caps.approveTransfer || caps.approveRecipe || caps.approvePrice || caps.approveInvoices || caps.approveCreditMemos },
  ];

  const openTask = (task: SilaReceivingTask) => {
    if (task.action === 'PROCESS_INVOICE') {
      go('receive/scan');
      return;
    }
    if (task.type === 'CREDIT_MEMO' || task.creditMemoId) {
      go(task.creditMemoId ? `receive/credit-memos/${task.creditMemoId}` : 'receive/credit-memos');
      return;
    }
    if (task.goodsReceiptId && task.action === 'REVIEW') {
      go(`receive/grns/${task.goodsReceiptId}`);
      return;
    }
    if (task.invoiceId) {
      go(`receive/invoices/${task.invoiceId}`);
      return;
    }
    if (task.purchaseOrderId && (task.action === 'RECEIVE' || task.action === 'RECEIVE_BALANCE')) {
      go(`receive/grn/new?poId=${encodeURIComponent(task.purchaseOrderId)}`);
      return;
    }
    if (task.purchaseOrderId) go(`receive/pos/${task.purchaseOrderId}`);
  };

  const name = firstNameOf(person);
  const count = (value: number | undefined, loading: boolean): string => (loading ? '…' : value === undefined ? '—' : String(value));

  return (
    <>
      <ScreenHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        intro={person?.organizationName ?? undefined}
        aside={
          <button type="button" className="sm-avatar" aria-label="Profile" onClick={() => go('more/profile')}>
            {initialsOf(person) || '•'}
          </button>
        }
      />
      <div className="sm-greet">
        {location && locations.length > 1 && (
          <LocationPicker label="My location" locations={locations} value={location.id} onChange={setLocationId} />
        )}
        {location && locations.length <= 1 && (
          <p className="sm-muted">My location: {location.locationName} · {location.propertyName}</p>
        )}
      </div>
      <div className="sm-screen">
        <OfflineBanner />
        {locLoading && <Loading text="Loading your locations…" />}
        {locError && <ErrorNotice message={locError} onRetry={reloadLocations} />}
        {!locLoading && !locError && locations.length === 0 && (
          <Empty text="No location assigned." description="You are not assigned to a store or outlet yet. Ask your administrator to assign you." />
        )}
        {dashboard.error && <ErrorNotice message={dashboard.error} onRetry={dashboard.reload} />}

        <section className="sm-section" aria-labelledby="sm-home-tasks">
          <h2 id="sm-home-tasks">My Tasks</h2>
          {tasks.length === 0 && !dashboard.loading && <Empty text="You're all caught up." description="No receiving or invoice tasks in your scope." />}
          <ul className="sm-list">
            {tasks.slice(0, 8).map((task, index) => (
              <li key={`${task.type}-${index}`}>
                <button type="button" className="sm-list-btn" onClick={() => openTask(task)}>
                  <span className="sm-row">
                    <strong>{task.poNumber || task.grnNumber || task.title}</strong>
                    <StatusBadge status={task.priority === 'CRITICAL' ? 'FAILED' : task.status || 'PENDING'} />
                  </span>
                  <span className="sm-meta">{task.title}{task.supplierName ? ` · ${task.supplierName}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-home-approvals">
          <h2 id="sm-home-approvals">Pending Approvals</h2>
          {approvals.length === 0 && !dashboard.loading && <Empty text="No pending approvals." description="PO and GRN reversal approvals are not in the current engine." />}
          <ul className="sm-list">
            {approvals.map((row, index) => (
              <li key={`${row.document}-${index}`}>
                <button type="button" className="sm-list-btn" onClick={() => row.creditMemoId ? go(`receive/credit-memos/${row.creditMemoId}`) : row.invoiceId ? go(`receive/invoices/${row.invoiceId}`) : row.transferId ? go('inventory/transfers?tab=to-approve') : undefined}>
                  <span className="sm-row"><strong>{row.document}</strong><StatusBadge status={row.status} /></span>
                  <span className="sm-meta">{row.type}{row.supplierName ? ` · ${row.supplierName}` : ''} · {row.age}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-home-attn">
          <h2 id="sm-home-attn">Attention Required</h2>
          {exceptions.length === 0 && !dashboard.loading && <Empty text="No items require your attention." />}
          <ul className="sm-list">
            {exceptions.slice(0, 8).map((row, index) => (
              <li key={`${row.document}-${index}`}>
                <button
                  type="button"
                  className="sm-list-btn"
                  onClick={() => row.creditMemoId ? go(`receive/credit-memos/${row.creditMemoId}`) : row.invoiceId ? go(`receive/invoices/${row.invoiceId}`) : row.goodsReceiptId ? go(`receive/grns/${row.goodsReceiptId}`) : row.purchaseOrderId ? go(`receive/pos/${row.purchaseOrderId}`) : undefined}
                >
                  <span className="sm-row"><strong>{row.document}</strong><StatusBadge status={row.severity === 'CRITICAL' ? 'FAILED' : row.status || 'PENDING'} /></span>
                  <span className="sm-meta">{row.exception} · {row.age}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-quick">
          <h2 id="sm-quick">Quick actions</h2>
          <div className="sm-grid-3">
            {actions.filter((action) => action.show).map((action) => (
              <button key={action.label} type="button" className="sm-action" onClick={() => go(action.to)}>
                <span className="sm-action__icon" aria-hidden="true"><MobileIcon name={action.icon} /></span>
                {action.label}
              </button>
            ))}
          </div>
        </section>

        {caps.viewReceiving && (
          <section className="sm-section" aria-labelledby="sm-recv-sum">
            <h2 id="sm-recv-sum">Receiving</h2>
            <div className="sm-grid-2">
              <button type="button" className="sm-stat" onClick={() => go('receive/pos')}><span className="sm-muted">Expected</span><strong>{count(kpis?.expectedToday, dashboard.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('receive/pos')}><span className="sm-muted">Pending</span><strong>{count(kpis?.pendingReceipt, dashboard.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('receive/pos')}><span className="sm-muted">Partial</span><strong>{count(kpis?.partiallyReceived, dashboard.loading)}</strong></button>
              <button type="button" className={`sm-stat${(kpis?.attentionRequired ?? 0) > 0 ? ' sm-stat--alert' : ''}`} onClick={() => go('receive/pending')}><span className="sm-muted">Attention</span><strong>{count(kpis?.attentionRequired, dashboard.loading)}</strong></button>
            </div>
          </section>
        )}

        {caps.viewInvoices && (
          <section className="sm-section" aria-labelledby="sm-inv-sum">
            <h2 id="sm-inv-sum">Invoices</h2>
            <div className="sm-grid-2">
              <button type="button" className="sm-stat" onClick={() => go('receive/scan')}><span className="sm-muted">Ready</span><strong>{count(data?.invoice.readyForProcessing, dashboard.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('receive/posted-invoices')}><span className="sm-muted">In progress</span><strong>{count(data?.invoice.inProgress, dashboard.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('receive/posted-invoices')}><span className="sm-muted">Posted</span><strong>{count(data?.invoice.postedRecently, dashboard.loading)}</strong></button>
              <button type="button" className={`sm-stat${(data?.invoice.postingFailed ?? 0) > 0 ? ' sm-stat--alert' : ''}`} onClick={() => go('receive')}><span className="sm-muted">Failed</span><strong>{count(data?.invoice.postingFailed, dashboard.loading)}</strong></button>
              {caps.viewCreditMemos && (
                <button type="button" className="sm-stat" onClick={() => go('receive/credit-memos?status=IN_PROGRESS')}><span className="sm-muted">Credit memos</span><strong>{count(data?.creditMemo.inProgress, dashboard.loading)}</strong></button>
              )}
            </div>
          </section>
        )}

        {caps.recommendation && (
          <section className="sm-section" aria-labelledby="sm-rec">
            <h2 id="sm-rec">Recommendations</h2>
            {recommendations.error && <ErrorNotice message={recommendations.error} onRetry={recommendations.reload} />}
            <div className="sm-grid-2">
              <button type="button" className="sm-stat" onClick={() => go('inventory/recommendations')}><span className="sm-muted">Stock-out</span><strong>{count(recommendations.data?.stockOut, recommendations.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('inventory/recommendations')}><span className="sm-muted">Below min</span><strong>{count(recommendations.data?.belowMinimum, recommendations.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('inventory/recommendations')}><span className="sm-muted">Recommended</span><strong>{count(recommendations.data?.recommendedPurchase, recommendations.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('inventory/recommendations')}><span className="sm-muted">Est. value</span><strong>{recommendations.loading ? '…' : recommendations.data?.estimatedValue ?? '—'}</strong></button>
            </div>
            <button type="button" className="sm-btn" onClick={() => go('inventory/recommendations')}>Review recommendations</button>
          </section>
        )}

        {caps.viewInventory && (
          <section className="sm-section" aria-labelledby="sm-stock">
            <h2 id="sm-stock">Inventory{location ? ` · ${location.locationName}` : ''}</h2>
            {summary.error && <ErrorNotice message={summary.error} onRetry={summary.reload} />}
            <div className="sm-grid-2">
              <button type="button" className="sm-stat" onClick={() => go('tasks/alerts')}><span className="sm-muted">Low stock</span><strong>{count(summary.data?.lowStockItems, summary.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('inventory/recommendations')}><span className="sm-muted">Stock-out</span><strong>{count(recommendations.data?.stockOut ?? summary.data?.lowStockItems, recommendations.loading || summary.loading)}</strong></button>
              <button type="button" className="sm-stat" onClick={() => go('tasks/alerts')}><span className="sm-muted">Alerts</span><strong>{count(summary.data?.openAlerts ?? alerts.data?.length, summary.loading)}</strong></button>
            </div>
          </section>
        )}

        <section className="sm-section" aria-labelledby="sm-home-activity">
          <h2 id="sm-home-activity">Recent Activity</h2>
          {(data?.activity ?? []).filter((item) => item.creditMemoId ? caps.viewCreditMemos : item.invoiceId ? caps.viewInvoices : caps.viewReceiving).length === 0 && !dashboard.loading && <Empty text="No recent receiving activity." />}
          <ul className="sm-list">
            {(data?.activity ?? []).filter((item) => item.creditMemoId ? caps.viewCreditMemos : item.invoiceId ? caps.viewInvoices : caps.viewReceiving).slice(0, 8).map((item) => (
              <li key={`${item.document}-${item.occurredOn}`}>
                <button type="button" className="sm-list-btn" onClick={() => item.creditMemoId ? go(`receive/credit-memos/${item.creditMemoId}`) : item.invoiceId ? go(`receive/invoices/${item.invoiceId}`) : item.goodsReceiptId ? go(`receive/grns/${item.goodsReceiptId}`) : undefined}>
                  <span className="sm-row"><strong>{item.document}</strong><StatusBadge status={item.status || item.action} /></span>
                  <span className="sm-meta">{formatDateTime(item.occurredOn)} · {item.action}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

export default HomeScreen;
