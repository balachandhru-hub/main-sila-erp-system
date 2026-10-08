import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import type { SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { SILA_ADJUSTMENT_TYPES, createAdjustment } from "../../../api/silaMe/silaMovementsApi";
import MovementLinesEditor, { toLineWrites, validateLines, type MovementLine } from "./MovementLinesEditor";
import { movementLabel } from "./movementFormat";

interface SilaAdjustmentFormProps {
  /** Locations the user works at. */
  locations: SilaLocation[];
  onClose: () => void;
  onCreated: () => void;
}

const TYPE_HELP: Record<string, string> = {
  OPENING_STOCK: "Adds the counted stock when a location starts using SILA ME.",
  MANUAL_ADJUSTMENT: "A positive quantity adds stock, a negative quantity removes it.",
};

/** New stock adjustment: opening stock, a waste type or a manual correction. Posted at once. */
const SilaAdjustmentForm: React.FC<SilaAdjustmentFormProps> = ({ locations, onClose, onCreated }) => {
  const [locationId, setLocationId] = useState(locations.length === 1 ? locations[0].id : "");
  const [type, setType] = useState<string>("WASTE");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const opening = type === "OPENING_STOCK";
  const manual = type === "MANUAL_ADJUSTMENT";

  const handleSubmit = async () => {
    if (!locationId) {
      setFormError("Select the location.");
      return;
    }
    if (!opening && !reason.trim()) {
      setFormError("Enter the reason for the adjustment.");
      return;
    }
    const lineError = validateLines(lines, manual);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const writes = toLineWrites(lines);
      await createAdjustment({
        locationId,
        adjustmentType: type,
        reason: reason.trim() || null,
        items: writes.map((write, index) => ({
          ...write,
          unitCost: lines[index].unitCost.trim() === "" ? null : Number(lines[index].unitCost),
        })),
      });
      toastService.success("Stock adjustment posted.");
      onCreated();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not post the stock adjustment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: "New stock adjustment" }}
      footerProps={{
        primaryButton: { text: "Post adjustment", onClick: handleSubmit, loading: saving, disabled: saving },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me smov-dialog">
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-adj-type">Type<span className="sila-required">*</span></label>
            <select
              id="smov-adj-type"
              className="sila-select"
              value={type}
              disabled={saving}
              onChange={(event) => setType(event.target.value)}
              aria-describedby={TYPE_HELP[type] ? "smov-adj-type-help" : undefined}
            >
              {SILA_ADJUSTMENT_TYPES.map((item) => (
                <option key={item} value={item}>{movementLabel(item)}</option>
              ))}
            </select>
            {TYPE_HELP[type] && <span id="smov-adj-type-help" className="sila-help">{TYPE_HELP[type]}</span>}
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-adj-location">Location<span className="sila-required">*</span></label>
            <select
              id="smov-adj-location"
              className="sila-select"
              value={locationId}
              disabled={saving}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">Select the location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode}){location.propertyName ? ` — ${location.propertyName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="smov-adj-reason">
              Reason{!opening && <span className="sila-required">*</span>}
            </label>
            <input
              id="smov-adj-reason"
              className="sila-input"
              value={reason}
              maxLength={500}
              disabled={saving}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <MovementLinesEditor
          idPrefix="smov-adj"
          lines={lines}
          onChange={setLines}
          allowNegative={manual}
          showUnitCost={opening}
          disabled={saving}
        />

        {formError && <p className="sila-error-text" role="alert">{formError}</p>}
      </div>
    </Modal>
  );
};

export default SilaAdjustmentForm;
