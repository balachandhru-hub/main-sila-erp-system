import React, { useEffect, useState } from "react";
import { Loader, PageHeader, toastService } from "@vosox/shared-ui";
import {
  INTEGRATION_AUTH_TYPES,
  INTEGRATION_PROCESS_TYPES,
  INTEGRATION_PROTOCOLS,
  getIntegration,
  integrationProcessOf,
  pullIntegration,
  setIntegrationActive,
  testIntegration,
  type IntegrationConfiguration,
  type IntegrationSide,
  type IntegrationTestResult,
} from "../../api/integrationsApi";
import IntegrationConfigForm from "./IntegrationConfigForm";
import IntegrationHistory from "./IntegrationHistory";
import IntegrationMappingEditor from "./IntegrationMappingEditor";
import IntegrationSchemaPanel from "./IntegrationSchemaPanel";
import { errorMessage, formatDateTime, statusBadgeClass, statusLabel } from "./integrationFormat";
import "./Integration.css";

type Tab = "configuration" | "schema" | "mapping" | "history";

type View = { name: "opening" } | { name: "create" } | { name: "workspace"; configuration: IntegrationConfiguration; tab: Tab };

type Action = "test" | "activate" | "pull" | "fullSync";

const TABS: { key: Tab; label: string }[] = [
  { key: "configuration", label: "Configuration" },
  { key: "schema", label: "Schema" },
  { key: "mapping", label: "Field mapping" },
  { key: "history", label: "Run history" },
];

const CONNECTION_TABS: Tab[] = ["configuration", "schema"];
const WORKFLOW_TABS: Tab[] = ["mapping", "history"];

