import React, { useEffect, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import {
  INTEGRATION_AUTH_TYPES,
  INTEGRATION_DEFAULT_API_KEY_HEADER,
  INTEGRATION_HTTP_METHODS,
  INTEGRATION_PAYLOAD_FORMATS,
  INTEGRATION_CONTRACT_BODY_TOKENS,
  INTEGRATION_PO_BODY_TOKENS,
  INTEGRATION_PROTOCOLS,
  INTEGRATION_SYSTEMS,
  createIntegration,
  integrationProcessOf,
  integrationProcessTypesFor,
  isPushProcess,
  isReservedIntegrationHeader,
  updateIntegration,
  type IntegrationConfiguration,
  type IntegrationConfigurationWrite,
  type IntegrationHttpMethod,
  type IntegrationPayloadFormat,
  type IntegrationSide,
} from "../../api/integrationsApi";
import { getCompanyCodes, type SilaCompanyCode } from "../../api/silaMe/silaMasterDataApi";
import { blank, errorMessage } from "./integrationFormat";
import "./Integration.css";

interface IntegrationConfigFormProps {
  /** The configuration being edited, or null to create a new one. */
  configuration: IntegrationConfiguration | null;
  /** Whose API types are offered. */
  side?: IntegrationSide;
  /** The API type a new integration starts with. */
  initialProcessType?: string;
  /** View only: the fields are shown but cannot be changed. */
  readOnly?: boolean;
  onSaved: (configuration: IntegrationConfiguration) => void;
  onCancel: () => void;
}

interface HeaderRow {
  /** Stable key for the row while it is edited. */
  key: string;
  name: string;
  value: string;
}

interface ConfigForm {
  name: string;
  entityCode: string;
  processType: string;
  systemName: string;
  protocol: string;
  baseUrl: string;
  resourcePath: string;
  httpMethod: IntegrationHttpMethod;
  payloadFormat: IntegrationPayloadFormat;
  requestBody: string;
  headers: HeaderRow[];
  authenticationType: string;
  username: string;
  password: string;
  apiKeyHeader: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  bearerToken: string;
  tokenEndpoint: string;
  tokenScope: string;
  tokenHeaders: string;
  tokenBody: string;
  timeoutSeconds: string;
  retryCount: string;
  pageSize: string;
  watermarkField: string;
  scheduleCron: string;
}

const NEW_FORM: ConfigForm = {
  name: "", entityCode: "ALL", processType: "", systemName: "", protocol: "ODATA_V4",
  baseUrl: "", resourcePath: "", httpMethod: "GET", payloadFormat: "JSON", requestBody: "", headers: [],
  authenticationType: "OAUTH2_CLIENT_CREDENTIALS",
  username: "", password: "", apiKeyHeader: "", apiKey: "", clientId: "", clientSecret: "", bearerToken: "",
  tokenEndpoint: "", tokenScope: "", tokenHeaders: "", tokenBody: "",
  timeoutSeconds: "30", retryCount: "2", pageSize: "100", watermarkField: "", scheduleCron: "",
};

let headerSequence = 0;
const nextHeaderKey = (): string => {
  headerSequence += 1;
  return `header-${headerSequence}`;
};

/** A push posts by default, a pull reads. */
const defaultHttpMethod = (processType: string): IntegrationHttpMethod => (isPushProcess(processType) ? "POST" : "GET");

const toForm = (configuration: IntegrationConfiguration | null, newProcessType: string): ConfigForm => {
  if (!configuration) return { ...NEW_FORM, processType: newProcessType, httpMethod: defaultHttpMethod(newProcessType) };
  return {
    ...NEW_FORM,
    name: configuration.name,
    entityCode: configuration.entityCode,
    processType: configuration.processType,
    systemName: configuration.systemName ?? "",
    protocol: configuration.protocol,
    baseUrl: configuration.baseUrl,
    resourcePath: configuration.resourcePath ?? "",
    httpMethod: configuration.httpMethod ?? defaultHttpMethod(configuration.processType),
    payloadFormat: configuration.payloadFormat ?? "JSON",
    requestBody: configuration.requestBody ?? "",
    headers: Object.entries(configuration.headers ?? {}).map(([name, value]) => ({ key: nextHeaderKey(), name, value })),
    authenticationType: configuration.authenticationType,
    username: configuration.username ?? "",
    apiKeyHeader: configuration.apiKeyHeader ?? "",
    timeoutSeconds: String(configuration.timeoutSeconds),
    retryCount: String(configuration.retryCount),
    pageSize: configuration.pageSize == null ? "" : String(configuration.pageSize),
    watermarkField: configuration.watermarkField ?? "",
    scheduleCron: configuration.scheduleCron ?? "",
  };
};

/** "name=value" lines to an object; null when nothing was entered. Throws on a line without "=". */
const parsePairs = (text: string, label: string): Record<string, string> | null => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const result: Record<string, string> = {};
  lines.forEach((line) => {
    const index = line.indexOf("=");
    if (index <= 0) throw new Error(`${label}: write each line as name=value.`);
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  });
  return result;
};

