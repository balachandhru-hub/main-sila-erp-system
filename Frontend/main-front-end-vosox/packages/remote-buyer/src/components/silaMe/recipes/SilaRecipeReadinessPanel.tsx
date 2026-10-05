import React, { useState } from "react";
import type { SilaRecipeReadiness } from "../../../api/silaMe/silaRecipeApi";
import { readinessStatusBadgeClass, readinessText } from "./recipeFormat";

interface SilaRecipeReadinessPanelProps {
  readiness: SilaRecipeReadiness;
}

/**
 * The readiness status (ACTIVE, PENDING APPROVAL, READY FOR APPROVAL, NOT READY (n)) with the list of issues to fix
 * (shown by default when not ready).
 */
const SilaRecipeReadinessPanel: React.FC<SilaRecipeReadinessPanelProps> = ({ readiness }) => {
  const [open, setOpen] = useState(true);
  const count = readiness.issues.length;

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Recipe readiness</h2>
        <span className="srec-badges">
          <span className={readinessStatusBadgeClass(readiness.status, count)}>{readinessText(readiness.status, count)}</span>
          {!readiness.costComplete && <span className="sila-badge sila-badge--warning">Cost incomplete</span>}
          {count > 0 && (
            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Hide issues" : `Issues: ${count}`}
            </button>
          )}
        </span>
      </div>
      {count > 0 && open && (
        <div className="sila-card-body">
          <ul className="srec-issue-list">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <span className="sila-help">Recipe approval is blocked until every ingredient has an approved material price and unit conversion.</span>
        </div>
      )}
    </section>
  );
};

export default SilaRecipeReadinessPanel;
