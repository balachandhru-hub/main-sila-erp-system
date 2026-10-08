import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, Pagination } from "@vosox/shared-ui";
import { getRecipes, type SilaRecipeDetail, type SilaRecipeListItem } from "../../../api/silaMe/silaRecipeApi";
import {
  confirmRecipeImport,
  downloadRecipeTemplate,
  exportRecipes,
  getRecipeMasters,
  previewRecipeImport,
  type SilaRecipeMaster,
} from "../../../api/silaMe/silaRecipeToolsApi";
import SilaRecipeDetailView from "./SilaRecipeDetailView";
import SilaRecipeEditor from "./SilaRecipeEditor";
import SilaRecipeExcelPanel from "./SilaRecipeExcelPanel";
import SilaRecipeTable from "./SilaRecipeTable";
import { RECIPE_STATUSES, recipeLabel } from "./recipeFormat";
import "../silaMeTheme.css";
import "./SilaRecipes.css";

interface SilaRecipesProps {
  /** Shows new / edit / submit / deactivate and the Excel upload (MANAGE_SILA_RECIPE). */
  canManage: boolean;
  /** Shows "Update price" on ingredients without an approved price (MANAGE_SILA_MASTER_DATA). */
  canRequestPrice?: boolean;
  /** Opens this recipe first (e.g. from the recipe dashboard). */
  openRecipeId?: string | null;
  /** Opens the editor for a new recipe first. */
  startNew?: boolean;
}

type View = { kind: "list" } | { kind: "detail"; recipeId: string } | { kind: "edit"; recipe: SilaRecipeDetail | null };

const PAGE_SIZE = 50;

/** Recipe master: paged list with filters, Excel template/export/import, editor, and detail with versions and approvals. */
const SilaRecipes: React.FC<SilaRecipesProps> = ({ canManage, canRequestPrice = false, openRecipeId, startNew = false }) => {
  const [view, setView] = useState<View>(() =>
    openRecipeId ? { kind: "detail", recipeId: openRecipeId } : startNew && canManage ? { kind: "edit", recipe: null } : { kind: "list" },
  );
  const [status, setStatus] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SilaRecipeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [families, setFamilies] = useState<SilaRecipeMaster[]>([]);
  const [categories, setCategories] = useState<SilaRecipeMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRecipes({ status, familyId, categoryId, search: appliedSearch, index: page - 1, limit: PAGE_SIZE });
      setRows(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the recipes.");
    } finally {
      setLoading(false);
    }
  }, [status, familyId, categoryId, appliedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Filter options; the list works without them.
  useEffect(() => {
    Promise.all([getRecipeMasters("families"), getRecipeMasters("categories")])
      .then(([loadedFamilies, loadedCategories]) => {
        setFamilies(loadedFamilies);
        setCategories(loadedCategories);
      })
      .catch(() => undefined);
  }, []);

  // Search as the user types, without a call per key stroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  if (view.kind === "edit") {
    return (
      <SilaRecipeEditor
        recipe={view.recipe}
        canRequestPrice={canRequestPrice}
        onCancel={() => setView(view.recipe ? { kind: "detail", recipeId: view.recipe.id } : { kind: "list" })}
        onSaved={(recipeId) => {
          load();
          setView({ kind: "detail", recipeId });
        }}
      />
    );
  }

  if (view.kind === "detail") {
    return (
      <SilaRecipeDetailView
        recipeId={view.recipeId}
        canManage={canManage}
        onBack={() => setView({ kind: "list" })}
        onEdit={(recipe) => setView({ kind: "edit", recipe })}
        onChanged={load}
      />
    );
  }

  const filtered = Boolean(status || familyId || categoryId || appliedSearch);

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="Recipe master"
        description="Menu items, serving, costing and Material Master ingredients. A recipe without an approved price for every ingredient shows INCOMPLETE."
        actions={
          <div className="srec-actions">
            <SilaRecipeExcelPanel
              noun="recipe"
              canImport={canManage}
              onTemplate={downloadRecipeTemplate}
              onExport={exportRecipes}
              onPreview={previewRecipeImport}
              onConfirm={confirmRecipeImport}
              onImported={load}
            />
            {canManage && (
              <button type="button" className="sila-btn sila-btn--primary" onClick={() => setView({ kind: "edit", recipe: null })}>
                New recipe
              </button>
            )}
          </div>
        }
      />

      <section className="sila-card">
        <div className="srec-filters">
          <div className="sila-field srec-grow">
            <label className="sila-label" htmlFor="srec-search">Search</label>
            <input
              id="srec-search"
              className="sila-input"
              type="search"
              placeholder="Recipe code, name or POS code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srec-status">Status</label>
            <select id="srec-status" className="sila-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {RECIPE_STATUSES.map((code) => (
                <option key={code} value={code}>{recipeLabel(code)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srec-family-filter">Family</label>
            <select id="srec-family-filter" className="sila-select" value={familyId} onChange={(e) => { setFamilyId(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>{family.name}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srec-category-filter">Category</label>
            <select id="srec-category-filter" className="sila-select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <Loader size={24} message="Loading recipes..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load recipes"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 && page === 1 ? (
          <EmptyState title={filtered ? "No recipe matches" : "No recipes yet"} />
        ) : (
          <>
            <SilaRecipeTable rows={rows} onOpen={(recipeId) => setView({ kind: "detail", recipeId })} />
            <Pagination
              page={page}
              hasNext={page * PAGE_SIZE < total}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => current + 1)}
              disabled={loading}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default SilaRecipes;
