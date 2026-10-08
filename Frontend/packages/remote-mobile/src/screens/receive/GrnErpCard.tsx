import React, { useState } from 'react';
import { reprocessErpPosting, type SilaGoodsReceiptDetail } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import StatusBadge from '../../components/StatusBadge';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDateTime } from '../../format';
import { errorText } from '../../useLoad';

interface GrnErpCardProps {
  grn: SilaGoodsReceiptDetail;
  onChanged: () => void;
}

/** GRN result: posted / failed / unknown with the ERP receipt number, as on the prototype's result screen. */
const GrnErpCard: React.FC<GrnErpCardProps> = ({ grn, onChanged }) => {
  const { can } = useAccess();
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const erp = grn.erpPosting;
  const status = (erp?.status ?? 'PENDING').toUpperCase();
  const posted = status === 'POSTED';
  const failed = status === 'FAILED';
  const unknown = status === 'UNKNOWN';

  const resend = async () => {
    if (!erp) return;
    setBusy(true);
    setNotice(null);
    try {
      await reprocessErpPosting(erp.id);
      setNotice({ tone: 'success', text: 'Queued again; it is sent to the ERP within a minute.' });
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
        <span className={`sm-result-icon${posted ? '' : ' sm-result-icon--error'}`} aria-hidden="true">
          {posted ? '✓' : failed || unknown ? '!' : '…'}
        </span>
        <StatusBadge status={status} />
      </div>
      <strong className="sm-title">
        {posted ? 'GRN POSTED SUCCESSFULLY' : failed ? 'GRN posting failed' : unknown ? 'ERP outcome unknown' : 'Waiting for the ERP'}
      </strong>
      <span className="sm-meta">Purchase Order: {grn.poNumber}</span>
      <span className="sm-meta">Supplier: {grn.supplierName ?? '—'}</span>
      <span className="sm-meta">Supplier Invoice: {grn.invoiceNumber ?? '—'}</span>
      <span className="sm-meta">ERP Receipt Number: {erp?.erpReference ?? '—'}</span>
      <span className="sm-meta">Company Code: {erp?.companyCode ?? '—'}</span>
      <span className="sm-meta">Status: {erp?.status ?? 'Not sent yet'} · attempts {erp?.attempts ?? 0}</span>
      <span className="sm-meta">Posted Date: {formatDateTime(erp?.postedOn ?? grn.receivedOn)}</span>
      {!erp && <p className="sm-meta">Queued; it is sent to the ERP automatically.</p>}
      {erp?.errorMessage && <p className="sm-notice sm-notice--error">{erp.errorMessage}</p>}
      {failed && !erp?.errorMessage && <p className="sm-notice sm-notice--error">ERP returned a confirmed failure.</p>}
      {unknown && <p className="sm-notice sm-notice--error">ERP outcome is unknown. Reconcile before posting again.</p>}
      <Notice notice={notice} />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--small" disabled={busy} onClick={onChanged}>
          Refresh status
        </button>
        {failed && can.manageErpPosting && (
          <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busy} onClick={resend}>
            {busy ? 'Sending…' : 'Retry'}
          </button>
        )}
      </div>
      {(failed || unknown) && !can.manageErpPosting && <p className="sm-meta">Your administrator resends or reconciles it from ERP postings.</p>}
    </section>
  );
};

export default GrnErpCard;
