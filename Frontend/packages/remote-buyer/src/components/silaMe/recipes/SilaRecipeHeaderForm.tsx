import React from "react";
import type { SilaRecipeMode } from "../../../api/silaMe/silaRecipeApi";
import type { SilaRecipeMaster } from "../../../api/silaMe/silaRecipeToolsApi";
import type { HeaderValues } from "./recipeEditorModel";
import { recipeLabel } from "./recipeFormat";

interface SilaRecipeHeaderFormProps {
  values: HeaderValues;
  families: SilaRecipeMaster[];
  categories: SilaRecipeMaster[];
  /** Recipe code, assigned on the first save. */
  recipeCode?: string | null;
  /** Units offered for the serving and selling unit (free text is still allowed). */
  uoms?: string[];
  /** Business date of the last POS sale (read-only, set by POS processing). */
  lastSaleDate?: string | null;
  onChange: (change: Partial<HeaderValues>) => void;
}

const MODES: SilaRecipeMode[] = ["DIRECT", "RECIPE", "BATCH"];

/** The menu item fields of a recipe: name, family, category, mode, POS code, serving and selling units, currency. */
const SilaRecipeHeaderForm: React.FC<SilaRecipeHeaderFormProps> = ({ values, families, categories, recipeCode, uoms = [], lastSaleDate, onChange }) => (
  <section className="sila-card">
    <div className="sila-card-header">
      <h2 className="sila-card-title">Menu item</h2>
      <span className="sila-badge sila-badge--neutral">{recipeCode || "Code assigned on save"}</span>
    </div>
    <div className="sila-card-body">
      <div className="sila-form-grid">
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-name">Name <span className="sila-required">*</span></label>
          <input id="srec-name" className="sila-input" maxLength={200} value={values.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-family">Family</label>
          <select id="srec-family" className="sila-select" value={values.familyId} onChange={(e) => onChange({ familyId: e.target.value })}>
            <option value="">No family</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>{family.code} · {family.name}</option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-category">Category</label>
          <select id="srec-category" className="sila-select" value={values.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.code} · {category.name}</option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-mode">Item mode <span className="sila-required">*</span></label>
          <select id="srec-mode" className="sila-select" value={values.itemMode} onChange={(e) => onChange({ itemMode: e.target.value as SilaRecipeMode })}>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>{recipeLabel(mode)}</option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-pos">POS code</label>
          <input id="srec-pos" className="sila-input" maxLength={50} value={values.posCode} onChange={(e) => onChange({ posCode: e.target.value })} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-pos-item">POS item</label>
          <input id="srec-pos-item" className="sila-input" maxLength={200} value={values.posItem} onChange={(e) => onChange({ posItem: e.target.value })} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-last-sale">Last sale date</label>
          <input id="srec-last-sale" className="sila-input" readOnly value={lastSaleDate ? lastSaleDate.slice(0, 10) : "No sale yet"} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-serving">Serving quantity <span className="sila-required">*</span></label>
          <input
            id="srec-serving"
            className="sila-input"
            type="number"
            min="0"
            step="any"
            value={values.servingQty}
            onChange={(e) => onChange({ servingQty: e.target.value })}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-serving-uom">Serving unit <span className="sila-required">*</span></label>
          <input
            id="srec-serving-uom"
            className="sila-input"
            list="srec-uom-list"
            maxLength={20}
            value={values.servingUom}
            onChange={(e) => onChange({ servingUom: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-selling-uom">Selling unit</label>
          <input
            id="srec-selling-uom"
            className="sila-input"
            list="srec-uom-list"
            maxLength={20}
            value={values.sellingUom}
            onChange={(e) => onChange({ sellingUom: e.target.value.toUpperCase() })}
          />
          <datalist id="srec-uom-list">
            {uoms.map((uom) => (
              <option key={uom} value={uom} />
            ))}
          </datalist>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srec-currency">Currency</label>
          <input
            id="srec-currency"
            className="sila-input"
            maxLength={3}
            value={values.currency}
            onChange={(e) => onChange({ currency: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="sila-field sila-field--full">
          <label className="sila-label" htmlFor="srec-description">Description</label>
          <textarea
            id="srec-description"
            className="sila-textarea"
            rows={2}
            maxLength={1000}
            value={values.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
      </div>
    </div>
  </section>
);

export default SilaRecipeHeaderForm;
