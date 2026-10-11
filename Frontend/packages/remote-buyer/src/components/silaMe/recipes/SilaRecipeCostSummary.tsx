import React from "react";
import { costPercent, costPerServing, formatCost, formatPercent, marginPercent, priceNotes } from "./recipeFormat";

export interface RecipeCostBreakup {
  name: string;
  /** Line cost; null while the line cannot be costed. */
  cost: number | null;
}

interface SilaRecipeCostSummaryProps {
  /** Recipe cost; null while incomplete. */
  totalCost: number | null;
  servingQty: number;
  servingUom: string;
  currency?: string | null;
  /** Number of outlets with a menu price. */
  pricedOutlets: number;
  /** Menu price text. Saved on the named outlet, or held until an outlet is assigned. */
  menuPrice: string;
  /** Absent on the read-only recipe view. */
  onMenuPrice?: (value: string) => void;
  /** Outlet this menu price is saved on; empty until one is assigned. */
  menuOutlet?: string;
  /** Price status of every material line (APPROVED | MISSING | PENDING_APPROVAL). */
  priceStatuses: (string | null | undefined)[];
  /** Where the cost is priced, e.g. "Outlet X" or "Default prices". */
  costBasis?: string;
  /** Ingredient cost and its share of the recipe cost. */
  breakup?: RecipeCostBreakup[];
}

const Incomplete = () => <span className="sila-me-flag">Incomplete</span>;
const NoMenuPrice = () => <span className="sila-me-flag">No menu price</span>;

/** Cost & profitability: menu price, cost of one serving, cost %, margin, and the ingredient cost split. */
const SilaRecipeCostSummary: React.FC<SilaRecipeCostSummaryProps> = ({
  totalCost,
  servingQty,
  servingUom,
  currency,
  pricedOutlets,
  menuPrice,
  onMenuPrice,
  menuOutlet,
  priceStatuses,
  costBasis,
  breakup = [],
}) => {
  const notes = priceNotes(priceStatuses);
  const price = Number(menuPrice);
  const hasPrice = menuPrice.trim() !== "" && Number.isFinite(price) && price > 0;
  const perServing = totalCost == null ? null : costPerServing(totalCost, servingQty);
  const percent = perServing == null || !hasPrice ? null : costPercent(perServing, price);
  const margin = perServing == null || !hasPrice ? null : price - perServing;
  const marginPct = perServing == null || !hasPrice ? null : marginPercent(perServing, price);
  const profit = (value: React.ReactNode) => (totalCost == null ? <Incomplete /> : hasPrice ? value : <NoMenuPrice />);
  const items: [string, React.ReactNode][] = [
    ["Recipe / item cost", totalCost == null ? <Incomplete /> : formatCost(totalCost, currency)],
    [`Cost / serving (${servingUom || "—"})`, perServing == null ? <Incomplete /> : formatCost(perServing, currency)],
    ["Cost %", profit(formatPercent(percent))],
    ["Margin amount", profit(formatCost(margin, currency))],
    ["Margin %", profit(formatPercent(marginPct))],
  ];
  if (!onMenuPrice) items.unshift(["Menu price", hasPrice ? formatCost(price, currency) : <NoMenuPrice />]);

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Cost &amp; profitability</h2>
      </div>
      <div className="sila-card-body srec-stack">
        {onMenuPrice ? (
          <label className="sila-field" htmlFor="srec-menu-price">
            <span className="sila-label">Menu price</span>
            <input
              id="srec-menu-price"
              className="sila-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              data-testid="input-menu-price"
              value={menuPrice}
              placeholder="0.00"
              onChange={(event) => onMenuPrice(event.target.value)}
            />
          </label>
        ) : null}
        <span className="sila-help">
          {menuOutlet
            ? `Menu price is for ${menuOutlet}${pricedOutlets > 1 ? `. ${pricedOutlets} outlets are priced; the list shows the lowest.` : "."}`
            : onMenuPrice
              ? "Assign an outlet below to keep this price. Cost % and margin use it now."
              : "No outlet is priced, so cost % and margin stay empty."}
        </span>
        <div className="sila-meta-grid">
          {items.map(([label, value]) => (
            <div className="sila-meta-item" key={label}>
              <span className="sila-meta-label">{label}</span>
              <span className="sila-meta-value">{value}</span>
            </div>
          ))}
        </div>
        {notes.length > 0 && <span className="sila-me-flag">{notes.join(" · ")}</span>}
        {costBasis && <span className="sila-help">Costed with the material prices of: {costBasis}.</span>}
        {breakup.length > 0 && (
          <div className="sila-table-wrap">
            <span className="sila-label">Ingredient cost breakup</span>
            <table className="sila-table">
              <caption className="sila-visually-hidden">Ingredient cost breakup</caption>
              <thead>
                <tr>
                  <th scope="col">Ingredient</th>
                  <th scope="col" className="srec-num">Cost</th>
                  <th scope="col" className="srec-num">Cost %</th>
                </tr>
              </thead>
              <tbody>
                {breakup.map((line, index) => {
                  const share = totalCost != null && totalCost > 0 && line.cost != null ? (line.cost / totalCost) * 100 : null;
                  return (
                    <tr key={`${line.name}-${index}`}>
                      <td>{line.name}</td>
                      <td className="srec-num">{line.cost == null ? <span className="sila-me-flag">Not calculated</span> : formatCost(line.cost, currency)}</td>
                      <td className="srec-num">{share == null ? <span className="sila-me-flag">Not calculated</span> : formatPercent(share)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default SilaRecipeCostSummary;
