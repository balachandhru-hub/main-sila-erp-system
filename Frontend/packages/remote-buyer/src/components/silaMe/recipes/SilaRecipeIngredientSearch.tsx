import React, { useEffect, useState } from "react";
import { Loader } from "@vosox/shared-ui";
import {
  getIngredientFacets,
  searchIngredients,
  type SilaIngredientFacets,
  type SilaIngredientOption,
} from "../../../api/silaMe/silaRecipeToolsApi";
import { conversionSummary, priceStatusBadgeClass, priceStatusLabel, unitPriceText } from "./recipeFormat";

interface SilaRecipeIngredientSearchProps {
  /** Materials already in the recipe (shown as added). */
  addedIds: string[];
  onAdd: (material: SilaIngredientOption) => void;
}

const EMPTY_FACETS: SilaIngredientFacets = { materialGroups: [], categories: [], suppliers: [], materialTypes: [], supplierOptions: [] };
const RESULT_LIMIT = 20;

/**
 * Item Master search for ingredients: text (code, description, material group or supplier name) plus material group,
 * category, material type and supplier filters (a supplier of the master is filtered by id, so its aliases count).
 * Searches once there is a term of two characters or a filter.
 */
const SilaRecipeIngredientSearch: React.FC<SilaRecipeIngredientSearchProps> = ({ addedIds, onAdd }) => {
  const [facets, setFacets] = useState<SilaIngredientFacets>(EMPTY_FACETS);
  const [search, setSearch] = useState("");
  const [materialGroup, setMaterialGroup] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [results, setResults] = useState<SilaIngredientOption[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Filter values; the text search works without them.
  useEffect(() => {
    getIngredientFacets().then(setFacets).catch(() => setFacets(EMPTY_FACETS));
  }, []);

  const term = search.trim();
  const active = term.length >= 2 || Boolean(materialGroup || category || supplier || materialType);
  // The supplier select value is "id:<id>" for a supplier of the master, otherwise "name:<name>".
  const supplierId = supplier.startsWith("id:") ? supplier.slice(3) : undefined;
  const supplierName = supplier.startsWith("name:") ? supplier.slice(5) : undefined;

  useEffect(() => {
    if (!active) {
      setResults([]);
      setTotal(0);
      setSearchError(null);
      return undefined;
    }
    let current = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const page = await searchIngredients({
          search: term,
          materialGroup,
          category,
          materialType,
          supplier: supplierName,
          supplierId,
          limit: RESULT_LIMIT,
        });
        if (current) {
          setResults(page.items);
          setTotal(page.total);
        }
      } catch (err: unknown) {
        if (current) setSearchError(err instanceof Error ? err.message : "Could not search the materials.");
      } finally {
        if (current) setSearching(false);
      }
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [active, term, materialGroup, category, materialType, supplierName, supplierId]);

  const added = new Set(addedIds.map((id) => id.toLowerCase()));

  return (
    <div className="srec-stack">
      <div className="srec-filters srec-filters--flush">
        <div className="sila-field srec-grow">
          <label className="sila-label" htmlFor="srec-ingredient-search">Add ingredient from Material Master</label>
          <input
            id="srec-ingredient-search"
            className="sila-input"
            type="search"
            placeholder="Search Material ID or name; filter by group, category or supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-ingredient-group">Material group</label>
          <select id="srec-ingredient-group" className="sila-select" value={materialGroup} onChange={(e) => setMaterialGroup(e.target.value)}>
            <option value="">All</option>
            {facets.materialGroups.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-ingredient-category">Category</label>
          <select id="srec-ingredient-category" className="sila-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {facets.categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-ingredient-type">Material type</label>
          <select id="srec-ingredient-type" className="sila-select" value={materialType} onChange={(e) => setMaterialType(e.target.value)}>
            <option value="">All</option>
            {facets.materialTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-ingredient-supplier">Supplier</label>
          <select id="srec-ingredient-supplier" className="sila-select" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">All</option>
            {facets.supplierOptions.length > 0
              ? facets.supplierOptions.map((option) => (
                <option key={option.id ?? option.name} value={option.id ? `id:${option.id}` : `name:${option.name}`}>
                  {option.code ? `${option.code} · ${option.name}` : option.name}
                </option>
              ))
              : facets.suppliers.map((value) => <option key={value} value={`name:${value}`}>{value}</option>)}
          </select>
        </div>
      </div>

      {!active ? null : searching ? (
        <Loader size={20} message="Searching..." />
      ) : searchError ? (
        <div className="sila-alert sila-alert--danger" role="alert">{searchError}</div>
      ) : results.length === 0 ? (
        <span className="sila-help">No materials matched.</span>
      ) : (
        <div className="sila-table-wrap srec-search-results">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Group / category</th>
                <th scope="col">Base UOM / pack</th>
                <th scope="col" className="srec-num">Unit price</th>
                <th scope="col">Price status</th>
                <th scope="col">Suppliers</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {results.map((material) => {
                const isAdded = added.has(material.id.toLowerCase());
                return (
                  <tr key={material.id}>
                    <td>
                      <span className="sila-cell-strong">{material.materialCode}</span>
                      <span className="srec-sub">{material.description}</span>
                    </td>
                    <td>
                      {material.materialGroup || "—"}
                      <span className="srec-sub">{material.category || "—"}</span>
                    </td>
                    <td>
                      {material.baseUom}
                      <span className="srec-sub">{conversionSummary(material)}</span>
                    </td>
                    <td className="srec-num">{unitPriceText(material.priceStatus, material.unitCost, material.currency, material.baseUom)}</td>
                    <td><span className={priceStatusBadgeClass(material.priceStatus)}>{priceStatusLabel(material.priceStatus)}</span></td>
                    <td className="srec-message">{material.suppliers.join(", ") || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        disabled={isAdded}
                        aria-label={isAdded ? `${material.materialCode} added` : `Add ${material.materialCode}`}
                        onClick={() => onAdd(material)}
                      >
                        {isAdded ? "Added" : material.priceStatus === "MISSING" && !material.outletPrices?.length ? "Price missing · Add" : "Add"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > results.length && <span className="sila-help">Showing {results.length} of {total}. Refine the search to narrow it down.</span>}
        </div>
      )}
    </div>
  );
};

export default SilaRecipeIngredientSearch;
