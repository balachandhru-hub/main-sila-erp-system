import React, { useState } from "react";
import { toastService } from "@vosox/shared-ui";
import {
  INTEGRATION_CONTRACT_BODY_TOKENS,
  INTEGRATION_PAYLOAD_FORMATS,
  INTEGRATION_PO_BODY_TOKENS,
  updateIntegrationRequestBody,
  type IntegrationConfiguration,
  type IntegrationPayloadFormat,
} from "../../api/integrationsApi";
import { errorMessage } from "./integrationFormat";

interface IntegrationBodyEditorProps {
  configuration: IntegrationConfiguration;
  readOnly?: boolean;
  onSaved: (configuration: IntegrationConfiguration) => void;
}

/** The request body an API the application sends to is called with. It can be changed at any time without testing the API again. */
const IntegrationBodyEditor: React.FC<IntegrationBodyEditorProps> = ({ configuration, readOnly = false, onSaved }) => {
  const [payloadFormat, setPayloadFormat] = useState<IntegrationPayloadFormat>(configuration.payloadFormat ?? "JSON");
  const [body, setBody] = useState(configuration.requestBody ?? "");
  const [saving, setSaving] = useState(false);

  const bodyRequired = payloadFormat !== "JSON";
  const tokens = configuration.processType === "POST_PO"
    ? INTEGRATION_PO_BODY_TOKENS
    : configuration.processType === "POST_CONTRACT"
      ? INTEGRATION_CONTRACT_BODY_TOKENS
      : [];

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (bodyRequired && !body.trim()) {
      toastService.error("SOAP and cXML need the request body template.");
      return;
    }

    setSaving(true);
    try {
      const saved = await updateIntegrationRequestBody(configuration.id, payloadFormat, body.trim() ? body : null);
      toastService.success("Request body saved.");
      onSaved(saved);
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Could not save the request body."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sila-card" onSubmit={handleSave}>
      <div className="sila-form-section">
        <h3 className="sila-form-section-title">Request body</h3>
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="integration-body-format">Payload format</label>
            <select id="integration-body-format" className="sila-select" value={payloadFormat} disabled={readOnly} onChange={(event) => setPayloadFormat(event.target.value as IntegrationPayloadFormat)}>
              {INTEGRATION_PAYLOAD_FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="integration-body-template">
              Request body template{bodyRequired && <span className="sila-required">*</span>}
            </label>
            <textarea id="integration-body-template" className="sila-textarea" rows={14} value={body} readOnly={readOnly} onChange={(event) => setBody(event.target.value)} />
            <span className="sila-help ops-break">
              {bodyRequired ? "SOAP and cXML send this body." : "Leave empty to send the application's standard JSON body."}
              {tokens.length > 0 ? ` Tokens: ${tokens.join(" ")}.` : ""}
            </span>
          </div>
        </div>
        {!readOnly && (
          <div className="sila-btn-group">
            <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>{saving ? "Saving..." : "Save request body"}</button>
          </div>
        )}
      </div>
    </form>
  );
};

export default IntegrationBodyEditor;
