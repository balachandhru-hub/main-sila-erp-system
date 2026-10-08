import React, { useState } from "react";
import { toastService } from "@vosox/shared-ui";
import { updateSupplierCatalogStock, type CatalogDetailResponseItem } from "../../api/supplierApi";

interface CatalogStockEditorProps {
    catalogItem: CatalogDetailResponseItem;
    onSaved: () => void;
}

const toInput = (value: number | null | undefined): string => (value == null ? "" : String(value));

/** SKU, available stock and discount of one catalog product — what buyers see on their weekly bucket. */
const CatalogStockEditor: React.FC<CatalogStockEditorProps> = ({ catalogItem, onSaved }) => {
    const [sku, setSku] = useState(catalogItem.sku ?? "");
    const [availableStock, setAvailableStock] = useState(toInput(catalogItem.availableStock));
    const [discountPercent, setDiscountPercent] = useState(toInput(catalogItem.discountPercent));
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (availableStock !== "" && Number(availableStock) < 0) {
            toastService.error("Available stock cannot be negative.");
            return;
        }
        if (discountPercent !== "" && (Number(discountPercent) < 0 || Number(discountPercent) > 100)) {
            toastService.error("Discount must be between 0 and 100.");
            return;
        }

        setSaving(true);
        const response = await updateSupplierCatalogStock(catalogItem.catalogId, {
            sku: sku.trim(),
            availableStock: availableStock === "" ? null : Number(availableStock),
            discountPercent: discountPercent === "" ? null : Number(discountPercent),
        });
        setSaving(false);

        if (response !== true) {
            toastService.error(response.description || response.message || "Failed to update stock.");
            return;
        }
        toastService.success("Stock updated.");
        onSaved();
    };

    return (
        <form className="pud-catalog-card-classification" onSubmit={handleSubmit}>
            <div className="pud-catalog-form-section-title">Stock &amp; Discount</div>
            <div className="pud-catalog-form-grid">
                <div className="pud-catalog-form-field">
                    <label className="pud-catalog-form-label" htmlFor="catalog-stock-sku">SKU</label>
                    <input
                        id="catalog-stock-sku"
                        type="text"
                        maxLength={100}
                        className="pud-catalog-form-input"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Supplier SKU"
                    />
                </div>
                <div className="pud-catalog-form-field">
                    <label className="pud-catalog-form-label" htmlFor="catalog-stock-available">Available Stock</label>
                    <input
                        id="catalog-stock-available"
                        type="number"
                        step="0.01"
                        min="0"
                        className="pud-catalog-form-input"
                        value={availableStock}
                        onChange={(e) => setAvailableStock(e.target.value)}
                        placeholder="0"
                    />
                </div>
                <div className="pud-catalog-form-field">
                    <label className="pud-catalog-form-label" htmlFor="catalog-stock-discount">Discount %</label>
                    <input
                        id="catalog-stock-discount"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        className="pud-catalog-form-input"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        placeholder="0"
                    />
                </div>
            </div>
            <div>
                <button type="submit" className="pud-btn sila-btn sila-btn--primary" disabled={saving}>
                    {saving ? "Saving..." : "Update Stock"}
                </button>
            </div>
        </form>
    );
};

export default CatalogStockEditor;
