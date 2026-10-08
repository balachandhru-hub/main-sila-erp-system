import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import {
  INTEGRATION_PROCESS_TYPES,
  getIntegrations,
  integrationProcessTypesFor,
  type IntegrationConfiguration,
  type IntegrationSide,
} from "../../api/integrationsApi";
import IntegrationWorkspace from "./IntegrationWorkspace";
import { statusBadgeClass, statusLabel } from "./integrationFormat";

interface IntegrationHubProps {
  /**
   * "integration": connect APIs — every API in one list, with its URL, request, sign-in, schema and
   * connection test. "workflow": use the connected APIs — for each one its field mapping, data update,
   * runs, activation and pulls.
   */
  variant?: "integration" | "workflow";
  /** Whose API types are configured here. */
  side?: IntegrationSide;
  /** View only: APIs can be opened but not created or changed. */
  readOnly?: boolean;
}

// Statuses of an API whose connection test has passed.
const CONNECTED_STATUSES = ["TESTED", "ACTIVE", "INACTIVE"];

type View =
  | { name: "list" }
  | { name: "create"; processType: string }
  | { name: "open"; configurationId: string };

const purposeOf = (processType: string): string =>
  INTEGRATION_PROCESS_TYPES.find((type) => type.value === processType)?.label ?? statusLabel(processType);

/**
 * The application's single place for external APIs, for every API type of the buyer or the supplier.
 * Integration connects and tests them; Workflow & Configuration decides how the connected ones are
 * used. Both read the same list and open the same form.
 */
const IntegrationHub: React.FC<IntegrationHubProps> = ({
  variant = "integration",
  side = "buyer",
  readOnly = false,
}) => {
  const isWorkflow = variant === "workflow";
  const [view, setView] = useState<View>({ name: "list" });
  const [rows, setRows] = useState<IntegrationConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newType, setNewType] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getIntegrations(side));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the integrations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view.name === "list") load();
  }, [view.name, variant, side]);

  // Leaving one screen for the other starts on its list.
  useEffect(() => {
    setView({ name: "list" });
  }, [variant]);

  const backToList = () => setView({ name: "list" });

  if (view.name !== "list") {
    return (
      <IntegrationWorkspace
        startWith={view.name === "create" ? "create" : { configurationId: view.configurationId }}
        initialProcessType={view.name === "create" ? view.processType : undefined}
        onExit={backToList}
        mode={isWorkflow ? "workflow" : "connection"}
        side={side}
        readOnly={readOnly}
      />
    );
  }

  // Workflow & Configuration works only with APIs that are connected.
  const visibleRows = isWorkflow ? rows.filter((row) => CONNECTED_STATUSES.includes(row.status)) : rows;

  // Every API type is offered. One API per type and company code is enforced when it is saved, so an API type that
  // is already configured can still be added for another company code (entity code).
  const apiTypes = integrationProcessTypesFor(side);
  const canCreate = !isWorkflow && !readOnly && apiTypes.length > 0;

  const handleCreate = () => {
    if (!newType) return;
    setView({ name: "create", processType: newType });
    setNewType("");
  };

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title={isWorkflow ? "Workflow & Configuration" : "Integrations"}
        actions={canCreate ? (
          <div className="sila-btn-group">
            <select
              className="sila-select"
              aria-label="API type"
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
            >
              <option value="">Select API type</option>
              {apiTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <button type="button" className="sila-btn sila-btn--primary" onClick={handleCreate} disabled={!newType}>
              New integration
            </button>
          </div>
        ) : undefined}
      />
      <section className="sila-card">
        {loading ? (
          <Loader size={24} message="Loading integrations..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the integrations"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title={isWorkflow ? "No connected APIs yet" : "No integrations yet"}
            description={isWorkflow
              ? "Connect an API under Integration and pass its connection test. It then appears here to be configured."
              : readOnly
                ? `Your ${side} administrator sets up the integrations of the organization.`
                : "Select an API type and choose New integration."}
          />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">{isWorkflow ? "Workflow" : "Purpose"}</th>
                  <th scope="col">API</th>
                  <th scope="col">System</th>
                  <th scope="col">Target</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{purposeOf(row.processType)}</td>
                    <td>{row.name}</td>
                    <td>{row.systemName || "—"}</td>
                    <td>{row.baseUrl || "—"}</td>
                    <td>{row.entityCode || "—"}</td>
                    <td><span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span></td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => setView({ name: "open", configurationId: row.id })}
                      >
                        {readOnly ? "View" : isWorkflow ? "Configure" : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default IntegrationHub;
