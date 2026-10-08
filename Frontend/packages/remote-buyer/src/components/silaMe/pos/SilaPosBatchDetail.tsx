import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination, toastService } from "@vosox/shared-ui";
import {
  discardPosBatch,
  getPosBatch,
  getPosTransactions,
  processPosBatch,
  type SilaPosBatch,
  type SilaPosTransactionPage,
} from "../../../api/silaMe/silaPosApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { formatQty } from "../recipes/recipeFormat";
import SilaPosTransactionDetail from "./SilaPosTransactionDetail";
import { SilaPosConfirm } from "./SilaPosShared";
import { errorText, posLabel, posStatusBadgeClass } from "./posFormat";

interface SilaPosBatchDetailProps {
  batchId: string;
  canManage: boolean;
  onBack: () => void;
}

const PAGE_SIZE = 25;

/** One sales batch with its lines; a batch awaiting processing can be processed or discarded here. */
const SilaPosBatchDetail: React.FC<SilaPosBatchDetailProps> = ({ batchId, canManage, onBack }) => {
  const [batch, setBatch] = useState<SilaPosBatch | null>(null);
  const [lines, setLines] = useState<SilaPosTransactionPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"process" | "discard" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openTransactionId, setOpenTransactionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [header, page_] = await Promise.all([
        getPosBatch(batchId),
        getPosTransactions({ batchId, index: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }),
      ]);
      setBatch(header);
      setLines(page_);
    } catch (err: unknown) {
      setError(errorText(err, "Could not load the sales batch."));
    } finally {
      setLoading(false);
    }
  }, [batchId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleProcess = async () => {
    setBusy("process");
    try {
      const result = await processPosBatch(batchId);
      toastService.success(`Batch ${result.batchNumber}: ${result.processed} processed, ${result.failed} failed.`);
      await load();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not process the sales batch."));
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    setBusy("discard");
    try {
      await discardPosBatch(batchId);
      toastService.success("Upload discarded.");
      onBack();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not discard the upload."));
      setBusy(null);
    }
  };

  const back = (
    <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={onBack}>
      Back to batches
    </button>
  );

  if (openTransactionId) {
    return (
      <SilaPosTransactionDetail
        transactionId={openTransactionId}
        canReprocess={canManage}
        onBack={() => {
          setOpenTransactionId(null);
          load();
        }}
      />
    );
  }

  if (loading && !batch) return <Loader size={24} message="Loading batch..." />;
  if (error || !batch) {
    return (
      <div className="srec-stack">
        {back}
        <EmptyState
          variant="error"
          title="Couldn't load the batch"
          description={error ?? "The batch was not found."}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      </div>
    );
  }

  const rows = lines?.items ?? [];
  const totalPages = lines ? Math.max(1, Math.ceil(lines.total / PAGE_SIZE)) : 1;
  const awaiting = batch.status === "PREVIEW";

  return (
    <div className="srec-stack">
      <div className="spos-detail-head">
        {back}
        {canManage && awaiting && (
          <div className="srec-actions">
            <button type="button" className="sila-btn sila-btn--ghost" onClick={() => setConfirmDiscard(true)} disabled={busy !== null}>Discard</button>
            <button type="button" className="sila-btn sila-btn--primary" onClick={handleProcess} disabled={busy !== null}>
              {busy === "process" ? "Processing..." : "Process"}
            </button>
          </div>
        )}
      </div>
      <div className="sila-meta-grid">
        {[
          ["Batch", batch.batchNumber],
          ["Status", posLabel(batch.status)],
          ["Source", `${posLabel(batch.source)}${batch.posSourceName ? ` · ${batch.posSourceName}` : ""}`],
          ["File", batch.fileName || "—"],
          ["Business dates", batch.businessDateFrom ? `${formatDate(batch.businessDateFrom)}${batch.businessDateTo ? ` – ${formatDate(batch.businessDateTo)}` : ""}` : "—"],
          ["Lines / accepted", `${batch.rows} / ${batch.accepted}`],
          ["Duplicates / invalid", `${batch.duplicates} / ${batch.invalid}`],
          ["Received", `${formatDateTime(batch.dateCreated)}${batch.uploadedByName ? ` · ${batch.uploadedByName}` : ""}`],
        ].map(([label, value]) => (
          <div className="sila-meta-item" key={label}>
            <span className="sila-meta-label">{label}</span>
            <span className="sila-meta-value">{value}</span>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No lines in this batch" />
      ) : (
        <>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Transaction / line</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">POS code / recipe</th>
                  <th scope="col">Menu item / version</th>
                  <th scope="col" className="srec-num">Qty</th>
                  <th scope="col">Status</th>
                  <th scope="col">Message</th>
                  <th scope="col">Consumption txn</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--ghost sila-btn--sm"
                        aria-label={`Open transaction ${line.sourceTransactionId} line ${line.lineNumber}`}
                        onClick={() => setOpenTransactionId(line.id)}
                      >
                        {line.sourceTransactionId} / {line.lineNumber}
                      </button>
                      <span className="srec-sub">{formatDate(line.businessDate)}</span>
                    </td>
                    <td>{line.outletLocationName || line.outletCode}</td>
                    <td>
                      {line.posCode}
                      {line.recipeCode && <span className="srec-sub">{line.recipeCode} {line.recipeName}</span>}
                    </td>
                    <td>
                      {line.menuItem || "—"}
                      {line.recipeVersion != null && <span className="srec-sub">v{line.recipeVersion}</span>}
                    </td>
                    <td className="srec-num">{formatQty(line.quantitySold)} {line.uom ?? ""}</td>
                    <td><span className={posStatusBadgeClass(line.status)}>{posLabel(line.status)}</span></td>
                    <td className="srec-message">{line.failureMessage || (line.erpReference ? `Material document ${line.erpReference}` : "—")}</td>
                    <td>{line.consumptionTransactionNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            summary={`${lines?.total ?? 0} line${lines?.total === 1 ? "" : "s"}`}
            disabled={loading}
          />
        </>
      )}

      {confirmDiscard && (
        <SilaPosConfirm
          heading="Discard upload"
          content={`Discard upload ${batch.batchNumber}?`}
          description="Its lines are removed and nothing is deducted."
          confirmText="Discard"
          busy={busy === "discard"}
          onConfirm={handleDiscard}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
};

export default SilaPosBatchDetail;
