import React, { useState } from "react";
import { EmptyState, toastService } from "@vosox/shared-ui";
import { silaLabel } from "../../../api/silaMe/silaInventoryApi";
import { updateAlert } from "../../../api/silaMe/silaStockCountApi";
import { requestAlertPhysicalInventory } from "../../../api/silaMe/silaControlApi";
import { createReplenishmentTransfers, type SilaDashboardAction } from "../../../api/silaMe/silaInventoryControlApi";
import SilaPurchaseRequestDialog, { type SilaPurchaseRequestDraft } from "./SilaPurchaseRequestDialog";

interface SilaDashboardActionsProps {
  actions: SilaDashboardAction[];
  canRequestPurchase: boolean;
  /** MANAGE_SILA_TRANSFER: raise the recommended transfer. */
  canTransfer?: boolean;
  /** Called after an alert or a request changed, so the dashboard reloads. */
  onChanged: () => void;
}

export const severityBadge = (severity: string): string => {
  switch (severity) {
    case "CRITICAL":
      return "sila-badge--danger";
    case "HIGH":
      return "sila-badge--warning";
    case "MEDIUM":
      return "sila-badge--info";
    default:
      return "sila-badge--neutral";
  }
};

const RECOMMENDATION_TEXT: Record<string, string> = {
  REQUEST_TRANSFER: "Request a transfer from another location of the property.",
  REQUEST_PHYSICAL_INVENTORY: "Count the stock to correct the balance.",
  INVESTIGATE: "Investigate the movement.",
  REVIEW_TRANSFER: "Review the transfer before closing it.",
};

/** Open alerts with their recommended action: acknowledge, request a physical inventory or raise a purchase request. */
const SilaDashboardActions: React.FC<SilaDashboardActionsProps> = ({ actions, canRequestPurchase, canTransfer = false, onChanged }) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SilaPurchaseRequestDraft | null>(null);

  const run = async (alertId: string, work: () => Promise<unknown>, done: string) => {
    setBusyId(alertId);
    try {
      await work();
      toastService.success(done);
      onChanged();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not update the alert.");
    } finally {
      setBusyId(null);
    }
  };

  const openRequest = (action: SilaDashboardAction) =>
    setDraft({
      locationId: action.locationId as string,
      locationName: action.locationName ?? "",
      materialId: action.materialId as string,
      materialCode: action.materialCode ?? "",
      materialName: action.title,
      uom: action.uom ?? "",
      quantity: action.recommendedQty ?? 0,
      source: "ALERT",
      reason: action.title,
    });

  return (
    <section className="sila-card" aria-labelledby="sinv-actions-title">
      <div className="sila-card-header">
        <h2 id="sinv-actions-title" className="sila-card-title">Action Center</h2>
      </div>
      <div className="sila-card-body">
        {actions.length === 0 ? (
          <EmptyState title="No open alerts" description="No inventory exceptions need action for this context." />
        ) : (
          <ul className="sinv-alert-list">
            {actions.map((action) => {
              const busy = busyId === action.alertId;
              const canOrder =
                canRequestPurchase && (action.primaryAction === "CREATE_PR" || action.alertType === "LOW_STOCK") && action.locationId && action.materialId;
              const canMove =
                canTransfer && action.primaryAction === "CREATE_TRANSFER" && action.sourceLocationId && action.locationId && action.materialId && (action.recommendedQty ?? 0) > 0;
              return (
                <li key={action.alertId} className="sinv-alert-item">
                  <div className="sinv-alert-text">
                    <span className="sila-cell-strong">{action.title}</span>
                    <span className="sinv-sub">{action.message}</span>
                    {action.impact && <span className="sinv-sub">Impact: {action.impact}</span>}
                    {action.recommendation ? (
                      <span className="sinv-sub">Recommended: {action.recommendation}</span>
                    ) : action.recommendedAction && (
                      <span className="sinv-sub">Recommended: {RECOMMENDATION_TEXT[action.recommendedAction] ?? silaLabel(action.recommendedAction)}</span>
                    )}
                    <span className="sinv-sub">
                      {[action.kindLabel || silaLabel(action.alertType), action.locationName, action.materialCode, new Date(action.createdOn).toLocaleString()].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="sinv-alert-side">
                    <span className="sinv-inline">
                      <span className={`sila-badge ${severityBadge(action.severity)}`}>{silaLabel(action.severity)}</span>
                      <span className="sila-badge sila-badge--neutral">{silaLabel(action.status)}</span>
                    </span>
                    <span className="sinv-inline">
                      {action.status === "NEW" && (
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          disabled={busy}
                          onClick={() => run(action.alertId, () => updateAlert(action.alertId, "acknowledge"), "Alert acknowledged.")}
                        >
                          Acknowledge
                        </button>
                      )}
                      {action.recommendedAction === "REQUEST_PHYSICAL_INVENTORY" && action.locationId && (
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          disabled={busy}
                          onClick={() => run(action.alertId, () => requestAlertPhysicalInventory(action.alertId), "Physical inventory requested.")}
                        >
                          Request count
                        </button>
                      )}
                      {canMove && (
                        <button
                          type="button"
                          className="sila-btn sila-btn--primary sila-btn--sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              action.alertId,
                              () =>
                                createReplenishmentTransfers([
                                  {
                                    materialId: action.materialId as string,
                                    sourceLocationId: action.sourceLocationId as string,
                                    destinationLocationId: action.locationId as string,
                                    quantity: action.recommendedQty as number,
                                  },
                                ]),
                              `Transfer requested from ${action.sourceLocationName ?? "the source"}.`,
                            )
                          }
                        >
                          Create transfer
                        </button>
                      )}
                      {canOrder && (
                        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={() => openRequest(action)}>
                          Create PR
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {draft && (
        <SilaPurchaseRequestDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onCreated={() => {
            setDraft(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
};

export default SilaDashboardActions;
