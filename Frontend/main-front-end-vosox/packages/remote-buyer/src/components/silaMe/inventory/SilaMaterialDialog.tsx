import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  deleteMaterialConversion,
  saveMaterialConversion,
  searchMaterials,
  updateMaterialInventory,
  SILA_INVENTORY_TYPES,
  type SilaMaterial,
  type SilaUomConversion,
} from "../../../api/silaMe/silaInventoryApi";
import { codeLabel } from "../materials/materialFormat";

interface SilaMaterialDialogProps {
  material: SilaMaterial;
  onClose: () => void;
  /** Called after a save, and on close when conversions were changed. */
  onSaved: () => void;
}

const numberText = (value: number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

/**
 * Edits the inventory fields of a material (inventory type, batch / expiry / serial management, standard and moving average
 * price) and its UOM conversions (e.g. 1 BTL = 750 ML). The unit price changes only through the price panel (approval).
 */
const SilaMaterialDialog: React.FC<SilaMaterialDialogProps> = ({ material, onClose, onSaved }) => {
  const [barcode, setBarcode] = useState(material.barcode ?? "");
  const [isInventoryItem, setIsInventoryItem] = useState(material.isInventoryItem);
  const [inventoryType, setInventoryType] = useState(material.inventoryType ?? "");
  const [batchManaged, setBatchManaged] = useState(!!material.batchManaged);
  const [expiryManaged, setExpiryManaged] = useState(!!material.expiryManaged);
  const [shelfLifeDays, setShelfLifeDays] = useState(numberText(material.shelfLifeDays));
  const [serialManaged, setSerialManaged] = useState(!!material.serialManaged);
  const [standardPrice, setStandardPrice] = useState(numberText(material.standardPrice));
  const [movingAveragePrice, setMovingAveragePrice] = useState(numberText(material.movingAveragePrice));
  const [saving, setSaving] = useState(false);

  const [conversions, setConversions] = useState<SilaUomConversion[]>(material.conversions);
  const [conversionsChanged, setConversionsChanged] = useState(false);
  const [fromUom, setFromUom] = useState("");
  const [factor, setFactor] = useState("");
  const [toUom, setToUom] = useState(material.baseUom);
  const [convBusy, setConvBusy] = useState(false);

  const close = () => (conversionsChanged ? onSaved() : onClose());

  const refreshConversions = async () => {
    const found = await searchMaterials(material.materialCode);
    const fresh = found.find((row) => row.id === material.id);
    if (fresh) setConversions(fresh.conversions);
  };

  const handleAddConversion = async () => {
    const from = fromUom.trim().toUpperCase();
    const to = toUom.trim().toUpperCase();
    const value = Number(factor);
    if (!from || !to || from === to) {
      toastService.error("Enter two different units of measure.");
      return;
    }
    if (from !== material.baseUom && to !== material.baseUom) {
      toastService.error(`One of the two units must be the base unit ${material.baseUom}.`);
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toastService.error("Enter a factor greater than zero.");
      return;
    }
    setConvBusy(true);
    try {
      await saveMaterialConversion(material.id, { fromUom: from, toUom: to, factor: value });
      setConversionsChanged(true);
      setFromUom("");
      setFactor("");
      setToUom(material.baseUom);
      toastService.success(`1 ${from} = ${value} ${to} saved.`);
      await refreshConversions();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the conversion.");
    } finally {
      setConvBusy(false);
    }
  };

  const handleDeleteConversion = async (conversion: SilaUomConversion) => {
    if (!conversion.id) return;
    setConvBusy(true);
    try {
      await deleteMaterialConversion(material.id, conversion.id);
      setConversionsChanged(true);
      setConversions((current) => current.filter((row) => row.id !== conversion.id));
      toastService.success("Conversion deleted.");
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete the conversion.");
    } finally {
      setConvBusy(false);
    }
  };

  // STOCK makes the material an inventory item; an inventory item cannot be a SERVICE.
  const changeInventoryType = (value: string) => {
    setInventoryType(value);
    if (value === "STOCK") setIsInventoryItem(true);
    if (value === "SERVICE") setIsInventoryItem(false);
  };

  const changeInventoryItem = (checked: boolean) => {
    setIsInventoryItem(checked);
    if (checked && (inventoryType === "SERVICE" || inventoryType === "")) setInventoryType("STOCK");
  };

  const optionalNumber = (text: string): number | null | undefined => {
    if (!text.trim()) return null;
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  };

  const handleSave = async () => {
    const standard = optionalNumber(standardPrice);
    const movingAverage = optionalNumber(movingAveragePrice);
    if (standard === undefined || movingAverage === undefined) {
      toastService.error("Enter zero or a positive standard and moving average price.");
      return;
    }
    const shelfLife = Number(shelfLifeDays);
    if (expiryManaged && (!Number.isInteger(shelfLife) || shelfLife < 1 || shelfLife > 3650)) {
      toastService.error("Enter the shelf life in whole days (1-3650) for an expiry managed material.");
      return;
    }
    setSaving(true);
    try {
      await updateMaterialInventory(material.id, {
        barcode: barcode.trim() || null,
        isInventoryItem,
        inventoryType: inventoryType || null,
        batchManaged,
        expiryManaged,
        shelfLifeDays: expiryManaged ? shelfLife : null,
        serialManaged,
        standardPrice: standard,
        movingAveragePrice: movingAverage,
      });
      toastService.success(`${material.materialCode} updated.`);
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not update the material.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      size="lg"
      headerProps={{ heading: material.materialCode, subHeading: material.description }}
      footerProps={{
        secondaryButton: { text: "Close", variant: "secondary", onClick: close, disabled: saving },
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: convBusy },
      }}
    >
      <div className="sila-root sila-me sinv-dialog">
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-mat-type">Inventory type</label>
            <select id="sinv-mat-type" className="sila-input" value={inventoryType} onChange={(event) => changeInventoryType(event.target.value)}>
              <option value="">Not set</option>
              {SILA_INVENTORY_TYPES.map((type) => <option key={type} value={type}>{codeLabel(type)}</option>)}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-mat-barcode">Barcode</label>
            <input id="sinv-mat-barcode" className="sila-input" maxLength={64} value={barcode} onChange={(event) => setBarcode(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-mat-standard">Standard price</label>
            <input id="sinv-mat-standard" className="sila-input" type="number" min={0} step="any" value={standardPrice}
              onChange={(event) => setStandardPrice(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-mat-mav">Moving average price</label>
            <input id="sinv-mat-mav" className="sila-input" type="number" min={0} step="any" value={movingAveragePrice}
              onChange={(event) => setMovingAveragePrice(event.target.value)} />
          </div>
          {expiryManaged && (
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-mat-shelf">Shelf life (days) *</label>
              <input id="sinv-mat-shelf" className="sila-input" type="number" min={1} max={3650} step={1} value={shelfLifeDays}
                onChange={(event) => setShelfLifeDays(event.target.value)} />
            </div>
          )}
        </div>
        <div className="sinv-inline">
          <label className="sila-choice">
            <input type="checkbox" checked={isInventoryItem} onChange={(event) => changeInventoryItem(event.target.checked)} />
            Inventory item (stock is kept)
          </label>
          <label className="sila-choice">
            <input type="checkbox" checked={batchManaged} onChange={(event) => setBatchManaged(event.target.checked)} />
            Batch managed
          </label>
          <label className="sila-choice">
            <input type="checkbox" checked={expiryManaged} onChange={(event) => setExpiryManaged(event.target.checked)} />
            Expiry managed
          </label>
          <label className="sila-choice">
            <input type="checkbox" checked={serialManaged} onChange={(event) => setSerialManaged(event.target.checked)} />
            Serial managed
          </label>
        </div>

        <section className="sila-form-section">
          <h3 className="sila-section-title">Unit of measure conversions</h3>
          <span className="sila-help">Base unit: {material.baseUom}</span>
          {conversions.length === 0 ? (
            <span className="sila-help">No conversions yet.</span>
          ) : (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Conversion</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((conversion) => (
                    <tr key={conversion.id ?? `${conversion.fromUom}-${conversion.toUom}`}>
                      <td>1 {conversion.fromUom} = {conversion.factor} {conversion.toUom}</td>
                      <td className="sila-cell-actions">
                        <button
                          type="button"
                          className="sila-btn sila-btn--ghost sila-btn--sm"
                          disabled={convBusy || !conversion.id}
                          aria-label={`Delete conversion ${conversion.fromUom} to ${conversion.toUom}`}
                          onClick={() => handleDeleteConversion(conversion)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="sinv-conversion-row">
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-conv-from">1 unit</label>
              <input
                id="sinv-conv-from"
                className="sila-input"
                placeholder="BTL"
                value={fromUom}
                onChange={(event) => setFromUom(event.target.value)}
              />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-conv-factor">equals</label>
              <input
                id="sinv-conv-factor"
                className="sila-input"
                type="number"
                min={0}
                step="any"
                placeholder="750"
                value={factor}
                onChange={(event) => setFactor(event.target.value)}
              />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-conv-to">unit</label>
              <input
                id="sinv-conv-to"
                className="sila-input"
                value={toUom}
                onChange={(event) => setToUom(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              disabled={convBusy}
              onClick={handleAddConversion}
            >
              {convBusy ? "Saving..." : "Add conversion"}
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
};

export default SilaMaterialDialog;
