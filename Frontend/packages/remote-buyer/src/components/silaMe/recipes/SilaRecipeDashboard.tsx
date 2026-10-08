import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader } from "@vosox/shared-ui";
import { getRecipeDashboard, type SilaRecipeDashboard as Dashboard, type SilaRecipeNextAction } from "../../../api/silaMe/silaRecipeToolsApi";
import "../silaMeTheme.css";
import "./SilaRecipes.css";

interface SilaRecipeDashboardProps {
  /** Opens the recipe list (Active recipes card). */
  onOpenRecipes?: () => void;
  /** Opens one recipe (a "complete" next action). */
  onOpenRecipe?: (recipeId: string) => void;
  /** Opens the recipe approvals (Pending approvals card and "approve" actions). */
  onOpenApprovals?: () => void;
  /** Opens the POS transaction tracker (Failed POS sales card and actions). */
  onOpenPosTransactions?: () => void;
  /** Shows "New recipe" (needs MANAGE_SILA_RECIPE). */
  onNewRecipe?: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  AWAITING_ME: "Review",
  NOT_READY: "Complete",
  FAILED_POS: "Investigate",
};

const ACTION_BADGE: Record<string, string> = {
  AWAITING_ME: "sila-badge sila-badge--info",
  NOT_READY: "sila-badge sila-badge--warning",
  FAILED_POS: "sila-badge sila-badge--danger",
};

const ACTION_KIND: Record<string, string> = {
  AWAITING_ME: "Approval",
  NOT_READY: "Not ready",
  FAILED_POS: "POS sale",
};

/** Recipe management overview: active recipes, approvals waiting for me, failed POS sales, consumption today, what to do next. */
const SilaRecipeDashboard: React.FC<SilaRecipeDashboardProps> = ({ onOpenRecipes, onOpenRecipe, onOpenApprovals, onOpenPosTransactions, onNewRecipe }) => {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRecipeDashboard());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the recipe dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAction = (action: SilaRecipeNextAction): (() => void) | undefined => {
    if (action.kind === "AWAITING_ME") return onOpenApprovals;
    if (action.kind === "FAILED_POS") return onOpenPosTransactions;
    return onOpenRecipe && action.referenceId ? () => onOpenRecipe(action.referenceId as string) : undefined;
  };

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="Recipe control center"
        description="Approved recipes, POS sales posting, and the consumption that feeds inventory."
        actions={
          <div className="srec-actions">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={load} disabled={loading}>Refresh</button>
            {onNewRecipe && <button type="button" className="sila-btn sila-btn--primary" onClick={onNewRecipe}>New recipe</button>}
          </div>
        }
      />

      {loading && !data ? (
        <Loader size={24} message="Loading..." />
      ) : error || !data ? (
        <EmptyState
          variant="error"
          title="Couldn't load the dashboard"
          description={error ?? undefined}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : (
        <>
          <div className="sila-kpi-grid">
            <KpiCard label="Active recipes" value={data.activeRecipes} tone="primary"
              meta={`${data.draftRecipes} draft${data.totalRecipes != null ? ` · ${data.totalRecipes} total` : ""}${data.materialCount != null ? ` · ${data.materialCount} materials` : ""}`}
              onClick={onOpenRecipes} linkText={onOpenRecipes ? "Open recipes" : undefined} />
            <KpiCard label="Pending approvals" value={data.pendingApprovalTotal} tone={data.pendingMyApproval > 0 ? "warning" : "neutral"}
              meta={`${data.pendingMyApproval} waiting for you · CREATE and CHANGE`} onClick={onOpenApprovals} linkText={onOpenApprovals ? "Open approvals" : undefined} />
            <KpiCard label="Failed POS sales" value={data.failedPosSales} tone={data.failedPosSales > 0 ? "danger" : "success"} meta="Need mapping or stock posting"
              onClick={onOpenPosTransactions} linkText={onOpenPosTransactions ? "Open tracker" : undefined} />
            <KpiCard label="Posted consumption" value={data.consumptionPostedToday} tone="neutral" meta="Sales deducted from stock today" />
          </div>

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">What to do next</h2>
            </div>
            <div className="sila-card-body">
              {data.nextActions.length === 0 ? (
                <EmptyState title="Nothing to do right now" description="No recipe or POS exceptions need action." />
              ) : (
                <ul className="srec-next-list">
                  {data.nextActions.map((action) => {
                    const open = openAction(action);
                    return (
                      <li key={`${action.kind}-${action.referenceId ?? action.title}`} className="srec-next-item">
                        <span className={ACTION_BADGE[action.kind] ?? "sila-badge sila-badge--neutral"}>{ACTION_KIND[action.kind] ?? action.kind}</span>
                        <span className="srec-next-text">
                          <span className="sila-cell-strong">{action.title}</span>
                          {action.detail && <span className="srec-sub">{action.detail}</span>}
                        </span>
                        {open && (
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`${ACTION_LABEL[action.kind] ?? "Open"}: ${action.title}`} onClick={open}>
                            {ACTION_LABEL[action.kind] ?? "Open"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Consumption</h2>
              {onOpenPosTransactions && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={onOpenPosTransactions}>Transaction tracker</button>
              )}
            </div>
            <div className="sila-card-body">
              <p className="sila-help">
                {data.consumptionPostedToday === 0
                  ? "No consumption posted today. Upload POS sales to deduct outlet stock."
                  : `${data.consumptionPostedToday} POS sale consumption${data.consumptionPostedToday === 1 ? "" : "s"} posted to inventory today. Open the Transaction Tracker for the audit trail.`}
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default SilaRecipeDashboard;
