import React from "react";
import type { SilaRecipeDetail } from "../../../api/silaMe/silaRecipeApi";
import { conversionSummary, costPerServing, formatCost, formatPercent, formatQty, priceStatusBadgeClass, priceStatusLabel } from "./recipeFormat";

interface SilaRecipeCostingProps {
  recipe: SilaRecipeDetail;
}

/** Saved ingredients with their costs, and the menu price, cost per serving, cost % and margin per outlet. */
const SilaRecipeCosting: React.FC<SilaRecipeCostingProps> = ({ recipe }) => {
  const perServing = recipe.costPerServing ?? costPerServing(recipe.totalCost, recipe.servingQty);
  return (
  <>
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">{recipe.itemMode === "DIRECT" ? "Direct consumption" : "Ingredients / consumption"}</h2>
        {recipe.readiness.costComplete ? (
          <span className="sila-badge sila-badge--neutral">Total cost {formatCost(recipe.totalCost, recipe.currency)}</span>
        ) : (
          <span className="sila-me-flag">Total cost incomplete</span>
        )}
      </div>
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">Ingredient ID</th>
              <th scope="col">Ingredient</th>
              <th scope="col">Material ID</th>
              <th scope="col" className="srec-num">Recipe qty</th>
              <th scope="col">Base UOM</th>
              <th scope="col">Pack / conversion</th>
              <th scope="col" className="srec-num">Unit price</th>
              <th scope="col">Price status</th>
              <th scope="col" className="srec-num">Inventory consumption</th>
              <th scope="col" className="srec-num">Ingredient cost</th>
              <th scope="col" className="srec-num">Cost %</th>
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td>{ingredient.ingredientCode}</td>
                <td>
                  {ingredient.itemName}
                  {ingredient.subRecipeId && <span className="srec-sub">Sub-recipe</span>}
                </td>
                <td className="sila-cell-strong">{ingredient.itemCode}</td>
                <td className="srec-num">{formatQty(ingredient.quantity)} {ingredient.uom}</td>
                <td>{ingredient.baseUom}</td>
                <td className="srec-message">{ingredient.materialId ? ingredient.packSummary || conversionSummary(ingredient) : "—"}</td>
                <td className="srec-num">
                  {formatCost(ingredient.unitCost, ingredient.currency)}
                  {ingredient.unitCost != null ? ` / ${ingredient.priceUom || ingredient.baseUom}` : ""}
                  {ingredient.proposedUnitPrice != null && (
                    <span className="srec-sub">Proposed {formatCost(ingredient.proposedUnitPrice, ingredient.currency)}</span>
                  )}
                </td>
                <td>
                  {ingredient.materialId ? (
                    <span className={priceStatusBadgeClass(ingredient.priceStatus)}>{priceStatusLabel(ingredient.priceStatus)}</span>
                  ) : (
                    "—"
                  )}
                  {ingredient.issue && <span className="srec-sub srec-negative">{ingredient.issue}</span>}
                </td>
                <td className="srec-num">{formatQty(ingredient.baseQuantity)} {ingredient.baseUom}</td>
                <td className="srec-num">{formatCost(ingredient.cost)}</td>
                <td className="srec-num">
                  {recipe.readiness.costComplete && recipe.totalCost > 0 ? (
                    `${((ingredient.cost / recipe.totalCost) * 100).toFixed(2)}%`
                  ) : (
                    <span className="sila-me-flag">Not calculated</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Menu price per outlet</h2>
      </div>
      {recipe.outletPrices.length === 0 ? (
        <div className="sila-card-body">
          <span className="sila-me-flag">No menu price</span>
          <span className="sila-help"> Not priced for any outlet: POS sales of this item cannot be matched.</span>
        </div>
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Outlet</th>
                <th scope="col" className="srec-num">Menu price</th>
                <th scope="col" className="srec-num">Cost / serving</th>
                <th scope="col" className="srec-num">Cost %</th>
                <th scope="col" className="srec-num">Margin</th>
                <th scope="col" className="srec-num">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {recipe.outletPrices.map((price) => (
                <tr key={price.id}>
                  <td>
                    <span className="sila-cell-strong">{price.locationName || "—"}</span>
                    <span className="srec-sub">{price.locationCode}</span>
                  </td>
                  <td className="srec-num">{formatCost(price.menuPrice, price.currency)}</td>
                  {!recipe.readiness.costComplete || price.costPercent == null ? (
                    <td colSpan={4} className="srec-num"><span className="sila-me-flag">Incomplete</span></td>
                  ) : (
                    <>
                      <td className="srec-num">{formatCost(price.costPerServing ?? perServing, price.currency)}</td>
                      <td className="srec-num">{formatPercent(price.costPercent)}</td>
                      <td className={`srec-num${(price.marginAmount ?? price.menuPrice - perServing) < 0 ? " srec-negative" : ""}`}>
                        {formatCost(price.marginAmount ?? price.menuPrice - perServing, price.currency)}
                      </td>
                      <td className={`srec-num${(price.marginPercent ?? 0) < 0 ? " srec-negative" : ""}`}>
                        {formatPercent(price.marginPercent)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  </>
  );
};

export default SilaRecipeCosting;
