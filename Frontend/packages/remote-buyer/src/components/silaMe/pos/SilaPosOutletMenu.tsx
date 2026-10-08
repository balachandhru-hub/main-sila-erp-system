import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination } from "@vosox/shared-ui";
import { getOutletMenuItems, type SilaPosOutletMapping, type SilaPosOutletMenuItem, type SilaPosPage } from "../../../api/silaMe/silaPosMasterApi";
import { formatCost, formatPercent } from "../recipes/recipeFormat";
import { errorText } from "./posFormat";

interface SilaPosOutletMenuProps {
  sourceId: string;
  outlet: SilaPosOutletMapping;
  onClose: () => void;
}

const PAGE_SIZE = 25;

/**
 * The menu of a POS outlet: recipes whose selling version has a menu price at the outlet location, with cost per serving,
 * cost %, margin % and the POS item mapped to the recipe. Prices are maintained on the recipe.
 */
const SilaPosOutletMenu: React.FC<SilaPosOutletMenuProps> = ({ sourceId, outlet, onClose }) => {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SilaPosPage<SilaPosOutletMenuItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getOutletMenuItems(sourceId, outlet.id, appliedSearch, (page - 1) * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setData(null);
      setError(errorText(err, "Could not load the outlet menu."));
    } finally {
      setLoading(false);
    }
  }, [sourceId, outlet.id, appliedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rows = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <section className="sila-card" aria-label={`Menu of POS outlet ${outlet.posOutletCode}`}>
      <div className="sila-card-header">
        <h2 className="sila-card-title">
          Menu items · {outlet.posOutletCode}
          {outlet.locationName ? ` (${outlet.locationName})` : ""}
        </h2>
        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={onClose} aria-label="Close the outlet menu">
          Close
        </button>
      </div>
      <div className="sila-card-body srec-stack">
        <div className="sila-field">
          <label className="sila-label" htmlFor="spos-menu-search">Search</label>
          <input id="spos-menu-search" className="sila-input" type="search" placeholder="Recipe, POS code or POS item" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="sila-help">Menu prices are maintained on the recipe (menu price per outlet) and go through recipe approval.</span>
      </div>
      {loading ? (
        <Loader size={20} message="Loading the menu..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the menu"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={appliedSearch ? "Nothing matches" : "No menu items"} description="No approved recipe has a menu price at this outlet location." />
      ) : (
        <>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Recipe</th>
                  <th scope="col">POS code / item</th>
                  <th scope="col">POS item mapping</th>
                  <th scope="col" className="srec-num">Menu price</th>
                  <th scope="col" className="srec-num">Cost / serving</th>
                  <th scope="col" className="srec-num">Cost %</th>
                  <th scope="col" className="srec-num">Margin %</th>
                  <th scope="col">Last sale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.recipeId}>
                    <td>
                      <span className="sila-cell-strong">{item.recipeCode}</span>
                      <span className="srec-sub">{item.name} · v{item.activeVersion}</span>
                    </td>
                    <td>
                      {item.posCode || "—"}
                      {item.posItem && <span className="srec-sub">{item.posItem}</span>}
                    </td>
                    <td>
                      {item.posItemCode || <span className="sila-cell-muted">By POS code</span>}
                      {item.posItemDescription && <span className="srec-sub">{item.posItemDescription}</span>}
                    </td>
                    <td className="srec-num">{formatCost(item.menuPrice, item.currency)}</td>
                    <td className="srec-num">{formatCost(item.costPerServing, item.currency)}</td>
                    <td className="srec-num">{formatPercent(item.costPercent)}</td>
                    <td className={`srec-num${(item.marginPercent ?? 0) < 0 ? " srec-negative" : ""}`}>{formatPercent(item.marginPercent)}</td>
                    <td>{item.lastSaleDate ? item.lastSaleDate.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            summary={`${data?.total ?? 0} menu item${data?.total === 1 ? "" : "s"}`}
            disabled={loading}
          />
        </>
      )}
    </section>
  );
};

export default SilaPosOutletMenu;
