import React, { useState } from "react";
import { toastService } from "@vosox/shared-ui";
import { formatQty, silaLabel, type SilaLiveInventoryDetail, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { createQuickTransfer, createTransfer } from "../../../api/silaMe/silaMovementsApi";
import { createPhysicalInventory } from "../../../api/silaMe/silaControlApi";
import SilaPurchaseRequestDialog, { type SilaPurchaseRequestDraft } from "./SilaPurchaseRequestDialog";
import "../materials/SilaMaterials.css";

interface SilaLiveDecisionPanelProps {
  detail: SilaLiveInventoryDetail;
  /** The caller's stores and outlets. */
  locations: SilaLocation[];
  currentLocationId: string;
  requiredQty: string;
  onCurrentLocationChange: (locationId: string) => void;
  onRequiredQtyChange: (value: string) => void;
  canTransfer: boolean;
  canRequestPurchase: boolean;
  /** Called after an action created something, so the stock reloads. */
  onChanged: () => void;
}

const TRANSFER_ACTIONS = ["REQUEST_TRANSFER", "QUICK_TRANSFER", "ADD_TO_LOCATION", "ONE_TIME_TRANSFER", "REDISTRIBUTE_STOCK"];

const ACTION_LABEL: Record<string, string> = {
  REQUEST_TRANSFER: "Request transfer",
  QUICK_TRANSFER: "Quick transfer",
  ADD_TO_LOCATION: "Add to location and transfer",
  ONE_TIME_TRANSFER: "One-time transfer",
  REDISTRIBUTE_STOCK: "Redistribute stock",
  CREATE_PR: "Create purchase request",
  REQUEST_ITEM: "Request item",
  REQUEST_PHYSICAL_INVENTORY: "Request physical inventory",
};

/** What the current location needs, what the property can give, and the next actions for this material. */
const SilaLiveDecisionPanel: React.FC<SilaLiveDecisionPanelProps> = ({
  detail,
  locations,
  currentLocationId,
  requiredQty,
  onCurrentLocationChange,
  onRequiredQtyChange,
  canTransfer,
  canRequestPurchase,
  onChanged,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<SilaPurchaseRequestDraft | null>(null);

  const managed = [detail.batchManaged ? "Batch" : "—", detail.expiryManaged ? "Expiry" : "—", detail.serialManaged ? "Serial" : "—"].join(" / ");
  const current = locations.find((location) => location.id === (detail.currentLocationId ?? currentLocationId));
  const required = Number(requiredQty) || 0;
  const shortage = detail.shortage ?? 0;

  // Move what is missing (or what is required), at most what the source can give.
  const transferQty = (): number => {
    const wanted = shortage > 0 ? shortage : required > 0 ? required : 1;
    return Math.min(wanted, detail.bestSourceTransferableQty ?? wanted);
  };

  const allowed = (action: string): boolean => {
    if (action === "CREATE_PR" || action === "REQUEST_ITEM") return canRequestPurchase;
    if (TRANSFER_ACTIONS.includes(action)) return canTransfer;
    return true;
  };

  const run = async (action: string) => {
    if (!current) return;
    if (action === "CREATE_PR" || action === "REQUEST_ITEM") {
      setDraft({
        locationId: current.id,
        locationName: current.locationName,
        materialId: detail.materialId,
        materialCode: detail.materialCode,
        materialName: detail.description,
        uom: detail.baseUom,
        quantity: shortage > 0 ? shortage : required,
        source: "LIVE_INVENTORY",
        reason: action === "REQUEST_ITEM" ? "Item not stocked at the location" : "Live inventory shortage",
      });
      return;
    }
    setBusy(action);
    try {
      if (action === "REQUEST_PHYSICAL_INVENTORY") {
        await createPhysicalInventory({ locationId: current.id, reason: `Live inventory: negative stock of ${detail.materialCode}` });
        toastService.success("Physical inventory requested.");
      } else if (action === "REDISTRIBUTE_STOCK") {
        const quantity = detail.redistributeQty ?? 0;
        await createTransfer({
          fromLocationId: current.id,
          toLocationId: detail.redistributeToLocationId as string,
          reason: "Redistribution from live inventory",
          requiredBy: null,
          items: [{ materialId: detail.materialId, quantity, uom: null }],
        });
        toastService.success(`Transfer of ${formatQty(quantity)} ${detail.baseUom} to ${detail.redistributeToName} raised.`);
      } else {
        const quick = action === "QUICK_TRANSFER" || action === "ONE_TIME_TRANSFER";
        const payload = {
          fromLocationId: detail.bestSourceLocationId as string,
          toLocationId: current.id,
          reason: quick ? "Guest service" : "Live inventory shortage",
          requiredBy: null,
          items: [{ materialId: detail.materialId, quantity: transferQty(), uom: null }],
          addToLocation: action === "ADD_TO_LOCATION",
        };
        if (quick) await createQuickTransfer(payload);
        else await createTransfer(payload);
        toastService.success(
          `${quick ? "Quick transfer" : "Transfer"} of ${formatQty(transferQty())} ${detail.baseUom} from ${detail.bestSourceName} raised.`,
        );
      }
      onChanged();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not complete the action.");
    } finally {
      setBusy(null);
    }
  };

  const actions = (detail.nextActions ?? []).filter((action) => action in ACTION_LABEL && allowed(action));

  return (
    <div className="sinv-decision">
      <dl className="smat-facts">
        <div><dt>Material ID</dt><dd>{detail.materialCode}</dd></div>
        <div><dt>Description</dt><dd>{detail.description}</dd></div>
        <div><dt>Base UOM</dt><dd>{detail.baseUom}</dd></div>
        <div><dt>Inventory type</dt><dd>{detail.inventoryType ? silaLabel(detail.inventoryType) : "—"}</dd></div>
        <div>
          <dt>Stocking here</dt>
          <dd>
            {detail.notStockedAtLocation
              ? <span className="sila-me-flag sila-me-flag--bad">Not stocked at this location</span>
              : detail.localStockingStatus ? silaLabel(detail.localStockingStatus) : "—"}
          </dd>
        </div>
        <div><dt>Batch / expiry / serial</dt><dd>{managed}</dd></div>
        <div>
          <dt>Unit cost</dt>
          <dd>
            {detail.unitCost === null || detail.unitCost === undefined
              ? <span className="sila-me-flag sila-me-flag--bad">Price missing</span>
              : `${detail.currency ? `${detail.currency} ` : ""}${formatQty(detail.unitCost)} / ${detail.baseUom}`}
          </dd>
        </div>
      </dl>
      <div className="sinv-filters">
        <div className="sila-field">
          <label className="sila-label" htmlFor="sinv-live-current">Transfer location</label>
          <select
            id="sinv-live-current"
            className="sila-select"
            value={detail.currentLocationId ?? currentLocationId}
            onChange={(event) => onCurrentLocationChange(event.target.value)}
          >
            {!detail.currentLocationId && <option value="">Select a location</option>}
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.locationName} ({location.locationCode})</option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="sinv-live-required">Required quantity ({detail.baseUom})</label>
          <input
            id="sinv-live-required"
            className="sila-input sinv-qty-input"
            type="number"
            min={0}
            step="any"
            value={requiredQty}
            onChange={(event) => onRequiredQtyChange(event.target.value)}
          />
        </div>
        <span className="sinv-inline">
          <span className="sila-badge sila-badge--neutral">Available locally: {formatQty(detail.localAvailable)}</span>
          <span className={`sila-badge ${shortage > 0 ? "sila-badge--warning" : "sila-badge--success"}`}>Shortage: {formatQty(shortage)}</span>
          {detail.bestSourceName && (
            <span className="sila-badge sila-badge--info">
              Best source: {detail.bestSourceName} ({formatQty(detail.bestSourceTransferableQty)})
            </span>
          )}
        </span>
      </div>
      {(detail.recommendation || detail.recommendationReason) && (
        <p className="sila-help">
          {detail.recommendation && <span className="sila-cell-strong">{silaLabel(detail.recommendation)}</span>}
          {detail.recommendation && detail.recommendationReason ? " · " : ""}
          {detail.recommendationReason}
        </p>
      )}
      {actions.length > 0 && current && (
        <div className="sila-btn-group">
          {actions.map((action, index) => (
            <button
              key={action}
              type="button"
              className={`sila-btn sila-btn--sm ${index === 0 ? "sila-btn--primary" : "sila-btn--secondary"}`}
              disabled={busy !== null}
              onClick={() => run(action)}
            >
              {busy === action ? "Working..." : ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      )}
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
    </div>
  );
};

export default SilaLiveDecisionPanel;
