import React, { useState } from "react";
import type { SilaPosPreview } from "../../../api/silaMe/silaPosApi";
import { posLabel, posStatusBadgeClass } from "./posFormat";

interface SilaPosPreviewTableProps {
  preview: SilaPosPreview;
  busy: "upload" | "process" | "discard" | null;
  onProcess: () => void;
  onDiscard: () => void;
}

/** Counts and rows of a checked sales file, with the Process and Discard actions. */
const SilaPosPreviewTable: React.FC<SilaPosPreviewTableProps> = ({ preview, busy, onProcess, onDiscard }) => {
  const [problemsOnly, setProblemsOnly] = useState(true);
  const rows = problemsOnly ? preview.rows.filter((row) => row.status !== "READY") : preview.rows;
  const notReady = preview.validRows - preview.readyToProcess;

  return (
    <section className="sila-card" aria-live="polite">
      <div className="sila-card-header">
        <h2 className="sila-card-title">
          Batch {preview.batchNumber}
          {preview.posSourceName ? ` · ${preview.posSourceName}` : ""}
        </h2>
        <div className="srec-actions">
          <button type="button" className="sila-btn sila-btn--ghost" onClick={onDiscard} disabled={busy !== null}>
            Discard
          </button>
          <button type="button" className="sila-btn sila-btn--primary" onClick={onProcess} disabled={busy !== null || preview.validRows === 0}>
            {busy === "process" ? "Processing..." : `Process ${preview.validRows} line${preview.validRows === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
      <div className="sila-card-body srec-stack">
        <div className="srec-counts">
          {[
            ["Total rows", preview.totalRows],
            ["Valid", preview.validRows],
            ["Invalid", preview.invalidRows],
            ["Duplicates", preview.duplicateRows],
            ["Unmapped POS codes", preview.unmappedPosCodes],
            ["Invalid outlets", preview.invalidOutlets],
            ["Invalid UOM", preview.invalidUom],
            ["Recipe not ready", preview.recipeNotReady],
            ["Ready to process", preview.readyToProcess],
          ].map(([label, value]) => (
            <div className="sila-meta-item" key={label}>
              <span className="sila-meta-label">{label}</span>
              <span className="sila-meta-value">{value}</span>
            </div>
          ))}
        </div>
        {notReady > 0 && (
          <div className="sila-alert sila-alert--warning" role="status">
            {notReady} stored line{notReady === 1 ? " is" : "s are"} not ready. Processing marks them failed with the reason; fix the mapping or recipe and
            reprocess them from the Transaction Tracker, or discard this upload and upload a corrected file.
          </div>
        )}
        <label className="sila-choice" htmlFor="spos-preview-problems">
          <input id="spos-preview-problems" type="checkbox" checked={problemsOnly} onChange={(event) => setProblemsOnly(event.target.checked)} />
          Show only lines with a problem
        </label>
        {rows.length === 0 ? (
          <p className="sila-cell-muted">{problemsOnly ? "No line has a problem." : "No lines."}</p>
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col" className="srec-num">Row</th>
                  <th scope="col">Transaction / line</th>
                  <th scope="col">Business date</th>
                  <th scope="col">POS code</th>
                  <th scope="col" className="srec-num">Qty</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Status</th>
                  <th scope="col">Message</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="srec-num">{row.rowNumber}</td>
                    <td>{row.transactionId || "—"} / {row.lineId || "1"}</td>
                    <td>{row.businessDate || "—"}</td>
                    <td>
                      {row.posCode || "—"}
                      {row.recipeCode && <span className="srec-sub">{row.recipeCode}</span>}
                    </td>
                    <td className="srec-num">{row.quantity || "—"} {row.uom || ""}</td>
                    <td>
                      {row.outletCode || "—"}
                      {row.outletLocationName && <span className="srec-sub">{row.outletLocationName}</span>}
                    </td>
                    <td>
                      {row.currency || "—"}
                      {row.amount && <span className="srec-sub">{row.amount}</span>}
                    </td>
                    <td><span className={posStatusBadgeClass(row.status)}>{posLabel(row.status)}</span></td>
                    <td className="srec-message">{row.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {preview.rowsTruncated && <span className="sila-help">Only the first 500 lines (problems first) are listed.</span>}
      </div>
    </section>
  );
};

export default SilaPosPreviewTable;
