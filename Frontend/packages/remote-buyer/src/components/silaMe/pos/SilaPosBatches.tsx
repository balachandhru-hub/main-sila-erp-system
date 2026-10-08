import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination } from "@vosox/shared-ui";
import { getPosBatches, type SilaPosBatch } from "../../../api/silaMe/silaPosApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import SilaPosBatchDetail from "./SilaPosBatchDetail";
import { errorText, posLabel, posStatusBadgeClass } from "./posFormat";

interface SilaPosBatchesProps {
  /** Shows Process / Discard on batches awaiting processing. */
  canManage: boolean;
}

const PAGE_SIZE = 20;

/** Received sales batches (uploads and API pulls); a batch opens with its lines. */
const SilaPosBatches: React.FC<SilaPosBatchesProps> = ({ canManage }) => {
  const [batches, setBatches] = useState<SilaPosBatch[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBatches(await getPosBatches((page - 1) * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setBatches([]);
      setError(errorText(err, "Could not load the sales batches."));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  if (openBatchId) {
    return (
      <SilaPosBatchDetail
        batchId={openBatchId}
        canManage={canManage}
        onBack={() => {
          setOpenBatchId(null);
          load();
        }}
      />
    );
  }

  if (loading) return <Loader size={24} message="Loading batches..." />;
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load batches"
        description={error}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
      />
    );
  }
  if (batches.length === 0 && page === 1) return <EmptyState title="No sales received yet" />;

  return (
    <>
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">Batch / file</th>
              <th scope="col">Source</th>
              <th scope="col">Business dates</th>
              <th scope="col" className="srec-num">Lines</th>
              <th scope="col" className="srec-num">Valid</th>
              <th scope="col" className="srec-num">Duplicates</th>
              <th scope="col" className="srec-num">Invalid</th>
              <th scope="col" className="srec-num">Processed</th>
              <th scope="col" className="srec-num">Failed</th>
              <th scope="col" className="srec-num">Posting unknown</th>
              <th scope="col">Status</th>
              <th scope="col">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>
                  <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Open batch ${batch.batchNumber}`} onClick={() => setOpenBatchId(batch.id)}>
                    {batch.batchNumber}
                  </button>
                  {batch.fileName && <span className="srec-sub">{batch.fileName}</span>}
                </td>
                <td>
                  {posLabel(batch.source)}
                  {batch.posSourceName && <span className="srec-sub">{batch.posSourceName}</span>}
                </td>
                <td>
                  {batch.businessDateFrom ? formatDate(batch.businessDateFrom) : "—"}
                  {batch.businessDateTo && batch.businessDateTo !== batch.businessDateFrom && <span className="srec-sub">to {formatDate(batch.businessDateTo)}</span>}
                </td>
                <td className="srec-num">{batch.rows}</td>
                <td className="srec-num">{batch.accepted}</td>
                <td className="srec-num">{batch.duplicates}</td>
                <td className="srec-num">{batch.invalid}</td>
                <td className="srec-num">{batch.processed ?? "—"}</td>
                <td className={`srec-num${batch.failed > 0 ? " srec-negative" : ""}`}>{batch.failed}</td>
                <td className={`srec-num${(batch.postingUnknown ?? 0) > 0 ? " srec-negative" : ""}`}>{batch.postingUnknown ?? "—"}</td>
                <td><span className={posStatusBadgeClass(batch.status)}>{posLabel(batch.status)}</span></td>
                <td>
                  {formatDateTime(batch.dateCreated)}
                  {batch.uploadedByName && <span className="srec-sub">{batch.uploadedByName}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        hasNext={batches.length === PAGE_SIZE}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />
    </>
  );
};

export default SilaPosBatches;
