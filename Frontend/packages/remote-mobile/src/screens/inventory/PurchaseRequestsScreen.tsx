import React, { useState } from 'react';
import {
  cancelPurchaseRequest,
  getPurchaseRequests,
  type SilaPurchaseRequest,
} from '../../../../remote-buyer/src/api/silaMe/silaInventoryControlApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { errorText, useLoad } from '../../useLoad';

const PAGE = 50;

const TABS: { key: string; label: string }[] = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'ADDED_TO_BUCKET', label: 'In weekly bucket' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: '', label: 'All' },
];

/** Purchase requests raised at my locations (mine by default); a submitted request can be cancelled. */
const PurchaseRequestsScreen: React.FC = () => {
  const { person, can, loading: accessLoading } = useAccess();
  const [status, setStatus] = useState<string>('SUBMITTED');
  const [onlyMine, setOnlyMine] = useState<boolean>(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const { data, loading, error, reload } = useLoad(
    () => getPurchaseRequests(status, 0, PAGE),
    can.requestPurchase ? `prs-${status}` : null,
  );
  const rows = (data ?? []).filter((row) => !onlyMine || !person || row.requestedBy === person.userId);

  const cancel = async (request: SilaPurchaseRequest) => {
    setBusyId(request.id);
    setNotice(null);
    try {
      await cancelPurchaseRequest(request.id);
      setConfirmId(null);
      setNotice({ tone: 'success', text: `${request.requestNumber} cancelled.` });
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ScreenHeader title="Purchase requests" eyebrow="Inventory" back intro="Requests raised from live inventory; the buyer adds them to the weekly bucket." />
      <div className="sm-screen">
        {!accessLoading && !can.requestPurchase && <Empty text="Purchase requests are not available for your role." />}
        {can.requestPurchase && (
          <>
            <div className="sm-tabs sm-tabs--wrap" role="group" aria-label="Status">
              {TABS.map((tab) => (
                <button key={tab.label} type="button" className="sm-tab" aria-pressed={tab.key === status} onClick={() => setStatus(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="sm-check">
              <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} />
              Only my requests
            </label>
            <Notice notice={notice} />
            {loading && <Loading />}
            {error && <ErrorNotice message={error} onRetry={reload} />}
            {!loading && !error && rows.length === 0 && (
              <Empty text="No purchase requests." description="Raise one from Live stock when a material is short and no location can give it." />
            )}
            <ul className="sm-list">
              {rows.map((row) => (
                <li key={row.id} className="sm-card">
                  <div className="sm-row">
                    <strong className="sm-title">{row.requestNumber}</strong>
                    <StatusBadge status={row.status} />
                  </div>
                  <span>
                    {row.materialName ?? '—'} <span className="sm-muted">({row.materialCode ?? '—'})</span>
                  </span>
                  <span className="sm-meta">
                    {formatQty(row.quantity)} {row.uom} · {row.locationName ?? '—'} · {formatDate(row.requestedOn)}
                  </span>
                  <span className="sm-meta">
                    {row.requestedByName ?? '—'}
                    {row.weeklyBucketCode ? ` · bucket ${row.weeklyBucketCode}` : ''}
                    {row.catalogMapped ? '' : ' · not mapped to a catalog product'}
                  </span>
                  {row.reason && <span className="sm-meta">Reason: {row.reason}</span>}
                  {row.status === 'SUBMITTED' && confirmId !== row.id && (
                    <button type="button" className="sm-btn sm-btn--small sm-btn--danger" onClick={() => setConfirmId(row.id)}>
                      Cancel request
                    </button>
                  )}
                  {confirmId === row.id && (
                    <div className="sm-notice sm-notice--warning sm-section" role="alertdialog" aria-label="Cancel the request">
                      <p>Cancel {row.requestNumber}? This cannot be undone.</p>
                      <div className="sm-grid-2">
                        <button type="button" className="sm-btn sm-btn--small" disabled={busyId === row.id} onClick={() => setConfirmId(null)}>
                          Keep it
                        </button>
                        <button type="button" className="sm-btn sm-btn--small sm-btn--danger" disabled={busyId === row.id} onClick={() => cancel(row)}>
                          {busyId === row.id ? 'Cancelling…' : 'Cancel request'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {(data ?? []).length === PAGE && <p className="sm-muted">Showing the newest {PAGE} requests.</p>}
          </>
        )}
      </div>
    </>
  );
};

export default PurchaseRequestsScreen;
