import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getGoodsReceiptReversal,
  reverseGoodsReceipt,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';

/** Reverse Goods Receipt: SAP Cancel on original Material Document (101 → 102). */
const GrnReverseScreen: React.FC = () => {
  const { grnId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getGoodsReceiptReversal(grnId), grnId || null);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const submit = async (opts?: { reverseInvoiceAndGrn?: boolean; localFinalizationOnly?: boolean }) => {
    if (!data) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setNotice({ tone: 'error', text: 'Enter a reversal reason.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await reverseGoodsReceipt(data.goodsReceiptId, {
        reason: trimmed,
        remarks: remarks.trim() || null,
        reverseInvoiceAndGrn: opts?.reverseInvoiceAndGrn === true,
        localFinalizationOnly: opts?.localFinalizationOnly === true || data.localFinalizationNeeded,
      });
      setNotice({ tone: 'success', text: result.message || 'Goods receipt reversed.' });
      go(`receive/grns/${data.goodsReceiptId}`, { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Could not reverse the goods receipt.') });
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Reverse Goods Receipt" eyebrow="Receive" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <Card title={data.grnNumber} aside={<StatusBadge status={data.status} />}>
              <dl className="sm-kv">
                <dt>GRN</dt>
                <dd>{data.grnNumber}</dd>
                <dt>SAP Material Document</dt>
                <dd>{data.materialDocument ?? '—'}</dd>
                <dt>Material Document Year</dt>
                <dd>{data.materialDocumentYear ?? '—'}</dd>
                <dt>PO</dt>
                <dd>{data.poNumber}</dd>
                <dt>Supplier</dt>
                <dd>{data.supplierName ?? '—'}</dd>
                <dt>Invoice</dt>
                <dd>
                  {data.invoiceNumber ?? '—'}
                  {data.invoiceGate ? ` · ${data.invoiceGate.replace(/_/g, ' ')}` : ''}
                </dd>
                {data.reversalMaterialDocument && (
                  <>
                    <dt>Reversal Material Document</dt>
                    <dd>
                      {data.reversalMaterialDocument}
                      {data.reversalMaterialDocumentYear ? ` / ${data.reversalMaterialDocumentYear}` : ''}
                    </dd>
                  </>
                )}
              </dl>
            </Card>

            {data.message && (
              <p
                className={`sm-notice ${
                  data.invoiceMustReverseFirst || data.decision === 'POSTING_UNKNOWN' || data.decision === 'IN_FLIGHT'
                    ? 'sm-notice--error'
                    : data.localFinalizationNeeded
                      ? 'sm-notice--error'
                      : 'sm-notice--success'
                }`}
                role="status"
              >
                {data.message}
              </p>
            )}

            {data.fullDocumentCancelOnly && data.canReverse && !data.localFinalizationNeeded && (
              <p className="sm-meta">Full Material Document Cancel only (SAP 102). Partial quantity reverse is not available.</p>
            )}

            <section className="sm-section" aria-labelledby="sm-rev-lines">
              <h2 id="sm-rev-lines">Lines ({data.lines.length})</h2>
              <ul className="sm-list">
                {data.lines.map((line) => (
                  <li key={line.goodsReceiptItemId} className="sm-card">
                    <strong className="sm-title">{line.materialName}</strong>
                    <span className="sm-meta">
                      {line.materialCode ?? '—'} · PO item {line.poItem || '—'}
                      {line.materialDocumentItem ? ` · MD item ${line.materialDocumentItem}` : ''}
                    </span>
                    <div className="sm-grid-2 sm-meta">
                      <span>Original {formatQty(line.originalReceivedQty)} {line.uom ?? ''}</span>
                      <span>Previously reversed {formatQty(line.previouslyReversedQty)}</span>
                      <span>Remaining {formatQty(line.remainingReversibleQty)}</span>
                      <span>Reversal qty {formatQty(line.reversalQty)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {(data.canReverse || data.invoiceMustReverseFirst || data.localFinalizationNeeded) && (
              <section className="sm-section" aria-labelledby="sm-rev-reason">
                <h2 id="sm-rev-reason">Reason</h2>
                <label className="sm-field">
                  <span>Reason (required)</span>
                  <input
                    type="text"
                    value={reason}
                    maxLength={500}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Why reverse this goods receipt?"
                  />
                </label>
                <label className="sm-field">
                  <span>Remarks (optional)</span>
                  <textarea
                    value={remarks}
                    maxLength={1000}
                    rows={3}
                    disabled={busy}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                </label>
              </section>
            )}

            <Notice notice={notice} />

            <div className="sm-actions">
              {data.invoiceMustReverseFirst && (
                <div className="sm-grid-2">
                  <button type="button" className="sm-btn" disabled={busy} onClick={() => go(`receive/grns/${data.goodsReceiptId}`)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sm-btn sm-btn--primary"
                    disabled={busy}
                    onClick={() => void submit({ reverseInvoiceAndGrn: true })}
                  >
                    {busy ? 'Working…' : 'Reverse Invoice & GRN'}
                  </button>
                </div>
              )}

              {data.localFinalizationNeeded && (
                <button
                  type="button"
                  className="sm-btn sm-btn--primary"
                  disabled={busy}
                  onClick={() => void submit({ localFinalizationOnly: true })}
                >
                  {busy ? 'Finalizing…' : 'Reprocess local finalization'}
                </button>
              )}

              {data.canReverse && !data.localFinalizationNeeded && !data.invoiceMustReverseFirst && (
                <button type="button" className="sm-btn sm-btn--primary" disabled={busy} onClick={() => void submit()}>
                  {busy ? 'Reversing…' : data.decision === 'READY' && data.reversalStatus === 'FAILED' ? 'Reprocess GRN reversal' : 'Confirm reverse GRN'}
                </button>
              )}

              {!data.canReverse && !data.invoiceMustReverseFirst && (
                <button type="button" className="sm-btn" disabled={busy} onClick={() => go(`receive/grns/${data.goodsReceiptId}`)}>
                  Back to GRN
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default GrnReverseScreen;