const labelOf = (options: { value: string; label: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? statusLabel(value);

interface IntegrationWorkspaceProps {
  /** Opens the create form, or one integration. */
  startWith: "create" | { configurationId: string };
  /** Back to the list owned by the host screen. */
  onExit: () => void;
  /**
   * Which half of an integration is shown. "connection": the API, its sign-in, its schema and the
   * connection test (the Integration screen). "workflow": how a connected API is used — field mapping,
   * runs, activation and pulls (the Workflow & Configuration screen).
   */
  mode: "connection" | "workflow";
  /** Whose API types: the buyer's or the supplier's. */
  side: IntegrationSide;
  /** The API type a new integration starts with. */
  initialProcessType?: string;
  /** View only: the integration is shown but cannot be changed, tested, activated or pulled. */
  readOnly?: boolean;
}

/**
 * One integration with an external system: its endpoint and sign-in, the discovered schema, the field
 * mapping and its run history, split between the Integration and the Workflow & Configuration screens.
 */
const IntegrationWorkspace: React.FC<IntegrationWorkspaceProps> = ({
  startWith,
  onExit,
  mode,
  side,
  initialProcessType,
  readOnly = false,
}) => {
  // The tabs of one integration: those of the screen's half that its API type has.
  const tabsFor = (processType: string): { key: Tab; label: string }[] => {
    const process = integrationProcessOf(processType);
    return TABS.filter((item) => {
      if (item.key === "mapping" && !process.hasMapping) return false;
      return mode === "connection" ? CONNECTION_TABS.includes(item.key) : WORKFLOW_TABS.includes(item.key);
    });
  };
  const [view, setView] = useState<View>(startWith === "create" ? { name: "create" } : { name: "opening" });
  const [action, setAction] = useState<Action | null>(null);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  // Bumped after a pull or a test so the run history reloads.
  const [historyVersion, setHistoryVersion] = useState(0);

  // Opened on one integration by the host screen.
  useEffect(() => {
    if (startWith === "create") return undefined;
    let active = true;
    getIntegration(side, startWith.configurationId)
      .then((configuration) => {
        if (active) setView({ name: "workspace", configuration, tab: tabsFor(configuration.processType)[0].key });
      })
      .catch((err: unknown) => {
        if (!active) return;
        toastService.error(errorMessage(err, "Could not open the integration."));
        onExit();
      });
    return () => {
      active = false;
    };
  }, []);

  const openWorkspace = (configuration: IntegrationConfiguration) => {
    setTestResult(null);
    setView({ name: "workspace", configuration, tab: tabsFor(configuration.processType)[0].key });
  };

  if (view.name === "opening") {
    return <Loader size={24} message="Opening integration..." />;
  }

  if (view.name === "create") {
    return (
      <div className="ops-section">
        <PageHeader className="pud-page-header" title="New integration" onBack={onExit} backLabel="Back to integrations" />
        <IntegrationConfigForm
          configuration={null}
          side={side}
          initialProcessType={initialProcessType}
          onCancel={onExit}
          onSaved={openWorkspace}
        />
      </div>
    );
  }

  const { configuration, tab } = view;
  const busy = action !== null;
  const isActive = configuration.status === "ACTIVE";
  const canActivate = configuration.status === "TESTED" || configuration.status === "INACTIVE";
  const process = integrationProcessOf(configuration.processType);
  const visibleTabs = tabsFor(configuration.processType);
  // A check reads the API and validates the mapping without storing anything.
  const isCheck = process.pull === "check";
  const pullName = isCheck ? "Check" : "Pull";
  const showConnectionActions = mode === "connection";
  const showWorkflowActions = mode === "workflow";

  const refresh = async (nextTab: Tab = tab) => {
    try {
      setView({ name: "workspace", configuration: await getIntegration(side, configuration.id), tab: nextTab });
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Could not reload the integration."));
    }
  };

  const handleTest = async () => {
    setAction("test");
    try {
      const result = await testIntegration(side, configuration.id);
      setTestResult(result);
      if (result.success) {
        toastService.success("The connection test passed.");
      } else {
        toastService.error("The connection test failed.");
      }
      setHistoryVersion((current) => current + 1);
      await refresh();
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "The connection test could not be completed."));
    } finally {
      setAction(null);
    }
  };

  const handleActivate = async () => {
    setAction("activate");
    try {
      await setIntegrationActive(side, configuration.id, !isActive);
      toastService.success(isActive ? "Integration deactivated." : "Integration activated.");
      await refresh();
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Could not change the integration status."));
    } finally {
      setAction(null);
    }
  };

  const handlePull = async (fullSync: boolean) => {
    setAction(fullSync ? "fullSync" : "pull");
    try {
      const run = await pullIntegration(side, configuration.id, fullSync);
      const summary = isCheck
        ? `${run.recordsRead} read, ${run.recordsFailed} failed.`
        : `${run.recordsCreated} created, ${run.recordsUpdated} updated, ${run.recordsFailed} failed.`;
      if (run.status === "SUCCESS") {
        toastService.success(`${pullName} completed: ${summary}`);
      } else {
        toastService.warning(`${pullName} ended as ${statusLabel(run.status).toLowerCase()}: ${summary}`);
      }
      setHistoryVersion((current) => current + 1);
      await refresh(visibleTabs.some((item) => item.key === "history") ? "history" : tab);
    } catch (err: unknown) {
      toastService.error(errorMessage(err, isCheck ? "The check could not be started." : "The pull could not be started."));
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="ops-section">
      <PageHeader
        className="pud-page-header"
        title={configuration.name}
        description={`${labelOf(INTEGRATION_PROCESS_TYPES, configuration.processType)} · ${labelOf(INTEGRATION_PROTOCOLS, configuration.protocol)} · entity ${configuration.entityCode}`}
        meta={<span className={statusBadgeClass(configuration.status)}>{statusLabel(configuration.status)}</span>}
        onBack={onExit}
        backLabel="Back to integrations"
        actions={readOnly ? undefined : (
          <div className="sila-btn-group">
            {showConnectionActions && (
              <button type="button" className="sila-btn sila-btn--secondary" onClick={handleTest} disabled={busy}>
                {action === "test" ? "Testing..." : "Test connection"}
              </button>
            )}
            {showWorkflowActions && (
              <>
                <button type="button" className="sila-btn sila-btn--secondary" onClick={handleActivate} disabled={busy || (!isActive && !canActivate)} title={!isActive && !canActivate ? "Run a successful connection test first" : undefined}>
                  {action === "activate" ? "Saving..." : isActive ? "Deactivate" : "Activate"}
                </button>
                {process.pull === "full" && (
                  <button type="button" className="sila-btn sila-btn--secondary" onClick={() => handlePull(true)} disabled={busy || !isActive || configuration.isRunning}>
                    {action === "fullSync" ? "Pulling..." : "Full sync"}
                  </button>
                )}
                {process.pull !== "none" && (
                  <button type="button" className="sila-btn sila-btn--primary" onClick={() => handlePull(false)} disabled={busy || !isActive || configuration.isRunning}>
                    {action === "pull" ? (isCheck ? "Checking..." : "Pulling...") : `${pullName} now`}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      />

      <section className="sila-card">
        <div className="sila-card-body ops-stack">
          <dl className="sila-meta-grid">
            <div className="sila-meta-item"><dt className="sila-meta-label">System</dt><dd className="sila-meta-value">{configuration.systemName || "—"}</dd></div>
            <div className="sila-meta-item"><dt className="sila-meta-label">Sign-in</dt><dd className="sila-meta-value">{labelOf(INTEGRATION_AUTH_TYPES, configuration.authenticationType)}</dd></div>
            <div className="sila-meta-item"><dt className="sila-meta-label">Credentials</dt><dd className="sila-meta-value">{statusLabel(configuration.credentialStatus)}</dd></div>
            <div className="sila-meta-item"><dt className="sila-meta-label">Last tested</dt><dd className="sila-meta-value">{formatDateTime(configuration.testedAt)}</dd></div>
            <div className="sila-meta-item"><dt className="sila-meta-label">Last attempt</dt><dd className="sila-meta-value">{formatDateTime(configuration.lastAttemptAt)}</dd></div>
            <div className="sila-meta-item"><dt className="sila-meta-label">Last successful run</dt><dd className="sila-meta-value">{formatDateTime(configuration.lastSuccessfulRunAt)}</dd></div>
            {process.pull === "full" && (
              <>
                <div className="sila-meta-item"><dt className="sila-meta-label">Next scheduled run</dt><dd className="sila-meta-value">{configuration.scheduleCron ? formatDateTime(configuration.nextRunAt) : "Not scheduled"}</dd></div>
                <div className="sila-meta-item"><dt className="sila-meta-label">Watermark</dt><dd className="sila-meta-value">{formatDateTime(configuration.lastWatermark)}</dd></div>
              </>
            )}
            <div className="sila-meta-item"><dt className="sila-meta-label">Run state</dt><dd className="sila-meta-value">{configuration.isRunning ? "Running now" : "Idle"}</dd></div>
          </dl>
          {process.calledWhen && <span className="sila-help">{process.calledWhen}</span>}
          {!isActive && !readOnly && (mode === "connection" ? (
            <span className="sila-help">
              {canActivate
                ? "The connection is tested. Activate and use this API under Workflow & Configuration."
                : "Run a successful connection test. The API can then be used under Workflow & Configuration."}
            </span>
          ) : (
            <span className="sila-help">
              {process.pull === "none" ? "" : `${pullName}s are available once the integration is active. `}
              {canActivate ? "It can be activated now." : "Run a successful connection test under Integration to be able to activate it."}
            </span>
          ))}
          {testResult && (
            <div className={`sila-alert ${testResult.success ? "sila-alert--success" : "sila-alert--danger"}`} role="status">
              <div>
                <div className="sila-alert-title">
                  {testResult.success ? "Connection test passed" : "Connection test failed"}
                  {testResult.httpStatus ? ` (HTTP ${testResult.httpStatus})` : ""}
                </div>
                <div className="ops-break">{testResult.message}</div>
              </div>
            </div>
          )}
          {configuration.lastErrorSafe && (
            <div className="sila-alert sila-alert--warning" role="status">
              <div>
                <div className="sila-alert-title">Last run reported a problem</div>
                <div className="ops-break">{configuration.lastErrorSafe}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="sila-tabs" role="tablist" aria-label="Integration sections">
        {visibleTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className="sila-tab"
            aria-selected={tab === item.key}
            onClick={() => setView({ name: "workspace", configuration, tab: item.key })}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "configuration" && (
        <IntegrationConfigForm
          key={configuration.id}
          configuration={configuration}
          side={side}
          readOnly={readOnly}
          onCancel={onExit}
          onSaved={(saved) => setView({ name: "workspace", configuration: saved, tab: "configuration" })}
        />
      )}
      {tab === "schema" && <IntegrationSchemaPanel configuration={configuration} readOnly={readOnly} />}
      {tab === "mapping" && <IntegrationMappingEditor configuration={configuration} readOnly={readOnly} />}
      {tab === "history" && <IntegrationHistory side={side} configurationId={configuration.id} refreshKey={historyVersion} />}
    </div>
  );
};

export default IntegrationWorkspace;
