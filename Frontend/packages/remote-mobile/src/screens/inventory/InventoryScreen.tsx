import React from 'react';
import { getInventoryHome } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

interface MenuEntry {
  label: string;
  detail: string;
  to: string;
  /** Hidden when the role cannot use it. */
  visible?: (can: ReturnType<typeof useAccess>['can']) => boolean;
}

const ENTRIES: MenuEntry[] = [
  { label: 'Live Inventory', detail: 'Search stock, see it per location and decide what to do', to: 'inventory/stock' },
  { label: 'Quick Transfer', detail: 'Send stock now; the receiver confirms', to: 'inventory/transfers/new?mode=quick' },
  { label: 'Record Quick Transfer', detail: 'Stock you already collected; the source confirms the handover', to: 'inventory/transfers/new?mode=quick&collected=1' },
  { label: 'Transfers', detail: 'My requests, approvals, in transit, completed', to: 'inventory/transfers' },
  { label: 'Goods Issue', detail: 'Issue store stock to an outlet', to: 'inventory/goods-issues', visible: (can) => can.postGoodsIssue },
  { label: 'Waste and Adjustments', detail: 'Waste, damage, spoilage, opening stock', to: 'inventory/adjustments', visible: (can) => can.postAdjustment },
  { label: 'Receiving', detail: 'Receive against an open purchase order', to: 'receive/pos?mode=receive' },
  { label: 'Stock Count', detail: 'Open counts and recounts at my locations', to: 'inventory/counts' },
  { label: 'Purchase Requests', detail: 'My requests and their weekly bucket', to: 'inventory/purchase-requests', visible: (can) => can.requestPurchase },
  { label: 'Alerts / Actions', detail: 'Stockout, discrepancy and manager-review tasks', to: 'tasks/alerts' },
];

const InventoryScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { location, loading } = useMyLocation();
  const home = useLoad(() => getInventoryHome(location?.id), location ? `inv-home-${location.id}` : null);
  const value = (count: number | undefined): string => (home.loading ? '…' : count === undefined ? '—' : String(count));
  const summary: { label: string; value: string; to: string }[] = [
    { label: 'Low Stock', value: value(home.data?.lowStockItems), to: 'tasks/alerts' },
    { label: 'Incoming', value: value(home.data?.inTransitToReceive), to: 'inventory/transfers?tab=in-transit' },
    { label: 'Open Counts', value: value(home.data?.openStockCounts), to: 'inventory/counts' },
  ];
  const tasks: { label: string; value: string; to: string }[] = [
    { label: 'Approval', value: value(home.data?.pendingTransferApprovals), to: 'inventory/transfers?tab=to-approve' },
    { label: 'Enquiries', value: value(home.data?.openEnquiries), to: 'tasks' },
    { label: 'Alerts', value: value(home.data?.openAlerts), to: 'tasks/alerts' },
  ];

  return (
    <>
      <ScreenHeader
        title="Inventory"
        eyebrow="Store stock"
        intro="Search or scan a material, then move stock from nearby locations. Company code, plant and GL come from the Location Master."
      />
      <div className="sm-screen">
        <OfflineBanner />
        <section className="sm-section" aria-labelledby="sm-my-location">
          <h2 id="sm-my-location">My location</h2>
          {location ? (
            <strong className="sm-title">
              {location.locationName} <span className="sm-muted">· {location.propertyName}</span>
            </strong>
          ) : (
            !loading && <Empty text="No operational location assigned." />
          )}
          {home.error && <ErrorNotice message={home.error} onRetry={home.reload} />}
          {location && (
            <div className="sm-grid-3">
              {summary.map((card) => (
                <button key={card.label} type="button" className="sm-stat" onClick={() => go(card.to)}>
                  <strong>{card.value}</strong>
                  <span className="sm-muted">{card.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        {location && (
          <section className="sm-section" aria-labelledby="sm-inv-tasks">
            <h2 id="sm-inv-tasks">Tasks</h2>
            <div className="sm-grid-3">
              {tasks.map((card) => (
                <button key={card.label} type="button" className="sm-stat" onClick={() => go(card.to)}>
                  <strong>{card.value}</strong>
                  <span className="sm-muted">{card.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <ul className="sm-list">
          {ENTRIES.filter((entry) => !entry.visible || entry.visible(can)).map((entry) => (
            <li key={entry.label}>
              <button type="button" className="sm-list-btn" onClick={() => go(entry.to)}>
                <span className="sm-row">
                  <strong>{entry.label}</strong>
                  <span aria-hidden="true">›</span>
                </span>
                <span className="sm-meta">{entry.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default InventoryScreen;
