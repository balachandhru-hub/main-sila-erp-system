import React, { useMemo, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import type { SilaLocation, SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import type { SilaMaterialOutletPrice } from "../../../api/silaMe/silaRecipeApi";
import { submitPriceChange } from "../../../api/silaMe/silaMaterialsApi";
import SilaPriceHistory from "./SilaPriceHistory";
import SilaPriceStatusBadge from "./SilaPriceStatusBadge";
import { formatPrice } from "./materialFormat";
import "../silaMeTheme.css";
import "./SilaMaterials.css";

interface SilaMaterialPricePanelProps {
  material: SilaMaterial;
  /** May request a price change (MANAGE_SILA_MASTER_DATA). Without it the panel only shows the price and its history. */
  canRequest: boolean;
  onClose: () => void;
  /** Called after a price change was submitted. */
  onSubmitted: () => void;
  /** Outlets a price can be set for; without them only the default price is changed. */
  outlets?: SilaLocation[];
  /** The material's outlet prices (shown as the current price of the chosen outlet). */
  outletPrices?: SilaMaterialOutletPrice[];
  /** Outlet preselected in the form; empty selects the default price. */
  defaultOutletId?: string;
}

/**
 * The price of a material: the approved price, the pending request and the history. A new price is submitted for
 * approval; it does not overwrite the approved price.
 */
const SilaMaterialPricePanel: React.FC<SilaMaterialPricePanelProps> = ({
  material,
  canRequest,
  onClose,
  onSubmitted,
  outlets = [],
  outletPrices = [],
  defaultOutletId = "",
}) => {
  const [outletId, setOutletId] = useState(defaultOutletId);
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState(material.currency ?? "");
  const [priceUom, setPriceUom] = useState(material.baseUom);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const pending = material.priceStatus === "PENDING_APPROVAL" || submitted;
  const uoms = useMemo(() => {
    const units = new Set<string>([material.baseUom]);
    material.conversions.forEach((conversion) => {
      units.add(conversion.fromUom);
      units.add(conversion.toUom);
    });
    return Array.from(units);
  }, [material]);

  const outletPrice = outletPrices.find((price) => price.outletLocationId === outletId);
  const currentCost = outletPrice?.unitCost ?? material.unitCost;
  const currentCurrency = outletPrice?.currency ?? material.currency;

  const close = () => (submitted ? onSubmitted() : onClose());

  const handleSubmit = async () => {
    const price = Number(unitPrice);
    if (!unitPrice.trim() || !Number.isFinite(price) || price <= 0) {
      toastService.error("Enter a new unit price greater than zero.");
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      toastService.error("Enter the 3-letter currency code, e.g. AED.");
      return;
    }
    if (!reason.trim()) {
      toastService.error("Enter the reason for the price change.");
      return;
    }
    setSaving(true);
    try {
      await submitPriceChange(material.id, {
        unitPrice: price,
        currency: currency.trim().toUpperCase(),
        priceUom: priceUom || null,
        effectiveFrom: effectiveFrom || null,
        reason: reason.trim(),
        outletLocationId: outletId || null,
      });
      toastService.success(`Price change of ${material.materialCode} submitted for approval.`);
      setSubmitted(true);
      setUnitPrice("");
      setReason("");
      setHistoryKey((key) => key + 1);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not submit the price change.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      size="lg"
      headerProps={{
        heading: `${canRequest ? "Update unit price" : "Unit price"} · ${material.materialCode}`,
        subHeading: material.description,
      }}
      footerProps={{
        secondaryButton: { text: "Close", variant: "secondary", onClick: close, disabled: saving },
        primaryButton: canRequest
          ? { text: "Submit for approval", onClick: handleSubmit, loading: saving, disabled: pending }
          : undefined,
      }}
    >
      <div className="sila-root sila-me smat-panel">
        <p className="sila-help">This submits a material change for approval. It does not overwrite the currently approved price.</p>
        <dl className="smat-facts">
          <div><dt>Material ID</dt><dd>{material.materialCode}</dd></div>
          <div><dt>Material description</dt><dd>{material.description || "—"}</dd></div>
          <div><dt>Material group</dt><dd>{material.materialGroup || "—"}</dd></div>
          <div><dt>Base UOM</dt><dd>{material.baseUom}</dd></div>
          <div>
            <dt>{outletId ? "Current unit price at the outlet" : "Current approved unit price"}</dt>
            <dd>
              {currentCost == null
                ? <span className="sila-me-flag sila-me-flag--bad">None</span>
                : formatPrice(currentCost, currentCurrency, material.baseUom)}
            </dd>
          </div>
          <div><dt>Currency</dt><dd>{material.currency || "—"}</dd></div>
          <div><dt>Price status</dt><dd><SilaPriceStatusBadge status={submitted ? "PENDING_APPROVAL" : material.priceStatus} /></dd></div>
          {material.proposedUnitCost != null && (
            <div><dt>Proposed price</dt><dd>{formatPrice(material.proposedUnitCost, material.currency, material.proposedPriceUom)}</dd></div>
          )}
        </dl>

        {pending && (
          <div className="sila-alert sila-alert--warning" role="status">
            A price change is waiting for approval. A new one can be requested once it is approved or rejected.
          </div>
        )}

        {canRequest && !pending && (
          <section className="sila-form-section">
            <h3 className="sila-section-title">New price</h3>
            {outlets.length > 0 && (
              <div className="sila-field">
                <label className="sila-label" htmlFor="smat-outlet">Price for</label>
                <select id="smat-outlet" className="sila-input" value={outletId} onChange={(event) => setOutletId(event.target.value)}>
                  <option value="">Default price (all outlets without their own)</option>
                  {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.locationName}</option>)}
                </select>
              </div>
            )}
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="smat-price">New unit price *</label>
                <input id="smat-price" className="sila-input" type="number" min={0} step="any" value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="smat-currency">Currency *</label>
                <input id="smat-currency" className="sila-input" maxLength={3} value={currency}
                  onChange={(event) => setCurrency(event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="smat-uom">Price UOM</label>
                <select id="smat-uom" className="sila-input" value={priceUom} onChange={(event) => setPriceUom(event.target.value)}>
                  {uoms.map((uom) => <option key={uom} value={uom}>{uom}</option>)}
                </select>
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="smat-effective">Effective from</label>
                <input id="smat-effective" className="sila-input" type="date" value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)} />
              </div>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="smat-reason">Reason / comment *</label>
              <textarea id="smat-reason" className="sila-input" rows={3} maxLength={500} value={reason}
                onChange={(event) => setReason(event.target.value)} />
            </div>
          </section>
        )}

        <section className="sila-form-section">
          <h3 className="sila-section-title">Price history</h3>
          <SilaPriceHistory materialId={material.id} reloadKey={historyKey} />
        </section>
      </div>
    </Modal>
  );
};

export default SilaMaterialPricePanel;
