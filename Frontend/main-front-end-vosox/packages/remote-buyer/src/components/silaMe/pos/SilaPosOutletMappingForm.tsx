import React, { useEffect, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { getLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { saveOutletMapping, type SilaPosOutletMapping, type SilaPosOutletMappingWrite } from "../../../api/silaMe/silaPosMasterApi";
import { errorText } from "./posFormat";

interface SilaPosOutletMappingFormProps {
  sourceId: string;
  /** null creates a new mapping. */
  mapping: SilaPosOutletMapping | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit dialog of a POS outlet → SILA outlet location mapping. */
const SilaPosOutletMappingForm: React.FC<SilaPosOutletMappingFormProps> = ({ sourceId, mapping, onClose, onSaved }) => {
  const [form, setForm] = useState<SilaPosOutletMappingWrite>({
    posOutletCode: mapping?.posOutletCode ?? "",
    posOutletName: mapping?.posOutletName ?? "",
    outletLocationId: mapping?.outletLocationId ?? "",
  });
  const [outlets, setOutlets] = useState<SilaLocation[]>([]);
  const [outletsError, setOutletsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getLocations()
      .then((locations) => {
        if (active) setOutlets(locations.filter((location) => location.locationType === "OUTLET"));
      })
      .catch((err: unknown) => {
        if (active) setOutletsError(errorText(err, "Could not load the outlet locations."));
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = outlets.find((outlet) => outlet.id === form.outletLocationId);

  const handleSave = async () => {
    if (!form.posOutletCode.trim()) {
      toastService.error("Enter the POS outlet code.");
      return;
    }
    if (!form.outletLocationId) {
      toastService.error("Select the SILA outlet location.");
      return;
    }
    setSaving(true);
    try {
      await saveOutletMapping(sourceId, mapping?.id ?? null, {
        posOutletCode: form.posOutletCode.trim(),
        posOutletName: form.posOutletName?.trim() || null,
        outletLocationId: form.outletLocationId,
      });
      toastService.success(mapping ? "Outlet mapping updated." : "Outlet mapping created.");
      onSaved();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not save the outlet mapping."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      headerProps={{ heading: mapping ? "Edit outlet mapping" : "New outlet mapping" }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: mapping ? "Save" : "Create", onClick: handleSave, loading: saving },
      }}
    >
      <form
        className="sila-root sila-me"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-om-code">POS outlet code<span className="sila-required">*</span></label>
            <input
              id="spos-om-code"
              className="sila-input"
              maxLength={100}
              value={form.posOutletCode}
              onChange={(event) => setForm((current) => ({ ...current, posOutletCode: event.target.value }))}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-om-name">POS outlet name</label>
            <input
              id="spos-om-name"
              className="sila-input"
              maxLength={200}
              value={form.posOutletName ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, posOutletName: event.target.value }))}
            />
          </div>
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="spos-om-location">SILA outlet location<span className="sila-required">*</span></label>
            <select
              id="spos-om-location"
              className="sila-select"
              value={form.outletLocationId}
              onChange={(event) => setForm((current) => ({ ...current, outletLocationId: event.target.value }))}
            >
              <option value="">Select an outlet location</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.locationName} ({outlet.locationCode}) · {outlet.propertyName}
                </option>
              ))}
            </select>
            {outletsError && <span className="sila-error-text">{outletsError}</span>}
            {selected && (
              <span className="sila-help">
                Property {selected.propertyName}
                {selected.storageLocationCode ? ` · storage location ${selected.storageLocationCode}` : ""}
              </span>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default SilaPosOutletMappingForm;
