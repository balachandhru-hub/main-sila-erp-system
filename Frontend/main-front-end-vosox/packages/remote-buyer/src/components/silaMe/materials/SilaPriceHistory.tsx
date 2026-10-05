import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import { getPriceHistory, type SilaPriceChange } from "../../../api/silaMe/silaMaterialsApi";
import SilaPriceStatusBadge from "./SilaPriceStatusBadge";
import { codeLabel, formatDate, formatDateTime, formatPrice } from "./materialFormat";

interface SilaPriceHistoryProps {
  materialId: string;
  /** Changes when the caller wants the list reloaded, e.g. after a submit. */
  reloadKey?: number;
}

/** The price change requests of a material, newest first, with each approver's decision. */
const SilaPriceHistory: React.FC<SilaPriceHistoryProps> = ({ materialId, reloadKey = 0 }) => {
  const [rows, setRows] = useState<SilaPriceChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPriceHistory(materialId));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the price history.");
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (loading) return <Loader size={20} message="Loading price history..." />;
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load the price history"
        description={error}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
      />
    );
  }
  if (rows.length === 0) return <span className="sila-help">No price changes yet.</span>;

  return (
    <div className="sila-table-wrap">
      <table className="sila-table">
        <thead>
          <tr>
            <th scope="col">Request</th>
            <th scope="col" className="smat-num">New price</th>
            <th scope="col">Effective from</th>
            <th scope="col">Status</th>
            <th scope="col">Approvers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="sila-cell-strong">{row.requestNumber}</span>
                <span className="smat-sub">{row.requestedByName || "—"} · {formatDateTime(row.requestedOn)}</span>
                <span className="smat-sub">{row.reason}</span>
              </td>
              <td className="smat-num">{formatPrice(row.proposedUnitCost, row.currency, row.priceUom)}</td>
              <td>{formatDate(row.effectiveFrom)}</td>
              <td><SilaPriceStatusBadge status={row.status} /></td>
              <td>
                {row.steps.length === 0
                  ? "—"
                  : row.steps.map((step) => (
                      <span key={`${row.id}-${step.order}`} className="smat-sub">
                        {step.order}. {step.name || "Approver"}: {codeLabel(step.status)}
                        {step.comment ? ` — ${step.comment}` : ""}
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SilaPriceHistory;
