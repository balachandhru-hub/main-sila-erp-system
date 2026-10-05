import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  cancelPhysicalInventory,
  createPhysicalInventory,
  reschedulePhysicalInventory,
  type SilaPhysicalInventory,
} from "../../../api/silaMe/silaControlApi";
import type { SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { formatDate } from "../../cart/lineFormat";
import { daysAgo } from "./controlFormat";

const MAX_REASON = 500;
const RANDOM_HELP = "Leave empty to pick a random working day within the next 7 days. Keep the date confidential.";

interface RequestDialogProps {
  locations: SilaLocation[];
  onClose: () => void;
  onSaved: (request: SilaPhysicalInventory) => void;
}

/** New physical inventory request: location, reason and an optional date. */
export const PhysicalInventoryRequestDialog: React.FC<RequestDialogProps> = ({ locations, onClose, onSaved }) => {
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    if (!locationId) return setFormError("Select the location to count.");
    if (!reason.trim()) return setFormError("Say why the physical inventory is needed.");
    setSaving(true);
    setFormError(null);
    try {
      const created = await createPhysicalInventory({ locationId, reason: reason.trim(), scheduledDate: date || null });
      toastService.success(`${created.requestNumber} scheduled for ${formatDate(created.scheduledDate)}. The cost controllers were notified.`);
      onSaved(created);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not request the physical inventory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      headerProps={{ heading: "Request physical inventory" }}
      footerProps={{
        secondaryButton: { text: "Back", onClick: onClose, disabled: saving },
        primaryButton: { text: "Schedule", onClick: save, loading: saving },
      }}
    >
      <div className="sila-root sila-me sctl-stack">
        <div className="sila-field">
          <label className="sila-label" htmlFor="spi-location">Location<span className="sila-required">*</span></label>
          <select id="spi-location" className="sila-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Select a location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>{location.locationName}</option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="spi-reason">Reason<span className="sila-required">*</span></label>
          <textarea id="spi-reason" className="sila-textarea" rows={3} maxLength={MAX_REASON} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="spi-date">Date</label>
          <input id="spi-date" type="date" className="sila-input" min={daysAgo(0)} value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="sila-help">{RANDOM_HELP}</span>
        </div>
        {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
      </div>
    </Modal>
  );
};

interface ScheduleDialogProps {
  request: SilaPhysicalInventory;
  onClose: () => void;
  onSaved: () => void;
}

/** Moves a scheduled physical inventory to another day (or a new random working day). */
export const PhysicalInventoryScheduleDialog: React.FC<ScheduleDialogProps> = ({ request, onClose, onSaved }) => {
  const [date, setDate] = useState(request.scheduledDate.slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const updated = await reschedulePhysicalInventory(request.id, date || null);
      toastService.success(`${updated.requestNumber} moved to ${formatDate(updated.scheduledDate)}.`);
      onSaved();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not reschedule the physical inventory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      headerProps={{ heading: `Reschedule ${request.requestNumber}` }}
      footerProps={{
        secondaryButton: { text: "Back", onClick: onClose, disabled: saving },
        primaryButton: { text: "Save date", onClick: save, loading: saving },
      }}
    >
      <div className="sila-root sila-me sctl-stack">
        <div className="sila-field">
          <label className="sila-label" htmlFor="spi-new-date">New date</label>
          <input id="spi-new-date" type="date" className="sila-input" min={daysAgo(0)} value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="sila-help">{RANDOM_HELP}</span>
        </div>
        {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
      </div>
    </Modal>
  );
};

/** Confirms the cancellation of a scheduled physical inventory. */
export const PhysicalInventoryCancelDialog: React.FC<ScheduleDialogProps> = ({ request, onClose, onSaved }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await cancelPhysicalInventory(request.id, reason);
      toastService.success(`${request.requestNumber} cancelled.`);
      onSaved();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not cancel the physical inventory.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      variant="danger"
      headerProps={{ heading: `Cancel ${request.requestNumber}` }}
      footerProps={{
        secondaryButton: { text: "Back", onClick: onClose, disabled: saving },
        primaryButton: { text: "Cancel request", onClick: save, loading: saving },
      }}
    >
      <div className="sila-root sila-me sctl-stack">
        <p className="sila-modal-text">
          The surprise count of {request.locationName ?? "the location"} planned for {formatDate(request.scheduledDate)} will not open.
        </p>
        <div className="sila-field">
          <label className="sila-label" htmlFor="spi-cancel-reason">Reason</label>
          <textarea id="spi-cancel-reason" className="sila-textarea" rows={2} maxLength={MAX_REASON} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
      </div>
    </Modal>
  );
};
