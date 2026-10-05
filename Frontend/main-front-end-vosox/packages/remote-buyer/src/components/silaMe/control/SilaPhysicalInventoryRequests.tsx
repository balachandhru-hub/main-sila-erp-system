import React, { useCallback, useEffect, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { getPhysicalInventories, type SilaPhysicalInventory } from "../../../api/silaMe/silaControlApi";
import { getLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import type { SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import PagedListBody from "../receiving/PagedListBody";
import { usePagedList } from "../receiving/usePagedList";
import { scBadgeClass, scLabel } from "../stockCount/stockCountFormat";
import { PhysicalInventoryCancelDialog, PhysicalInventoryRequestDialog, PhysicalInventoryScheduleDialog } from "./PhysicalInventoryDialogs";
import "../silaMeTheme.css";
import "../stockCount/StockCount.css";
import "./SilaControl.css";

export interface SilaPhysicalInventoryRequestsProps {
  /** MANAGE_SILA_STOCK_COUNT: may request a physical inventory. */
  canRequest: boolean;
  /** APPROVE_SILA_STOCK_COUNT: may reschedule or cancel a scheduled request. */
  canSchedule: boolean;
  /** Opens the count of a started request (e.g. SilaStockCounts with initialCountId). */
  onOpenCount?: (stockCountId: string) => void;
}

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

type Dialog = { kind: "request" } | { kind: "schedule" | "cancel"; request: SilaPhysicalInventory } | null;

/** Physical inventory requests: surprise blind counts scheduled for the cost controller's inspection. */
const SilaPhysicalInventoryRequests: React.FC<SilaPhysicalInventoryRequestsProps> = ({ canRequest, canSchedule, onOpenCount }) => {
  const [status, setStatus] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((err: unknown) => toastService.error(err instanceof Error ? err.message : "Could not load the locations."));
  }, []);

  const loadPage = useCallback((page: SilaPage) => getPhysicalInventories(status, locationId, page), [status, locationId]);
  const list = usePagedList(loadPage, "Could not load the physical inventories.");

  const closeAndReload = () => {
    setDialog(null);
    list.reload();
  };

  return (
    <div className="sila-root sila-me sctl-stack">
      <PageHeader
        className="pud-page-header"
        title="Physical Inventory"
        actions={canRequest ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setDialog({ kind: "request" })}>
            Request physical inventory
          </button>
        ) : undefined}
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Requests</h2>
          <div className="sc-filters">
            <div className="sila-field sc-filter">
              <label className="sila-label" htmlFor="spi-status">Status</label>
              <select id="spi-status" className="sila-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUSES.map((value) => (
                  <option key={value} value={value}>{scLabel(value)}</option>
                ))}
              </select>
            </div>
            <div className="sila-field sc-filter">
              <label className="sila-label" htmlFor="spi-location-filter">Location</label>
              <select id="spi-location-filter" className="sila-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">All locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.locationName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <PagedListBody list={list} noun="physical inventories" emptyTitle="No physical inventory requests">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Location</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  <th scope="col">Count</th>
                  <th scope="col" className="sila-cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.requestNumber}</span>
                      <span className="sc-sub">{formatDate(row.dateCreated)}</span>
                    </td>
                    <td>{row.locationName || "—"}</td>
                    <td>{formatDate(row.scheduledDate)}</td>
                    <td>
                      <span className="sctl-comment">{row.reason}</span>
                      {row.alertTitle && <span className="sc-sub">From alert: {row.alertTitle}</span>}
                    </td>
                    <td><span className={scBadgeClass(row.status)}>{scLabel(row.status)}</span></td>
                    <td>
                      {row.countNumber ? (
                        <>
                          <span>{row.countNumber}</span>
                          <span className="sc-sub">{scLabel(row.countStatus)}</span>
                        </>
                      ) : "—"}
                    </td>
                    <td className="sila-cell-actions">
                      <div className="sc-actions">
                        {row.stockCountId && onOpenCount && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Open count ${row.countNumber ?? ""} of ${row.requestNumber}`}
                            onClick={() => onOpenCount(row.stockCountId as string)}
                          >
                            Open count
                          </button>
                        )}
                        {canSchedule && row.status === "SCHEDULED" && (
                          <>
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              aria-label={`Reschedule ${row.requestNumber}`}
                              onClick={() => setDialog({ kind: "schedule", request: row })}
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--sm"
                              aria-label={`Cancel ${row.requestNumber}`}
                              onClick={() => setDialog({ kind: "cancel", request: row })}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>

      {dialog?.kind === "request" && (
        <PhysicalInventoryRequestDialog locations={locations} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      )}
      {dialog?.kind === "schedule" && (
        <PhysicalInventoryScheduleDialog request={dialog.request} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      )}
      {dialog?.kind === "cancel" && (
        <PhysicalInventoryCancelDialog request={dialog.request} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
};

export default SilaPhysicalInventoryRequests;
