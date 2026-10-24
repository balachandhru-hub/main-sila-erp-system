import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { getOcrConfiguration, saveOcrConfiguration, type SilaOcrAiProvider, type SilaOcrConfiguration } from "../../../api/silaMe/silaMasterDataApi";
import { formatDateTime } from "../../cart/lineFormat";
import SilaOcrPolicyFields, { policyProblem, toPolicyForm, toPolicyWrite, type OcrPolicyForm } from "./SilaOcrPolicyFields";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaOcrSettingsProps {
  /** MANAGE_SILA_MASTER_DATA (the endpoint requires it too). */
  canManage: boolean;
}

interface AttachmentForm {
  /** LOCAL | FILE_PATH | SHAREPOINT */
  storage: string;
  path: string;
  siteUrl: string;
  library: string;
  folder: string;
}

interface ProviderForm {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  priority: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  credentialConfigured: boolean;
  connectionStatus: string;
}

interface OcrForm {
  provider: string;
  autoExtractOnUpload: boolean;
  /** Percentage as typed, 0-100. */
  minimumConfidence: string;
  primaryOcrEnabled: boolean;
  aiFallbackEnabled: boolean;
  providers: ProviderForm[];
  policy: OcrPolicyForm;
  attachment: AttachmentForm;
}

const PROVIDER_TYPES = [
  { value: "GEMINI", label: "Gemini" },
  { value: "OPENAI", label: "OpenAI" },
  { value: "ANTHROPIC", label: "Anthropic Claude" },
  { value: "CUSTOM", label: "Other / Custom" },
];

const toProviderForm = (row: SilaOcrAiProvider): ProviderForm => ({
  id: row.id,
  provider: row.provider,
  displayName: row.displayName,
  enabled: row.enabled,
  priority: String(row.priority),
  model: row.model || "",
  baseUrl: row.baseUrl || "",
  apiKey: "",
  credentialConfigured: row.credentialConfigured,
  connectionStatus: row.connectionStatus || (row.credentialConfigured ? "Configured" : "Not configured"),
});

const emptyProvider = (): ProviderForm => ({
  id: "",
  provider: "GEMINI",
  displayName: "Gemini",
  enabled: true,
  priority: String(1),
  model: "",
  baseUrl: "",
  apiKey: "",
  credentialConfigured: false,
  connectionStatus: "Not configured",
});

const attachmentOf = (data: SilaOcrConfiguration): AttachmentForm => ({
  storage: data.attachmentStorage || "LOCAL",
  path: data.attachmentPath || "",
  siteUrl: data.sharePointSiteUrl || "",
  library: data.sharePointLibrary || "",
  folder: data.sharePointFolder || "",
});

