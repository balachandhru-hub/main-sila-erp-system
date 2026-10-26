import React, { useState } from 'react';
import { reconcileErpPosting, reprocessErpPosting, type SilaGoodsReceiptDetail } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import StatusBadge from '../../components/StatusBadge';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDateTime } from '../../format';
import { errorText } from '../../useLoad';

interface GrnErpCardProps {
  grn: SilaGoodsReceiptDetail;
  onChanged: () => void;
}

/** GRN steps: internal stock then S4, with reprocess for failed / skipped ERP posts. */
const GrnErpCard: React.FC<GrnErpCardProps> = ({ grn, onChanged }) => {
  const { can } = useAccess();
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [sapReference, setSapReference] = useState('');
  const erp = grn.erpPosting;
  const status = (erp?.status ?? (erp ? 'PENDING' : 'N/A')).toUpperCase();
  const posted = status === 'POSTED';
  const failed = status === 'FAILED';
  const skipped = status === 'SKIPPED';
  const unknown = status === 'UNKNOWN';
  const localFailed = status === 'FAILED_LOCAL';
  const stockedLines = grn.items.filter((item) => item.stocked && item.acceptedQty > 0).length;
  const manageErp = can.manageErpPosting;
  const canReprocess = (failed || skipped) && manageErp && !!erp && !unknown;

  const resend = async () => {
    if (!erp) return;
    setBusy(true);
    setNotice(null);
    try {
      await reprocessErpPosting(erp.id);
      setNotice({ tone: 'success', text: 'Sent to S4 again. Stock was already updated in step 1.' });
      onChanged();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const reconcile = async (postedInSap: boolean) => {
    if (!erp) return;
    setBusy(true);
    setNotice(null);
    try {
      await reconcileErpPosting(erp.id, postedInSap, postedInSap ? sapReference : '');
      setNotice({
        tone: 'success',
        text: postedInSap
          ? 'Reconciled as posted. Local finalization only. 101 was not sent.'
          : 'Reconciled as not posted. 101 was not sent.',
      });
      onChanged();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  const completeLocal = async () => {
    if (!erp) return;
    setBusy(true);
    setNotice(null);
    try {
      await reprocessErpPosting(erp.id);
      setNotice({ tone: 'success', text: 'Local finalization completed. SAP was not called.' });
      onChanged();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sm-card" aria-label="ERP posting">
      <div className="sm-row">
        <span className={`sm-result-icon${posted || (!erp && stockedLines === 0) ? '' : ' sm-result-icon--error'}`} aria-hidden="true">
          {posted || (!erp && stockedLines === 0) ? '✓' : failed || unknown || skipped ? '!' : '…'}
        </span>
        <StatusBadge status={status === 'N/A' ? 'SKIPPED' : status} />
      </div>
      <strong className="sm-title">
        {posted
          ? 'GRN POSTED SUCCESSFULLY'
          : failed
            ? 'S4 posting failed'
            : skipped
              ? 'S4 posting skipped'
              : unknown
                ? 'ERP outcome unknown'
                : erp
                  ? 'Waiting for S4'
                  : 'No S4 post required'}
      </strong>
      <span className="sm-meta">Step 1 — Internal stock: {stockedLines > 0 ? `Updated (${stockedLines} inventory line${stockedLines === 1 ? '' : 's'})` : 'No inventory materials'}</span>
      <span className="sm-meta">Step 2 — S4: {erp ? status : 'Not required'}</span>
      <span className="sm-meta">Purchase Order: {grn.poNumber}</span>
      <span className="sm-meta">Supplier: {grn.supplierName ?? '—'}</span>
      <span className="sm-meta">Supplier Invoice: {grn.invoiceNumber ?? '—'}</span>
      <span className="sm-meta">ERP Receipt Number: {erp?.erpReference ?? '—'}</span>
      <span className="sm-meta">Company Code: {erp?.companyCode ?? '—'}</span>
      <span className="sm-meta">Status: {erp?.status ?? 'Not sent'} · attempts {erp?.attempts ?? 0}</span>
      <span className="sm-meta">Posted Date: {formatDateTime(erp?.postedOn ?? grn.receivedOn)}</span>
      {erp?.errorMessage && <p className="sm-notice sm-notice--error">{erp.errorMessage}</p>}
      {failed && !erp?.errorMessage && <p className="sm-notice sm-notice--error">ERP returned a confirmed failure.</p>}
      {unknown && (
        <p className="sm-notice sm-notice--error">ERP outcome is unknown. Reconcile before posting again. 101 will not be sent.</p>
      )}
      {localFailed && (
        <p className="sm-notice sm-notice--warning">
          SAP goods receipt was created successfully. Complete local finalization only. SAP will not be called.
        </p>
      )}
      {unknown && manageErp && erp && (
        <>
          <label className="sm-label" htmlFor={`sm-grn-sap-ref-${erp.id}`}>SAP receipt reference</label>
          <input
            id={`sm-grn-sap-ref-${erp.id}`}
            className="sm-input"
            value={sapReference}
            onChange={(event) => setSapReference(event.target.value)}
            placeholder="Material document number"
          />
          <div className="sm-actions">
            <button
              type="button"
              className="sm-btn sm-btn--small sm-btn--primary"
              disabled={busy || sapReference.trim() === ''}
              onClick={() => void reconcile(true)}
            >
              {busy ? 'Reconciling…' : 'Reconcile'}
            </button>
            <button type="button" className="sm-btn sm-btn--small" disabled={busy} onClick={() => void reconcile(false)}>
              Not posted
            </button>
          </div>
        </>
      )}
      {localFailed && manageErp && erp && (
        <div className="sm-actions">
          <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busy} onClick={() => void completeLocal()}>
            {busy ? 'Completing…' : 'Complete local finalization'}
          </button>
        </div>
      )}
      <Notice notice={notice} />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--small" disabled={busy} onClick={onChanged}>
          Refresh status
        </button>
        {canReprocess && (
          <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busy} onClick={resend}>
            {busy ? 'Sending…' : 'Reprocess'}
          </button>
        )}
      </div>
      {(failed || unknown || skipped || localFailed) && !manageErp && (
        <p className="sm-meta">Recovery requires ERP posting management. This user can view the status only.</p>
      )}
    </section>
  );
};

export default GrnErpCard;
