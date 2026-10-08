import React, { useEffect, useState } from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import { getIntegrationExecutions, type IntegrationExecution, type IntegrationSide } from "../../api/integrationsApi";
import { errorMessage, formatDateTime, statusBadgeClass, statusLabel } from "./integrationFormat";
import "./Integration.css";

interface IntegrationHistoryProps {
  /** Whose integrations: the buyer's or the supplier's. */
  side: IntegrationSide;
  /** Limits the history to one integration. Without it, runs of every integration are listed. */
  configurationId?: string;
  /** Integration names by id, shown when the history covers every integration. */
  names?: Record<string, string>;
  /** Changing this value reloads the history (for example after a pull). */
  refreshKey?: number;
  title?: string;
}

const duration = (run: IntegrationExecution): string => {
  if (!run.completedAt) return "—";
  const milliseconds = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  if (Number.isNaN(milliseconds) || milliseconds < 0) return "—";
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
};

/** Run history: tests, manual and scheduled pulls. */
const IntegrationHistory: React.FC<IntegrationHistoryProps> = ({ side, configurationId, names, refreshKey = 0, title = "Run history" }) => {
  const [runs, setRuns] = useState<IntegrationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await getIntegrationExecutions(side, configurationId));
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load the run history."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [side, configurationId, refreshKey]);

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">{title}</h2>
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={load} disabled={loading}>Refresh</button>
      </div>
      {loading ? (
        <Loader size={20} message="Loading run history..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the run history"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : runs.length === 0 ? (
        <EmptyState title="No runs yet" description="Tests, pulls and spreadsheet imports are recorded here." />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Started</th>
                {!configurationId && <th scope="col">Integration</th>}
                <th scope="col">Trigger</th>
                <th scope="col">Status</th>
                <th scope="col">Duration</th>
                <th scope="col" className="ops-num">Read</th>
                <th scope="col" className="ops-num">Created</th>
                <th scope="col" className="ops-num">Updated</th>
                <th scope="col" className="ops-num">Failed</th>
                <th scope="col">Watermark after</th>
                <th scope="col">Message</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{formatDateTime(run.startedAt)}</td>
                  {!configurationId && <td>{names?.[run.configurationId] ?? "—"}</td>}
                  <td>{statusLabel(run.trigger)}</td>
                  <td><span className={statusBadgeClass(run.status)}>{statusLabel(run.status)}</span></td>
                  <td>{duration(run)}</td>
                  <td className="ops-num">{run.recordsRead}</td>
                  <td className="ops-num">{run.recordsCreated}</td>
                  <td className="ops-num">{run.recordsUpdated}</td>
                  <td className="ops-num">{run.recordsFailed}</td>
                  <td>{formatDateTime(run.watermarkAfter)}</td>
                  <td className="ops-break">
                    {run.errorMessageSafe
                      ? <span className="sila-error-text">{run.errorCode ? `${run.errorCode}: ` : ""}{run.errorMessageSafe}</span>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default IntegrationHistory;
