import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { createCompanyCode, updateCompanyCode, type SilaCompanyCode, type SilaCompanyCodeWrite } from "../../../api/silaMe/silaMasterDataApi";

interface SilaCompanyCodeFormProps {
  companyCode: SilaCompanyCode | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Add or change a company code. A code in use (ERP API, property, open PO) keeps its code; the name can change. */
const SilaCompanyCodeForm: React.FC<SilaCompanyCodeFormProps> = ({ companyCode, onClose, onSaved }) => {
  const [form, setForm] = useState<SilaCompanyCodeWrite>({
    code: companyCode?.code ?? "",
    name: companyCode?.name ?? "",
    country: companyCode?.country ?? "",
    currency: companyCode?.currency ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof SilaCompanyCodeWrite, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase();
    const country = (form.country ?? "").trim().toUpperCase();
    const currency = (form.currency ?? "").trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9_./-]*$/.test(code) || code === "ALL") return toastService.error("Enter a company code: letters, digits and _ . / - (ALL is reserved).");
    if (!form.name.trim()) return toastService.error("Enter the company name.");
    if (country && !/^[A-Z]{2,3}$/.test(country)) return toastService.error("Country: a 2 or 3 letter ISO code, for example AE.");
    if (currency && !/^[A-Z]{3}$/.test(currency)) return toastService.error("Currency: a 3 letter ISO code, for example AED.");
    const request: SilaCompanyCodeWrite = { code, name: form.name.trim(), country: country || null, currency: currency || null };
    setSaving(true);
    try {
      if (companyCode) await updateCompanyCode(companyCode.id, request);
      else await createCompanyCode(request);
      toastService.success(`Company code ${code} saved.`);
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the company code.");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="md"
      headerProps={{ heading: companyCode ? `Company code ${companyCode.code}` : "Add company code" }}
      footerProps={{
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: saving },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me sila-form-grid">
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-cc-code">Company code<span className="sila-required">*</span></label>
          <input id="srcv-cc-code" className="sila-input" maxLength={50} value={form.code} disabled={saving} onChange={(event) => set("code", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-cc-name">Company name<span className="sila-required">*</span></label>
          <input id="srcv-cc-name" className="sila-input" maxLength={200} value={form.name} disabled={saving} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-cc-country">Country</label>
          <input id="srcv-cc-country" className="sila-input" maxLength={3} placeholder="AE" value={form.country ?? ""} disabled={saving} onChange={(event) => set("country", event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-cc-currency">Currency</label>
          <input id="srcv-cc-currency" className="sila-input" maxLength={3} placeholder="AED" value={form.currency ?? ""} disabled={saving} onChange={(event) => set("currency", event.target.value)} />
        </div>
      </div>
    </Modal>
  );
};

export default SilaCompanyCodeForm;
