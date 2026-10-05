import React from 'react';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { grnErpStatus, isGrnPending, loadRecentGrns } from './grnStatus';

/** Goods receipts of the last 30 days the ERP has not confirmed yet: posting, failed or unknown. */
const PendingGrnScreen: React.FC = () => {
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => loadRecentGrns(30, 200), 'pending-grns');
  const pending = (data ?? []).filter(isGrnPending);

  return (
    <>
      <ScreenHeader title="Pending GRN" eyebrow="Receive" back intro="Goods receipts of the last 30 days that the ERP has not confirmed." />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && pending.length === 0 && <Empty text="No pending goods receipts." />}
        <ul className="sm-list">
          {pending.map((grn) => (
            <li key={grn.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                <span className="sm-row">
                  <strong>{grn.grnNumber}</strong>
                  <StatusBadge status={grnErpStatus(grn)} />
                </span>
                <span>{grn.supplierName ?? '—'}</span>
                <span className="sm-meta">
                  PO {grn.poNumber} · Invoice {grn.invoiceNumber ?? '—'} · {formatDate(grn.receivedOn)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default PendingGrnScreen;
