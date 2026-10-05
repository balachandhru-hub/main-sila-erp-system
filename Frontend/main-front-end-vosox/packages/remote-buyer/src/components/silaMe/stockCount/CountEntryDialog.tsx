import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  addStockCountItem,
  countStockCountItem,
  type SilaCountMethod,
  type SilaStockCountItemResult,
} from "../../../api/silaMe/silaStockCountApi";
import { formatQty, parseQty } from "./stockCountFormat";

/** The material being counted: a line of the sheet, or a material that is not on the sheet yet. */
export interface CountTarget {
  itemId: string | null;
  materialId: string;
  materialCode: string;
  materialName: string;
  baseUom: string;
  uoms: string[];
  /** Shown only when the count is not blind for this user. */
  systemQty?: number | null;
  countedQty?: number | null;
  method: SilaCountMethod;
}

interface CountEntryDialogProps {
  stockCountId: string;
  target: CountTarget;
  onClose: () => void;
  onSaved: (result: SilaStockCountItemResult) => void;
}

/** Counted quantity of one material: full units plus optional open units in another unit (e.g. 2 BTL + 300 ML). */
const CountEntryDialog: React.FC<CountEntryDialogProps> = ({ stockCountId, target, onClose, onSaved }) => {
  const uoms = target.uoms.length > 0 ? target.uoms : [target.baseUom];
  const [fullQty, setFullQty] = useState(target.countedQty !== null && target.countedQty !== undefined ? String(target.countedQty) : "");
  const [fullUom, setFullUom] = useState(target.baseUom);
  const [openQty, setOpenQty] = useState("");
  const [openUom, setOpenUom] = useState(uoms[uoms.length - 1]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const full = parseQty(fullQty);
    const open = parseQty(openQty);
    if (full === null || full < 0) {
      setError("Enter the full quantity you counted, 0 or more.");
      return;
    }
    if (openQty.trim() !== "" && (open === null || open < 0)) {
      setError("The open quantity must be 0 or more.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const request = {
        fullQty: full,
        fullUom,
        openQty: open && open > 0 ? open : null,
        openUom: open && open > 0 ? openUom : null,
        method: target.method,
      };
      const result = target.itemId
        ? await countStockCountItem(stockCountId, target.itemId, request)
        : await addStockCountItem(stockCountId, { ...request, materialId: target.materialId });
      toastService.success(result.message);
      onSaved(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the count.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      headerProps={{ heading: `Count ${target.materialName}` }}
      footerProps={{
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
        primaryButton: { text: "Save count", onClick: save, loading: saving },
      }}
    >
      <form
        className="sila-root sila-me sc-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <dl className="sila-meta-grid">
          <div className="sila-meta-item">
            <dt className="sila-meta-label">Material</dt>
            <dd className="sila-meta-value">{target.materialCode}</dd>
          </div>
          <div className="sila-meta-item">
            <dt className="sila-meta-label">Base unit</dt>
            <dd className="sila-meta-value">{target.baseUom}</dd>
          </div>
          {target.systemQty !== null && target.systemQty !== undefined && (
            <div className="sila-meta-item">
              <dt className="sila-meta-label">System quantity</dt>
              <dd className="sila-meta-value">{formatQty(target.systemQty)} {target.baseUom}</dd>
            </div>
          )}
          {!target.itemId && (
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Count sheet</dt>
              <dd className="sila-meta-value">Not on the sheet: it will be added</dd>
            </div>
          )}
        </dl>

        <div className="sila-field">
          <label className="sila-label" htmlFor="sc-full-qty">Full quantity<span className="sila-required">*</span></label>
          <div className="sc-qty-row">
            <input
              id="sc-full-qty"
              className="sila-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              autoFocus
              value={fullQty}
              onChange={(event) => setFullQty(event.target.value)}
            />
            <select className="sila-select" aria-label="Unit of the full quantity" value={fullUom} onChange={(event) => setFullUom(event.target.value)}>
              {uoms.map((uom) => (
                <option key={uom} value={uom}>{uom}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="sila-field">
          <label className="sila-label" htmlFor="sc-open-qty">Open / partial quantity</label>
          <div className="sc-qty-row">
            <input
              id="sc-open-qty"
              className="sila-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={openQty}
              onChange={(event) => setOpenQty(event.target.value)}
            />
            <select className="sila-select" aria-label="Unit of the open quantity" value={openUom} onChange={(event) => setOpenUom(event.target.value)}>
              {uoms.map((uom) => (
                <option key={uom} value={uom}>{uom}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="sila-alert sila-alert--danger" role="alert">{error}</div>}
        <button type="submit" className="sila-visually-hidden" tabIndex={-1}>Save count</button>
      </form>
    </Modal>
  );
};

export default CountEntryDialog;
