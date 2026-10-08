import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  extractInvoice,
  getInvoice,
  getInvoiceFile,
  getOpenPurchaseOrders,
  getPurchaseOrder,
  rereadInvoice,
  updateInvoice,
  type SilaInvoiceDetail,
  type SilaOpenPurchaseOrder,
  type SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import SilaInvoiceHistory from "./SilaInvoiceHistory";
import SilaInvoiceLinesEditor from "./SilaInvoiceLinesEditor";
import SilaInvoicePoMatch from "./SilaInvoicePoMatch";
import SilaInvoiceSupplierMatch from "./SilaInvoiceSupplierMatch";
import { INVOICE_TYPES, toInvoiceForm, toInvoiceWrite, toReceivePrefill, validateInvoiceForm, type InvoiceForm } from "./invoiceForm";
import { formatConfidence, openBlob, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import type { ReceivePrefill } from "./SilaReceiveGoodsDialog";

interface SilaInvoiceReviewDialogProps {
  invoiceId: string;
  canPost: boolean;
  onClose: () => void;
  /** The invoice changed (read, saved). */
  onChanged: () => void;
  /** Opens the receive flow prefilled from the invoice. */
  onReceive: (prefill: ReceivePrefill) => void;
}

const HEADER_FIELDS: { key: Exclude<keyof InvoiceForm, "lines" | "purchaseOrderId" | "invoiceType">; label: string; type: string }[] = [
  { key: "invoiceNumber", label: "Invoice number", type: "text" },
  { key: "supplierName", label: "Supplier", type: "text" },
  { key: "supplierTaxNumber", label: "Supplier TRN", type: "text" },
  { key: "invoiceDate", label: "Invoice date", type: "date" },
  { key: "currency", label: "Currency", type: "text" },
  { key: "netAmount", label: "Net amount", type: "number" },
  { key: "taxAmount", label: "Tax amount", type: "number" },
  { key: "grossAmount", label: "Gross amount", type: "number" },
];

type Tab = "review" | "matching" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Review" },
  { key: "matching", label: "Supplier & PO matching" },
  { key: "history", label: "Reading history" },
];

