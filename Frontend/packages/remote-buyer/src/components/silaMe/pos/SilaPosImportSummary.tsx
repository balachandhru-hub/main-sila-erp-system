import React from "react";
import type { SilaPosImportResult } from "../../../api/silaMe/silaPosApi";

interface SilaPosImportSummaryProps {
  result: SilaPosImportResult;
  onClose: () => void;
}

/** Counts of the last upload or pull, with the reasons of the invalid lines. */
const SilaPosImportSummary: React.FC<SilaPosImportSummaryProps> = ({ result, onClose }) => (
  <section className="sila-card" aria-live="polite">
    <div className="sila-card-header">
      <h2 className="sila-card-title">Batch {result.batchNumber}</h2>
      <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={onClose} aria-label="Close the import summary">
        Close
      </button>
    </div>
    <div className="sila-card-body srec-stack">
      <div className="srec-counts">
        {[
          ["Lines", result.rows],
          ["Accepted", result.accepted],
          ["Duplicates skipped", result.duplicates],
          ["Invalid", result.invalid],
          ["Processed", result.processed],
          ["Failed", result.failed],
          ["Already posted", result.alreadyPosted ?? 0],
          ["Posting unknown", result.postingUnknown ?? 0],
        ].map(([label, value]) => (
          <div className="sila-meta-item" key={label}>
            <span className="sila-meta-label">{label}</span>
            <span className="sila-meta-value">{value}</span>
          </div>
        ))}
      </div>
      {result.failed > 0 && (
        <div className="sila-alert sila-alert--warning" role="status">
          {result.failed} line{result.failed === 1 ? "" : "s"} failed matching or deduction. Open the Transaction Tracker to see why and reprocess.
        </div>
      )}
      {(result.postingUnknown ?? 0) > 0 && (
        <div className="sila-alert sila-alert--warning" role="status">
          {result.postingUnknown} line{result.postingUnknown === 1 ? "" : "s"} got no clear answer from the ERP. Reconcile them under ERP postings before reprocessing.
        </div>
      )}
      {result.errors.length > 0 && (
        <div className="sila-alert sila-alert--danger" role="alert">
          <div className="srec-stack">
            <span className="sila-alert-title">Invalid lines (not stored)</span>
            <div className="srec-error-list">
              {result.errors.map((error) => (
                <span key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);

export default SilaPosImportSummary;
