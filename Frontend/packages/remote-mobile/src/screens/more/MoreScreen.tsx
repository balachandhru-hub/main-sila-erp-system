import React from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';

interface MoreEntry {
  label: string;
  detail: string;
  to: string;
  /** Hidden when the role cannot use it. */
  visible?: (can: ReturnType<typeof useAccess>['can']) => boolean;
}

const ENTRIES: MoreEntry[] = [
  { label: 'Scan invoice', detail: 'Photograph the supplier invoice and read it', to: 'receive/scan' },
  { label: 'Receive goods', detail: 'Select the supplier purchase order and post the receipt', to: 'receive/pos?mode=receive' },
  { label: 'Purchase orders', detail: 'Search open POs and receive against them', to: 'receive/pos' },
  { label: 'Suppliers', detail: 'Supplier Master: ID, TRN, status', to: 'more/suppliers' },
  { label: 'Search', detail: 'Suppliers, purchase orders and GRNs', to: 'search' },
  { label: 'GRN History', detail: 'Goods receipts and their ERP status', to: 'receive/history' },
  { label: 'Internal Transfer History', detail: 'Completed transfers', to: 'inventory/transfers?tab=completed' },
  { label: 'Purchase Requests', detail: 'Requests raised from live inventory', to: 'inventory/purchase-requests', visible: (can) => can.requestPurchase },
  { label: 'Goods Issue', detail: 'Issue store stock to an outlet', to: 'inventory/goods-issues', visible: (can) => can.postGoodsIssue },
  { label: 'Waste and Adjustments', detail: 'Waste, damage, spoilage, opening stock', to: 'inventory/adjustments', visible: (can) => can.postAdjustment },
  { label: 'Profile', detail: 'Your account and log out', to: 'more/profile' },
  { label: 'Settings', detail: 'Connectivity and working location', to: 'more/settings' },
  { label: 'Help', detail: 'How SILA Store works', to: 'more/help' },
  { label: 'About SILA ME', detail: 'Version and capability status', to: 'more/about' },
];

const MoreScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  return (
    <>
      <ScreenHeader title="More" eyebrow="SILA ME" />
      <div className="sm-screen">
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

export default MoreScreen;
