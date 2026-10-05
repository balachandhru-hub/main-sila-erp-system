import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import {
  getAlerts,
  updateAlert,
  type SilaAlert,
  type SilaAlertAction,
} from "../../../api/silaMe/silaStockCountApi";
import { requestAlertPhysicalInventory, type SilaPhysicalInventory } from "../../../api/silaMe/silaControlApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { scBadgeClass, scLabel } from "./stockCountFormat";
import "../silaMeTheme.css";
import "./StockCount.css";

export interface SilaAlertsProps {
  /** Called with the count id when a requested physical inventory starts at once (scheduled for today). */
  onCountRequested?: (stockCountId: string) => void;
  /** Called after "Request physical inventory", e.g. to open SilaPhysicalInventoryRequests. */
  onPhysicalInventoryRequested?: (request: SilaPhysicalInventory) => void;
}

const STATUSES = ["NEW", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"];

const ACTION_DONE: Record<SilaAlertAction, string> = {
  acknowledge: "Alert acknowledged.",
  resolve: "Alert resolved.",
  dismiss: "Alert dismissed.",
};

const isOpen = (alert: SilaAlert): boolean => alert.status === "NEW" || alert.status === "ACKNOWLEDGED";

/** Inventory alerts of the user's locations with their actions. */
const SilaAlerts: React.FC<SilaAlertsProps> = ({ onCountRequested, onPhysicalInventoryRequested }) => {
  const [rows, setRows] = useState<SilaAlert[]>([]);
  const [status, setStatus] = useState("NEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAlerts(status || undefined));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the alerts.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (alert: SilaAlert, action: SilaAlertAction) => {
    setBusyId(alert.id);
    try {
      await updateAlert(alert.id, action);
      toastService.success(ACTION_DONE[action]);
      load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not update the alert.");
    } finally {
      setBusyId(null);
    }
  };

  const requestCount = async (alert: SilaAlert) => {
    setBusyId(alert.id);
    try {
      const request = await requestAlertPhysicalInventory(alert.id);
      toastService.success(
        `${request.requestNumber} scheduled for ${formatDate(request.scheduledDate)} at ${request.locationName ?? "the location"}. The cost controllers were notified.`,
      );
      load();
      onPhysicalInventoryRequested?.(request);
      if (request.stockCountId) onCountRequested?.(request.stockCountId);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not request the physical inventory.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="sila-root sila-me sc-stack">
      <PageHeader className="pud-page-header" title="Inventory Alerts" />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Alerts</h2>
          <div className="sila-field sc-filter">
            <label className="sila-label" htmlFor="sa-status-filter">Status</label>
            <select id="sa-status-filter" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{scLabel(value)}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <Loader size={24} message="Loading alerts..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load alerts"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No alerts" />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Alert</th>
                  <th scope="col">Type</th>
                  <th scope="col">Severity</th>
                  <th scope="col">Location</th>
                  <th scope="col">Material</th>
                  <th scope="col">Recommended</th>
                  <th scope="col">Status</th>
                  <th scope="col">Raised</th>
                  <th scope="col" className="sila-cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.title}</span>
                      <span className="sc-sub">{row.message}</span>
                    </td>
                    <td>{scLabel(row.alertType)}</td>
                    <td><span className={scBadgeClass(row.severity)}>{scLabel(row.severity)}</span></td>
                    <td>{row.locationName || "—"}</td>
                    <td>
                      {row.materialName || row.materialCode ? (
                        <>
                          {row.materialName || row.materialCode}
                          {row.materialName && row.materialCode && <span className="sc-sub">{row.materialCode}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{scLabel(row.recommendedAction)}</td>
                    <td><span className={scBadgeClass(row.status)}>{scLabel(row.status)}</span></td>
                    <td>{formatDateTime(row.dateCreated)}</td>
                    <td className="sila-cell-actions">
                      {isOpen(row) ? (
                        <div className="sc-actions">
                          {row.status === "NEW" && (
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              aria-label={`Acknowledge ${row.title}`}
                              disabled={busyId !== null}
                              onClick={() => act(row, "acknowledge")}
                            >
                              Acknowledge
                            </button>
                          )}
                          {row.locationId && (
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              aria-label={`Request a physical inventory for ${row.title}`}
                              disabled={busyId !== null}
                              onClick={() => requestCount(row)}
                            >
                              Request physical inventory
                            </button>
                          )}
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Resolve ${row.title}`}
                            disabled={busyId !== null}
                            onClick={() => act(row, "resolve")}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="sila-btn sila-btn--ghost sila-btn--sm"
                            aria-label={`Dismiss ${row.title}`}
                            disabled={busyId !== null}
                            onClick={() => act(row, "dismiss")}
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        <span className="sc-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SilaAlerts;
