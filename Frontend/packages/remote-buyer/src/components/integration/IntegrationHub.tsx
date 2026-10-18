import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import {
  INTEGRATION_PROCESS_TYPES,
  NEW_API_TYPE,
  customApiTypeCode,
  deleteIntegration,
  getIntegrations,
  integrationProcessTypesFor,
  isAcceptableProcessType,
  type ApiTypeDirection,
  type IntegrationConfiguration,
  type IntegrationSide,
} from "../../api/integrationsApi";
import IntegrationWorkspace from "./IntegrationWorkspace";
import { statusBadgeClass, statusLabel } from "./integrationFormat";
import "./Integration.css";

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
  | { name: "create"; processType: string; copyFromId?: string }
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
  const [customDraft, setCustomDraft] = useState("");
  const [customDirection, setCustomDirection] = useState<ApiTypeDirection>("read");
  const [pendingDelete, setPendingDelete] = useState<IntegrationConfiguration | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (view.name !== "list") return undefined;
    let active = true;
    setError(null);
    getIntegrations(side)
      .then((next) => {
        if (active) setRows(next);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the integrations.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view.name, variant, side]);

  // Switching between Integration and Workflow returns to that screen's list, without remounting the one already shown.
  useEffect(() => {
    setView((current) => (current.name === "list" ? current : { name: "list" }));
  }, [variant]);

  const backToList = () => setView({ name: "list" });

  if (view.name !== "list") {
    return (
      <IntegrationWorkspace
        startWith={view.name === "create" ? "create" : { configurationId: view.configurationId }}
        initialProcessType={view.name === "create" ? view.processType : undefined}
        copyFromId={view.name === "create" ? view.copyFromId : undefined}
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
  const addingType = newType === NEW_API_TYPE;
  const resolvedType = addingType ? customApiTypeCode(customDraft, customDirection) : newType;

  const handleCreate = () => {
    if (!isAcceptableProcessType(resolvedType)) return;
    setView({ name: "create", processType: resolvedType });
    setNewType("");
    setCustomDraft("");
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteIntegration(side, pendingDelete.id);
      toastService.success("API deleted.");
      setPendingDelete(null);
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete the integration.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (row: IntegrationConfiguration) => {
    setView({ name: "create", processType: row.processType, copyFromId: row.id });
  };

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title={isWorkflow ? "Workflow & Configuration" : "Integrations"}
        actions={canCreate ? (
          <div className="sila-btn-group ops-inline">
            <select
              className="sila-select"
              aria-label="API type"
              required
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
            >
              <option value="">Select API type</option>
              {apiTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
              <option value={NEW_API_TYPE}>Add new API type…</option>
            </select>
            {addingType && (
              <>
                <input
                  className="sila-input"
                  aria-label="New API type code"
                  placeholder="PRICE"
                  maxLength={24}
                  value={customDraft}
                  onChange={(event) => setCustomDraft(event.target.value)}
                />
                <select
                  className="sila-select"
                  aria-label="API type direction"
                  value={customDirection}
                  onChange={(event) => setCustomDirection(event.target.value as ApiTypeDirection)}
                >
                  <option value="read">Read (GET)</option>
                  <option value="send">Send (POST)</option>
                </select>
              </>
            )}
            <button type="button" className="sila-btn sila-btn--primary" onClick={handleCreate} disabled={!isAcceptableProcessType(resolvedType)}>
              {addingType ? "Add API type" : "Add new"}
            </button>
          </div>
        ) : undefined}
      />
      {addingType && canCreate && (
        <p className="sila-help">
          {resolvedType
            ? `This API type is stored as ${resolvedType}. Read uses GET_ and send uses POST_.`
            : "Enter a name such as PRICE. Read uses GET_ and send uses POST_."}
        </p>
      )}
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
                : "Select an API type and choose Add new, or choose Add new API type."}
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
                    <td>
                      {row.name}
                      {row.resourcePath?.includes("API_CV_ATTACHMENT_SRV") && row.name !== "API_CV_ATTACHMENT_SRV" && (
                        <span className="srcv-sub">API_CV_ATTACHMENT_SRV</span>
                      )}
                    </td>
                    <td>{row.systemName || "—"}</td>
                    <td>{row.baseUrl || "—"}</td>
                    <td>{row.entityCode || "—"}</td>
                    <td><span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span></td>
                    <td>
                      <div className="sila-btn-group">
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          onClick={() => setView({ name: "open", configurationId: row.id })}
                        >
                          {readOnly ? "View" : isWorkflow ? "Configure" : "Open"}
                        </button>
                        {canCreate && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            onClick={() => handleCopy(row)}
                          >
                            Copy
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--danger sila-btn--sm"
                            onClick={() => setPendingDelete(row)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        variant="danger"
        size="sm"
        headerProps={{ heading: "Delete API" }}
        bodyProps={{
          content: pendingDelete ? `Delete "${pendingDelete.name}"?` : "",
          contentDescription: "The connection, its field mapping and its run history are removed. This cannot be undone.",
        }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: () => setPendingDelete(null), disabled: deleting },
          primaryButton: { text: "Delete", onClick: handleDelete, loading: deleting },
        }}
      />
    </>
  );
};

export default IntegrationHub;