/** The first problem of the attachment choice, or null (the server checks the same rules). */
const attachmentProblem = (attachment: AttachmentForm): string | null => {
  if (attachment.storage === "FILE_PATH" && attachment.path.trim() === "") return "Enter the folder where invoice files should be kept.";
  if (attachment.storage === "SHAREPOINT") {
    const site = attachment.siteUrl.trim();
    if (!/^https?:\/\/[^/\s]+/i.test(site) || site.includes("@")) return "Enter the SharePoint site URL, for example https://tenant.sharepoint.com/sites/finance.";
    if (attachment.library.trim() === "") return "Enter the document library that will hold the invoice files.";
  }
  return null;
};

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
      primaryOcrEnabled: data.primaryOcrEnabled ?? true,
      aiFallbackEnabled: data.aiFallbackEnabled ?? false,
      providers: (data.providers ?? []).map(toProviderForm),
      policy: toPolicyForm(data),
      attachment: data.attachmentStorage ? attachmentOf(data) : (form?.attachment ?? attachmentOf(data)),
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
    const problem = policyProblem(form.policy) || attachmentProblem(form.attachment);
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
        attachmentStorage: form.attachment.storage,
        attachmentPath: form.attachment.path.trim() || null,
        sharePointSiteUrl: form.attachment.siteUrl.trim() || null,
        sharePointLibrary: form.attachment.library.trim() || null,
        sharePointFolder: form.attachment.folder.trim() || null,
        primaryOcrEnabled: form.primaryOcrEnabled,
        aiFallbackEnabled: form.aiFallbackEnabled,
        providers: form.providers.map((row) => ({
          id: row.id || null,
          provider: row.provider,
          displayName: row.displayName,
          enabled: row.enabled,
          priority: Number(row.priority) || 0,
          model: row.model.trim() || null,
          baseUrl: row.baseUrl.trim() || null,
          apiKey: row.apiKey.trim() || null,
        })),
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
      <PageHeader className="pud-page-header" title="Invoice OCR settings" description="Control how uploaded invoices are read, when a reading needs review, and where the invoice file is kept." />
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
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-ocr-primary">
                  <input id="srcv-ocr-primary" type="checkbox" checked={form.primaryOcrEnabled} onChange={(event) => setForm({ ...form, primaryOcrEnabled: event.target.checked })} /> Primary OCR Enabled
                </label>
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-ocr-ai">
                  <input id="srcv-ocr-ai" type="checkbox" checked={form.aiFallbackEnabled} onChange={(event) => setForm({ ...form, aiFallbackEnabled: event.target.checked })} /> AI Fallback Enabled
                </label>
                <span className="sila-help">Used only when OCR confidence is below the threshold. Existing OCR stays primary.</span>
              </div>
            </div>
            <div className="srcv-stack">
              <p className="srcv-sub"><strong>AI fallback providers</strong></p>
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Display Name</th>
                      <th>Enabled</th>
                      <th>Priority</th>
                      <th>Model</th>
                      <th>API/Base URL</th>
                      <th>Credential</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.providers.map((row, index) => (
                      <tr key={row.id || `new-${index}`}>
                        <td>
                          <select className="sila-select" value={row.provider} onChange={(event) => {
                            const providers = form.providers.slice();
                            providers[index] = { ...row, provider: event.target.value, displayName: row.displayName || event.target.value };
                            setForm({ ...form, providers });
                          }}>
                            {PROVIDER_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                          </select>
                        </td>
                        <td><input className="sila-input" value={row.displayName} onChange={(event) => {
                          const providers = form.providers.slice();
                          providers[index] = { ...row, displayName: event.target.value };
                          setForm({ ...form, providers });
                        }} /></td>
                        <td><input type="checkbox" checked={row.enabled} onChange={(event) => {
                          const providers = form.providers.slice();
                          providers[index] = { ...row, enabled: event.target.checked };
                          setForm({ ...form, providers });
                        }} /></td>
                        <td><input className="sila-input" type="number" value={row.priority} onChange={(event) => {
                          const providers = form.providers.slice();
                          providers[index] = { ...row, priority: event.target.value };
                          setForm({ ...form, providers });
                        }} /></td>
                        <td><input className="sila-input" value={row.model} onChange={(event) => {
                          const providers = form.providers.slice();
                          providers[index] = { ...row, model: event.target.value };
                          setForm({ ...form, providers });
                        }} /></td>
                        <td><input className="sila-input" value={row.baseUrl} onChange={(event) => {
                          const providers = form.providers.slice();
                          providers[index] = { ...row, baseUrl: event.target.value };
                          setForm({ ...form, providers });
                        }} /></td>
                        <td>
                          <input className="sila-input" type="password" autoComplete="new-password" placeholder={row.credentialConfigured ? "Configured" : "API key"} value={row.apiKey} onChange={(event) => {
                            const providers = form.providers.slice();
                            providers[index] = { ...row, apiKey: event.target.value };
                            setForm({ ...form, providers });
                          }} />
                        </td>
                        <td>{row.credentialConfigured ? "Configured" : row.connectionStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setForm({ ...form, providers: [...form.providers, emptyProvider()] })}>
                Add provider
              </button>
            </div>
            <SilaOcrPolicyFields form={form.policy} onChange={(policy) => setForm({ ...form, policy })} />
            <div className="srcv-stack">
              <p className="srcv-sub"><strong>Invoice attachment</strong></p>
              <div className="sila-form-grid">
                <div className="sila-field">
                  <label className="sila-label" htmlFor="srcv-ocr-storage">Save invoice files to</label>
                  <select
                    id="srcv-ocr-storage"
                    className="sila-select"
                    value={form.attachment.storage}
                    onChange={(event) => setForm({ ...form, attachment: { ...form.attachment, storage: event.target.value } })}
                  >
                    <option value="LOCAL">Local downloads path</option>
                    <option value="FILE_PATH">File path</option>
                    <option value="SHAREPOINT">SharePoint</option>
                  </select>
                  <span className="sila-help">
                    Files are saved on the local downloads path
                    {settings.attachmentLocalPath ? ` (${settings.attachmentLocalPath})` : ""}.
                    {" "}SharePoint and a file path are kept with these settings.
                  </span>
                </div>
                {form.attachment.storage === "FILE_PATH" && (
                  <div className="sila-field">
                    <label className="sila-label" htmlFor="srcv-ocr-path">Folder path</label>
                    <input
                      id="srcv-ocr-path"
                      className="sila-input"
                      value={form.attachment.path}
                      onChange={(event) => setForm({ ...form, attachment: { ...form.attachment, path: event.target.value } })}
                    />
                    <span className="sila-help">The folder that will hold the invoice files.</span>
                  </div>
                )}
                {form.attachment.storage === "SHAREPOINT" && (
                  <>
                    <div className="sila-field">
                      <label className="sila-label" htmlFor="srcv-ocr-site">SharePoint site</label>
                      <input
                        id="srcv-ocr-site"
                        className="sila-input"
                        value={form.attachment.siteUrl}
                        placeholder="https://tenant.sharepoint.com/sites/finance"
                        onChange={(event) => setForm({ ...form, attachment: { ...form.attachment, siteUrl: event.target.value } })}
                      />
                    </div>
                    <div className="sila-field">
                      <label className="sila-label" htmlFor="srcv-ocr-library">Document library</label>
                      <input
                        id="srcv-ocr-library"
                        className="sila-input"
                        value={form.attachment.library}
                        onChange={(event) => setForm({ ...form, attachment: { ...form.attachment, library: event.target.value } })}
                      />
                    </div>
                    <div className="sila-field">
                      <label className="sila-label" htmlFor="srcv-ocr-folder">Folder</label>
                      <input
                        id="srcv-ocr-folder"
                        className="sila-input"
                        value={form.attachment.folder}
                        onChange={(event) => setForm({ ...form, attachment: { ...form.attachment, folder: event.target.value } })}
                      />
                      <span className="sila-help">Optional. Leave empty to use the library itself.</span>
                    </div>
                  </>
                )}
              </div>
            </div>
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
