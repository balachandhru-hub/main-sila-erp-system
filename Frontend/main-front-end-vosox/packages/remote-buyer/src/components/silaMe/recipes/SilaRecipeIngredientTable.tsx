import React from "react";
import type { SilaRecipeMode } from "../../../api/silaMe/silaRecipeApi";
import type { IngredientLine, IngredientMaterial, LineCost } from "./recipeEditorModel";
import { conversionSummary, formatCost, formatQty, materialUoms, priceStatusBadgeClass, priceStatusLabel, unitPriceText } from "./recipeFormat";

interface SilaRecipeIngredientTableProps {
  lines: IngredientLine[];
  costs: LineCost[];
  mode: SilaRecipeMode;
  /** Total when every line can be costed, otherwise null (shown as incomplete). */
  totalCost: number | null;
  currency: string;
  onChange: (key: string, change: Partial<IngredientLine>) => void;
  onRemove: (key: string) => void;
  /** Opens the material price panel; absent when the user may not request prices. */
  onUpdatePrice?: (material: IngredientMaterial) => void;
}

/** The ingredient grid (prototype columns): recipe qty/UOM, base UOM, pack, unit and price UOM, price status, inventory consumption, cost and cost %. */
const SilaRecipeIngredientTable: React.FC<SilaRecipeIngredientTableProps> = ({
  lines,
  costs,
  mode,
  totalCost,
  currency,
  onChange,
  onRemove,
  onUpdatePrice,
}) => {
  const direct = mode === "DIRECT";
  return (
    <div className="sila-table-wrap">
      <table className="sila-table">
        <thead>
          <tr>
            <th scope="col">Ingredient ID</th>
            <th scope="col">Ingredient</th>
            <th scope="col">Material ID</th>
            <th scope="col">{direct ? "Consumption qty" : "Recipe qty"}</th>
            <th scope="col">{direct ? "Consumption UOM" : "Recipe UOM"}</th>
            <th scope="col">Base UOM</th>
            <th scope="col">Pack / conversion</th>
            <th scope="col" className="srec-num">Unit price</th>
            <th scope="col">Price UOM</th>
            <th scope="col">Price status</th>
            <th scope="col" className="srec-num">Inventory consumption</th>
            <th scope="col" className="srec-num">{direct ? "Item cost" : "Ingredient cost"}</th>
            {!direct && <th scope="col" className="srec-num">Cost %</th>}
            <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const cost = costs[index];
            const code = line.material?.materialCode ?? line.subRecipe?.recipeCode ?? "";
            const name = line.material?.description ?? line.subRecipe?.name ?? "";
            const share = totalCost && cost.cost != null ? (cost.cost / totalCost) * 100 : null;
            return (
              <tr key={line.key}>
                <td>{line.ingredientCode || <span className="sila-cell-muted">Assigned on save</span>}</td>
                <td>
                  {name}
                  {line.subRecipe && <span className="srec-sub">Sub-recipe</span>}
                </td>
                <td className="sila-cell-strong">{code}</td>
                <td>
                  <input
                    className="sila-input srec-cell-input"
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Quantity of ${code}`}
                    value={line.quantity}
                    onChange={(e) => onChange(line.key, { quantity: e.target.value })}
                  />
                </td>
                <td>
                  {line.material ? (
                    <select
                      className="sila-select srec-cell-input"
                      aria-label={`Unit of ${code}`}
                      value={line.uom}
                      onChange={(e) => onChange(line.key, { uom: e.target.value })}
                    >
                      {Array.from(new Set([line.uom.toUpperCase(), ...materialUoms(line.material)])).map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  ) : (
                    line.uom
                  )}
                </td>
                <td>{cost.baseUom || "—"}</td>
                <td className="srec-message">{line.material ? conversionSummary(line.material) : `Per serving (${cost.baseUom})`}</td>
                <td className="srec-num">
                  {line.material ? (
                    line.material.priceStatus === "APPROVED" ? (
                      unitPriceText(line.material.priceStatus, cost.unitCost, line.material.currency, line.material.baseUom)
                    ) : (
                      <span className="sila-me-flag sila-me-flag--bad">{unitPriceText(line.material.priceStatus, null, null, "")}</span>
                    )
                  ) : (
                    `${formatCost(cost.unitCost)} / ${cost.baseUom}`
                  )}
                </td>
                <td>{cost.baseUom || "—"}</td>
                <td>
                  {line.material ? (
                    <>
                      <span className={priceStatusBadgeClass(line.material.priceStatus)}>{priceStatusLabel(line.material.priceStatus)}</span>
                      {line.material.proposedUnitPrice != null && (
                        <span className="srec-sub">Proposed {formatCost(line.material.proposedUnitPrice, line.material.currency)}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                  {cost.issue && <span className="srec-sub srec-negative">{cost.issue}</span>}
                </td>
                <td className="srec-num">
                  {cost.baseQuantity == null ? <span className="sila-me-flag">Not calculated</span> : `${formatQty(cost.baseQuantity)} ${cost.baseUom}`}
                </td>
                <td className="srec-num">{cost.cost == null ? <span className="sila-me-flag">Not calculated</span> : formatCost(cost.cost, currency)}</td>
                {!direct && (
                  <td className="srec-num">{share == null ? <span className="sila-me-flag">Not calculated</span> : `${share.toFixed(2)}%`}</td>
                )}
                <td>
                  <span className="srec-actions">
                    {line.material && onUpdatePrice && line.material.priceStatus !== "PENDING_APPROVAL" && (
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Update the material price of ${code}`}
                        onClick={() => line.material && onUpdatePrice(line.material)}
                      >
                        Update material price
                      </button>
                    )}
                    <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Remove ${code}`} onClick={() => onRemove(line.key)}>
                      Remove
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
          <tr className="srec-total">
            <td colSpan={11}>Total cost</td>
            <td className="srec-num">
              {totalCost == null ? <span className="sila-me-flag">Incomplete</span> : formatCost(totalCost, currency)}
            </td>
            {!direct && <td />}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default SilaRecipeIngredientTable;
