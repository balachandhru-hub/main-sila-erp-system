import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import type { Outlet } from "../../../api/outletApi";
import type { Property } from "../../../api/propertyApi";
import {
  SILA_LOCATION_TYPES,
  SILA_STORE_CATEGORIES,
  createLocation,
  silaLabel,
  updateLocation,
  type SilaLocation,
  type SilaLocationWrite,
} from "../../../api/silaMe/silaInventoryApi";
import SilaSearchableSelect, { silaLocationOptions } from "../SilaSearchableSelect";

interface SilaLocationFormProps {
  /** null creates a new location. */
  location: SilaLocation | null;
  properties: Property[];
  outlets: Outlet[];
  /** All locations of the organization; the venues among them can be parents. */
  locations?: SilaLocation[];
  onClose: () => void;
  onSaved: () => void;
}

const toForm = (location: SilaLocation | null): SilaLocationWrite => ({
  propertyId: location?.propertyId ?? "",
  locationCode: location?.locationCode ?? "",
  locationName: location?.locationName ?? "",
  locationType: location?.locationType ?? "STORE",
  outletId: location?.outletId ?? null,
  storeCategory: location?.storeCategory ?? "GENERAL",
  storageLocationCode: location?.storageLocationCode ?? "",
  transferEnabled: location?.transferEnabled ?? true,
  salesEnabled: location?.salesEnabled ?? false,
  parentLocationId: location?.parentLocationId ?? null,
  glAccount: location?.glAccount ?? "",
  costCenter: location?.costCenter ?? "",
  profitCenter: location?.profitCenter ?? "",
  description: location?.description ?? "",
  inventoryEnabled: location?.inventoryEnabled ?? true,
  consumptionEnabled: location?.consumptionEnabled ?? true,
});

const MAX_ACCOUNT = 40;

