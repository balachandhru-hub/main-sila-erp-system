import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  createPurchaseRequest,
  type SilaPurchaseRequest,
  type SilaPurchaseRequestSource,
} from "../../../api/silaMe/silaInventoryControlApi";

export interface SilaPurchaseRequestDraft {
  locationId: string;
  locationName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Base unit of the material; empty when unknown (the server uses the base unit). */
  uom: string;
  /** Proposed quantity in the base unit. */
  quantity: number;
  source: SilaPurchaseRequestSource;
  reason?: string;
}

interface SilaPurchaseRequestDialogProps {
  draft: SilaPurchaseRequestDraft;
  onClose: () => void;
  onCreated: (request: SilaPurchaseRequest) => void;
}

const MAX_REASON = 500;

/** Raises an internal purchase request for a material at a location (from the dashboard, live inventory or an alert). */
const SilaPurchaseRequestDialog: React.FC<SilaPurchaseRequestDialogProps> = ({ draft, onClose, onCreated }) => {
  const [quantity, setQuantity] = useState(draft.quantity > 0 ? String(Number(draft.quantity.toFixed(3))) : "");
  const [reason, setReason] = useState(draft.reason ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const value = Number(quantity);
    if (quantity.trim() === "" || Number.isNaN(value) || value <= 0) {
      setFormError("Enter a quantity greater than zero.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const created = await createPurchaseRequest({
        locationId: draft.locationId,
        materialId: draft.materialId,
        quantity: value,
        uom: draft.uom || null,
        reason: reason.trim() || null,
        source: draft.source,
      });
      toastService.success(`Purchase request ${created.requestNumber} raised.`);
      onCreated(created);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not raise the purchase request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="lg"
      headerProps={{ heading: "Raise purchase request", subHeading: `${draft.materialCode} · ${draft.locationName}` }}
      footerProps={{
        primaryButton: { text: "Raise request", onClick: handleSubmit, loading: saving, disabled: saving },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me sinv-dialog">
        <p className="sila-help">{draft.materialName}</p>
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-pr-quantity">
              Quantity ({draft.uom || "base unit"})<span className="sila-required">*</span>
            </label>
            <input
              id="sinv-pr-quantity"
              className="sila-input"
              type="number"
              min={0}
              step="any"
              value={quantity}
              disabled={saving}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="sinv-pr-reason">Reason</label>
            <textarea
              id="sinv-pr-reason"
              className="sila-textarea"
              value={reason}
              maxLength={MAX_REASON}
              disabled={saving}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        {formError && <p className="sila-error-text" role="alert">{formError}</p>}
      </div>
    </Modal>
  );
};

export default SilaPurchaseRequestDialog;
