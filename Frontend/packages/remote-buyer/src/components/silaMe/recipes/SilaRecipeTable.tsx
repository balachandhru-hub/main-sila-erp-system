import React from "react";
import type { SilaRecipeListItem } from "../../../api/silaMe/silaRecipeApi";
import { formatDateTime } from "../../cart/lineFormat";
import { approvalEvent, costPerServing, formatCost, formatQty, readinessStatusBadgeClass, readinessText, recipeBadgeClass, recipeLabel } from "./recipeFormat";

interface SilaRecipeTableProps {
  rows: SilaRecipeListItem[];
  onOpen: (recipeId: string) => void;
  /** Label of the open button, e.g. "Open" or "Review". */
  openLabel?: string;
  /** Shows the approval event (CREATE / CHANGE) and version columns (recipe approvals). */
  showEvent?: boolean;
}

const Incomplete: React.FC = () => <span className="sila-me-flag">Incomplete</span>;

/**
 * Recipe master columns of the prototype: POS code, title, serving, recipe id, family, category, menu prices,
 * recipe cost and cost per serving (or INCOMPLETE), status and readiness.
 */
const SilaRecipeTable: React.FC<SilaRecipeTableProps> = ({ rows, onOpen, openLabel = "Open", showEvent = false }) => (
  <div className="sila-table-wrap">
    <table className="sila-table">
      <thead>
        <tr>
          <th scope="col">POS code</th>
          <th scope="col">Title</th>
          <th scope="col">POS item</th>
          <th scope="col">Serving UOM</th>
          <th scope="col" className="srec-num">Serving qty</th>
          <th scope="col">Recipe ID</th>
          {showEvent && <th scope="col">Event</th>}
          {showEvent && <th scope="col">Level / approver</th>}
          <th scope="col">Family</th>
          <th scope="col">Category</th>
          <th scope="col">Mode</th>
          <th scope="col">Menu price</th>
          <th scope="col" className="srec-num">Recipe cost</th>
          <th scope="col" className="srec-num">Cost / serving</th>
          <th scope="col">Status</th>
          <th scope="col">Readiness</th>
          <th scope="col">Updated</th>
          <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.posCode || "—"}</td>
            <td className="sila-cell-strong">{row.name}</td>
            <td>{row.posItem || "—"}</td>
            <td>{row.servingUom}</td>
            <td className="srec-num">{formatQty(row.servingQty)}</td>
            <td>{row.recipeCode}</td>
            {showEvent && (
              <td>
                {row.approvalEvent || approvalEvent(row.activeVersion)}
                <span className="srec-sub">v{row.version}</span>
              </td>
            )}
            {showEvent && (
              <td>
                {row.approvalLevel != null ? `Level ${row.approvalLevel}${row.approvalLevelCount ? ` of ${row.approvalLevelCount}` : ""}` : "—"}
                {(row.approverName || row.approverRole) && (
                  <span className="srec-sub">{[row.approverName, row.approverRole].filter(Boolean).join(" · ")}</span>
                )}
              </td>
            )}
            <td>{row.familyName || "—"}</td>
            <td>{row.category || "—"}</td>
            <td>{recipeLabel(row.itemMode)}</td>
            <td>
              {row.outletCount > 0 ? `${row.outletCount} outlet${row.outletCount === 1 ? "" : "s"}` : <span className="sila-me-flag">No menu price</span>}
            </td>
            <td className="srec-num">
              {row.costComplete || row.activeVersion > 0 ? formatCost(row.totalCost, row.currency) : <Incomplete />}
              {row.draftTotalCost != null && <span className="srec-sub">Draft {formatCost(row.draftTotalCost, row.currency)}</span>}
            </td>
            <td className="srec-num">
              {row.costComplete || row.activeVersion > 0
                ? formatCost(row.costPerServing ?? costPerServing(row.totalCost, row.servingQty), row.currency)
                : <Incomplete />}
            </td>
            <td>
              <span className="srec-badges">
                <span className={recipeBadgeClass(row.status)}>{recipeLabel(row.status)}</span>
                <span className="srec-sub">
                  v{row.version}
                  {row.activeVersion > 0 && row.activeVersion !== row.version ? ` · selling v${row.activeVersion}` : ""}
                </span>
              </span>
            </td>
            <td>
              {row.status === "INACTIVE" ? (
                "—"
              ) : (
                <span className={readinessStatusBadgeClass(row.readinessStatus, row.issueCount)}>{readinessText(row.readinessStatus, row.issueCount)}</span>
              )}
            </td>
            <td>{formatDateTime(row.dateUpdated ?? row.submittedOn)}</td>
            <td>
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                aria-label={`${openLabel} ${row.recipeCode}`}
                onClick={() => onOpen(row.id)}
              >
                {openLabel}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default SilaRecipeTable;
