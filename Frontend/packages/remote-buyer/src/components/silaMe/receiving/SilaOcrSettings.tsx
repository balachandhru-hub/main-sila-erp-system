import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { getOcrConfiguration, saveOcrConfiguration, type SilaOcrConfiguration } from "../../../api/silaMe/silaMasterDataApi";
import { formatDateTime } from "../../cart/lineFormat";
import SilaOcrPolicyFields, { policyProblem, toPolicyForm, toPolicyWrite, type OcrPolicyForm } from "./SilaOcrPolicyFields";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaOcrSettingsProps {
  /** MANAGE_SILA_MASTER_DATA (the endpoint requires it too). */
  canManage: boolean;
}

interface OcrForm {
  provider: string;
  autoExtractOnUpload: boolean;
  /** Percentage as typed, 0-100. */
  minimumConfidence: string;
  policy: OcrPolicyForm;
}

/** How invoices are read: the built-in OCR service or the external EXTRACT_INVOICE API; automatic reading; minimum confidence. */
const SilaOcrSettings: React.FC<SilaOcrSettingsProps> = ({ canManage }) => {
  const [settings, setSettings] = useState<SilaOcrConfiguration | null>(null);
  const [form, setForm] = useState<OcrForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const show = (data: SilaOcrConfiguration) => {
    setSettings(data);
    setForm({
      provider: data.provider,
      autoExtractOnUpload: data.autoExtractOnUpload,
      minimumConfidence: String(Math.round(data.minimumConfidence * 100)),
      policy: toPolicyForm(data),
    });
  };

  useEffect(() => {
    let active = true;
    setError(null);
    getOcrConfiguration()
      .then((data) => active && show(data))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Could not load the OCR settings."));
    return () => {
      active = false;
    };
  }, [version]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const percent = Number(form.minimumConfidence);
    if (form.minimumConfidence.trim() === "" || Number.isNaN(percent) || percent < 0 || percent > 100) {
      toastService.error("Enter a minimum confidence between 0 and 100 %.");
      return;
    }
    const problem = policyProblem(form.policy);
    if (problem) {
      toastService.error(problem);
      return;
    }
    setSaving(true);
    try {
      show(await saveOcrConfiguration({
        provider: form.provider,
        autoExtractOnUpload: form.autoExtractOnUpload,
        minimumConfidence: percent / 100,
        ...toPolicyWrite(form.policy),
      }));
      toastService.success("OCR settings saved.");
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the OCR settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="Invoice OCR settings" description="Control how uploaded invoices are read and when a reading needs review." />
      {error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the OCR settings"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={() => setVersion((current) => current + 1)}>Try again</button>}
        />
      ) : !settings || !form ? (
        <Loader size={24} message="Loading OCR settings..." />
      ) : (
        <form className="sila-card srcv-panel srcv-stack" onSubmit={handleSave}>
          <fieldset className="srcv-stack" disabled={!canManage || saving}>
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-ocr-provider">Invoice reader</label>
                <select id="srcv-ocr-provider" className="sila-select" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
                  <option value="BUILT_IN">Built-in OCR service</option>
                  <option value="EXTERNAL">External API (EXTRACT_INVOICE integration)</option>
                </select>
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-ocr-confidence">Minimum confidence (%)</label>
                <input id="srcv-ocr-confidence" className="sila-input" type="number" min={0} max={100} step={1} value={form.minimumConfidence} onChange={(event) => setForm({ ...form, minimumConfidence: event.target.value })} />
                <span className="sila-help">Readings below it are marked "Needs review".</span>
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-ocr-auto">
                  <input id="srcv-ocr-auto" type="checkbox" checked={form.autoExtractOnUpload} onChange={(event) => setForm({ ...form, autoExtractOnUpload: event.target.checked })} /> Read invoices automatically on upload
                </label>
              </div>
            </div>
            <SilaOcrPolicyFields form={form.policy} onChange={(policy) => setForm({ ...form, policy })} />
            {form.provider === "EXTERNAL" && !settings.externalConfigured && (
              <div className="sila-alert sila-alert--warning" role="alert">No active EXTRACT_INVOICE API is configured under Integration; readings will fail until one is activated.</div>
            )}
          </fieldset>
          <div className="srcv-actions">
            {canManage && (
              <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>{saving ? "Saving..." : "Save settings"}</button>
            )}
            <span className="srcv-sub">{settings.saved && settings.updatedOn ? `Last saved ${formatDateTime(settings.updatedOn)}` : "Default settings (not saved yet)"}</span>
          </div>
        </form>
      )}
    </div>
  );
};

export default SilaOcrSettings;
