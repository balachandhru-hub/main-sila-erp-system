import React from "react";
import type { SilaPullResult } from "../../../api/silaMe/silaMasterDataApi";

interface SilaPullSummaryProps {
  result: SilaPullResult;
  /** e.g. "suppliers" */
  noun: string;
}

/** The outcome of the last "Pull from ERP": counts, then the first problems. */
const SilaPullSummary: React.FC<SilaPullSummaryProps> = ({ result, noun }) => (
  <div className={result.invalid > 0 ? "sila-alert sila-alert--warning" : "sila-alert sila-alert--success"} role="status">
    <p>
      Read {result.read} records from {result.apis} ERP API{result.apis === 1 ? "" : "s"}: {result.created} new {noun}, {result.updated} updated,{" "}
      {result.unchanged} unchanged, {result.invalid} skipped.
    </p>
    {result.errors.length > 0 && (
      <ul className="srcv-messages">
        {result.errors.map((error) => <li key={error}>{error}</li>)}
      </ul>
    )}
  </div>
);

export default SilaPullSummary;
