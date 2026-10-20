import React, { useEffect, useMemo, useState } from 'react';
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

/** PWA GRN REVERSAL: original posted GRN, touch-friendly Reverse Qty → FIVE S4-GRN REVERSAL (102). */
const GrnReverseScreen: React.FC = () => {
  const { grnId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getGoodsReceiptReversal(grnId), grnId || null);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    data.lines.forEach((line) => {
      next[line.goodsReceiptItemId] = String(line.reversalQty ?? line.remainingReversibleQty ?? 0);
    });
    setQtyByLine(next);
  }, [data]);

  const parsedLines = useMemo(() => {
    if (!data) return [];
    return data.lines.map((line) => {
      const raw = qtyByLine[line.goodsReceiptItemId] ?? '0';
      const qty = Number(raw);
      return { ...line, reversalQuantity: Number.isFinite(qty) ? qty : NaN };
    });
  }, [data, qtyByLine]);

  const selectedLines = useMemo(
    () => parsedLines.filter((line) => Number.isFinite(line.reversalQuantity) && line.reversalQuantity > 0),
    [parsedLines],
  );

  const qtyError = useMemo(() => {
    for (const line of parsedLines) {
      if (!Number.isFinite(line.reversalQuantity) || line.reversalQuantity < 0) {
        return `Enter a valid reverse qty for ${line.materialName}.`;
      }
      if (line.reversalQuantity > line.remainingReversibleQty + 0.0001) {
        return `Reverse qty for ${line.materialName} exceeds available ${line.remainingReversibleQty}.`;
      }
    }
    if (data?.canReverse && !data.localFinalizationNeeded && selectedLines.length === 0) {
      return 'Set Reverse Qty greater than zero on at least one line.';
    }
    return null;
  }, [parsedLines, data, selectedLines.length]);

  const isPartial = useMemo(() => {
    if (!data) return false;
    const eligible = data.lines.filter((line) => line.remainingReversibleQty > 0.0001);
    if (selectedLines.length !== eligible.length) return true;
    return selectedLines.some((line) => Math.abs(line.reversalQuantity - line.remainingReversibleQty) > 0.0001);
  }, [data, selectedLines]);

  const setQty = (lineId: string, value: string) => {
    setQtyByLine((current) => ({ ...current, [lineId]: value }));
  };

  const nudge = (lineId: string, delta: number, max: number) => {
    const current = Number(qtyByLine[lineId] ?? '0');
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.min(max, Math.max(0, base + delta));
    setQty(lineId, String(next));
  };

  const submit = async (opts?: { reverseInvoiceAndGrn?: boolean; localFinalizationOnly?: boolean }) => {
    if (!data) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setNotice({ tone: 'error', text: 'Enter a reversal reason.' });
      return;
    }
    if (!opts?.localFinalizationOnly && qtyError) {
      setNotice({ tone: 'error', text: qtyError });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await reverseGoodsReceipt(data.goodsReceiptId, {
        reason: trimmed,
        remarks: remarks.trim() || null,
        postingDate: today,
        documentDate: today,
        reverseInvoiceAndGrn: opts?.reverseInvoiceAndGrn === true,
        localFinalizationOnly: opts?.localFinalizationOnly === true || data.localFinalizationNeeded,
        lines: opts?.localFinalizationOnly
          ? undefined
          : parsedLines.map((line) => ({
              goodsReceiptItemId: line.goodsReceiptItemId,
              reversalQuantity: line.reversalQuantity,
            })),
      });
      setNotice({ tone: 'success', text: result.message || 'Goods receipt reversed.' });
      go(`receive/grns/${data.goodsReceiptId}`, { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Could not reverse the goods receipt.') });
      reload();
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const canPost = Boolean(data?.canReverse && !data.localFinalizationNeeded && !data.invoiceMustReverseFirst);

  return (
    <>
      <ScreenHeader title="GRN REVERSAL" eyebrow="Receive" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <Card title={data.grnNumber} aside={<StatusBadge status={data.status} />}>
              <p className="sm-meta">Reversal mode — original posted GRN. {data.integrationName || 'FIVE S4-GRN REVERSAL'}</p>
              <dl className="sm-kv">
                <dt>Original GRN</dt>
                <dd>{data.grnNumber}</dd>
                <dt>SAP Material Document</dt>
                <dd>{data.materialDocument ?? '—'}</dd>
                <dt>Material Document Year</dt>
                <dd>{data.materialDocumentYear ?? '—'}</dd>
                <dt>PO</dt>
                <dd>{data.poNumber}</dd>
                <dt>Supplier</dt>
                <dd>{data.supplierName ?? '—'}</dd>
                <dt>Company Code</dt>
                <dd>{data.companyCode ?? '—'}</dd>
                <dt>Plant</dt>
                <dd>{data.plant ?? '—'}</dd>
                <dt>Storage Location</dt>
                <dd>{data.storageLocation ?? '—'}</dd>
                <dt>Invoice Status</dt>
                <dd>
                  {data.invoiceStatus ?? data.invoiceNumber ?? '—'}
                  {data.invoiceGate ? ` · ${data.invoiceGate.replace(/_/g, ' ')}` : ''}
                </dd>
                {data.reversalMaterialDocument && (
                  <>
                    <dt>Latest Reversal Material Document</dt>
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
                  data.invoiceMustReverseFirst || data.decision === 'GRN_REVERSAL_POSTING_UNKNOWN' || data.decision === 'IN_FLIGHT'
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

            <section className="sm-section" aria-labelledby="sm-rev-lines">
              <h2 id="sm-rev-lines">Lines ({data.lines.length})</h2>
              <ul className="sm-list">
                {data.lines.map((line) => (
                  <li key={line.goodsReceiptItemId} className="sm-card">
                    <strong className="sm-title">{line.materialName}</strong>
                    <span className="sm-meta">
                      {line.materialCode ?? '—'} · PO item {line.purchaseOrderItem || line.poItem || '—'}
                    </span>
                    <div className="sm-grid-2 sm-meta">
                      <span>Received {formatQty(line.originalReceivedQty)} {line.uom ?? ''}</span>
                      <span>Already reversed {formatQty(line.previouslyReversedQty)} {line.uom ?? ''}</span>
                      <span>Available {formatQty(line.remainingReversibleQty)} {line.uom ?? ''}</span>
                      <span>Plant {line.plant || data.plant || '—'} · SLoc {line.storageLocation || data.storageLocation || '—'}</span>
                    </div>
                    {canPost ? (
                      <div className="sm-field">
                        <span>REVERSE QTY</span>
                        <div className="sm-grid-2" style={{ alignItems: 'center', gridTemplateColumns: 'auto 1fr auto' }}>
                          <button
                            type="button"
                            className="sm-btn"
                            disabled={busy || line.remainingReversibleQty <= 0}
                            onClick={() => nudge(line.goodsReceiptItemId, -1, line.remainingReversibleQty)}
                            aria-label={`Decrease reverse qty for ${line.materialName}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={line.remainingReversibleQty}
                            step="any"
                            value={qtyByLine[line.goodsReceiptItemId] ?? '0'}
                            disabled={busy || line.remainingReversibleQty <= 0}
                            onChange={(event) => setQty(line.goodsReceiptItemId, event.target.value)}
                            aria-label={`Reverse qty for ${line.materialName}`}
                          />
                          <button
                            type="button"
                            className="sm-btn"
                            disabled={busy || line.remainingReversibleQty <= 0}
                            onClick={() => nudge(line.goodsReceiptItemId, 1, line.remainingReversibleQty)}
                            aria-label={`Increase reverse qty for ${line.materialName}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="sm-meta">Reverse qty {formatQty(line.reversalQty)} {line.uom ?? ''}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {data.history && data.history.length > 0 && (
              <section className="sm-section" aria-labelledby="sm-rev-history">
                <h2 id="sm-rev-history">Reversal history</h2>
                <ul className="sm-list">
                  {data.history.map((row) => (
                    <li key={row.erpPostingId} className="sm-meta">
                      {row.postedOn ? new Date(row.postedOn).toLocaleDateString() : '—'}
                      {' · '}
                      {row.reversedQuantity} · {row.status}
                      {row.materialDocument ? ` · SAP ${row.materialDocument}` : ''}
                      {row.reason ? ` · ${row.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </section>
            )}

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

            {confirmOpen && (
              <Card title="Confirm GRN REVERSAL">
                <p className="sm-meta">Original GRN: {data.grnNumber}</p>
                <p className="sm-meta">Lines: {selectedLines.length}</p>
                <ul className="sm-list">
                  {selectedLines.map((line) => (
                    <li key={line.goodsReceiptItemId} className="sm-meta">
                      Line {line.purchaseOrderItem || line.poItem} — {line.reversalQuantity} {line.uom ?? ''}
                    </li>
                  ))}
                </ul>
                <p className="sm-meta">{isPartial ? 'This is a partial reversal.' : 'This reverses all remaining quantity.'}</p>
                <div className="sm-grid-2">
                  <button type="button" className="sm-btn" disabled={busy} onClick={() => setConfirmOpen(false)}>
                    CANCEL
                  </button>
                  <button type="button" className="sm-btn sm-btn--primary" disabled={busy} onClick={() => void submit()}>
                    {busy ? 'Posting…' : 'CONFIRM REVERSAL'}
                  </button>
                </div>
              </Card>
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

              {canPost && !confirmOpen && (
                <button
                  type="button"
                  className="sm-btn sm-btn--primary"
                  disabled={busy}
                  onClick={() => {
                    if (!reason.trim()) {
                      setNotice({ tone: 'error', text: 'Enter a reversal reason.' });
                      return;
                    }
                    if (qtyError) {
                      setNotice({ tone: 'error', text: qtyError });
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  {busy ? 'Posting…' : data.reversalStatus === 'FAILED' ? 'REPROCESS GRN REVERSAL' : 'POST REVERSAL'}
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
