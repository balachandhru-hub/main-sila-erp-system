import React from "react";
import type { SilaRecipeDetail } from "../../../api/silaMe/silaRecipeApi";
import { formatDateTime } from "../../cart/lineFormat";
import { recipeBadgeClass, recipeLabel } from "./recipeFormat";

interface SilaRecipeApprovalTrailProps {
  recipe: SilaRecipeDetail;
}

/** Approval steps of every version (newest first) and the recipe's history. */
const SilaRecipeApprovalTrail: React.FC<SilaRecipeApprovalTrailProps> = ({ recipe }) => (
  <>
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Approval trail</h2>
      </div>
      {recipe.approvalSteps.length === 0 ? (
        <div className="sila-card-body">
          <span className="sila-help">Not sent for approval yet.</span>
        </div>
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Level</th>
                <th scope="col">Approver</th>
                <th scope="col">Status</th>
                <th scope="col">Comment</th>
                <th scope="col">Acted on</th>
              </tr>
            </thead>
            <tbody>
              {recipe.approvalSteps.map((step) => (
                <tr key={`${step.version}-${step.order}-${step.userId}`}>
                  <td>v{step.version}</td>
                  <td>Level {step.order}</td>
                  <td>
                    <span className="sila-cell-strong">{step.name || step.email || "Unknown user"}</span>
                    {step.name && step.email && <span className="srec-sub">{step.email}</span>}
                  </td>
                  <td><span className={recipeBadgeClass(step.status)}>{recipeLabel(step.status)}</span></td>
                  <td>{step.comment || "—"}</td>
                  <td>{formatDateTime(step.actedOn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>

    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">History</h2>
      </div>
      {recipe.history.length === 0 ? (
        <div className="sila-card-body">
          <span className="sila-help">No history.</span>
        </div>
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">By</th>
                <th scope="col">Comment</th>
              </tr>
            </thead>
            <tbody>
              {recipe.history.map((event, index) => (
                <tr key={`${event.dateCreated}-${index}`}>
                  <td>{formatDateTime(event.dateCreated)}</td>
                  <td>{recipeLabel(event.action)}</td>
                  <td>{event.actorName || "—"}</td>
                  <td>{event.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>
);

export default SilaRecipeApprovalTrail;
