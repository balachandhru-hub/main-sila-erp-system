import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { getPosTransaction, reprocessPosTransaction, type SilaPosTransactionDetail as Detail } from "../../../api/silaMe/silaPosApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { formatQty } from "../recipes/recipeFormat";
import { errorText, posLabel, posStatusBadgeClass, stepBadgeClass } from "./posFormat";
import "../silaMeTheme.css";
import "../recipes/SilaRecipes.css";
import "./SilaPos.css";

interface SilaPosTransactionDetailProps {
  transactionId: string;
  /** Shows Reprocess (MANAGE_SILA_POS). */
  canReprocess?: boolean;
  onBack: () => void;
}

/** A POS sale: header, processing steps, consumed ingredients, timeline and ERP posting, with Reprocess. */
const SilaPosTransactionDetail: React.FC<SilaPosTransactionDetailProps> = ({ transactionId, canReprocess = true, onBack }) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getPosTransaction(transactionId));
    } catch (err: unknown) {
      setError(errorText(err, "Could not load the transaction."));
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReprocess = async () => {
    if (!detail) return;
    setReprocessing(true);
    try {
      await reprocessPosTransaction(transactionId);
      toastService.success(detail.transaction.failedStep === "POST" ? "The SAP posting is queued again." : "Transaction reprocessed.");
      await load();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not reprocess the transaction."));
    } finally {
      setReprocessing(false);
    }
  };

  const tx = detail?.transaction;
  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title={tx ? `POS transaction ${tx.sourceTransactionId} / ${tx.lineNumber}` : "POS transaction"}
        description="Step 1 deducts SILA inventory. Step 2 posts the consumption to the ERP (SAP)."
        actions={
          <div className="srec-actions">
            <button type="button" className="sila-btn sila-btn--ghost" onClick={onBack}>Back</button>
            {canReprocess && tx?.canReprocess && (
              <button type="button" className="sila-btn sila-btn--primary" onClick={handleReprocess} disabled={reprocessing}>
                {reprocessing ? "Reprocessing..." : "Reprocess"}
              </button>
            )}
          </div>
        }
      />

      {loading && !detail ? (
        <Loader size={24} message="Loading transaction..." />
      ) : error || !detail || !tx ? (
        <EmptyState
          variant="error"
          title="Couldn't load the transaction"
          description={error ?? "The transaction was not found."}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : (
        <>
          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Sale</h2>
              <span className={posStatusBadgeClass(tx.status)}>{posLabel(tx.status)}</span>
            </div>
            <div className="sila-card-body srec-stack">
              <div className="sila-meta-grid">
                {[
                  ["Business date", formatDate(tx.businessDate)],
                  ["Outlet", tx.outletLocationName ? `${tx.outletLocationName} (${detail.outletLocationCode ?? tx.outletCode})` : `${tx.outletCode} (not matched)`],
                  ["POS code", tx.posCode],
                  ["Recipe", tx.recipeCode ? `${tx.recipeCode} ${tx.recipeName ?? ""}${detail.recipeActiveVersion ? ` · version ${detail.recipeActiveVersion}` : ""}` : "—"],
                  ["Quantity", `${formatQty(tx.quantitySold)} ${tx.uom ?? ""}`],
                  ["Amount", tx.amount !== null && tx.amount !== undefined ? `${tx.amount} ${tx.currency ?? ""}` : "—"],
                  ["Batch", tx.batchNumber ? `${tx.batchNumber}${detail.posSourceName ? ` · ${detail.posSourceName}` : ""}` : "—"],
                  ["Received", formatDateTime(tx.dateCreated)],
                ].map(([label, value]) => (
                  <div className="sila-meta-item" key={label}>
                    <span className="sila-meta-label">{label}</span>
                    <span className="sila-meta-value">{value}</span>
                  </div>
                ))}
              </div>
              <div className="srec-badges" aria-label="Processing steps">
                <span className="sila-meta-label">Received</span>
                <span className={stepBadgeClass(tx.receivedState)}>{posLabel(tx.receivedState)}</span>
                <span className="sila-meta-label">Step 1 · SILA inventory</span>
                <span className={stepBadgeClass(tx.deductState)}>{posLabel(tx.deductState)}</span>
                {tx.step1Message && <span className="srec-sub">{tx.step1Message}</span>}
                <span className="sila-meta-label">Step 2 · ERP</span>
                <span className={stepBadgeClass(tx.postState)}>{posLabel(tx.postState)}</span>
                {tx.erpReference && <span className="srec-sub">Material document {tx.erpReference}</span>}
                {tx.step2Message && <span className="srec-sub">{tx.step2Message}</span>}
              </div>
              {tx.failureMessage && (
                <div className={`sila-alert ${tx.status === "FAILED" ? "sila-alert--danger" : "sila-alert--warning"}`} role="alert">
                  {detail.failureCode ? `[${detail.failureCode}] ` : ""}
                  {tx.failedStep ? `${posLabel(tx.failedStep)}: ` : ""}{tx.failureMessage}
                </div>
              )}
            </div>
          </section>

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Step 2 · ERP posting (SAP)</h2>
              {tx.erpPostingStatus && <span className={posStatusBadgeClass(tx.erpPostingStatus)}>{posLabel(tx.erpPostingStatus)}</span>}
            </div>
            <div className="sila-card-body">
              {tx.erpPostingId ? (
                <div className="sila-meta-grid">
                  {[
                    ["Material document", tx.erpReference || "—"],
                    ["Movement", posLabel(detail.erpMovementType)],
                    ["Integration system", tx.integrationSystem || "—"],
                    ["HTTP status", detail.erpHttpStatus != null ? String(detail.erpHttpStatus) : "—"],
                    ["Location type", tx.locationType ? posLabel(tx.locationType) : "—"],
                    ["Attempts", String(detail.erpAttempts)],
                    ["Last attempt", detail.erpLastAttemptOn ? formatDateTime(detail.erpLastAttemptOn) : "—"],
                    ["Posted on", tx.postedOn ? formatDateTime(tx.postedOn) : "—"],
                    ["Error", detail.erpErrorMessage || "—"],
                  ].map(([label, value]) => (
                    <div className="sila-meta-item" key={label}>
                      <span className="sila-meta-label">{label}</span>
                      <span className="sila-meta-value">{value}</span>
                    </div>
                  ))}
                  {detail.erpRequest && (
                    <details className="sila-meta-item spos-payload-block">
                      <summary className="sila-meta-label">ERP request (credentials masked)</summary>
                      <pre className="spos-payload">{detail.erpRequest}</pre>
                    </details>
                  )}
                  {detail.erpResponse && (
                    <details className="sila-meta-item spos-payload-block">
                      <summary className="sila-meta-label">ERP response</summary>
                      <pre className="spos-payload">{detail.erpResponse}</pre>
                    </details>
                  )}
                </div>
              ) : (
                <p className="sila-cell-muted">Not queued yet: the sale is posted to SAP after its inventory is deducted.</p>
              )}
            </div>
          </section>

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Exploded ingredients</h2>
            </div>
            {detail.lines.length === 0 ? (
              <EmptyState title="No exploded ingredients" description="Ingredients are consumed when the sale is processed." />
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col" className="srec-num">Consumed</th>
                      <th scope="col" className="srec-num">Unit cost</th>
                      <th scope="col" className="srec-num">Value</th>
                      <th scope="col">Ledger entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          <span className="sila-cell-strong">{line.materialCode ?? "—"}</span>
                          {line.materialDescription && <span className="srec-sub">{line.materialDescription}</span>}
                        </td>
                        <td className="srec-num">{formatQty(line.quantity)} {line.uom}</td>
                        <td className="srec-num">{line.unitCost ?? "—"}</td>
                        <td className="srec-num">{line.value ?? "—"}</td>
                        <td>{line.transactionNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Timeline</h2>
            </div>
            {detail.timeline.length === 0 ? (
              <div className="sila-card-body"><span className="sila-help">No events yet.</span></div>
            ) : (
              <ol className="sila-card-body spos-timeline">
                {detail.timeline.map((event, index) => (
                  <li key={`${event.action}-${event.occurredOn}-${index}`} className="spos-timeline-item">
                    <span className="sila-cell-strong">
                      {posLabel(event.action)}
                      {event.step && event.status && <span className={stepBadgeClass(event.status)}> {posLabel(event.step)} · {posLabel(event.status)}</span>}
                    </span>
                    <span className="srec-sub">
                      {formatDateTime(event.occurredOn)}
                      {event.actorName ? ` · ${event.actorName}` : ""}
                    </span>
                    {event.comment && <span>{event.comment}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default SilaPosTransactionDetail;
