import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import { getRecipeApprovals, type SilaRecipeListItem } from "../../../api/silaMe/silaRecipeApi";
import SilaRecipeDetailView from "./SilaRecipeDetailView";
import SilaRecipeTable from "./SilaRecipeTable";
import SilaRecipeWorkflowSummary from "./SilaRecipeWorkflowSummary";
import "../silaMeTheme.css";
import "./SilaRecipes.css";

/** Recipes waiting for the signed-in user's decision; opening one shows Approve / Reject. */
const SilaRecipeApprovals: React.FC = () => {
  const [rows, setRows] = useState<SilaRecipeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getRecipeApprovals());
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the recipes waiting for you.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (openId) {
    return (
      <SilaRecipeDetailView
        recipeId={openId}
        canManage={false}
        onBack={() => setOpenId(null)}
        onEdit={() => undefined}
        onChanged={load}
      />
    );
  }

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="Recipe approvals"
        description="Recipes waiting for your decision. CREATE is a new recipe; CHANGE is a new version of an approved recipe (POS sales keep the approved version until it is approved)."
      />
      <section className="sila-card">
        {loading ? (
          <Loader size={24} message="Loading approvals..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load approvals"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing is waiting for you" />
        ) : (
          <SilaRecipeTable rows={rows} onOpen={setOpenId} openLabel="Review" showEvent />
        )}
      </section>
      <SilaRecipeWorkflowSummary />
    </div>
  );
};

export default SilaRecipeApprovals;
