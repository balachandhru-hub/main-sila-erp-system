import React from "react";
import { formatCost, priceNotes } from "./recipeFormat";

interface SilaRecipeCostSummaryProps {
  /** Recipe cost; null while incomplete. */
  totalCost: number | null;
  servingQty: number;
  servingUom: string;
  currency?: string | null;
  /** Number of outlets with a menu price. */
  pricedOutlets: number;
  /** Price status of every material line (APPROVED | MISSING | PENDING_APPROVAL). */
  priceStatuses: (string | null | undefined)[];
}

/** Cost & profitability: recipe cost and cost per serving (or INCOMPLETE), menu prices (or NO MENU PRICE) and the price notes. */
const SilaRecipeCostSummary: React.FC<SilaRecipeCostSummaryProps> = ({ totalCost, servingQty, servingUom, currency, pricedOutlets, priceStatuses }) => {
  const notes = priceNotes(priceStatuses);
  const incomplete = <span className="sila-me-flag">Incomplete</span>;
  const items: [string, React.ReactNode][] = [
    ["Recipe / item cost", totalCost == null ? incomplete : formatCost(totalCost, currency)],
    [`Cost / serving (${servingUom || "—"})`, totalCost == null || !(servingQty > 0) ? incomplete : formatCost(totalCost / servingQty, currency)],
    ["Menu prices", pricedOutlets > 0 ? `${pricedOutlets} outlet${pricedOutlets === 1 ? "" : "s"}` : <span className="sila-me-flag">No menu price</span>],
  ];

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Cost &amp; profitability</h2>
      </div>
      <div className="sila-card-body srec-stack">
        <div className="sila-meta-grid">
          {items.map(([label, value]) => (
            <div className="sila-meta-item" key={label}>
              <span className="sila-meta-label">{label}</span>
              <span className="sila-meta-value">{value}</span>
            </div>
          ))}
        </div>
        {notes.length > 0 && <span className="sila-me-flag">{notes.join(" · ")}</span>}
        <span className="sila-help">Cost % and margin compare the cost of one serving with each outlet's menu price.</span>
      </div>
    </section>
  );
};

export default SilaRecipeCostSummary;
