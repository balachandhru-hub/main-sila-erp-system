import React from "react";
import type { SilaOcrConfiguration, SilaOcrConfigurationWrite } from "../../../api/silaMe/silaMasterDataApi";

type ToggleKey =
  | "autoFallback"
  | "alwaysBackendOnReread"
  | "detailedLineExtraction"
  | "supplierValidation"
  | "poValidation"
  | "financialReconciliation"
  | "reuseCachedOcr";

/** The reading policy as typed: numbers as text, switches as booleans. */
export interface OcrPolicyForm {
  amountTolerance: string;
  backendTimeoutSeconds: string;
  backendRetryCount: string;
  toggles: Record<ToggleKey, boolean>;
}

const TOGGLES: { key: ToggleKey; label: string; help: string }[] = [
  { key: "detailedLineExtraction", label: "Read invoice lines", help: "Off: only the header (number, supplier, amounts) is read." },
  { key: "autoFallback", label: "Fall back to the built-in reader", help: "When the external API cannot read an invoice." },
  { key: "alwaysBackendOnReread", label: "Re-read always uses the reader", help: "A re-read never reuses a cached reading." },
  { key: "reuseCachedOcr", label: "Reuse the reading of an identical file", help: "Same file (SHA-256) uploaded again: no new reading." },
  { key: "supplierValidation", label: "Check the supplier", help: "Needs review when the supplier is not in the Supplier Master." },
  { key: "poValidation", label: "Check the purchase order", help: "Needs review when the PO number is not a known purchase order." },
  { key: "financialReconciliation", label: "Check net + tax = gross", help: "Warns when they differ by more than the tolerance." },
];

export const toPolicyForm = (data: SilaOcrConfiguration): OcrPolicyForm => ({
  amountTolerance: String(data.amountTolerance ?? 0.05),
  backendTimeoutSeconds: String(data.backendTimeoutSeconds ?? 60),
  backendRetryCount: String(data.backendRetryCount ?? 1),
  toggles: {
    autoFallback: data.autoFallback ?? true,
    alwaysBackendOnReread: data.alwaysBackendOnReread ?? true,
    detailedLineExtraction: data.detailedLineExtraction ?? true,
    supplierValidation: data.supplierValidation ?? false,
    poValidation: data.poValidation ?? false,
    financialReconciliation: data.financialReconciliation ?? true,
    reuseCachedOcr: data.reuseCachedOcr ?? false,
  },
});

/** The first problem of the policy, or null (the server checks the same ranges). */
export const policyProblem = (form: OcrPolicyForm): string | null => {
  const tolerance = Number(form.amountTolerance);
  if (form.amountTolerance.trim() === "" || Number.isNaN(tolerance) || tolerance < 0 || tolerance > 1000) return "Enter an amount tolerance between 0 and 1000.";
  const timeout = Number(form.backendTimeoutSeconds);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600) return "Enter a reader timeout between 1 and 600 seconds.";
  const retries = Number(form.backendRetryCount);
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) return "Enter between 0 and 5 retries.";
  return null;
};

export const toPolicyWrite = (form: OcrPolicyForm): Partial<SilaOcrConfigurationWrite> => ({
  amountTolerance: Number(form.amountTolerance),
  backendTimeoutSeconds: Number(form.backendTimeoutSeconds),
  backendRetryCount: Number(form.backendRetryCount),
  ...form.toggles,
});

interface SilaOcrPolicyFieldsProps {
  form: OcrPolicyForm;
  onChange: (form: OcrPolicyForm) => void;
}

/** Amount tolerance, reader timeout and retries, and the reading / validation switches of the OCR policy. */
const SilaOcrPolicyFields: React.FC<SilaOcrPolicyFieldsProps> = ({ form, onChange }) => (
  <div className="srcv-stack">
    <div className="sila-form-grid">
      <div className="sila-field">
        <label className="sila-label" htmlFor="srcv-ocr-tolerance">Amount tolerance</label>
        <input id="srcv-ocr-tolerance" className="sila-input" type="number" min={0} step="any" value={form.amountTolerance} onChange={(event) => onChange({ ...form, amountTolerance: event.target.value })} />
        <span className="sila-help">Allowed difference between net + tax and gross.</span>
      </div>
      <div className="sila-field">
        <label className="sila-label" htmlFor="srcv-ocr-timeout">Reader timeout (seconds)</label>
        <input id="srcv-ocr-timeout" className="sila-input" type="number" min={1} max={600} step={1} value={form.backendTimeoutSeconds} onChange={(event) => onChange({ ...form, backendTimeoutSeconds: event.target.value })} />
      </div>
      <div className="sila-field">
        <label className="sila-label" htmlFor="srcv-ocr-retries">Retries when the reader is unreachable</label>
        <input id="srcv-ocr-retries" className="sila-input" type="number" min={0} max={5} step={1} value={form.backendRetryCount} onChange={(event) => onChange({ ...form, backendRetryCount: event.target.value })} />
      </div>
    </div>
    <div className="sila-form-grid">
      {TOGGLES.map((toggle) => (
        <div className="sila-field" key={toggle.key}>
          <label className="sila-label" htmlFor={`srcv-ocr-${toggle.key}`}>
            <input
              id={`srcv-ocr-${toggle.key}`}
              type="checkbox"
              checked={form.toggles[toggle.key]}
              onChange={(event) => onChange({ ...form, toggles: { ...form.toggles, [toggle.key]: event.target.checked } })}
            />{" "}
            {toggle.label}
          </label>
          <span className="sila-help">{toggle.help}</span>
        </div>
      ))}
    </div>
  </div>
);

export default SilaOcrPolicyFields;
