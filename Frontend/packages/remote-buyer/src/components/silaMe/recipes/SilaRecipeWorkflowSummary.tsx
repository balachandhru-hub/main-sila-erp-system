import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import { getRecipeWorkflows, type SilaApprovalWorkflow } from "../../../api/silaMe/silaRecipeApi";

const scopeText = (flow: SilaApprovalWorkflow): string => {
  const kind = (flow.scopeKind || "ALL").toUpperCase();
  if (kind === "ALL") return "All outlets";
  return flow.scopeCode ? `${kind.replace("_", " ")} ${flow.scopeCode}` : kind.replace("_", " ");
};

/** The RECIPE approval flows with their levels (approver name and role), as configured in Approval Management. */
const SilaRecipeWorkflowSummary: React.FC = () => {
  const [flows, setFlows] = useState<SilaApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFlows(await getRecipeWorkflows());
    } catch (err: unknown) {
      setFlows([]);
      setError(err instanceof Error ? err.message : "Could not load the recipe approval workflows.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Recipe approval workflow</h2>
      </div>
      {loading ? (
        <Loader size={20} message="Loading workflows..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the workflows"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : flows.length === 0 ? (
        <EmptyState title="No recipe approval flow" description="Create an approval flow of type RECIPE in Approval Management before submitting recipes." />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Flow</th>
                <th scope="col">Scope</th>
                <th scope="col" className="srec-num">Levels</th>
                <th scope="col">Approvers</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((flow) => (
                <tr key={flow.id}>
                  <td>
                    <span className="sila-cell-strong">{flow.name || flow.code || "—"}</span>
                    {flow.code && flow.name && <span className="srec-sub">{flow.code}</span>}
                  </td>
                  <td>{scopeText(flow)}</td>
                  <td className="srec-num">{flow.levelCount}</td>
                  <td>
                    {flow.levels.length === 0
                      ? <span className="sila-me-flag">No approvers</span>
                      : flow.levels.map((level) => (
                        <span className="srec-sub" key={`${flow.id}-${level.level}`}>
                          L{level.level}: {level.name || "Unknown user"}{level.roleName ? ` (${level.roleName})` : ""}
                        </span>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default SilaRecipeWorkflowSummary;
