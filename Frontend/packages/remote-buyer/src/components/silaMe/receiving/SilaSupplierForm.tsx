import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { createSupplier, updateSupplier, type SilaSupplier, type SilaSupplierWrite } from "../../../api/silaMe/silaMasterDataApi";

interface SilaSupplierFormProps {
  /** The supplier to change, or null to add one. */
  supplier: SilaSupplier | null;
  onClose: () => void;
  onSaved: () => void;
}

interface SupplierForm {
  supplierCode: string;
  name: string;
  taxNumber: string;
  aliases: string;
  country: string;
  status: string;
  legalName: string;
  city: string;
  address: string;
  currency: string;
}

const toForm = (supplier: SilaSupplier | null): SupplierForm => ({
  supplierCode: supplier?.supplierCode ?? "",
  name: supplier?.name ?? "",
  taxNumber: supplier?.taxNumber ?? "",
  aliases: supplier?.aliases.join(", ") ?? "",
  country: supplier?.country ?? "",
  status: supplier?.status ?? "ACTIVE",
  legalName: supplier?.legalName ?? "",
  city: supplier?.city ?? "",
  address: supplier?.address ?? "",
  currency: supplier?.currency ?? "",
});

/** The first problem of the form, or null when it can be saved (the server checks again). */
const validate = (form: SupplierForm): string | null => {
  if (!form.supplierCode.trim()) return "Enter the supplier code.";
  if (!/^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(form.supplierCode.trim())) return "Supplier code: letters, digits and _ . / - only.";
  if (!form.name.trim()) return "Enter the supplier name.";
  if (form.country.trim() && !/^[A-Za-z]{2,3}$/.test(form.country.trim())) return "Country: a 2 or 3 letter ISO code, for example AE.";
  if (form.currency.trim() && !/^[A-Za-z]{3}$/.test(form.currency.trim())) return "Currency: a 3 letter ISO code, for example AED.";
  return null;
};

/** Add or change a Supplier Master row. */
const SilaSupplierForm: React.FC<SilaSupplierFormProps> = ({ supplier, onClose, onSaved }) => {
  const [form, setForm] = useState<SupplierForm>(() => toForm(supplier));
  const [saving, setSaving] = useState(false);
  const set = (key: keyof SupplierForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    const problem = validate(form);
    if (problem) {
      toastService.error(problem);
      return;
    }
    const request: SilaSupplierWrite = {
      supplierCode: form.supplierCode.trim(),
      name: form.name.trim(),
      taxNumber: form.taxNumber.trim() || null,
      aliases: form.aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
      country: form.country.trim().toUpperCase() || null,
      status: form.status,
      legalName: form.legalName.trim() || null,
      city: form.city.trim() || null,
      address: form.address.trim() || null,
      currency: form.currency.trim().toUpperCase() || null,
    };
    setSaving(true);
    try {
      if (supplier) await updateSupplier(supplier.id, request);
      else await createSupplier(request);
      toastService.success(`Supplier ${request.supplierCode} saved.`);
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the supplier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="md"
      headerProps={{ heading: supplier ? `Supplier ${supplier.supplierCode}` : "Add supplier" }}
      footerProps={{
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: saving },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me sila-form-grid">
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-code">Supplier code<span className="sila-required">*</span></label>
          <input id="srcv-sup-code" className="sila-input" maxLength={50} value={form.supplierCode} disabled={saving} onChange={(event) => set("supplierCode", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-name">Name<span className="sila-required">*</span></label>
          <input id="srcv-sup-name" className="sila-input" maxLength={200} value={form.name} disabled={saving} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-legal">Legal name</label>
          <input id="srcv-sup-legal" className="sila-input" maxLength={200} value={form.legalName} disabled={saving} onChange={(event) => set("legalName", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-tax">Tax number (TRN)</label>
          <input id="srcv-sup-tax" className="sila-input" maxLength={50} value={form.taxNumber} disabled={saving} onChange={(event) => set("taxNumber", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-country">Country</label>
          <input id="srcv-sup-country" className="sila-input" maxLength={3} placeholder="AE" value={form.country} disabled={saving} onChange={(event) => set("country", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-city">City</label>
          <input id="srcv-sup-city" className="sila-input" maxLength={100} value={form.city} disabled={saving} onChange={(event) => set("city", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-currency">Currency</label>
          <input id="srcv-sup-currency" className="sila-input" maxLength={3} placeholder="AED" value={form.currency} disabled={saving} onChange={(event) => set("currency", event.target.value)} />
        </div>
        <div className="sila-field sila-field--full">
          <label className="sila-label" htmlFor="srcv-sup-address">Address</label>
          <input id="srcv-sup-address" className="sila-input" maxLength={500} value={form.address} disabled={saving} onChange={(event) => set("address", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-aliases">Aliases (comma separated)</label>
          <input id="srcv-sup-aliases" className="sila-input" maxLength={1000} value={form.aliases} disabled={saving} onChange={(event) => set("aliases", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-sup-status">Status</label>
          <select id="srcv-sup-status" className="sila-select" value={form.status} disabled={saving} onChange={(event) => set("status", event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          {form.status === "BLOCKED" && <span className="srcv-sub">A blocked supplier gets no purchase orders and no invoice matches.</span>}
        </div>
      </div>
    </Modal>
  );
};

export default SilaSupplierForm;
