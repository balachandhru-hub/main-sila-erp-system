import React, { useState } from 'react';
import { reprocessErpPosting } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import { grnErpStatus, isGrnPending, loadRecentGrns } from './grnStatus';

/** Goods receipts awaiting S4 confirmation, with reprocess for failed / skipped posts. */
const PendingGrnScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(() => loadRecentGrns(30, 200), 'pending-grns');
  const pending = (data ?? []).filter(isGrnPending);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const reprocess = async (postingId: string, grnNumber: string) => {
    setBusyId(postingId);
    setNotice(null);
    try {
      await reprocessErpPosting(postingId);
      setNotice({ tone: 'success', text: `${grnNumber} sent to S4 again.` });
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ScreenHeader
        title="Pending GRN"
        eyebrow="Receive"
        back
        intro="Step 1 stock is already updated. Reprocess failed S4 posts (step 2) here."
      />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        <Notice notice={notice} />
        {!loading && !error && pending.length === 0 && <Empty text="No pending goods receipts." />}
        <ul className="sm-list">
          {pending.map((grn) => {
            const status = grnErpStatus(grn);
            const canSendAgain =
              can.manageErpPosting && !!grn.erpPostingId && (status === 'FAILED' || status === 'SKIPPED');
            return (
              <li key={grn.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                  <span className="sm-row">
                    <strong>{grn.grnNumber}</strong>
                    <StatusBadge status={status} />
                  </span>
                  <span>{grn.supplierName ?? '—'}</span>
                  <span className="sm-meta">
                    PO {grn.poNumber} · Invoice {grn.invoiceNumber ?? '—'} · {formatDate(grn.receivedOn)}
                  </span>
                </button>
                {canSendAgain && (
                  <button
                    type="button"
                    className="sm-btn sm-btn--small sm-btn--primary"
                    style={{ margin: '0.5rem 1rem 1rem' }}
                    disabled={busyId !== null}
                    onClick={() => reprocess(grn.erpPostingId!, grn.grnNumber)}
                  >
                    {busyId === grn.erpPostingId ? 'Sending…' : 'Reprocess S4'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default PendingGrnScreen;
