import React, { useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  getGoodsReceiptReversal,
  reverseGoodsReceipt,
  type SilaGrnReversalPreview,
} from "../../../api/silaMe/silaReceivingApi";
import { readHttpStatus } from "../../../api/readError";
import { formatQtyUom, receivingLabel } from "./receivingFormat";

interface SilaGoodsReceiptReverseDialogProps {
  goodsReceiptId: string;
  onClose: () => void;
  onChanged?: () => void;
}

interface LoadFailure {
  message: string;
  httpStatus: number | null;
  goodsReceiptId: string;
  at: string;
}

/** Cloud GRN REVERSAL mode: original posted GRN with editable Reverse Qty → FIVE S4-GRN REVERSAL (102). */
const SilaGoodsReceiptReverseDialog: React.FC<SilaGoodsReceiptReverseDialogProps> = ({
  goodsReceiptId,
  onClose,
  onChanged,
}) => {
  const [preview, setPreview] = useState<SilaGrnReversalPreview | null>(null);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [error, setError] = useState<LoadFailure | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const asFailure = (err: unknown): LoadFailure => ({
    message: err instanceof Error ? err.message : "Could not load the goods receipt reversal.",
    httpStatus: readHttpStatus(err),
    goodsReceiptId,
    at: new Date().toISOString(),
  });

  const applyPreview = (data: SilaGrnReversalPreview) => {
    setPreview(data);
    const next: Record<string, string> = {};
    data.lines.forEach((line) => {
      next[line.goodsReceiptItemId] = String(line.reversalQty ?? line.remainingReversibleQty ?? 0);
    });
    setQtyByLine(next);
  };

  const load = () => {
    setError(null);
    setShowDetails(false);
    setConfirmOpen(false);
    getGoodsReceiptReversal(goodsReceiptId)
      .then(applyPreview)
      .catch((err: unknown) => {
        setError(asFailure(err));
      });
  };

  useEffect(() => {
    let active = true;
    setError(null);
    setShowDetails(false);
    setConfirmOpen(false);
    getGoodsReceiptReversal(goodsReceiptId)
      .then((data) => {
        if (active) applyPreview(data);
      })
      .catch((err: unknown) => {
        if (active) setError(asFailure(err));
      });
    return () => {
      active = false;
    };
  }, [goodsReceiptId]);

  const parsedLines = useMemo(() => {
    if (!preview) return [];
    return preview.lines.map((line) => {
      const raw = qtyByLine[line.goodsReceiptItemId] ?? "0";
      const qty = Number(raw);
      return {
        ...line,
        reversalQuantity: Number.isFinite(qty) ? qty : NaN,
      };
    });
  }, [preview, qtyByLine]);

  const selectedLines = useMemo(
    () => parsedLines.filter((line) => Number.isFinite(line.reversalQuantity) && line.reversalQuantity > 0),
    [parsedLines],
  );

  const qtyError = useMemo(() => {
    for (const line of parsedLines) {
      if (!Number.isFinite(line.reversalQuantity) || line.reversalQuantity < 0) {
        return `Enter a valid reversal quantity for ${line.materialName}.`;
      }
      if (line.reversalQuantity > line.remainingReversibleQty + 0.0001) {
        return `Reversal qty for ${line.materialName} exceeds remaining ${line.remainingReversibleQty}.`;
      }
    }
    if (preview?.canReverse && !preview.localFinalizationNeeded && selectedLines.length === 0) {
      return "Set Reversal Qty greater than zero on at least one line.";
    }
    return null;
  }, [parsedLines, preview, selectedLines.length]);

  const isPartial = useMemo(() => {
    if (!preview) return false;
    const eligible = preview.lines.filter((line) => line.remainingReversibleQty > 0.0001);
    if (selectedLines.length !== eligible.length) return true;
    return selectedLines.some((line) => Math.abs(line.reversalQuantity - line.remainingReversibleQty) > 0.0001);
  }, [preview, selectedLines]);

  const submit = async (opts?: { reverseInvoiceAndGrn?: boolean; localFinalizationOnly?: boolean }) => {
    if (!preview) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toastService.error("Enter a reversal reason.");
      return;
    }
    if (!opts?.localFinalizationOnly && qtyError) {
      toastService.error(qtyError);
      return;
    }
    setBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await reverseGoodsReceipt(preview.goodsReceiptId, {
        reason: trimmed,
        remarks: remarks.trim() || null,
        postingDate: today,
        documentDate: today,
        reverseInvoiceAndGrn: opts?.reverseInvoiceAndGrn === true,
        localFinalizationOnly: opts?.localFinalizationOnly === true || preview.localFinalizationNeeded,
        lines: opts?.localFinalizationOnly
          ? undefined
          : parsedLines.map((line) => ({
              goodsReceiptItemId: line.goodsReceiptItemId,
              reversalQuantity: line.reversalQuantity,
            })),
      });
      toastService.success(result.message || "Goods receipt reversed.");
      onChanged?.();
      onClose();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reverse the goods receipt.");
      load();
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const showForm = Boolean(preview && (preview.canReverse || preview.invoiceMustReverseFirst || preview.localFinalizationNeeded));
  const canPost = Boolean(preview?.canReverse && !preview.localFinalizationNeeded && !preview.invoiceMustReverseFirst);

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: preview ? `GRN REVERSAL — ${preview.grnNumber}` : "GRN REVERSAL" }}
      footerProps={{
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: busy },
        primaryButton: preview?.localFinalizationNeeded
          ? {
              text: busy ? "Finalizing..." : "Reprocess local finalization",
              onClick: () => void submit({ localFinalizationOnly: true }),
              loading: busy,
              disabled: busy || !reason.trim(),
            }
          : preview?.invoiceMustReverseFirst
            ? {
                text: busy ? "Working..." : "Reverse Invoice & GRN",
                onClick: () => void submit({ reverseInvoiceAndGrn: true }),
                loading: busy,
                disabled: busy || !reason.trim(),
              }
            : canPost
              ? {
                  text: busy ? "Posting..." : "POST REVERSAL",
                  onClick: () => {
                    if (!reason.trim()) {
                      toastService.error("Enter a reversal reason.");
                      return;
                    }
                    if (qtyError) {
                      toastService.error(qtyError);
                      return;
                    }
                    setConfirmOpen(true);
                  },
                  loading: busy,
                  disabled: busy || !reason.trim() || Boolean(qtyError),
                }
              : undefined,
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {error ? (
          <div className="srcv-stack">
            <EmptyState variant="error" title="GRN Reversal cannot be prepared" description={error.message} />
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setShowDetails((open) => !open)}>
              {showDetails ? "Hide details" : "View details"}
            </button>
            {showDetails && (
              <dl className="srcv-facts">
                <div><dt>Stage</dt><dd>LOAD_REVERSAL_CONTEXT</dd></div>
                <div><dt>HTTP status</dt><dd>{error.httpStatus ?? "—"}</dd></div>
                <div><dt>GRN ID</dt><dd>{error.goodsReceiptId}</dd></div>
                <div><dt>Endpoint</dt><dd>GET /api/v1/buyer/sila/grns/{"{id}"}/reversal</dd></div>
                <div><dt>Timestamp</dt><dd>{error.at}</dd></div>
                <div><dt>Message</dt><dd>{error.message}</dd></div>
              </dl>
            )}
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={load}>
              Retry
            </button>
          </div>
        ) : !preview ? (
          <Loader size={24} message="Loading reversal..." />
        ) : (
          <>
            <p className="srcv-sub">Reversal mode — reviewing the original posted GRN. Integration: {preview.integrationName || "FIVE S4-GRN REVERSAL"}</p>
            <dl className="srcv-facts">
              <div><dt>Original GRN</dt><dd>{preview.grnNumber}</dd></div>
              {preview.reversalGrnNumber && (
                <div><dt>Reversal GRN</dt><dd>{preview.reversalGrnNumber}</dd></div>
              )}
              <div><dt>SAP Material Document</dt><dd>{preview.materialDocument || "—"}</dd></div>
              <div><dt>Material Document Year</dt><dd>{preview.materialDocumentYear || "—"}</dd></div>
              <div><dt>PO</dt><dd>{preview.poNumber}</dd></div>
              <div><dt>Supplier</dt><dd>{preview.supplierName || "—"}</dd></div>
              <div><dt>Company Code</dt><dd>{preview.companyCode || "—"}</dd></div>
              <div><dt>Property</dt><dd>{preview.propertyName || "—"}</dd></div>
              <div><dt>Plant</dt><dd>{preview.plant || "—"}</dd></div>
              <div><dt>Storage Location</dt><dd>{preview.storageLocation || "—"}</dd></div>
              <div>
                <dt>Invoice Status</dt>
                <dd>
                  {preview.invoiceStatus || preview.invoiceNumber || "—"}
                  {preview.invoiceGate ? ` · ${receivingLabel(preview.invoiceGate)}` : ""}
                </dd>
              </div>
              {preview.reversalMaterialDocument && (
                <div>
                  <dt>Latest Reversal Material Document</dt>
                  <dd>
                    {preview.reversalMaterialDocument}
                    {preview.reversalMaterialDocumentYear ? ` / ${preview.reversalMaterialDocumentYear}` : ""}
                  </dd>
                </div>
              )}
            </dl>

            {preview.message && (
              <div
                className={
                  preview.invoiceMustReverseFirst || preview.decision === "GRN_REVERSAL_POSTING_UNKNOWN" || preview.localFinalizationNeeded
                    ? "sila-alert sila-alert--warning"
                    : "sila-alert"
                }
                role="status"
              >
                {preview.message}
              </div>
            )}

            <h3 className="sila-section-title">Lines</h3>
            {preview.lines.length === 0 ? (
              <p className="srcv-sub">No reversible lines.</p>
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col">PO Item</th>
                      <th scope="col">Received</th>
                      <th scope="col">Reversed</th>
                      <th scope="col">Available</th>
                      <th scope="col">Reverse Qty</th>
                      <th scope="col">UOM</th>
                      <th scope="col">Plant</th>
                      <th scope="col">SLoc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => (
                      <tr key={line.goodsReceiptItemId}>
                        <td>
                          <span className="sila-cell-strong">{line.materialName}</span>
                          <span className="srcv-sub">{line.materialCode || "—"}</span>
                        </td>
                        <td>{line.purchaseOrderItem || line.poItem || "—"}</td>
                        <td>{formatQtyUom(line.originalReceivedQty, line.uom)}</td>
                        <td>{formatQtyUom(line.previouslyReversedQty, line.uom)}</td>
                        <td>{formatQtyUom(line.remainingReversibleQty, line.uom)}</td>
                        <td>
                          {canPost ? (
                            <input
                              className="sila-input"
                              type="number"
                              min={0}
                              max={line.remainingReversibleQty}
                              step="any"
                              value={qtyByLine[line.goodsReceiptItemId] ?? "0"}
                              disabled={busy || line.remainingReversibleQty <= 0}
                              onChange={(event) =>
                                setQtyByLine((current) => ({
                                  ...current,
                                  [line.goodsReceiptItemId]: event.target.value,
                                }))
                              }
                              aria-label={`Reverse qty for ${line.materialName}`}
                            />
                          ) : (
                            <span className="sila-cell-strong">{formatQtyUom(line.reversalQty, line.uom)}</span>
                          )}
                        </td>
                        <td>{line.uom || "—"}</td>
                        <td>{line.plant || preview.plant || "—"}</td>
                        <td>{line.storageLocation || preview.storageLocation || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.history && preview.history.length > 0 && (
              <>
                <h3 className="sila-section-title">Reversal history</h3>
                <ul className="srcv-stack">
                  {preview.history.map((row) => (
                    <li key={row.erpPostingId} className="srcv-sub">
                      {row.postedOn ? new Date(row.postedOn).toLocaleDateString() : "—"}
                      {" · "}
                      {row.reversedQuantity} · {row.status}
                      {row.materialDocument ? ` · SAP ${row.materialDocument}` : ""}
                      {row.reason ? ` · ${row.reason}` : ""}
                      {row.errorMessage ? ` · ${row.errorMessage}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {showForm && (
              <div className="srcv-stack">
                <label className="sila-label" htmlFor="srcv-rev-reason">Reason (required)</label>
                <input
                  id="srcv-rev-reason"
                  className="sila-input"
                  value={reason}
                  maxLength={500}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why reverse this goods receipt?"
                />
                <label className="sila-label" htmlFor="srcv-rev-remarks">Remarks (optional)</label>
                <textarea
                  id="srcv-rev-remarks"
                  className="sila-input"
                  value={remarks}
                  maxLength={1000}
                  rows={3}
                  disabled={busy}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </div>
            )}

            {confirmOpen && (
              <div className="sila-alert" role="alertdialog" aria-labelledby="srcv-rev-confirm-title">
                <h3 id="srcv-rev-confirm-title" className="sila-section-title">GRN REVERSAL</h3>
                <p>Original GRN: {preview.grnNumber}</p>
                {preview.reversalGrnNumber && <p>Reversal GRN: {preview.reversalGrnNumber}</p>}
                <p>Lines: {selectedLines.length}</p>
                <ul>
                  {selectedLines.map((line) => (
                    <li key={line.goodsReceiptItemId}>
                      Line {line.purchaseOrderItem || line.poItem} — {line.reversalQuantity} {line.uom || ""}
                    </li>
                  ))}
                </ul>
                <p>{isPartial ? "This is a partial reversal." : "This reverses all remaining quantity."}</p>
                <div className="srcv-stack" style={{ flexDirection: "row", gap: "0.5rem" }}>
                  <button type="button" className="sila-btn sila-btn--secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>
                    CANCEL
                  </button>
                  <button type="button" className="sila-btn sila-btn--primary" disabled={busy} onClick={() => void submit()}>
                    {busy ? "Posting..." : "CONFIRM REVERSAL"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaGoodsReceiptReverseDialog;
