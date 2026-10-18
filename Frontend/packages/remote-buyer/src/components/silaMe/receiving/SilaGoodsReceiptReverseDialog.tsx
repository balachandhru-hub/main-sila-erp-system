import React, { useEffect, useState } from "react";
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

/** Cloud Reverse GRN: SAP Cancel on original Material Document (101 → 102). */
const SilaGoodsReceiptReverseDialog: React.FC<SilaGoodsReceiptReverseDialogProps> = ({
  goodsReceiptId,
  onClose,
  onChanged,
}) => {
  const [preview, setPreview] = useState<SilaGrnReversalPreview | null>(null);
  const [error, setError] = useState<LoadFailure | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const asFailure = (err: unknown): LoadFailure => ({
    message: err instanceof Error ? err.message : "Could not load the goods receipt reversal.",
    httpStatus: readHttpStatus(err),
    goodsReceiptId,
    at: new Date().toISOString(),
  });

  const load = () => {
    setError(null);
    setShowDetails(false);
    getGoodsReceiptReversal(goodsReceiptId)
      .then(setPreview)
      .catch((err: unknown) => {
        setError(asFailure(err));
      });
  };

  useEffect(() => {
    let active = true;
    setError(null);
    setShowDetails(false);
    getGoodsReceiptReversal(goodsReceiptId)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((err: unknown) => {
        if (active) setError(asFailure(err));
      });
    return () => {
      active = false;
    };
  }, [goodsReceiptId]);

  const submit = async (opts?: { reverseInvoiceAndGrn?: boolean; localFinalizationOnly?: boolean }) => {
    if (!preview) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toastService.error("Enter a reversal reason.");
      return;
    }
    setBusy(true);
    try {
      const result = await reverseGoodsReceipt(preview.goodsReceiptId, {
        reason: trimmed,
        remarks: remarks.trim() || null,
        reverseInvoiceAndGrn: opts?.reverseInvoiceAndGrn === true,
        localFinalizationOnly: opts?.localFinalizationOnly === true || preview.localFinalizationNeeded,
      });
      toastService.success(result.message || "Goods receipt reversed.");
      onChanged?.();
      onClose();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reverse the goods receipt.");
      load();
    } finally {
      setBusy(false);
    }
  };

  const showForm = Boolean(preview && (preview.canReverse || preview.invoiceMustReverseFirst || preview.localFinalizationNeeded));

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: preview ? `Reverse GRN ${preview.grnNumber}` : "Reverse Goods Receipt" }}
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
            : preview?.canReverse
              ? {
                  text: busy ? "Reversing..." : "Confirm reverse GRN",
                  onClick: () => void submit(),
                  loading: busy,
                  disabled: busy || !reason.trim(),
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
            <dl className="srcv-facts">
              <div><dt>GRN</dt><dd>{preview.grnNumber}</dd></div>
              <div><dt>SAP Material Document</dt><dd>{preview.materialDocument || "—"}</dd></div>
              <div><dt>Material Document Year</dt><dd>{preview.materialDocumentYear || "—"}</dd></div>
              <div><dt>PO</dt><dd>{preview.poNumber}</dd></div>
              <div><dt>Supplier</dt><dd>{preview.supplierName || "—"}</dd></div>
              <div>
                <dt>Invoice</dt>
                <dd>
                  {preview.invoiceNumber || "—"}
                  {preview.invoiceGate ? ` · ${receivingLabel(preview.invoiceGate)}` : ""}
                </dd>
              </div>
              {preview.reversalMaterialDocument && (
                <div>
                  <dt>Reversal Material Document</dt>
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
                  preview.invoiceMustReverseFirst || preview.decision === "POSTING_UNKNOWN" || preview.localFinalizationNeeded
                    ? "sila-alert sila-alert--warning"
                    : "sila-alert"
                }
                role="status"
              >
                {preview.message}
              </div>
            )}

            {preview.fullDocumentCancelOnly && preview.canReverse && !preview.localFinalizationNeeded && (
              <p className="srcv-sub">Full Material Document Cancel only (SAP 102). Partial quantity reverse is not available.</p>
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
                      <th scope="col">PO item</th>
                      <th scope="col">Original</th>
                      <th scope="col">Previously reversed</th>
                      <th scope="col">Remaining</th>
                      <th scope="col">Reversal qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((line) => (
                      <tr key={line.goodsReceiptItemId}>
                        <td>
                          <span className="sila-cell-strong">{line.materialName}</span>
                          <span className="srcv-sub">{line.materialCode || "—"}</span>
                        </td>
                        <td>{line.poItem || "—"}{line.materialDocumentItem ? ` · MD ${line.materialDocumentItem}` : ""}</td>
                        <td>{formatQtyUom(line.originalReceivedQty, line.uom)}</td>
                        <td>{formatQtyUom(line.previouslyReversedQty, line.uom)}</td>
                        <td>{formatQtyUom(line.remainingReversibleQty, line.uom)}</td>
                        <td className="sila-cell-strong">{formatQtyUom(line.reversalQty, line.uom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaGoodsReceiptReverseDialog;
