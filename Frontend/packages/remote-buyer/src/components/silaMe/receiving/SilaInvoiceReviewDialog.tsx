import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  decideInvoice,
  extractInvoice,
  getInvoice,
  getInvoiceFile,
  getInvoiceGrnPdf,
  getOpenPurchaseOrders,
  getPurchaseOrder,
  reconcileErpPosting,
  refreshInvoicePosting,
  reprocessErpPosting,
  rereadInvoice,
  submitInvoice,
  updateInvoice,
  type SilaInvoiceDetail,
  type SilaOpenPurchaseOrder,
  type SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import SilaInvoiceHistory from "./SilaInvoiceHistory";
import SilaInvoicePostingPanel from "./SilaInvoicePostingData";
import SilaInvoiceLinesEditor from "./SilaInvoiceLinesEditor";
import SilaInvoicePoMatch from "./SilaInvoicePoMatch";
import SilaInvoiceSupplierMatch from "./SilaInvoiceSupplierMatch";
import { INVOICE_TYPES, toInvoiceForm, toInvoiceWrite, toReceivePrefill, validateInvoiceForm, type InvoiceForm } from "./invoiceForm";
import { formatAmount, formatConfidence, openBlob, receivingBadgeClass, receivingLabel } from "./receivingFormat";
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

type Tab = "review" | "matching" | "posting" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Review" },
  { key: "matching", label: "Supplier & PO matching" },
  { key: "posting", label: "S/4 posting data" },
  { key: "history", label: "Reading history" },
];

/** OCR result and review form of an invoice: fields, supplier/PO/line matching, reading history; then receive the goods. */
const SilaInvoiceReviewDialog: React.FC<SilaInvoiceReviewDialogProps> = ({ invoiceId, canPost, onClose, onChanged, onReceive }) => {
  const [invoice, setInvoice] = useState<SilaInvoiceDetail | null>(null);
  const [form, setForm] = useState<InvoiceForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SilaOpenPurchaseOrder[]>([]);
  const [poLines, setPoLines] = useState<SilaPurchaseOrderLine[]>([]);
  const [busy, setBusy] = useState<"extract" | "reread" | "save" | "file" | "submit" | "decide" | "pdf" | "reprocess" | "reconcile" | "refresh" | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [readings, setReadings] = useState(0);
  const [deferred, setDeferred] = useState(false);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [sapReference, setSapReference] = useState("");

  const show = (data: SilaInvoiceDetail) => {
    setInvoice(data);
    setForm(toInvoiceForm(data));
    setEditing(false);
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

  const pastReceipt = invoice != null && [
    "GRN_IN_PROGRESS", "GRN_POSTED", "GRN_FAILED", "READY_FOR_INVOICE_SUBMISSION", "PENDING_APPROVAL", "APPROVED",
    "READY_TO_POST", "POSTING", "POSTED", "ERP_POSTING_FAILED", "GET_PO_FAILED", "VALIDATION_FAILED", "LOCAL_FINALIZATION_FAILED",
    "POSTING_UNKNOWN", "AWAITING_PAYMENT", "PARTIALLY_PAID", "PAID", "OVERDUE",
  ].includes(invoice.status);
  const retry = invoice != null && ["GET_PO_FAILED", "VALIDATION_FAILED", "ERP_POSTING_FAILED", "APPROVAL_REJECTED", "READY_TO_POST"].includes(invoice.status);
  const canExtract = canPost && invoice !== null && ["UPLOADED", "OCR_FAILED", "EXTRACTED", "REVIEW_REQUIRED"].includes(invoice.status);
  // A re-read keeps the fields the user corrected; it is the only reading of a reviewed invoice.
  const canReread = canPost && invoice !== null && ["EXTRACTED", "REVIEW_REQUIRED", "REVIEWED"].includes(invoice.status);
  const prefill = invoice && !pastReceipt && invoice.goodsReceiptApplicable !== false && invoice.goodsReceipts.length === 0
    ? toReceivePrefill(invoice)
    : null;
  const grn = invoice?.goodsReceipts.find((receipt) => receipt.status === "POSTED" || receipt.erpStatus === "POSTED" || receipt.erpStatus === "ERP_ACCEPTED" || Boolean(receipt.erpReference)) ?? invoice?.goodsReceipts[0];
  const postedGrns = (invoice?.goodsReceipts ?? []).filter((receipt) => receipt.status === "POSTED" || receipt.erpStatus === "POSTED" || receipt.erpStatus === "ERP_ACCEPTED" || Boolean(receipt.erpReference));
  const supplierKey = invoice?.silaSupplierId || invoice?.supplierId;
  const erpAccepted = Boolean(invoice?.erpReference) || invoice?.erpStatus === "POSTED" || invoice?.erpStatus === "ERP_ACCEPTED";
  const readyToSubmit = Boolean(
    canPost && invoice && supplierKey && invoice.invoiceNumber && invoice.poNumber && invoice.purchaseOrderId
    && invoice.status === "GRN_POSTED" && postedGrns.length === 1 && !erpAccepted
    && invoice.erpStatus !== "PENDING" && invoice.erpStatus !== "UNKNOWN" && invoice.erpStatus !== "FAILED_LOCAL",
  );
  const canRetry = Boolean(
    canPost && invoice && supplierKey && invoice.invoiceNumber && invoice.poNumber && invoice.purchaseOrderId
    && retry && postedGrns.length >= 1 && !erpAccepted
    && invoice.erpStatus !== "PENDING" && invoice.erpStatus !== "UNKNOWN" && invoice.erpStatus !== "FAILED_LOCAL",
  );
  const canSubmit = Boolean(invoice?.canSubmitInvoice) || readyToSubmit || canRetry;
  const askSubmit = Boolean(canSubmit && !retry && grn && !invoice?.goodsReceiptNote);
  const posted = erpAccepted || invoice?.status === "AWAITING_PAYMENT" || invoice?.status === "POSTED" || invoice?.status === "PAID" || invoice?.status === "PARTIALLY_PAID" || invoice?.status === "OVERDUE";
  const sealed = posted || invoice?.status === "POSTING" || invoice?.status === "PENDING_APPROVAL" || invoice?.status === "POSTING_UNKNOWN" || invoice?.status === "LOCAL_FINALIZATION_FAILED" || invoice?.status === "GRN_IN_PROGRESS";
  const canEdit = Boolean(canPost && invoice && pastReceipt && !sealed);
  const fieldsLocked = !canPost || sealed || (pastReceipt && !editing);
  const postingFailed = invoice?.status === "ERP_POSTING_FAILED" || (invoice?.erpStatus === "FAILED" && !posted);
  const submitLabel = busy === "submit" ? (retry ? "Resubmitting..." : "Submitting...") : (retry ? "Resubmit" : "Submit invoice");

  const run = async (kind: "extract" | "reread" | "save" | "file" | "submit" | "decide" | "pdf" | "reprocess" | "reconcile" | "refresh", action: () => Promise<void>) => {
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

  const openGrnPdf = (goodsReceiptId: string, downloadName?: string) => run("pdf", async () => {
    const blob = await getInvoiceGrnPdf(invoiceId, goodsReceiptId);
    if (downloadName) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    openBlob(blob);
  });

  const handleSubmit = () => run("submit", async () => {
    const data = await submitInvoice(invoiceId);
    show(data);
    setDeferred(false);
    onChanged();
    if (data.status === "PENDING_APPROVAL") toastService.success("Invoice submitted for approval.");
    else if (data.paymentStatus || data.status === "AWAITING_PAYMENT" || data.status === "POSTED") toastService.success("Invoice posted successfully.");
    else toastService.success("Invoice submitted.");
  });

  const handleDecision = (approve: boolean) => run("decide", async () => {
    if (!approve && comment.trim() === "") {
      toastService.error("A comment is required.");
      return;
    }
    const data = await decideInvoice(invoiceId, approve, comment);
    show(data);
    onChanged();
    toastService.success(approve ? "Approval recorded." : "Invoice rejected. SAP was not called.");
  });

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
        primaryButton: fieldsLocked || !form || tab !== "review" ? undefined : { text: "Save review", onClick: handleSave, loading: busy === "save", disabled: busy !== null },
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
              {canEdit && !editing && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => { setEditing(true); setTab("review"); }}>
                  Edit
                </button>
              )}
              {canSubmit && (deferred || !askSubmit) && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={handleSubmit}>
                  {submitLabel}
                </button>
              )}
            </div>
            {askSubmit && !deferred && grn && (
              <div className="sila-alert sila-alert--success" role="status">
                <p><strong>GRN Posted Successfully</strong></p>
                <p>GRN: {grn.grnNumber}{grn.erpReference ? ` (${grn.erpReference})` : ""}</p>
                <div className="srcv-actions">
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => openGrnPdf(grn.id)}>View GRN PDF</button>
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => setDeferred(true)}>Not now</button>
                  <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={handleSubmit}>
                    {submitLabel}
                  </button>
                </div>
                <p>Would you like to submit the invoice?</p>
              </div>
            )}
            {posted && (
              <div className="sila-alert sila-alert--success" role="status">
                <p><strong>INVOICE POSTED SUCCESSFULLY</strong></p>
                <p>Supplier Invoice: {invoice.invoiceNumber || invoice.fileName}</p>
                <p>PO: {invoice.poNumber || "—"}</p>
                <p>GRN: {invoice.goodsReceipts.map((receipt) => receipt.grnNumber).join(", ") || "—"}</p>
                <p>SAP Invoice: {invoice.erpReference || "—"}</p>
                <p>Status: {receivingLabel(invoice.paymentStatus || invoice.status)}</p>
              </div>
            )}
            {invoice.status === "GET_PO_FAILED" && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>Purchase order read failed</strong></p>
                <p>{invoice.erpMessage && !/POST_INVOICE/i.test(invoice.erpMessage) ? invoice.erpMessage : "The purchase order could not be read for invoice posting. The purchase order API has to return the company code, supplier, currency, purchase order item and unit of measure."}</p>
                <div className="srcv-actions">
                  {canEdit && !editing && (
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => { setEditing(true); setTab("review"); }}>Edit</button>
                  )}
                  {canSubmit && (
                    <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={handleSubmit}>{submitLabel}</button>
                  )}
                </div>
              </div>
            )}
            {postingFailed && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>INVOICE POSTING FAILED</strong></p>
                <p>Reason: {invoice.erpMessage || "The ERP did not accept the invoice."}</p>
                {invoice.erpPostingId && (
                  <div className="srcv-actions">
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("reprocess", async () => {
                      await reprocessErpPosting(invoice.erpPostingId!);
                      show(await getInvoice(invoiceId));
                      onChanged();
                      toastService.success("Invoice posting reprocessed from the stored posting data.");
                    })}>
                      Reprocess
                    </button>
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("refresh", async () => {
                      show(await refreshInvoicePosting(invoiceId));
                      onChanged();
                      setTab("posting");
                      toastService.success("Posting data refreshed from S/4. The invoice was not posted.");
                    })}>
                      Refresh from S/4
                    </button>
                  </div>
                )}
              </div>
            )}
            {invoice.status === "LOCAL_FINALIZATION_FAILED" && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>SAP invoice was created successfully. SILA local finalization requires reprocessing.</strong></p>
                <p>Reprocessing will update SILA only. SAP will not be called again.</p>
                <p>SAP Invoice: {invoice.erpReference || "—"}</p>
                {invoice.erpPostingId && (
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("reprocess", async () => {
                    await reprocessErpPosting(invoice.erpPostingId!);
                    show(await getInvoice(invoiceId));
                    onChanged();
                  })}>
                    Reprocess local
                  </button>
                )}
              </div>
            )}
            {(invoice.status === "POSTING_UNKNOWN" || invoice.erpStatus === "UNKNOWN") && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>Posting status unknown</strong></p>
                <p>SAP may have created the invoice. Reconcile it before anything is sent again. There is no blind retry.</p>
                {invoice.erpPostingId && (
                  <div className="srcv-actions">
                    <input className="sila-input" placeholder="SAP invoice reference" value={sapReference} onChange={(event) => setSapReference(event.target.value)} />
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null || sapReference.trim() === ""} onClick={() => run("reconcile", async () => {
                      await reconcileErpPosting(invoice.erpPostingId!, true, sapReference);
                      show(await getInvoice(invoiceId));
                      onChanged();
                    })}>
                      SAP created it
                    </button>
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("reconcile", async () => {
                      await reconcileErpPosting(invoice.erpPostingId!, false, "");
                      show(await getInvoice(invoiceId));
                      onChanged();
                    })}>
                      Not posted
                    </button>
                  </div>
                )}
              </div>
            )}
            {invoice.status === "PENDING_APPROVAL" && (
              <div className="sila-alert" role="status">
                <p><strong>Waiting for approval</strong></p>
                <label className="sila-label" htmlFor="srcv-approval-comment">Comment</label>
                <input id="srcv-approval-comment" className="sila-input" value={comment} onChange={(event) => setComment(event.target.value)} />
                <div className="srcv-actions">
                  <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={() => handleDecision(true)}>Approve</button>
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => handleDecision(false)}>Reject</button>
                </div>
              </div>
            )}
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
            {invoice.status === "VALIDATION_FAILED" && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>Posting data is incomplete</strong></p>
                <p>SAP was not called. The missing values are on S/4 posting data.</p>
              </div>
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
                <SilaInvoiceSupplierMatch invoice={invoice} disabled={fieldsLocked || busy !== null} onUpdated={handleMatched} />
                <SilaInvoicePoMatch invoice={invoice} disabled={fieldsLocked || busy !== null} onUpdated={handleMatched} />
              </div>
            )}
            {tab === "posting" && (
              <div id="srcv-panel-posting" role="tabpanel" aria-labelledby="srcv-tab-posting">
                <SilaInvoicePostingPanel
                  posting={invoice.postingData}
                  canRefresh={canPost && invoice.status !== "POSTING" && invoice.status !== "POSTED" && invoice.status !== "POSTING_UNKNOWN" && invoice.status !== "LOCAL_FINALIZATION_FAILED"}
                  busy={busy !== null}
                  onRefresh={() => run("refresh", async () => {
                    show(await refreshInvoicePosting(invoiceId));
                    onChanged();
                    toastService.success("Posting data refreshed from S/4. The invoice was not posted.");
                  })}
                />
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
                        disabled={fieldsLocked || busy !== null}
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
                      disabled={fieldsLocked || busy !== null}
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
                      disabled={fieldsLocked || busy !== null}
                      onChange={(event) => setForm({ ...form, purchaseOrderId: event.target.value, lines: form.lines.map((line) => ({ ...line, purchaseOrderItemId: "" })) })}
                    >
                      <option value="">Not linked</option>
                      {poOptions.map((order) => <option key={order.id} value={order.id}>{order.poNumber} — {order.supplierName || "Supplier"}</option>)}
                    </select>
                  </div>
                </div>
                <SilaInvoiceLinesEditor lines={form.lines} poLines={poLines} disabled={fieldsLocked || busy !== null} onChange={(lines) => setForm({ ...form, lines })} />
                {(invoice.timeline ?? []).length > 0 && (
                  <div>
                    <h3 className="sila-section-title">Lifecycle</h3>
                    <ul>
                      {invoice.timeline?.map((step) => (
                        <li key={step.step}>
                          {step.status === "SUCCESS" ? "✓" : step.status === "FAILED" ? "✕" : "○"} {step.step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="sila-section-title">Attachments</h3>
                  {(invoice.documents ?? []).length === 0 ? <p className="srcv-sub">No documents stored.</p> : (
                    <ul>
                      {invoice.documents?.map((document) => (
                        <li key={`${document.documentType}-${document.fileName}-${document.goodsReceiptId ?? ""}`}>
                          <span>{document.documentType}</span>
                          {document.grnNumber ? <span> · GRN {document.grnNumber}</span> : null}
                          {document.poNumber ? <span> · PO {document.poNumber}</span> : null}
                          {document.generatedOn ? <span> · {document.generatedOn.slice(0, 10)}</span> : null}
                          <span> · {document.fileName}</span>
                          {document.documentType === "Original Supplier Invoice" && (
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={handleFile}>View</button>
                          )}
                          {document.goodsReceiptId && (
                            <>
                              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => openGrnPdf(document.goodsReceiptId!)}>View</button>
                              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => openGrnPdf(document.goodsReceiptId!, document.fileName)}>Download</button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="sila-section-title">Payment</h3>
                  <p className="srcv-sub">Supplier invoice: {invoice.invoiceNumber || "—"}</p>
                  <p className="srcv-sub">SAP invoice: {invoice.erpReference || "—"}</p>
                  <p className="srcv-sub">Amount: {formatAmount(invoice.grossAmount, invoice.currency)}</p>
                  <p className="srcv-sub">Invoice date: {invoice.invoiceDate?.slice(0, 10) || "—"}</p>
                  <p className="srcv-sub">Due date: —</p>
                  <p className="srcv-sub">Payment status: {receivingLabel(invoice.paymentStatus)}</p>
                  <p className="srcv-sub">Paid amount: —</p>
                  <p className="srcv-sub">Outstanding: {formatAmount(invoice.outstandingAmount, invoice.currency)}</p>
                  <p className="srcv-sub">Payment date: —</p>
                  <p className="srcv-sub">Payment reference: —</p>
                  <p className="srcv-sub">Payment integration: {invoice.paymentIntegration || "NOT CONFIGURED"}</p>
                </div>
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
