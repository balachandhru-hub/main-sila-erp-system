import React, { useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import { getMyLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  getOpenPurchaseOrders,
  getPurchaseOrder,
  postGoodsReceipt,
  validateGoodsReceipt,
  type SilaGrnValidation,
  type SilaGrnWrite,
  type SilaOpenPurchaseOrder,
  type SilaPurchaseOrderDetail,
} from "../../../api/silaMe/silaReceivingApi";
import SilaReceiveLinesTable, { acceptedOf, batchExpiryProblem, type ReceiveLineInput } from "./SilaReceiveLinesTable";
import { parseNumber } from "./receivingFormat";
import { useDebounced } from "./usePagedList";

export interface ReceivePrefill {
  purchaseOrderId: string;
  invoiceId?: string;
  invoiceNumber?: string | null;
  /** Received quantity per purchase order line, e.g. from the invoice lines. */
  quantities?: Record<string, number>;
}

interface SilaReceiveGoodsDialogProps {
  prefill?: ReceivePrefill | null;
  onClose: () => void;
  onPosted: (goodsReceiptId: string) => void;
}

/**
 * Receive goods: pick the purchase order, enter what arrived per line, choose the receiving store, post. The receipt is
 * checked by the server first; errors stop it, warnings (partial receipt, rejected goods, invoice differences) need a
 * second click to post anyway.
 */
const SilaReceiveGoodsDialog: React.FC<SilaReceiveGoodsDialogProps> = ({ prefill, onClose, onPosted }) => {
  const [poSearch, setPoSearch] = useState("");
  const term = useDebounced(poSearch);
  const [options, setOptions] = useState<SilaOpenPurchaseOrder[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState(prefill?.purchaseOrderId ?? "");
  const [order, setOrder] = useState<SilaPurchaseOrderDetail | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [stores, setStores] = useState<SilaLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [inputs, setInputs] = useState<Record<string, ReceiveLineInput>>({});
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<{ key: string; result: SilaGrnValidation } | null>(null);

  useEffect(() => {
    let active = true;
    getMyLocations()
      .then((locations) => {
        if (!active) return;
        const list = locations.filter((location) => location.locationType === "STORE");
        setStores(list);
        if (list.length === 1) setLocationId(list[0].id);
      })
      .catch((err: unknown) => toastService.error(err instanceof Error ? err.message : "Could not load your stores."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (prefill) return undefined;
    let active = true;
    getOpenPurchaseOrders(term, { index: 0, limit: 20 })
      .then((rows) => {
        if (active) setOptions(rows);
      })
      .catch((err: unknown) => {
        if (active) setOrderError(err instanceof Error ? err.message : "Could not load the open purchase orders.");
      });
    return () => {
      active = false;
    };
  }, [term, prefill]);

  useEffect(() => {
    setOrder(null);
    setInputs({});
    if (!purchaseOrderId) return undefined;
    let active = true;
    setOrderError(null);
    getPurchaseOrder(purchaseOrderId)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        const initial: Record<string, ReceiveLineInput> = {};
        Object.entries(prefill?.quantities ?? {}).forEach(([lineId, quantity]) => {
          initial[lineId] = { received: String(quantity), rejected: "", damaged: "" };
        });
        setInputs(initial);
      })
      .catch((err: unknown) => {
        if (active) setOrderError(err instanceof Error ? err.message : "Could not load the purchase order.");
      });
    return () => {
      active = false;
    };
  }, [purchaseOrderId, prefill]);

  const openLines = useMemo(() => (order ? order.lines.filter((line) => line.openQty > 0) : []), [order]);

  const handleSubmit = async () => {
    if (!order) return toastService.error("Select a purchase order.");
    if (!locationId) return toastService.error("Select the receiving store.");
    const lines = openLines
      .map((line) => ({ line, input: inputs[line.id] }))
      .filter(({ input }) => input && (parseNumber(input.received) ?? 0) > 0);
    if (lines.length === 0) return toastService.error("Enter the received quantity of at least one line.");
    for (const { line, input } of lines) {
      const accepted = acceptedOf(input);
      if (accepted < 0) return toastService.error(`Rejected and damaged exceed received on ${line.productName}.`);
      if (accepted > line.openQty + 0.0001) return toastService.error(`Accepted is more than open on ${line.productName}.`);
      const batchProblem = batchExpiryProblem(line, input);
      if (batchProblem) return toastService.error(batchProblem);
    }

    const request: SilaGrnWrite = {
      purchaseOrderId: order.id,
      locationId,
      invoiceId: prefill?.invoiceId ?? null,
      deliveryNote: deliveryNote.trim() || null,
      lines: lines.map(({ line, input }) => ({
        purchaseOrderItemId: line.id,
        receivedQty: parseNumber(input.received) ?? 0,
        acceptedQty: acceptedOf(input),
        rejectedQty: parseNumber(input.rejected) ?? 0,
        damagedQty: parseNumber(input.damaged) ?? 0,
        batchNumber: input.batch?.trim() || null,
        expiryDate: input.expiry || null,
      })),
    };
    const key = JSON.stringify(request);

    setSaving(true);
    try {
      // Checked again whenever the entries changed since the last check; warnings already shown are accepted by posting.
      if (!check || check.key !== key || !check.result.valid) {
        const result = await validateGoodsReceipt(request);
        setCheck({ key, result });
        if (!result.valid) {
          toastService.error("The goods receipt has errors; correct them and post again.");
          return;
        }
        if (result.warnings.length > 0) {
          toastService.warning("Check the warnings, then post anyway.");
          return;
        }
      }

      const id = await postGoodsReceipt(request);
      toastService.success("Goods receipt posted.");
      onPosted(id);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not post the goods receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: order ? `Receive goods — ${order.poNumber}` : "Receive goods", subHeading: prefill?.invoiceNumber ? `Invoice ${prefill.invoiceNumber}` : undefined }}
      footerProps={{
        primaryButton: {
          text: check?.result.valid && check.result.warnings.length > 0 ? "Post anyway" : "Post goods receipt",
          onClick: handleSubmit,
          loading: saving,
          disabled: saving || !order,
        },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        <div className="sila-form-grid">
          {!prefill && (
            <>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-rcv-search">Find purchase order</label>
                <input id="srcv-rcv-search" className="sila-input" type="search" placeholder="PO number or supplier" value={poSearch} disabled={saving} onChange={(event) => setPoSearch(event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-rcv-po">Purchase order<span className="sila-required">*</span></label>
                <select id="srcv-rcv-po" className="sila-select" value={purchaseOrderId} disabled={saving} onChange={(event) => setPurchaseOrderId(event.target.value)}>
                  <option value="">Select a purchase order</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>{option.poNumber} — {option.supplierName || "Supplier"}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-rcv-store">Receiving store<span className="sila-required">*</span></label>
            <select id="srcv-rcv-store" className="sila-select" value={locationId} disabled={saving} onChange={(event) => setLocationId(event.target.value)}>
              <option value="">Select a store</option>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.locationName}</option>)}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-rcv-note">Delivery note</label>
            <input id="srcv-rcv-note" className="sila-input" value={deliveryNote} maxLength={100} disabled={saving} onChange={(event) => setDeliveryNote(event.target.value)} />
          </div>
        </div>
        {check && (check.result.errors.length > 0 || check.result.warnings.length > 0) && (
          <div className={check.result.errors.length > 0 ? "sila-alert sila-alert--danger" : "sila-alert sila-alert--warning"} role="alert">
            <p>
              {check.result.errors.length > 0 ? "Cannot be posted:" : "Check before posting:"} {check.result.totalAccepted} accepted
              {check.result.totalValue != null ? `, value ${check.result.totalValue.toFixed(2)}${check.result.currency ? ` ${check.result.currency}` : ""}` : ""}.
            </p>
            <ul className="srcv-messages">
              {[...check.result.errors, ...check.result.warnings].map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        )}
        {orderError ? (
          <EmptyState variant="error" title="Couldn't load the purchase order" description={orderError} />
        ) : !purchaseOrderId ? (
          <EmptyState title="Select a purchase order" />
        ) : !order ? (
          <Loader size={24} message="Loading purchase order..." />
        ) : openLines.length === 0 ? (
          <EmptyState title="Nothing left to receive" description="Every line of this purchase order is fully received." />
        ) : (
          <SilaReceiveLinesTable
            lines={openLines}
            inputs={inputs}
            disabled={saving}
            onChange={(lineId, input) => setInputs((current) => ({ ...current, [lineId]: input }))}
          />
        )}
      </div>
    </Modal>
  );
};

export default SilaReceiveGoodsDialog;