/** Create / edit dialog of an inventory location. */
const SilaLocationForm: React.FC<SilaLocationFormProps> = ({ location, properties, outlets, locations = [], onClose, onSaved }) => {
  const [form, setForm] = useState<SilaLocationWrite>(() => toForm(location));
  const [saving, setSaving] = useState(false);

  const isOutlet = form.locationType === "OUTLET";
  const isVenue = form.locationType === "VENUE";
  const propertyOutlets = outlets.filter((outlet) => outlet.propertyId === form.propertyId);
  // A store or outlet may sit in a venue of the same property.
  const venues = locations.filter(
    (row) => row.locationType === "VENUE" && row.propertyId === form.propertyId && row.id !== location?.id,
  );

  const setField = <K extends keyof SilaLocationWrite>(field: K, value: SilaLocationWrite[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const changeProperty = (propertyId: string) =>
    setForm((current) => ({ ...current, propertyId, outletId: null, parentLocationId: null }));

  const changeType = (locationType: string) =>
    setForm((current) => ({ ...current, locationType, parentLocationId: locationType === "VENUE" ? null : current.parentLocationId }));

  // Picking an outlet proposes its name, code and storage location when those are still empty.
  const changeOutlet = (outletId: string) => {
    const outlet = outlets.find((row) => row.id === outletId);
    setForm((current) => ({
      ...current,
      outletId: outletId || null,
      locationName: current.locationName || outlet?.outletName || "",
      locationCode: current.locationCode || outlet?.outletCode || "",
      storageLocationCode: current.storageLocationCode || outlet?.storageLocation || "",
    }));
  };

  const handleSave = async () => {
    if (!form.propertyId) {
      toastService.error("Select the property of the location.");
      return;
    }
    if (!form.locationCode.trim() || !form.locationName.trim()) {
      toastService.error("Enter a location code and a location name.");
      return;
    }
    if (isOutlet && !form.outletId) {
      toastService.error("Select the outlet this location stands for.");
      return;
    }
    if ([form.glAccount, form.costCenter, form.profitCenter].some((value) => (value ?? "").trim().length > MAX_ACCOUNT)) {
      toastService.error(`Use at most ${MAX_ACCOUNT} characters for the GL account, cost center and profit center.`);
      return;
    }
    if (form.locationType === "STORE" && !form.storeCategory) {
      toastService.error("Select the store category.");
      return;
    }

    const payload: SilaLocationWrite = {
      ...form,
      locationCode: form.locationCode.trim(),
      locationName: form.locationName.trim(),
      outletId: isOutlet ? form.outletId : null,
      storeCategory: form.locationType === "STORE" ? form.storeCategory : null,
      storageLocationCode: form.storageLocationCode?.trim() || null,
      parentLocationId: isVenue ? null : form.parentLocationId || null,
      glAccount: form.glAccount?.trim() || null,
      costCenter: form.costCenter?.trim() || null,
      profitCenter: form.profitCenter?.trim() || null,
      transferEnabled: isVenue ? false : form.transferEnabled,
      salesEnabled: isVenue ? false : form.salesEnabled,
      description: form.description?.trim() ?? "",
      inventoryEnabled: isVenue ? false : form.inventoryEnabled,
      consumptionEnabled: isVenue ? false : form.consumptionEnabled,
    };
    setSaving(true);
    try {
      if (location) {
        await updateLocation(location.id, payload);
        toastService.success("Location updated.");
      } else {
        await createLocation(payload);
        toastService.success("Location created.");
      }
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{ heading: location ? "Edit location" : "New location" }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: location ? "Save" : "Create", onClick: handleSave, loading: saving },
      }}
    >
      <form
        className="sila-root sila-me sinv-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-type">Type<span className="sila-required">*</span></label>
            <select
              id="sinv-form-type"
              className="sila-select"
              value={form.locationType}
              onChange={(event) => changeType(event.target.value)}
            >
              {SILA_LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>{silaLabel(type)}</option>
              ))}
            </select>
          </div>
          <SilaSearchableSelect
            label="Property"
            required
            placeholder="Select a property"
            value={form.propertyId}
            options={properties.map((property) => ({
              value: property.id,
              label: `${property.propertyName} (${property.plantCode})`,
            }))}
            onChange={changeProperty}
            infoText={properties.length === 0 ? "Create a property first." : undefined}
          />
          {isOutlet ? (
            <SilaSearchableSelect
              label="Outlet"
              required
              placeholder="Select an outlet"
              value={form.outletId ?? ""}
              disabled={!form.propertyId}
              options={propertyOutlets.map((outlet) => ({ value: outlet.id, label: outlet.outletName }))}
              onChange={changeOutlet}
              infoText={form.propertyId && propertyOutlets.length === 0 ? "The property has no outlets." : undefined}
            />
          ) : isVenue ? null : (
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-form-category">Store category<span className="sila-required">*</span></label>
              <select
                id="sinv-form-category"
                className="sila-select"
                value={form.storeCategory ?? ""}
                onChange={(event) => setField("storeCategory", event.target.value || null)}
              >
                {SILA_STORE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{silaLabel(category)}</option>
                ))}
              </select>
            </div>
          )}
          {!isVenue && (
            <SilaSearchableSelect
              label="Venue"
              placeholder="No venue"
              value={form.parentLocationId ?? ""}
              disabled={!form.propertyId}
              options={silaLocationOptions(venues)}
              onChange={(parentLocationId) => setField("parentLocationId", parentLocationId || null)}
            />
          )}
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-code">Location code<span className="sila-required">*</span></label>
            <input
              id="sinv-form-code"
              className="sila-input"
              value={form.locationCode}
              onChange={(event) => setField("locationCode", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-name">Location name<span className="sila-required">*</span></label>
            <input
              id="sinv-form-name"
              className="sila-input"
              value={form.locationName}
              onChange={(event) => setField("locationName", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-sloc">SAP storage location</label>
            <input
              id="sinv-form-sloc"
              className="sila-input"
              value={form.storageLocationCode ?? ""}
              onChange={(event) => setField("storageLocationCode", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-gl">GL account</label>
            <input
              id="sinv-form-gl"
              className="sila-input"
              maxLength={MAX_ACCOUNT}
              value={form.glAccount ?? ""}
              onChange={(event) => setField("glAccount", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-cost">Cost center</label>
            <input
              id="sinv-form-cost"
              className="sila-input"
              maxLength={MAX_ACCOUNT}
              value={form.costCenter ?? ""}
              onChange={(event) => setField("costCenter", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-form-profit">Profit center</label>
            <input
              id="sinv-form-profit"
              className="sila-input"
              maxLength={MAX_ACCOUNT}
              value={form.profitCenter ?? ""}
              onChange={(event) => setField("profitCenter", event.target.value)}
            />
          </div>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="sinv-form-description">Description</label>
          <textarea
            id="sinv-form-description"
            className="sila-textarea"
            rows={2}
            maxLength={500}
            value={form.description ?? ""}
            onChange={(event) => setField("description", event.target.value)}
          />
        </div>
        {isVenue ? (
          <p className="sila-help">A venue groups stores and outlets of its property; it holds no stock itself.</p>
        ) : (
        <div className="sinv-inline">
          <label className="sila-choice">
            <input
              type="checkbox"
              checked={form.transferEnabled}
              onChange={(event) => setField("transferEnabled", event.target.checked)}
            />
            Transfers enabled
          </label>
          <label className="sila-choice">
            <input
              type="checkbox"
              checked={form.salesEnabled}
              onChange={(event) => setField("salesEnabled", event.target.checked)}
            />
            Sales enabled
          </label>
          <label className="sila-choice">
            <input
              type="checkbox"
              checked={form.inventoryEnabled !== false}
              onChange={(event) => setField("inventoryEnabled", event.target.checked)}
            />
            Inventory enabled
          </label>
          <label className="sila-choice">
            <input
              type="checkbox"
              checked={form.consumptionEnabled !== false}
              onChange={(event) => setField("consumptionEnabled", event.target.checked)}
            />
            Consumption enabled
          </label>
        </div>
        )}
      </form>
    </Modal>
  );
};

export default SilaLocationForm;