/** OCR result and review form of an invoice: fields, supplier/PO/line matching, reading history; then receive the goods. */
const SilaInvoiceReviewDialog: React.FC<SilaInvoiceReviewDialogProps> = ({ invoiceId, canPost, onClose, onChanged, onReceive }) => {
  const [invoice, setInvoice] = useState<SilaInvoiceDetail | null>(null);
  const [form, setForm] = useState<InvoiceForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SilaOpenPurchaseOrder[]>([]);
  const [poLines, setPoLines] = useState<SilaPurchaseOrderLine[]>([]);
  const [busy, setBusy] = useState<"extract" | "reread" | "save" | "file" | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [readings, setReadings] = useState(0);

  const show = (data: SilaInvoiceDetail) => {
    setInvoice(data);
    setForm(toInvoiceForm(data));
  };

  useEffect(() => {
    let active = true;
    getInvoice(invoiceId)
      .then((data) => active && show(data))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Could not load the invoice."));
    getOpenPurchaseOrders("", { index: 0, limit: 50 })
      .then((rows) => active && setOrders(rows))
      .catch(() => active && setOrders([]));
    return () => {
      active = false;
    };
  }, [invoiceId]);

  const purchaseOrderId = form?.purchaseOrderId ?? "";
  useEffect(() => {
    setPoLines([]);
    if (!purchaseOrderId) return undefined;
    let active = true;
    getPurchaseOrder(purchaseOrderId)
      .then((order) => active && setPoLines(order.lines))
      .catch((err: unknown) => toastService.error(err instanceof Error ? err.message : "Could not load the purchase order lines."));
    return () => {
      active = false;
    };
  }, [purchaseOrderId]);

  const locked = !canPost || invoice?.status === "GRN_POSTED";
  const canExtract = canPost && invoice !== null && ["UPLOADED", "OCR_FAILED", "EXTRACTED", "REVIEW_REQUIRED"].includes(invoice.status);
  // A re-read keeps the fields the user corrected; it is the only reading of a reviewed invoice.
  const canReread = canPost && invoice !== null && ["EXTRACTED", "REVIEW_REQUIRED", "REVIEWED"].includes(invoice.status);
  const prefill = invoice && invoice.status !== "GRN_POSTED" ? toReceivePrefill(invoice) : null;

  const run = async (kind: "extract" | "reread" | "save" | "file", action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleExtract = () => run("extract", async () => {
    const data = await extractInvoice(invoiceId);
    show(data);
    onChanged();
    setReadings((current) => current + 1);
    if (data.status === "OCR_FAILED") toastService.error(data.ocrMessage || "The invoice could not be read. Type the fields.");
    else toastService.success("Invoice read. Check the fields and save.");
  });

  const handleReread = () => run("reread", async () => {
    const data = await rereadInvoice(invoiceId);
    show(data);
    onChanged();
    setReadings((current) => current + 1);
    toastService.success("Invoice read again; your corrections were kept.");
  });

  const handleMatched = (data: SilaInvoiceDetail) => {
    show(data);
    onChanged();
  };

  const handleSave = () => {
    if (!form || !invoice) return;
    const problem = validateInvoiceForm(form);
    if (problem) {
      toastService.error(problem);
      return;
    }
    // A changed purchase order takes its own supplier; otherwise the matched supplier is kept.
    const supplierId = form.purchaseOrderId === (invoice.purchaseOrderId ?? "") ? invoice.supplierId : null;
    run("save", async () => {
      // The Supplier Master match is kept while the supplier name is unchanged.
      const silaSupplierId = form.supplierName.trim() === (invoice.supplierName ?? "") ? invoice.silaSupplierId ?? null : null;
      show(await updateInvoice(invoiceId, { ...toInvoiceWrite(form, supplierId), silaSupplierId }));
      onChanged();
      toastService.success("Invoice saved.");
    });
  };

  const handleFile = () => run("file", async () => openBlob(await getInvoiceFile(invoiceId)));

  const poOptions = invoice?.purchaseOrderId && !orders.some((order) => order.id === invoice.purchaseOrderId)
    ? [{ id: invoice.purchaseOrderId, poNumber: invoice.poNumber ?? "Linked order", supplierName: invoice.supplierName }, ...orders]
    : orders;

  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: invoice ? `Invoice ${invoice.invoiceNumber || invoice.fileName}` : "Invoice" }}
      footerProps={{
        primaryButton: locked || !form || tab !== "review" ? undefined : { text: "Save review", onClick: handleSave, loading: busy === "save", disabled: busy !== null },
        secondaryButton: { text: "Close", onClick: onClose, disabled: busy !== null },
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {error ? (
          <EmptyState variant="error" title="Couldn't load the invoice" description={error} />
        ) : !invoice || !form ? (
          <Loader size={24} message="Loading invoice..." />
        ) : (
          <>
            <div className="srcv-actions">
              <span className={receivingBadgeClass(invoice.status)}>{receivingLabel(invoice.status)}</span>
              <span className="srcv-sub">OCR confidence {formatConfidence(invoice.ocrConfidence)}</span>
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={handleFile}>
                {busy === "file" ? "Opening..." : "View file"}
              </button>
              {canReread && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={handleReread}>
                  {busy === "reread" ? "Reading..." : "Re-read (keep corrections)"}
                </button>
              )}
              {canExtract && invoice.status !== "EXTRACTED" && invoice.status !== "REVIEW_REQUIRED" && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={handleExtract}>
                  {busy === "extract" ? "Reading..." : invoice.status === "UPLOADED" ? "Read with OCR" : "Read again"}
                </button>
              )}
              {canPost && prefill && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={() => onReceive(prefill)}>
                  Create GRN from invoice
                </button>
              )}
            </div>
            {invoice.ocrMessage && <div className="sila-alert sila-alert--warning" role="status">{invoice.ocrMessage}</div>}
            {invoice.goodsReceiptNote && <div className="sila-alert sila-alert--warning" role="status">{invoice.goodsReceiptNote}</div>}
            {invoice.reconciliationWarning && <div className="sila-alert sila-alert--warning" role="status">{invoice.reconciliationWarning}</div>}
            {invoice.needsReview && (
              <div className="sila-alert sila-alert--warning" role="status">The reading is below the minimum confidence: check every field before saving.</div>
            )}
            {invoice.erpStatus && (
              <p className="srcv-sub">
                ERP invoice posting: {receivingLabel(invoice.erpStatus)}
                {invoice.erpReference ? ` — ${invoice.erpReference}` : ""}
                {invoice.erpMessage ? ` — ${invoice.erpMessage}` : ""}
              </p>
            )}
            <div className="srcv-tabs" role="tablist" aria-label="Invoice sections">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`srcv-tab-${item.key}`}
                  aria-selected={tab === item.key}
                  aria-controls={`srcv-panel-${item.key}`}
                  className="sila-btn sila-btn--secondary sila-btn--sm srcv-tab"
                  disabled={busy !== null}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === "matching" && (
              <div id="srcv-panel-matching" role="tabpanel" aria-labelledby="srcv-tab-matching" className="srcv-stack">
                <SilaInvoiceSupplierMatch invoice={invoice} disabled={locked || busy !== null} onUpdated={handleMatched} />
                <SilaInvoicePoMatch invoice={invoice} disabled={locked || busy !== null} onUpdated={handleMatched} />
              </div>
            )}
            {tab === "history" && (
              <div id="srcv-panel-history" role="tabpanel" aria-labelledby="srcv-tab-history">
                <SilaInvoiceHistory invoiceId={invoice.id} version={`${readings}`} />
              </div>
            )}
            {tab === "review" && (
              <div id="srcv-panel-review" role="tabpanel" aria-labelledby="srcv-tab-review" className="srcv-stack">
                <div className="sila-form-grid">
                  {HEADER_FIELDS.map((field) => (
                    <div className="sila-field" key={field.key}>
                      <label className="sila-label" htmlFor={`srcv-inv-${field.key}`}>{field.label}</label>
                      <input
                        id={`srcv-inv-${field.key}`}
                        className="sila-input"
                        type={field.type}
                        step={field.type === "number" ? "any" : undefined}
                        value={form[field.key]}
                        disabled={locked || busy !== null}
                        onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                      />
                    </div>
                  ))}
                  <div className="sila-field">
                    <label className="sila-label" htmlFor="srcv-inv-type">Invoice type</label>
                    <select
                      id="srcv-inv-type"
                      className="sila-select"
                      value={form.invoiceType}
                      disabled={locked || busy !== null}
                      onChange={(event) => setForm({ ...form, invoiceType: event.target.value })}
                    >
                      <option value="">Not known</option>
                      {INVOICE_TYPES.map((type) => <option key={type} value={type}>{receivingLabel(type)}</option>)}
                    </select>
                    {form.invoiceType === "SERVICE" && <span className="srcv-sub">Goods receipt not applicable for a service invoice.</span>}
                  </div>
                  <div className="sila-field">
                    <label className="sila-label" htmlFor="srcv-inv-po">Purchase order</label>
                    <select
                      id="srcv-inv-po"
                      className="sila-select"
                      value={form.purchaseOrderId}
                      disabled={locked || busy !== null}
                      onChange={(event) => setForm({ ...form, purchaseOrderId: event.target.value, lines: form.lines.map((line) => ({ ...line, purchaseOrderItemId: "" })) })}
                    >
                      <option value="">Not linked</option>
                      {poOptions.map((order) => <option key={order.id} value={order.id}>{order.poNumber} — {order.supplierName || "Supplier"}</option>)}
                    </select>
                  </div>
                </div>
                <SilaInvoiceLinesEditor lines={form.lines} poLines={poLines} disabled={locked || busy !== null} onChange={(lines) => setForm({ ...form, lines })} />
                {invoice.goodsReceipts.length > 0 && (
                  <p className="srcv-sub">Goods receipts: {invoice.goodsReceipts.map((receipt) => receipt.grnNumber).join(", ")}</p>
                )}
                {invoice.ocrText && (
                  <details>
                    <summary>Text read by the OCR</summary>
                    <pre className="srcv-ocr-text">{invoice.ocrText}</pre>
                  </details>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaInvoiceReviewDialog;
