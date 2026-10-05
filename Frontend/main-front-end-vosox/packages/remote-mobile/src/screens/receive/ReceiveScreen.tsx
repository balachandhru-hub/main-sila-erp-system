import React from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import { OfflineBanner } from '../../components/StateViews';
import { useGo } from '../../navigation';

const ENTRIES: { label: string; detail: string; to: string }[] = [
  { label: 'Scan Invoice', detail: 'Capture invoice pages, review OCR, match supplier and PO, then save.', to: 'receive/scan' },
  { label: 'Receive Against PO', detail: 'Select supplier and open PO when no invoice scan is needed first.', to: 'receive/pos?mode=receive' },
  { label: 'View Open PO', detail: 'Search eligible open purchase orders for receiving.', to: 'receive/pos' },
  { label: 'Pending GRN', detail: 'Posting, failed, and unknown goods receipts.', to: 'receive/pending' },
  { label: 'Receiving History', detail: 'Posted and historical GRN documents.', to: 'receive/history' },
];

const ReceiveScreen: React.FC = () => {
  const go = useGo();
  return (
    <>
      <ScreenHeader title="Receive" eyebrow="Receiving" intro="Invoice scan, PO receiving, and GRN posting for the selected store." />
      <div className="sm-screen">
        <OfflineBanner />
        <ul className="sm-list">
          {ENTRIES.map((entry) => (
            <li key={entry.label}>
              <button type="button" className="sm-list-btn" onClick={() => go(entry.to)}>
                <span className="sm-row">
                  <strong>{entry.label}</strong>
                  <span className="sm-badge">Open</span>
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

export default ReceiveScreen;
