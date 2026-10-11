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
  { label: 'Recipes', detail: 'Menu recipes and stock at your location', to: 'recipes', visible: (can) => can.manageRecipe || can.approveRecipe },
  { label: 'Stock Count', detail: 'Start a count, or review and approve a submitted one', to: 'inventory/counts', visible: (can) => can.manageCount || can.approveCount },
  { label: 'Search', detail: 'Suppliers, purchase orders and GRNs', to: 'search' },
  { label: 'Suppliers', detail: 'Supplier Master: ID, TRN, status', to: 'more/suppliers' },
  { label: 'Purchase Orders', detail: 'Search open POs and receive against them', to: 'receive/pos' },
  { label: 'GRN History', detail: 'Goods receipts and their ERP status', to: 'receive/history' },
  { label: 'Internal Transfer History', detail: 'Completed transfers', to: 'inventory/transfers?tab=completed' },
  { label: 'Purchase Requests', detail: 'Requests raised from live inventory', to: 'inventory/purchase-requests', visible: (can) => can.requestPurchase },
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
