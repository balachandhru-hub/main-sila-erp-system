import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import { getApprovalSetups, type SilaApprovalSetup, type SilaApprovalSetupAction } from "../../../api/silaMe/silaApprovalApi";
import type { SilaApprovalWorkflow } from "../../../api/silaMe/silaRecipeApi";
import "../silaMeTheme.css";
import "../recipes/SilaRecipes.css";

const STATUS_TEXT: Record<string, string> = {
  CONFIGURED: "Set up",
  NOT_CONFIGURED: "Not set up",
  IMMEDIATE: "No approval",
};

const STATUS_BADGE: Record<string, string> = {
  CONFIGURED: "sila-badge--success",
  NOT_CONFIGURED: "sila-badge--warning",
  IMMEDIATE: "sila-badge--neutral",
};

const scopeText = (flow: SilaApprovalWorkflow): string => {
  const kind = (flow.scopeKind || "ALL").toUpperCase();
  if (kind === "ALL") return "All";
  const label = kind.replace(/_/g, " ");
  return flow.scopeCode ? `${label} ${flow.scopeCode}` : label;
};

const FlowLines: React.FC<{ action: SilaApprovalSetupAction }> = ({ action }) => {
  if (action.flows.length === 0) {
    return <span className="srec-sub">{action.note}</span>;
  }
  return (
    <>
      {action.flows.map((flow) => (
        <span className="srec-sub" key={flow.id}>
          <span className="sila-cell-strong">{flow.name || flow.code || "Approval flow"}</span>
          {flow.code && flow.name ? ` · ${flow.code}` : ""}
          {` · ${scopeText(flow)} · `}
          {flow.levels.length === 0
            ? "No approvers"
            : flow.levels.map((level) => `L${level.level} ${level.name || "Unknown user"}${level.roleName ? ` (${level.roleName})` : ""}`).join(", ")}
        </span>
      ))}
      {action.note && <span className="srec-sub">{action.note}</span>}
    </>
  );
};

/** Setup: every approval flow, including create, change and deactivation. */
const SilaApprovalFlows: React.FC = () => {
  const [areas, setAreas] = useState<SilaApprovalSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAreas(await getApprovalSetups());
    } catch (err: unknown) {
      setAreas([]);
      setError(err instanceof Error ? err.message : "Could not load the approval setups.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="Approval flow"
        description="Approval setups for inventory, menu engineering, recipe, material and the other functions. Create, change and deactivation are listed for each."
        actions={<button type="button" className="sila-btn sila-btn--secondary" onClick={load} disabled={loading}>Refresh</button>}
      />
      <p className="sila-help">
        The buyer administrator can approve or reject any pending stock count, internal transfer, recipe and material price, including a level assigned to someone else.
      </p>

      {loading && areas.length === 0 ? (
        <Loader size={24} message="Loading approval setups..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the approval setups"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : (
        areas.map((area) => (
          <section className="sila-card" key={area.area} aria-labelledby={`sila-approval-${area.area.replace(/\s+/g, "-")}`}>
            <div className="sila-card-header">
              <h2 id={`sila-approval-${area.area.replace(/\s+/g, "-")}`} className="sila-card-title">{area.area}</h2>
            </div>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {area.actions.map((action) => (
                    <tr key={`${area.area}-${action.action}`}>
                      <td className="sila-cell-strong">{action.action}</td>
                      <td>{action.approvalType || "—"}</td>
                      <td>
                        <span className={`sila-badge ${STATUS_BADGE[action.status] ?? "sila-badge--neutral"}`}>
                          {STATUS_TEXT[action.status] ?? action.status}
                        </span>
                      </td>
                      <td><FlowLines action={action} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default SilaApprovalFlows;
