import React, { useState } from "react";
import { EmptyState } from "@vosox/shared-ui";
import type { SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { costPercent, costPerServing, formatCost, formatPercent, marginPercent } from "./recipeFormat";

interface SilaRecipeOutletPricesProps {
  outlets: SilaLocation[];
  /** Menu price text per outlet location id. A key means the outlet is assigned; empty = assigned, price not entered. */
  prices: Record<string, string>;
  /** Recipe cost at an outlet (its own material prices); null while incomplete (cost % and margin are not shown there). */
  costAt: (outletLocationId: string) => number | null;
  /** Servings the recipe makes: cost % and margin use the cost of one serving. */
  servingQty: number;
  onChange: (outletLocationId: string, value: string) => void;
  onRemove: (outletLocationId: string) => void;
}

const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Menu price per outlet with the live cost %, margin and margin % of the cost of one serving (recipe cost / serving qty),
 * INCOMPLETE or NO MENU PRICE otherwise.
 */
const SilaRecipeOutletPrices: React.FC<SilaRecipeOutletPricesProps> = ({ outlets, prices, costAt, servingQty, onChange, onRemove }) => {
  const [term, setTerm] = useState("");
  const assigned = outlets.filter((outlet) => Object.prototype.hasOwnProperty.call(prices, outlet.id));
  const query = term.trim().toUpperCase();
  const matches = query.length === 0
    ? []
    : outlets
        .filter((outlet) => !Object.prototype.hasOwnProperty.call(prices, outlet.id)
          && `${outlet.locationCode} ${outlet.locationName} ${outlet.propertyName ?? ""}`.toUpperCase().includes(query))
        .slice(0, 8);

  return (
  <section className="sila-card">
    <div className="sila-card-header">
      <h2 className="sila-card-title">Outlet assignment</h2>
    </div>
    <div className="sila-card-body srec-stack">
      <label className="sila-label" htmlFor="srec-outlet-search">Assign outlets</label>
      <input
        id="srec-outlet-search"
        className="sila-input"
        value={term}
        placeholder="Search outlet code or name"
        onChange={(event) => setTerm(event.target.value)}
      />
      {matches.length > 0 && (
        <ul className="srec-assign-list">
          {matches.map((outlet) => (
            <li key={outlet.id}>
              <button
                type="button"
                className="srec-assign"
                onClick={() => {
                  onChange(outlet.id, "");
                  setTerm("");
                }}
              >
                <span>
                  <strong>{outlet.locationCode}</strong>
                  <span className="srec-sub">{outlet.locationName}</span>
                </span>
                <em>Assign</em>
              </button>
            </li>
          ))}
        </ul>
      )}
      {assigned.length > 0 && (
        <div className="srec-chips">
          {assigned.map((outlet) => (
            <button key={outlet.id} type="button" className="sila-badge sila-badge--neutral" onClick={() => onRemove(outlet.id)}>
              {outlet.locationCode} ×
            </button>
          ))}
        </div>
      )}
    </div>
    {outlets.length === 0 ? (
      <div className="sila-card-body">
        <EmptyState title="No outlet locations" description="Create locations of type Outlet in the location master first." />
      </div>
    ) : assigned.length === 0 ? null : (
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">Outlet</th>
              <th scope="col">Menu price</th>
              <th scope="col" className="srec-num">Cost / serving (at this outlet)</th>
              <th scope="col" className="srec-num">Cost %</th>
              <th scope="col" className="srec-num">Margin</th>
              <th scope="col" className="srec-num">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {assigned.map((outlet) => {
              const value = prices[outlet.id] ?? "";
              const price = toNumber(value);
              const outletCost = costAt(outlet.id);
              const perServing = outletCost == null ? null : costPerServing(outletCost, servingQty);
              const margin = perServing == null ? null : marginPercent(perServing, price);
              return (
                <tr key={outlet.id}>
                  <td>
                    <span className="sila-cell-strong">{outlet.locationName}</span>
                    <span className="srec-sub">{outlet.locationCode} · {outlet.propertyName}</span>
                  </td>
                  <td>
                    <input
                      className="sila-input srec-cell-input"
                      type="number"
                      min="0"
                      step="any"
                      aria-label={`Menu price at ${outlet.locationName}`}
                      placeholder="Not sold"
                      value={value}
                      onChange={(e) => onChange(outlet.id, e.target.value)}
                    />
                  </td>
                  {perServing == null || !(price > 0) ? (
                    <td colSpan={4} className="srec-num">
                      <span className="sila-me-flag">{perServing == null ? "Incomplete" : "No menu price"}</span>
                    </td>
                  ) : (
                    <>
                      <td className="srec-num">{formatCost(perServing)}</td>
                      <td className="srec-num">{formatPercent(costPercent(perServing, price))}</td>
                      <td className={`srec-num${price - perServing < 0 ? " srec-negative" : ""}`}>{formatCost(price - perServing)}</td>
                      <td className={`srec-num${margin != null && margin < 0 ? " srec-negative" : ""}`}>{formatPercent(margin)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
  );
};

export default SilaRecipeOutletPrices;
