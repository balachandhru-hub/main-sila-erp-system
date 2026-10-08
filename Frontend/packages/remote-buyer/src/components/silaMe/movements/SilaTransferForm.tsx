import React, { useMemo, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import type { SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { createQuickTransfer, createTransfer } from "../../../api/silaMe/silaMovementsApi";
import MovementLinesEditor, { toLineWrites, validateLines, type MovementLine } from "./MovementLinesEditor";
import { todayInput } from "./movementFormat";

interface SilaTransferFormProps {
  /** Quick: the stock leaves the source at once, no approval. */
  quick: boolean;
  /** All transfer-enabled locations of the organization. */
  locations: SilaLocation[];
  /** Ids of the locations the user works at. */
  myLocationIds: string[];
  onClose: () => void;
  onCreated: (transferId: string) => void;
}

const locationText = (location: SilaLocation): string =>
  `${location.locationName} (${location.locationCode})${location.propertyName ? ` — ${location.propertyName}` : ""}`;

/** New standard transfer request, or a quick transfer sent at once. Both locations belong to one property. */
const SilaTransferForm: React.FC<SilaTransferFormProps> = ({ quick, locations, myLocationIds, onClose, onCreated }) => {
  // Already collected: the requester took the stock from any location to one of his own locations.
  const [alreadyCollected, setAlreadyCollected] = useState(false);
  const sources = useMemo(
    () => (quick && !alreadyCollected ? locations.filter((location) => myLocationIds.includes(location.id)) : locations),
    [quick, alreadyCollected, locations, myLocationIds],
  );
  const [fromId, setFromId] = useState(sources.length === 1 ? sources[0].id : "");
  const [toId, setToId] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const from = locations.find((location) => location.id === fromId);
  // Transfers stay inside one property.
  const destinations = from
    ? locations.filter(
        (location) =>
          location.id !== from.id &&
          location.propertyId === from.propertyId &&
          (!alreadyCollected || myLocationIds.includes(location.id)),
      )
    : [];

  const handleCollected = (value: boolean) => {
    setAlreadyCollected(value);
    setFromId("");
    setToId("");
  };

  const handleFrom = (value: string) => {
    setFromId(value);
    const nextFrom = locations.find((location) => location.id === value);
    const currentTo = locations.find((location) => location.id === toId);
    if (!nextFrom || !currentTo || currentTo.propertyId !== nextFrom.propertyId || currentTo.id === nextFrom.id) setToId("");
  };

  const handleSubmit = async () => {
    if (!fromId || !toId) {
      setFormError("Select the source and the destination.");
      return;
    }
    if (alreadyCollected && !myLocationIds.includes(toId)) {
      setFormError("Record collected stock for a destination you work at.");
      return;
    }
    if (!quick && !myLocationIds.includes(fromId) && !myLocationIds.includes(toId)) {
      setFormError("Request transfers for a location you work at.");
      return;
    }
    const lineError = validateLines(lines);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        fromLocationId: fromId,
        toLocationId: toId,
        reason: reason.trim() || null,
        requiredBy: requiredBy || null,
        items: toLineWrites(lines),
        alreadyCollected: quick ? alreadyCollected : undefined,
      };
      const id = quick ? await createQuickTransfer(payload) : await createTransfer(payload);
      toastService.success(alreadyCollected ? "Collected stock recorded." : quick ? "Quick transfer sent." : "Transfer requested.");
      onCreated(id);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the transfer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: quick ? "Quick transfer" : "New transfer" }}
      footerProps={{
        primaryButton: { text: quick ? "Send now" : "Request transfer", onClick: handleSubmit, loading: saving, disabled: saving },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me smov-dialog">
        {quick && (
          <div className="sila-alert sila-alert--warning" role="note">
            {alreadyCollected
              ? "Records stock you already took from the source. The source confirms the handover, or disputes it."
              : "Quick transfers follow the quick-transfer policy: the stock can leave the source at once and the destination confirms what arrives."}
          </div>
        )}
        {quick && (
          <label className="sila-choice" htmlFor="smov-transfer-collected">
            <input
              id="smov-transfer-collected"
              type="checkbox"
              checked={alreadyCollected}
              disabled={saving}
              onChange={(event) => handleCollected(event.target.checked)}
            />
            Record already collected
          </label>
        )}
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-transfer-from">From<span className="sila-required">*</span></label>
            <select
              id="smov-transfer-from"
              className="sila-select"
              value={fromId}
              disabled={saving}
              onChange={(event) => handleFrom(event.target.value)}
            >
              <option value="">Select the source</option>
              {sources.map((location) => (
                <option key={location.id} value={location.id}>{locationText(location)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-transfer-to">To<span className="sila-required">*</span></label>
            <select
              id="smov-transfer-to"
              className="sila-select"
              value={toId}
              disabled={saving || !from}
              onChange={(event) => setToId(event.target.value)}
            >
              <option value="">{from ? "Select the destination" : "Select the source first"}</option>
              {destinations.map((location) => (
                <option key={location.id} value={location.id}>{locationText(location)}</option>
              ))}
            </select>
          </div>
          {!quick && (
            <div className="sila-field">
              <label className="sila-label" htmlFor="smov-transfer-required">Required by</label>
              <input
                id="smov-transfer-required"
                className="sila-input"
                type="date"
                min={todayInput()}
                value={requiredBy}
                disabled={saving}
                onChange={(event) => setRequiredBy(event.target.value)}
              />
            </div>
          )}
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="smov-transfer-reason">Reason</label>
            <input
              id="smov-transfer-reason"
              className="sila-input"
              value={reason}
              maxLength={500}
              disabled={saving}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>

        <MovementLinesEditor idPrefix="smov-transfer" lines={lines} onChange={setLines} disabled={saving} />

        {formError && <p className="sila-error-text" role="alert">{formError}</p>}
      </div>
    </Modal>
  );
};

export default SilaTransferForm;
