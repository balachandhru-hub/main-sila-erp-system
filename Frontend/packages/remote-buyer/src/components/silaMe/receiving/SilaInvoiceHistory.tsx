import React, { useEffect, useState } from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import { getInvoiceExtractions, type SilaInvoiceExtraction } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import { formatConfidence } from "./receivingFormat";

interface SilaInvoiceHistoryProps {
  invoiceId: string;
  /** Changes after each reading, so the history reloads. */
  version: string;
}

const TRIGGERS: Record<string, string> = { UPLOAD: "On upload", MANUAL: "Read", REREAD: "Re-read" };
const METHODS: Record<string, string> = { PDF_TEXT: "PDF text", OCR: "OCR", EXTERNAL: "External reader" };

/** Every reading of the invoice: when, how, the confidence and what it found. */
const SilaInvoiceHistory: React.FC<SilaInvoiceHistoryProps> = ({ invoiceId, version }) => {
  const [rows, setRows] = useState<SilaInvoiceExtraction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    getInvoiceExtractions(invoiceId)
      .then((data) => active && setRows(data))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Could not load the reading history."));
    return () => {
      active = false;
    };
  }, [invoiceId, version]);

  const PROVIDERS: Record<string, string> = { BUILT_IN: "Built-in reader", EXTERNAL: "External reader", CACHED: "Reused reading (identical file)" };
  const formatDuration = (ms: number): string => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

  if (error) return <EmptyState variant="error" title="Couldn't load the reading history" description={error} />;
  if (!rows) return <Loader size={20} message="Loading reading history..." />;
  if (rows.length === 0) return <EmptyState title="Not read yet" description="Read the invoice to fill its fields." />;
  return (
    <div className="sila-table-wrap">
      <table className="sila-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Completed</th>
            <th scope="col">Reading</th>
            <th scope="col">Result</th>
            <th scope="col">Found</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.attempt}</td>
              <td>{formatDateTime(row.createdOn)}</td>
              <td>
                {TRIGGERS[row.trigger] ?? row.trigger}
                <span className="srcv-sub">{METHODS[row.method] ?? row.method}</span>
                {(row.provider || row.durationMs != null) && (
                  <span className="srcv-sub">
                    {[row.provider ? PROVIDERS[row.provider] ?? row.provider : null, row.durationMs != null ? formatDuration(row.durationMs) : null].filter(Boolean).join(" · ")}
                  </span>
                )}
                {row.contentHash && <span className="srcv-sub" title={row.contentHash}>File {row.contentHash.slice(0, 12)}</span>}
              </td>
              <td>
                <span className={row.status === "COMPLETED" ? "sila-badge sila-badge--success" : "sila-badge sila-badge--danger"}>
                  {row.status === "COMPLETED" ? `Read ${formatConfidence(row.confidence)}` : "Failed"}
                </span>
                {row.message && <span className="srcv-sub">{row.message}</span>}
              </td>
              <td>
                {row.fields ? (
                  <>
                    {[row.fields.invoiceNumber, row.fields.supplierName, row.fields.poNumber].filter(Boolean).join(" · ") || "—"}
                    <span className="srcv-sub">{row.lineCount} line{row.lineCount === 1 ? "" : "s"}</span>
                  </>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SilaInvoiceHistory;