/** The extra header rows as an object; null when there are none. Throws on a row the server would refuse. */
const parseHeaders = (rows: HeaderRow[]): Record<string, string> | null => {
  const filled = rows.filter((row) => row.name.trim() || row.value.trim());
  if (filled.length === 0) return null;
  const result: Record<string, string> = {};
  filled.forEach((row) => {
    const name = row.name.trim();
    if (!name) throw new Error("Enter a name for every extra header.");
    if (isReservedIntegrationHeader(name)) {
      throw new Error(`"${name}" cannot be an extra header. Enter credentials in the sign-in fields.`);
    }
    if (Object.keys(result).some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      throw new Error(`The extra header "${name}" is entered more than once.`);
    }
    result[name] = row.value.trim();
  });
  return result;
};

const inRange = (value: number, min: number, max: number): boolean => Number.isInteger(value) && value >= min && value <= max;

/** Create or edit one integration: what it does, where it calls, what it sends, how it signs in, and when it runs. */
const IntegrationConfigForm: React.FC<IntegrationConfigFormProps> = ({
  configuration,
  side = "buyer",
  initialProcessType,
  readOnly = false,
  onSaved,
  onCancel,
}) => {
  const offeredTypes = integrationProcessTypesFor(side);
  const [form, setForm] = useState<ConfigForm>(() => toForm(configuration, initialProcessType ?? offeredTypes[0]?.value ?? ""));
  const [saving, setSaving] = useState(false);
  const [companyCodes, setCompanyCodes] = useState<SilaCompanyCode[]>([]);

  // Buyer APIs can be configured per company code (SAP for one, Ariba for another). The list is a suggestion only: an
  // organization without the SILA ME masters (or without access to them) still types ALL or a company code by hand.
  useEffect(() => {
    if (side !== "buyer") return undefined;
    let active = true;
    getCompanyCodes("", { index: 0, limit: 200 })
      .then((rows) => active && setCompanyCodes(rows))
      .catch(() => active && setCompanyCodes([]));
    return () => {
      active = false;
    };
  }, [side]);

  const setField = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // A saved type that is not offered here (another module, or an older type) stays selectable.
  const typeOptions = !form.processType || offeredTypes.some((type) => type.value === form.processType)
    ? offeredTypes
    : [integrationProcessOf(form.processType), ...offeredTypes];

  const changeProcessType = (processType: string) =>
    setForm((current) => ({
      ...current,
      processType,
      // The method follows the direction of the type until it is chosen for that direction.
      httpMethod: isPushProcess(processType) === isPushProcess(current.processType) ? current.httpMethod : defaultHttpMethod(processType),
    }));

  const updateHeader = (key: string, changes: Partial<Pick<HeaderRow, "name" | "value">>) =>
    setField("headers", form.headers.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  const isPush = isPushProcess(form.processType);
  // Only a type whose pull stores data runs on a schedule and tracks a watermark.
  const canSchedule = integrationProcessOf(form.processType).pull === "full";
  const bodyRequired = isPush && form.payloadFormat !== "JSON";

  const auth = form.authenticationType;
  const usesBasic = auth === "BASIC";
  const usesApiKey = auth === "API_KEY";
  const usesBearer = auth === "BEARER_TOKEN";
  const usesOAuth = auth === "OAUTH2_CLIENT_CREDENTIALS";
  const usesCustomToken = auth === "CUSTOM_TOKEN_ENDPOINT";
  const secretPlaceholder = configuration && !readOnly ? "Leave empty to keep the saved value" : "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    if (!form.name.trim()) {
      toastService.error("Enter a name for the integration.");
      return;
    }
    if (!form.processType) {
      toastService.error("Select the API type.");
      return;
    }
    if (!/^https?:\/\//i.test(form.baseUrl.trim())) {
      toastService.error("Enter the base URL, starting with https://.");
      return;
    }
    if (bodyRequired && !form.requestBody.trim()) {
      toastService.error("SOAP and cXML need the request body template.");
      return;
    }
    const timeoutSeconds = Number(form.timeoutSeconds);
    const retryCount = Number(form.retryCount);
    const pageSize = !isPush && form.pageSize.trim() ? Number(form.pageSize) : null;
    if (!inRange(timeoutSeconds, 5, 300)) {
      toastService.error("Timeout must be between 5 and 300 seconds.");
      return;
    }
    if (!inRange(retryCount, 0, 5)) {
      toastService.error("Retry count must be between 0 and 5.");
      return;
    }
    if (pageSize !== null && !inRange(pageSize, 1, 1000)) {
      toastService.error("Page size must be between 1 and 1000.");
      return;
    }
    if ((usesOAuth || usesCustomToken) && !form.tokenEndpoint.trim()) {
      toastService.error("Enter the token endpoint.");
      return;
    }

    let headers: Record<string, string> | null = null;
    try {
      headers = parseHeaders(form.headers);
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Check the extra headers."));
      return;
    }

    let tokenHeaders: Record<string, string> | null = null;
    let tokenBody: Record<string, string> | null = null;
    try {
      if (usesCustomToken) {
        tokenHeaders = parsePairs(form.tokenHeaders, "Token request headers");
        tokenBody = parsePairs(form.tokenBody, "Token request body");
      }
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Check the token request fields."));
      return;
    }

    // Credentials that do not belong to the chosen sign-in method, and fields that do not belong to the
    // direction of the API type, are not sent.
    const payload: IntegrationConfigurationWrite = {
      name: form.name.trim(),
      entityCode: form.entityCode.trim() || "ALL",
      processType: form.processType,
      systemName: blank(form.systemName),
      protocol: form.protocol,
      baseUrl: form.baseUrl.trim(),
      resourcePath: blank(form.resourcePath),
      httpMethod: form.httpMethod,
      payloadFormat: isPush ? form.payloadFormat : "JSON",
      requestBody: isPush ? blank(form.requestBody) : null,
      headers,
      authenticationType: auth,
      username: usesBasic ? blank(form.username) : null,
      password: usesBasic ? blank(form.password) : null,
      apiKeyHeader: usesApiKey ? blank(form.apiKeyHeader) : null,
      apiKey: usesApiKey ? blank(form.apiKey) : null,
      clientId: usesOAuth || usesCustomToken ? blank(form.clientId) : null,
      clientSecret: usesOAuth || usesCustomToken ? blank(form.clientSecret) : null,
      bearerToken: usesBearer ? blank(form.bearerToken) : null,
      tokenEndpoint: usesOAuth || usesCustomToken ? blank(form.tokenEndpoint) : null,
      tokenScope: usesOAuth || usesCustomToken ? blank(form.tokenScope) : null,
      tokenHeaders,
      tokenBody,
      timeoutSeconds,
      retryCount,
      pageSize,
      watermarkField: canSchedule ? blank(form.watermarkField) : null,
      scheduleCron: canSchedule ? blank(form.scheduleCron) : null,
    };

    setSaving(true);
    try {
      const saved = configuration
        ? await updateIntegration(side, configuration.id, payload)
        : await createIntegration(side, payload);
      toastService.success(configuration ? "Integration updated." : "Integration saved as a draft. Test it before activating.");
      setForm((current) => ({ ...current, password: "", apiKey: "", clientSecret: "", bearerToken: "", clientId: "", tokenHeaders: "", tokenBody: "" }));
      onSaved(saved);
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Could not save the integration."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sila-card" onSubmit={handleSubmit}>
      <fieldset className="sila-card-body ops-fieldset" disabled={readOnly}>
        <div className="sila-form-section">
          <h3 className="sila-form-section-title">General</h3>
          <div className="sila-form-grid">
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-name">Name<span className="sila-required">*</span></label>
              <input id="integration-name" className="sila-input" value={form.name} onChange={(event) => setField("name", event.target.value)} />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-process">API type<span className="sila-required">*</span></label>
              <select id="integration-process" className="sila-select" value={form.processType} onChange={(event) => changeProcessType(event.target.value)}>
                {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}
              </select>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-system">System</label>
              <input id="integration-system" className="sila-input" list="integration-systems" placeholder="SAP S/4" value={form.systemName} onChange={(event) => setField("systemName", event.target.value)} />
              <datalist id="integration-systems">
                {INTEGRATION_SYSTEMS.map((system) => <option key={system} value={system} />)}
              </datalist>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-entity">Entity code</label>
              <input id="integration-entity" className="sila-input" list="integration-entity-codes" value={form.entityCode} onChange={(event) => setField("entityCode", event.target.value)} />
              <datalist id="integration-entity-codes">
                <option value="ALL">Every company code</option>
                {companyCodes.map((companyCode) => <option key={companyCode.id} value={companyCode.code}>{companyCode.name}</option>)}
              </datalist>
              <span className="sila-help">ALL applies to every company code; a company code routes only its documents to this API (one API per type and company code).</span>
            </div>
          </div>
        </div>

        <div className="sila-form-section">
          <h3 className="sila-form-section-title">Endpoint</h3>
          <div className="sila-form-grid">
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-protocol">Protocol<span className="sila-required">*</span></label>
              <select id="integration-protocol" className="sila-select" value={form.protocol} onChange={(event) => setField("protocol", event.target.value)}>
                {INTEGRATION_PROTOCOLS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-timeout">Timeout (seconds)</label>
              <input id="integration-timeout" type="number" min="5" max="300" className="sila-input" value={form.timeoutSeconds} onChange={(event) => setField("timeoutSeconds", event.target.value)} />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-retry">Retry count</label>
              <input id="integration-retry" type="number" min="0" max="5" className="sila-input" value={form.retryCount} onChange={(event) => setField("retryCount", event.target.value)} />
            </div>
            <div className="sila-field sila-field--full">
              <label className="sila-label" htmlFor="integration-base-url">Base URL<span className="sila-required">*</span></label>
              <input id="integration-base-url" className="sila-input" placeholder="https://erp.example.com" value={form.baseUrl} onChange={(event) => setField("baseUrl", event.target.value)} />
            </div>
            <div className="sila-field sila-field--full">
              <label className="sila-label" htmlFor="integration-resource">Resource path</label>
              <input id="integration-resource" className="sila-input" placeholder="API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder" value={form.resourcePath} onChange={(event) => setField("resourcePath", event.target.value)} />
              <span className="sila-help">Appended to the base URL. For OData this is the service and entity set.</span>
            </div>
          </div>
        </div>

        <div className="sila-form-section">
          <h3 className="sila-form-section-title">Request</h3>
          {!isPush && (
            <p className="sila-help">
              This API type only reads from the ERP, so it has no request body. To send a body, set the API type above to one
              that creates or posts a document, such as Purchase order (create in ERP) or Contract (create in ERP).
            </p>
          )}
          <div className="sila-form-grid">
            {isPush && (
              <>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-method">HTTP method</label>
                  <select id="integration-method" className="sila-select" value={form.httpMethod} onChange={(event) => setField("httpMethod", event.target.value as IntegrationHttpMethod)}>
                    {INTEGRATION_HTTP_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                  </select>
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-format">Payload format</label>
                  <select id="integration-format" className="sila-select" value={form.payloadFormat} onChange={(event) => setField("payloadFormat", event.target.value as IntegrationPayloadFormat)}>
                    {INTEGRATION_PAYLOAD_FORMATS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="sila-field sila-field--full">
                  <label className="sila-label" htmlFor="integration-body">
                    Request body template{bodyRequired && <span className="sila-required">*</span>}
                  </label>
                  <textarea id="integration-body" className="sila-textarea" rows={8} value={form.requestBody} onChange={(event) => setField("requestBody", event.target.value)} />
                  <span className="sila-help ops-break">
                    {bodyRequired ? "SOAP and cXML send this body." : "Leave empty to send the application's standard JSON body."}
                    {form.processType === "POST_PO" ? ` Tokens: ${INTEGRATION_PO_BODY_TOKENS.join(" ")} ({{entries}} and {{items}} are the JSON array of the lines; the contract tokens apply to a purchase order created from a contract).` : ""}
                    {form.processType === "POST_CONTRACT" ? ` Tokens: ${INTEGRATION_CONTRACT_BODY_TOKENS.join(" ")}.` : ""}
                  </span>
                </div>
              </>
            )}
            <div className="sila-field sila-field--full" role="group" aria-labelledby="integration-headers-label">
              <span id="integration-headers-label" className="sila-label">Extra headers</span>
              {form.headers.map((row, index) => (
                <div key={row.key} className="ops-inline">
                  <input className="sila-input" aria-label={`Name of extra header ${index + 1}`} placeholder="Name" value={row.name} onChange={(event) => updateHeader(row.key, { name: event.target.value })} />
                  <input className="sila-input" aria-label={`Value of extra header ${index + 1}`} placeholder="Value" value={row.value} onChange={(event) => updateHeader(row.key, { value: event.target.value })} />
                  {!readOnly && (
                    <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={() => setField("headers", form.headers.filter((item) => item.key !== row.key))}>Remove</button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <div className="ops-inline">
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setField("headers", [...form.headers, { key: nextHeaderKey(), name: "", value: "" }])}>Add header</button>
                </div>
              )}
              <span className="sila-help">Sent with every call. Credentials go in the sign-in fields, not in a header.</span>
            </div>
          </div>
        </div>

        <div className="sila-form-section">
          <h3 className="sila-form-section-title">Authentication</h3>
          <p className="sila-form-section-description">
            {configuration
              ? `Credential state: ${configuration.credentialStatus}. Secrets are never shown again${readOnly ? "." : "; leave a secret empty to keep the saved one."}`
              : "Secrets are stored by the server and are never shown again after saving."}
          </p>
          <div className="sila-form-grid">
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-auth">Sign-in method<span className="sila-required">*</span></label>
              <select id="integration-auth" className="sila-select" value={auth} onChange={(event) => setField("authenticationType", event.target.value)}>
                {INTEGRATION_AUTH_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {usesBasic && (
              <>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-username">Username</label>
                  <input id="integration-username" className="sila-input" autoComplete="off" value={form.username} onChange={(event) => setField("username", event.target.value)} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-password">Password</label>
                  <input id="integration-password" type="password" className="sila-input" autoComplete="new-password" placeholder={secretPlaceholder} value={form.password} onChange={(event) => setField("password", event.target.value)} />
                </div>
              </>
            )}
            {usesApiKey && (
              <>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-api-key-header">API key header</label>
                  <input id="integration-api-key-header" className="sila-input" autoComplete="off" placeholder={INTEGRATION_DEFAULT_API_KEY_HEADER} value={form.apiKeyHeader} onChange={(event) => setField("apiKeyHeader", event.target.value)} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-api-key">API key</label>
                  <input id="integration-api-key" type="password" className="sila-input" autoComplete="new-password" placeholder={secretPlaceholder} value={form.apiKey} onChange={(event) => setField("apiKey", event.target.value)} />
                </div>
              </>
            )}
            {usesBearer && (
              <div className="sila-field sila-field--full">
                <label className="sila-label" htmlFor="integration-bearer">Bearer token</label>
                <input id="integration-bearer" type="password" className="sila-input" autoComplete="new-password" placeholder={secretPlaceholder} value={form.bearerToken} onChange={(event) => setField("bearerToken", event.target.value)} />
              </div>
            )}
            {(usesOAuth || usesCustomToken) && (
              <>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-client-id">Client ID</label>
                  <input id="integration-client-id" className="sila-input" autoComplete="off" placeholder={secretPlaceholder} value={form.clientId} onChange={(event) => setField("clientId", event.target.value)} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-client-secret">Client secret</label>
                  <input id="integration-client-secret" type="password" className="sila-input" autoComplete="new-password" placeholder={secretPlaceholder} value={form.clientSecret} onChange={(event) => setField("clientSecret", event.target.value)} />
                </div>
                <div className="sila-field sila-field--full">
                  <label className="sila-label" htmlFor="integration-token-endpoint">Token endpoint<span className="sila-required">*</span></label>
                  <input id="integration-token-endpoint" className="sila-input" placeholder="https://login.example.com/oauth/token" value={form.tokenEndpoint} onChange={(event) => setField("tokenEndpoint", event.target.value)} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="integration-token-scope">Scope</label>
                  <input id="integration-token-scope" className="sila-input" value={form.tokenScope} onChange={(event) => setField("tokenScope", event.target.value)} />
                </div>
              </>
            )}
            {usesCustomToken && (
              <>
                <div className="sila-field sila-field--full">
                  <label className="sila-label" htmlFor="integration-token-headers">Token request headers</label>
                  <textarea id="integration-token-headers" className="sila-textarea" rows={3} placeholder={"Accept=application/json"} value={form.tokenHeaders} onChange={(event) => setField("tokenHeaders", event.target.value)} />
                  <span className="sila-help">One name=value per line.{configuration ? " Leave empty to keep the saved headers." : ""}</span>
                </div>
                <div className="sila-field sila-field--full">
                  <label className="sila-label" htmlFor="integration-token-body">Token request body</label>
                  <textarea id="integration-token-body" className="sila-textarea" rows={3} placeholder={"grant_type=client_credentials"} value={form.tokenBody} onChange={(event) => setField("tokenBody", event.target.value)} />
                  <span className="sila-help">One name=value per line.{configuration ? " Leave empty to keep the saved body." : ""}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!isPush && (
          <div className="sila-form-section">
            <h3 className="sila-form-section-title">{canSchedule ? "Paging and schedule" : "Paging"}</h3>
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="integration-page-size">Page size</label>
                <input id="integration-page-size" type="number" min="1" max="1000" className="sila-input" value={form.pageSize} onChange={(event) => setField("pageSize", event.target.value)} />
              </div>
              {canSchedule && (
                <>
                  <div className="sila-field">
                    <label className="sila-label" htmlFor="integration-watermark">Watermark field</label>
                    <input id="integration-watermark" className="sila-input" placeholder="PurchaseOrderLastChangeDateTime" value={form.watermarkField} onChange={(event) => setField("watermarkField", event.target.value)} />
                    <span className="sila-help">The source field holding the last change time. Scheduled pulls only read records changed since the last run.</span>
                  </div>
                  <div className="sila-field">
                    <label className="sila-label" htmlFor="integration-cron">Schedule (cron)</label>
                    <input id="integration-cron" className="sila-input" placeholder="0 */2 * * *" value={form.scheduleCron} onChange={(event) => setField("scheduleCron", event.target.value)} />
                    <span className="sila-help">Leave empty to pull only on demand. The schedule runs once the integration is active.</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </fieldset>
      <div className="sila-card-footer">
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onCancel} disabled={saving}>
          {configuration ? "Close" : "Cancel"}
        </button>
        {!readOnly && (
          <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>
            {saving ? "Saving..." : configuration ? "Save integration" : "Save draft"}
          </button>
        )}
      </div>
    </form>
  );
};

export default IntegrationConfigForm;
