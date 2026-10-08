import React, { useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { getLocations, type SilaLocation, type SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import {
  createRecipe,
  getRecipeUoms,
  getRecipes,
  submitRecipe,
  updateRecipe,
  type SilaRecipeDetail,
  type SilaRecipeListItem,
  type SilaRecipeWrite,
} from "../../../api/silaMe/silaRecipeApi";
import { getRecipeMasters, type SilaIngredientOption, type SilaRecipeMaster } from "../../../api/silaMe/silaRecipeToolsApi";
import SilaMaterialPricePanel from "../materials/SilaMaterialPricePanel";
import {
  editorIssues,
  headerFrom,
  lineCost,
  linesFrom,
  materialFromOption,
  nextKey,
  toNumber,
  totalCostAt,
  type HeaderValues,
  type IngredientLine,
  type IngredientMaterial,
} from "./recipeEditorModel";
import { formatQty, readinessBadgeClass, readinessLabel, recipeBadgeClass, recipeLabel, versionsSummary } from "./recipeFormat";
import SilaRecipeCostSummary from "./SilaRecipeCostSummary";
import SilaRecipeHeaderForm from "./SilaRecipeHeaderForm";
import SilaRecipeIngredientSearch from "./SilaRecipeIngredientSearch";
import SilaRecipeIngredientTable from "./SilaRecipeIngredientTable";
import SilaRecipeOutletPrices from "./SilaRecipeOutletPrices";
import SilaRecipeReadinessPanel from "./SilaRecipeReadinessPanel";

interface SilaRecipeEditorProps {
  /** The recipe (latest version) to edit; a new recipe when absent. */
  recipe?: SilaRecipeDetail | null;
  /** Shows "Update price" on material lines (MANAGE_SILA_MASTER_DATA). */
  canRequestPrice?: boolean;
  onCancel: () => void;
  onSaved: (recipeId: string) => void;
}

type Saving = "" | "draft" | "submit";

const asPanelMaterial = (material: IngredientMaterial): SilaMaterial => ({
  id: material.id,
  materialCode: material.materialCode,
  description: material.description,
  baseUom: material.baseUom,
  unitCost: material.unitCost,
  currency: material.currency,
  isInventoryItem: false,
  priceStatus: material.priceStatus,
  conversions: material.conversions,
});

/** Create or edit a recipe: menu item, ingredients with live cost and readiness, and the menu price per outlet. */
const SilaRecipeEditor: React.FC<SilaRecipeEditorProps> = ({ recipe, canRequestPrice = false, onCancel, onSaved }) => {
  const [header, setHeader] = useState<HeaderValues>(() => headerFrom(recipe));
  const [lines, setLines] = useState<IngredientLine[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries((recipe?.outletPrices ?? []).map((price) => [price.outletLocationId, String(price.menuPrice)])),
  );
  const [outlets, setOutlets] = useState<SilaLocation[]>([]);
  const [subRecipes, setSubRecipes] = useState<SilaRecipeListItem[]>([]);
  const [families, setFamilies] = useState<SilaRecipeMaster[]>([]);
  const [categories, setCategories] = useState<SilaRecipeMaster[]>([]);
  const [uoms, setUoms] = useState<string[]>([]);
  const [subRecipeId, setSubRecipeId] = useState("");
  const [priceMaterial, setPriceMaterial] = useState<IngredientMaterial | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Saving>("");
  // Outlet whose material prices cost the ingredients; null = the first outlet with a menu price, else the default prices.
  const [costingOutlet, setCostingOutlet] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [locations, approved, loadedFamilies, loadedCategories, loadedUoms] = await Promise.all([
          getLocations(),
          getRecipes({ active: true, limit: 200 }),
          getRecipeMasters("families"),
          getRecipeMasters("categories"),
          getRecipeUoms(),
        ]);
        if (!active) return;
        const loaded = linesFrom(recipe, approved.items);
        const dropped = (recipe?.ingredients.length ?? 0) - loaded.length;
        if (dropped > 0) toastService.error(`${dropped} sub-recipe(s) are no longer approved and were removed from the editor.`);
        setLines(loaded);
        setOutlets(locations.filter((location) => location.locationType === "OUTLET"));
        setSubRecipes(approved.items.filter((x) => x.id !== recipe?.id));
        setFamilies(loadedFamilies);
        setCategories(loadedCategories);
        setUoms(loadedUoms);
      } catch (err: unknown) {
        if (active) setLoadError(err instanceof Error ? err.message : "Could not load the recipe editor.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [recipe]);

  const pricedOutletIds = useMemo(() => Object.keys(prices).filter((id) => prices[id].trim() !== ""), [prices]);
  const pricedOutlets = pricedOutletIds.length;
  const activeOutlet = costingOutlet ?? pricedOutletIds[0] ?? "";
  const activeOutletName = outlets.find((outlet) => outlet.id === activeOutlet)?.locationName;
  const costs = useMemo(() => lines.map((line) => lineCost(line, activeOutlet)), [lines, activeOutlet]);
  const issues = editorIssues(lines, header.itemMode, pricedOutletIds);
  const costComplete = lines.length > 0 && costs.every((cost) => cost.cost != null);
  const totalCost = totalCostAt(lines, activeOutlet);
  const currency = header.currency.trim() || lines.find((line) => line.material?.currency)?.material?.currency || "";

  const addMaterial = (option: SilaIngredientOption) => {
    const material = materialFromOption(option);
    const line: IngredientLine = { key: nextKey(), material, quantity: "1", uom: material.baseUom.toUpperCase() };
    if (header.itemMode === "DIRECT") {
      // A direct item has one material: a new one replaces it.
      setLines([line]);
      return;
    }
    setLines((current) => (current.some((x) => x.material?.id === material.id) ? current : [...current, line]));
  };

  const addSubRecipe = () => {
    const sub = subRecipes.find((x) => x.id === subRecipeId);
    if (!sub || lines.some((line) => line.subRecipe?.id === sub.id)) return;
    setLines((current) => [...current, { key: nextKey(), subRecipe: sub, quantity: "1", uom: sub.servingUom }]);
    setSubRecipeId("");
  };

  const changeHeader = (change: Partial<HeaderValues>) => {
    setHeader((current) => ({ ...current, ...change }));
    if (change.itemMode === "DIRECT") setLines((current) => current.filter((line) => line.material).slice(0, 1));
    if (change.itemMode && change.itemMode !== "BATCH") setLines((current) => current.filter((line) => !line.subRecipe));
  };

  const validate = (): string | null => {
    if (!header.name.trim()) return "Enter the recipe name.";
    if (!(toNumber(header.servingQty) > 0) || !header.servingUom.trim()) return "Enter a serving quantity greater than zero and its unit.";
    if (lines.length === 0) return "Add at least one ingredient.";
    if (lines.some((line) => !(toNumber(line.quantity) > 0))) return "Enter a quantity greater than zero for every ingredient.";
    if (Object.values(prices).some((value) => value.trim() !== "" && !(toNumber(value) > 0))) {
      return "Menu prices must be greater than zero (leave empty when not sold at an outlet).";
    }
    return null;
  };

  const buildRequest = (): SilaRecipeWrite => ({
    name: header.name.trim(),
    description: header.description.trim() || null,
    familyId: header.familyId || null,
    categoryId: header.categoryId || null,
    itemMode: header.itemMode,
    servingQty: toNumber(header.servingQty),
    servingUom: header.servingUom.trim(),
    sellingUom: header.sellingUom.trim() || "EA",
    posCode: header.posCode.trim() || null,
    posItem: header.posItem.trim() || null,
    currency: header.currency.trim() || null,
    ingredients: lines.map((line) => ({
      materialId: line.material?.id ?? null,
      subRecipeId: line.subRecipe?.id ?? null,
      quantity: toNumber(line.quantity),
      uom: line.uom || null,
    })),
    outletPrices: Object.entries(prices)
      .filter(([, value]) => value.trim() !== "")
      .map(([outletLocationId, value]) => ({ outletLocationId, menuPrice: toNumber(value) })),
  });

  const handleSave = async (submit: boolean) => {
    const problem = validate();
    if (problem) {
      toastService.error(problem);
      return;
    }
    setSaving(submit ? "submit" : "draft");
    let recipeId = recipe?.id ?? null;
    try {
      if (recipe) {
        await updateRecipe(recipe.id, buildRequest());
      } else {
        recipeId = await createRecipe(buildRequest());
      }
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the recipe.");
      setSaving("");
      return;
    }
    const newVersion = recipe && (recipe.status === "APPROVED" || recipe.status === "REJECTED");
    try {
      if (submit && recipeId) {
        await submitRecipe(recipeId);
        toastService.success("Recipe saved and sent for approval.");
      } else {
        toastService.success(newVersion ? `Saved as draft version ${(recipe?.version ?? 0) + 1}.` : "Recipe saved as draft.");
      }
    } catch (err: unknown) {
      toastService.error(`Saved as draft, but not sent for approval: ${err instanceof Error ? err.message : "the submit failed."}`);
    } finally {
      setSaving("");
    }
    if (recipeId) onSaved(recipeId);
  };

  const title = recipe ? `Edit ${recipe.recipeCode} ${recipe.name}` : "New recipe";

  if (loading || loadError) {
    return (
      <div className="sila-me srec-page">
        <PageHeader className="pud-page-header" title={title} onBack={onCancel} />
        {loading ? <Loader size={24} message="Loading..." /> : <EmptyState variant="error" title="Couldn't open the editor" description={loadError ?? undefined} />}
      </div>
    );
  }

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title={title}
        description="Define the menu item, then build the ingredients from Material Master."
        meta={
          <span className="srec-badges">
            <span className={recipeBadgeClass(recipe?.status ?? "DRAFT")}>{recipeLabel(recipe?.status ?? "DRAFT")}</span>
            <span className={readinessBadgeClass(issues.length)}>{readinessLabel(issues.length)}</span>
          </span>
        }
        onBack={onCancel}
        backLabel="Back to recipes"
        actions={
          <div className="srec-actions">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={onCancel} disabled={saving !== ""}>Cancel</button>
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => handleSave(false)} disabled={saving !== ""}>
              {saving === "draft" ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              className="sila-btn sila-btn--primary"
              onClick={() => handleSave(true)}
              disabled={saving !== "" || issues.length > 0}
              title={issues.length > 0 ? "Fix the readiness issues first." : undefined}
            >
              {saving === "submit" ? "Submitting..." : recipe?.activeVersion ? "Submit POS / recipe change" : "Submit for approval"}
            </button>
          </div>
        }
      />

      {recipe && recipe.activeVersion > 0 && (recipe.status === "APPROVED" || recipe.status === "REJECTED") && (
        <div className="sila-alert sila-alert--warning" role="status">
          Saving creates draft version {recipe.version + 1}. POS sales keep using version {recipe.activeVersion} until it is approved.
        </div>
      )}

      {recipe && recipe.versions.length > 0 && <span className="sila-help">Versions: {versionsSummary(recipe.versions)}</span>}

      <SilaRecipeReadinessPanel readiness={{ ready: issues.length === 0, costComplete, issues }} />
      <SilaRecipeHeaderForm
        values={header}
        families={families}
        categories={categories}
        recipeCode={recipe?.recipeCode}
        uoms={uoms}
        lastSaleDate={recipe?.lastSaleDate}
        onChange={changeHeader}
      />
      <SilaRecipeCostSummary
        totalCost={totalCost}
        servingQty={toNumber(header.servingQty)}
        servingUom={header.servingUom}
        currency={currency}
        pricedOutlets={pricedOutlets}
        priceStatuses={costs.filter((_, index) => lines[index].material).map((cost) => cost.priceStatus)}
        costBasis={activeOutletName ?? "Default prices"}
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">{header.itemMode === "DIRECT" ? "Direct consumption" : "Ingredients / consumption"}</h2>
        </div>
        <div className="sila-card-body srec-stack">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srec-costing-outlet">Show material prices of</label>
            <select
              id="srec-costing-outlet"
              className="sila-select"
              value={activeOutlet}
              onChange={(e) => setCostingOutlet(e.target.value)}
            >
              <option value="">Default prices</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>{outlet.locationName}</option>
              ))}
            </select>
            <span className="sila-help">Material prices come from Material Master and can differ per outlet. The cost below uses the prices of this outlet.</span>
          </div>
          <SilaRecipeIngredientSearch addedIds={lines.filter((x) => x.material).map((x) => x.material!.id)} onAdd={addMaterial} />
          {header.itemMode === "BATCH" && (
            <div className="srec-filters srec-filters--flush">
              <div className="sila-field srec-grow">
                <label className="sila-label" htmlFor="srec-sub-recipe">Add an approved sub-recipe</label>
                <select id="srec-sub-recipe" className="sila-select" value={subRecipeId} onChange={(e) => setSubRecipeId(e.target.value)}>
                  <option value="">Select a recipe</option>
                  {subRecipes.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.recipeCode} {sub.name} ({formatQty(sub.servingQty)} {sub.servingUom})</option>
                  ))}
                </select>
              </div>
              <button type="button" className="sila-btn sila-btn--secondary" onClick={addSubRecipe} disabled={!subRecipeId}>Add sub-recipe</button>
            </div>
          )}
          {lines.length === 0 ? (
            <EmptyState
              title="No ingredients yet"
              description={`Search Material Master and add ${header.itemMode === "DIRECT" ? "the consumption material" : "an ingredient"}. A missing price does not block a draft.`}
            />
          ) : (
            <SilaRecipeIngredientTable
              lines={lines}
              costs={costs}
              mode={header.itemMode}
              totalCost={totalCost}
              currency={currency}
              onChange={(key, change) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)))}
              onRemove={(key) => setLines((current) => current.filter((line) => line.key !== key))}
              onUpdatePrice={canRequestPrice ? setPriceMaterial : undefined}
            />
          )}
        </div>
      </section>

      <SilaRecipeOutletPrices
        outlets={outlets}
        prices={prices}
        costAt={(outletId) => totalCostAt(lines, outletId)}
        servingQty={toNumber(header.servingQty)}
        onChange={(id, value) => setPrices((current) => ({ ...current, [id]: value }))}
      />

      {priceMaterial && (
        <SilaMaterialPricePanel
          material={asPanelMaterial(priceMaterial)}
          canRequest={canRequestPrice}
          outlets={outlets}
          outletPrices={priceMaterial.outletPrices}
          defaultOutletId={activeOutlet}
          onClose={() => setPriceMaterial(null)}
          onSubmitted={() => {
            const id = priceMaterial.id;
            setLines((current) =>
              current.map((line) => (line.material?.id === id ? { ...line, material: { ...line.material, priceStatus: "PENDING_APPROVAL" } } : line)),
            );
            setPriceMaterial(null);
          }}
        />
      )}
    </div>
  );
};

export default SilaRecipeEditor;
