import React, { useEffect, useRef, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  decideInvoice,
  extractInvoice,
  getGoodsReceipt,
  getGoodsReceipts,
  copyInvoice,
  getInvoice,
  getInvoiceFile,
  getOpenPurchaseOrders,
  getPurchaseOrder,
  linkInvoiceGoodsReceipts,
  reconcileErpPosting,
  refreshInvoicePosting,
  reprocessErpPosting,
  reprocessInvoiceAttachment,
  rereadInvoice,
  submitInvoice,
  updateInvoice,
  type SilaGoodsReceipt,
  type SilaInvoiceDetail,
  type SilaOpenPurchaseOrder,
  type SilaPurchaseOrderDetail,
  type SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import SilaInvoiceHistory from "./SilaInvoiceHistory";
import SilaInvoicePostingPanel from "./SilaInvoicePostingData";
import SilaInvoiceLinesEditor from "./SilaInvoiceLinesEditor";
import SilaInvoicePoMatch from "./SilaInvoicePoMatch";
import SilaInvoiceSupplierMatch from "./SilaInvoiceSupplierMatch";
import { INVOICE_TYPES, toInvoiceForm, toInvoiceWrite, toReceivePrefill, validateInvoiceForm, type InvoiceForm } from "./invoiceForm";
import { billableQuantity, invoiceHoldsGoodsReceipt, selectGoodsReceipts } from "./goodsReceiptMatch";
import { formatAmount, formatConfidence, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import type { ReceivePrefill } from "./SilaReceiveGoodsDialog";

interface SilaInvoiceReviewDialogProps {
  invoiceId: string;
  canPost: boolean;
  onClose: () => void;
  /** The invoice changed (read, saved). */
  onChanged: () => void;
  /** Opens the receive flow prefilled from the invoice. */
  onReceive: (prefill: ReceivePrefill) => void;
  /** Opens the copied invoice. */
  onCopied?: (invoiceId: string) => void;
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
type Busy = "extract" | "reread" | "save" | "file" | "submit" | "decide" | "reprocess" | "reconcile" | "refresh" | "link" | "attachment" | "copy";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Review" },
  { key: "matching", label: "Supplier & PO matching" },
  { key: "posting", label: "S/4 posting data" },
  { key: "history", label: "Reading history" },
];

const compactKey = (value?: string | null): string => (value || "").replace(/\s+/g, "");

/** SAP invoice number and fiscal year, with no separator. 5105601144 + 2026 = 51056011442026. */
const linkedSapObjectKey = (invoice: SilaInvoiceDetail): string => {
  const stored = invoice.attachment?.linkedSapObjectKey?.trim();
  if (stored) return stored;
  const number = compactKey(invoice.erpReference);
  const year = compactKey(invoice.fiscalYear);
  return number && year ? `${number}${year}` : "—";
};

const attachmentStatus = (invoice: SilaInvoiceDetail): string => {
  const status = invoice.attachment?.status?.trim();
  if (status && status !== "Not started") return status;
  return linkedSapObjectKey(invoice) === "—" ? "Not started" : "Pending";
};

/** OCR result and review form of an invoice: fields, supplier/PO/line matching, reading history; then receive the goods. */
const SilaInvoiceReviewDialog: React.FC<SilaInvoiceReviewDialogProps> = ({ invoiceId, canPost, onClose, onChanged, onReceive, onCopied }) => {
  const [invoice, setInvoice] = useState<SilaInvoiceDetail | null>(null);
  const [form, setForm] = useState<InvoiceForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<SilaOpenPurchaseOrder[]>([]);
  const [order, setOrder] = useState<SilaPurchaseOrderDetail | null>(null);
  const [poLines, setPoLines] = useState<SilaPurchaseOrderLine[]>([]);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [readings, setReadings] = useState(0);
  const [deferred, setDeferred] = useState(false);
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState("");
  const [sapReference, setSapReference] = useState("");
  const [postingReviewed, setPostingReviewed] = useState(false);
  const [candidates, setCandidates] = useState<SilaGoodsReceipt[]>([]);
  const [grnPick, setGrnPick] = useState<string[] | null>(null);
  const [grnNote, setGrnNote] = useState<string | null>(null);
  const [matchReason, setMatchReason] = useState<string | null>(null);
  const [heldStatus, setHeldStatus] = useState<Record<string, { status?: string | null; erp?: string | null }>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"pdf" | "image">("pdf");
  const [previewTitle, setPreviewTitle] = useState("Invoice file");
  const previewUrlRef = useRef<string | null>(null);
  const autoLinkKey = useRef("");
  const grnPickRef = useRef<string[] | null>(null);
  grnPickRef.current = grnPick;

  const show = (data: SilaInvoiceDetail) => {
    setInvoice(data);
    setForm(toInvoiceForm(data));
    setEditing(false);
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    setPostingReviewed(false);
    setGrnPick(null);
    setGrnNote(null);
    setMatchReason(null);
    setHeldStatus({});
    setCandidates([]);
    autoLinkKey.current = "";
    grnPickRef.current = null;
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
    setOrder(null);
    setPoLines([]);
    if (!purchaseOrderId) return undefined;
    let active = true;
    getPurchaseOrder(purchaseOrderId)
      .then((loaded) => {
        if (!active) return;
        setOrder(loaded);
        setPoLines(loaded.lines);
      })
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
  const grn = invoice?.goodsReceipts.find((receipt) => receipt.status === "POSTED" || receipt.erpStatus === "POSTED" || receipt.erpStatus === "ERP_ACCEPTED" || Boolean(receipt.erpReference)) ?? invoice?.goodsReceipts[0];
  const postedGrns = (invoice?.goodsReceipts ?? []).filter((receipt) => receipt.status === "POSTED" || receipt.erpStatus === "POSTED" || receipt.erpStatus === "ERP_ACCEPTED" || Boolean(receipt.erpReference));
  const supplierKey = invoice?.silaSupplierId || invoice?.supplierId;
  const erpAccepted = Boolean(invoice?.erpReference) || invoice?.erpStatus === "POSTED" || invoice?.erpStatus === "ERP_ACCEPTED";
  const readyStatus = invoice != null && ["GRN_POSTED", "READY_FOR_INVOICE_SUBMISSION", "APPROVED", "REVIEWED", "EXTRACTED"].includes(invoice.status);
  const serviceReady = invoice?.goodsReceiptApplicable === false && (invoice.status === "REVIEWED" || invoice.status === "READY_FOR_INVOICE_SUBMISSION");
  const receiptAlreadyConfirmed = invoice?.status === "GRN_POSTED" || invoice?.status === "READY_FOR_INVOICE_SUBMISSION" || invoice?.status === "APPROVED";
  const readyToSubmit = Boolean(
    canPost && invoice && supplierKey && invoice.invoiceNumber && invoice.poNumber && invoice.purchaseOrderId
    && (serviceReady || (readyStatus && (postedGrns.length >= 1 || receiptAlreadyConfirmed)))
    && !erpAccepted
    && invoice.erpStatus !== "PENDING" && invoice.erpStatus !== "UNKNOWN" && invoice.erpStatus !== "FAILED_LOCAL",
  );
  const posted = erpAccepted || invoice?.status === "AWAITING_PAYMENT" || invoice?.status === "POSTED" || invoice?.status === "PAID" || invoice?.status === "PARTIALLY_PAID" || invoice?.status === "OVERDUE";
  const postingFailed = !posted && (invoice?.status === "ERP_POSTING_FAILED" || invoice?.erpStatus === "FAILED");
  const sealed = !postingFailed && (posted || invoice?.status === "POSTING" || invoice?.status === "PENDING_APPROVAL" || invoice?.status === "POSTING_UNKNOWN" || invoice?.status === "LOCAL_FINALIZATION_FAILED" || invoice?.status === "GRN_IN_PROGRESS");
  const grnLocked = posted || invoice?.status === "POSTING" || invoice?.status === "PENDING_APPROVAL" || invoice?.status === "POSTING_UNKNOWN" || invoice?.status === "LOCAL_FINALIZATION_FAILED";
  const prefill = invoice && !grnLocked && invoice.goodsReceiptApplicable !== false ? toReceivePrefill(invoice) : null;
  const canEdit = Boolean(canPost && invoice && pastReceipt && !sealed);
  const fieldsLocked = !canPost || sealed || (pastReceipt && !editing);
  const failedPosting = retry || postingFailed;
  const showSubmit = !failedPosting && (readyToSubmit || Boolean(invoice?.canSubmitInvoice));
  const showResubmit = Boolean(
    failedPosting && canPost && invoice && supplierKey && invoice.invoiceNumber && invoice.poNumber && invoice.purchaseOrderId
    && !erpAccepted
    && invoice.erpStatus !== "PENDING" && invoice.erpStatus !== "UNKNOWN" && invoice.erpStatus !== "FAILED_LOCAL",
  );
  const askSubmit = Boolean(showSubmit && grn && !invoice?.goodsReceiptNote);
  const submitLabel = busy === "submit" ? "Submitting..." : "Submit";
  const resubmitLabel = busy === "submit" ? "Resubmitting..." : "Resubmit";
  const linkedIds = (invoice?.goodsReceipts ?? []).map((receipt) => receipt.id);
  const selectedGrns = grnPick ?? linkedIds;
  const grnDirty = selectedGrns.length !== linkedIds.length || selectedGrns.some((id) => !linkedIds.includes(id));
  const receiptKey = linkedIds.join(",");
  const poNumbers = Array.from(new Set([
    invoice?.poNumber,
    ...(invoice?.purchaseOrders ?? []).map((row) => row.poNumber),
    ...(invoice?.items ?? []).map((row) => row.poNumber),
  ].filter((value): value is string => Boolean(value && value.trim())))).sort();
  const poKey = poNumbers.join("|");
  const demandKey = (form?.lines ?? []).map((line) => `${line.purchaseOrderItemId}:${line.quantity}`).join("|");

  const run = async (kind: Busy, action: () => Promise<void>) => {
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

  const showBlob = (blob: Blob, title: string) => {
    const url = URL.createObjectURL(blob);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPreviewKind(blob.type.startsWith("image/") ? "image" : "pdf");
    setPreviewTitle(title);
  };

  const handleFile = () => run("file", async () => showBlob(await getInvoiceFile(invoiceId), invoice?.fileName || "Invoice file"));

  const hideFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  };

  useEffect(() => {
    if (!invoice || invoice.goodsReceiptApplicable === false || poNumbers.length === 0) {
      setCandidates([]);
      return undefined;
    }
    const allowed = new Set([
      invoice.purchaseOrderId,
      ...(invoice.purchaseOrders ?? []).map((row) => row.id),
      ...invoice.items.map((row) => row.purchaseOrderId),
    ].filter((value): value is string => Boolean(value)));
    const linked = invoice.goodsReceipts;
    let active = true;
    Promise.all(poNumbers.map((poNumber) => getGoodsReceipts({ search: poNumber, fromDate: "", toDate: "" }, { index: 0, limit: 200 })))
      .then((pages) => {
        if (!active) return;
        const rows = pages.flat().filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index);
        const same = rows.filter((row) => allowed.has(row.purchaseOrderId) || poNumbers.includes(row.poNumber));
        const extras = linked.filter((row) => !same.some((candidate) => candidate.id === row.id));
        setCandidates([...extras, ...same]);
      })
      .catch((err: unknown) => {
        if (active) setGrnNote(err instanceof Error ? err.message : "Could not load the goods receipts.");
      });
    return () => {
      active = false;
    };
  }, [invoice, poKey, receiptKey]);

  useEffect(() => {
    if (!canPost || !invoice || invoice.goodsReceiptApplicable === false || grnLocked || grnPick !== null) return undefined;
    if (candidates.length === 0) {
      setMatchReason(null);
      return undefined;
    }
    let settled = false;
    const invoiceId = invoice.id;
    const demand = (form?.lines ?? []).length > 0
      ? form!.lines.filter((line) => Number(line.quantity) > 0).map((line) => ({ purchaseOrderItemId: line.purchaseOrderItemId || null, quantity: Number(line.quantity) }))
      : invoice.items.filter((item) => (item.quantity ?? 0) > 0).map((item) => ({ purchaseOrderItemId: item.purchaseOrderItemId, quantity: item.quantity ?? 0 }));
    const linked = invoice.goodsReceipts.map((row) => row.id);
    let active = true;
    (async () => {
      const details = await Promise.all(candidates.map(async (row) => {
        try {
          return await getGoodsReceipt(row.id);
        } catch {
          return null;
        }
      }));
      if (!active) return;
      const statusOf = new Map<string, { status?: string | null; erp?: string | null }>();
      candidates.forEach((row) => {
        if (row.invoiceId && row.invoiceId !== invoiceId) statusOf.set(row.invoiceId, { status: row.invoiceStatus, erp: row.invoiceErpStatus });
      });
      await Promise.all([...statusOf.entries()].filter(([, value]) => !value.status).map(async ([id]) => {
        try {
          const held = await getInvoice(id);
          if (active) statusOf.set(id, { status: held.status, erp: held.erpStatus });
        } catch {
          if (active) statusOf.set(id, { status: "POSTED", erp: null });
        }
      }));
      if (!active) return;
      const known: Record<string, { status?: string | null; erp?: string | null }> = {};
      statusOf.forEach((value, id) => { known[id] = value; });
      setHeldStatus(known);
      const choice = selectGoodsReceipts(demand, candidates.map((row, index) => {
        const held = row.invoiceId && row.invoiceId !== invoiceId ? statusOf.get(row.invoiceId) : undefined;
        const available = !row.invoiceId || row.invoiceId === invoiceId || !invoiceHoldsGoodsReceipt(held?.status ?? row.invoiceStatus, held?.erp ?? row.invoiceErpStatus);
        return {
          id: row.id,
          grnNumber: row.grnNumber,
          available,
          lines: (details[index]?.items ?? []).map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            quantity: billableQuantity(item.acceptedQty, item.receivedQty),
          })),
        };
      }));
      if (grnPickRef.current !== null) {
        setMatchReason(choice.reason || null);
        return;
      }
      setMatchReason(choice.reason || (demand.length > 0 ? "No goods receipt matches these quantities exactly. Select one, or several that add up to the invoice." : null));
      if (choice.ids.length === 0) return;
      const already = choice.ids.length === linked.length && choice.ids.every((id) => linked.includes(id));
      if (already) return;
      const key = `${invoiceId}:${[...choice.ids].sort().join(",")}`;
      if (autoLinkKey.current === key) return;
      autoLinkKey.current = key;
      try {
        const data = await linkInvoiceGoodsReceipts(invoiceId, choice.ids);
        if (!active) return;
        show(data);
        setGrnNote(null);
        onChanged();
        toastService.success(choice.reason);
      } catch (err: unknown) {
        if (!active) return;
        setGrnPick(choice.ids);
        setGrnNote(err instanceof Error ? err.message : "Could not save the goods receipt match.");
      } finally {
        settled = true;
      }
    })();
    return () => {
      active = false;
      if (!settled && autoLinkKey.current.startsWith(`${invoice.id}:`)) autoLinkKey.current = "";
    };
  }, [candidates, canPost, demandKey, grnLocked, grnPick, invoice]);

  const toggleGrn = (id: string) => {
    setGrnPick(selectedGrns.includes(id) ? selectedGrns.filter((row) => row !== id) : [...selectedGrns, id]);
  };

  const saveGrns = () => run("link", async () => {
    const data = await linkInvoiceGoodsReceipts(invoiceId, selectedGrns);
    setGrnPick(null);
    setGrnNote(null);
    show(data);
    onChanged();
    toastService.success("Goods receipt selection saved.");
  });

  const handleSubmit = () => {
    if (!postingReviewed && !postingFailed) {
      setPostingReviewed(true);
      setTab("posting");
      toastService.success("Review the purchase order and the invoice values. Submit to S/4 when they are right.");
      return;
    }
    run("submit", async () => {
      const data = await submitInvoice(invoiceId);
      show(data);
      setDeferred(false);
      onChanged();
      if (data.status === "PENDING_APPROVAL") toastService.success("Invoice submitted for approval.");
      else if (data.paymentStatus || data.status === "AWAITING_PAYMENT" || data.status === "POSTED") toastService.success("Invoice posted successfully.");
      else toastService.success(postingFailed ? "Invoice resubmitted." : "Invoice submitted.");
    });
  };

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
              {invoice.creationType && <span className="sila-badge sila-badge--info">{receivingLabel(invoice.creationType)}</span>}
              {invoice.companyCode && <span className="srcv-sub">Company {invoice.companyCode}</span>}
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
              {previewUrl && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={hideFile}>
                  Hide file
                </button>
              )}
              {canPost && prefill && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={() => onReceive(prefill)}>
                  Create GRN from invoice
                </button>
              )}
              {canPost && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("copy", async () => {
                  const created = await copyInvoice(invoiceId);
                  toastService.success("Invoice copied. The copy is not posted to SAP.");
                  onChanged();
                  setError(null);
                  setInvoice(null);
                  setForm(null);
                  if (onCopied) onCopied(created);
                })}>
                  {busy === "copy" ? "Copying..." : "Copy"}
                </button>
              )}
              {canEdit && !editing && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => { setEditing(true); setTab("review"); }}>
                  Edit
                </button>
              )}
              {postingFailed && invoice.erpPostingId && (
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("refresh", async () => {
                  show(await refreshInvoicePosting(invoiceId));
                  onChanged();
                  setTab("posting");
                  toastService.success("Posting data refreshed from S/4. The invoice was not posted.");
                })}>
                  {busy === "refresh" ? "Refreshing..." : "Refresh from S/4"}
                </button>
              )}
              {showSubmit && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={handleSubmit}>
                  {submitLabel}
                </button>
              )}
              {showResubmit && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== null} onClick={handleSubmit}>
                  {resubmitLabel}
                </button>
              )}
            </div>
            {askSubmit && !deferred && grn && (
              <div className="sila-alert sila-alert--success" role="status">
                <p><strong>GRN Posted Successfully</strong></p>
                <p>GRN: {grn.grnNumber}{grn.erpReference ? ` (${grn.erpReference})` : ""}</p>
                <div className="srcv-actions">
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
              </div>
            )}
            {postingFailed && (
              <div className="sila-alert sila-alert--warning" role="status">
                <p><strong>Invoice posting failed</strong></p>
                <p className="srcv-error">{invoice.erpMessage || "The ERP did not accept the invoice."}</p>
                <p>Edit the invoice if a value is wrong, refresh the purchase order from S/4 if that data is stale, then resubmit. Resubmit sends this document to SAP again.</p>
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
            {previewUrl && (
              <div className="srcv-stack">
                <p className="srcv-sub">{previewTitle}</p>
                {previewKind === "image" ? (
                  <img className="srcv-file-view" src={previewUrl} alt={previewTitle} />
                ) : (
                  <iframe className="srcv-file-view" title={previewTitle} src={previewUrl} />
                )}
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
                  onClick={() => {
                    setTab(item.key);
                    if (item.key === "posting") setPostingReviewed(true);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === "matching" && (
              <div id="srcv-panel-matching" role="tabpanel" aria-labelledby="srcv-tab-matching" className="srcv-stack">
                <SilaInvoiceSupplierMatch invoice={invoice} disabled={fieldsLocked || busy !== null} onUpdated={handleMatched} />
                {invoice.creationType === "NON_PO" ? (
                  <p className="srcv-sub">Non-PO invoice — purchase order matching is not used. Expense lines and account assignments are on the Review tab and S/4 posting data.</p>
                ) : (
                  <SilaInvoicePoMatch invoice={invoice} disabled={fieldsLocked || busy !== null} onUpdated={handleMatched} />
                )}
              </div>
            )}
            {tab === "posting" && (
              <div id="srcv-panel-posting" role="tabpanel" aria-labelledby="srcv-tab-posting">
                <SilaInvoicePostingPanel
                  posting={invoice.postingData}
                  invoice={invoice}
                  order={order}
                  canRefresh={!postingFailed && canPost && invoice.status !== "POSTING" && invoice.status !== "POSTED" && invoice.status !== "POSTING_UNKNOWN" && invoice.status !== "LOCAL_FINALIZATION_FAILED"}
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
                {invoice.goodsReceiptApplicable !== false && (
                  <div className="srcv-stack">
                    <h3 className="sila-section-title">Goods receipts</h3>
                    <p className="srcv-sub">
                      The goods receipt whose quantities equal the invoice lines is selected, including one that sits on an invoice that was not posted. Several receipts can be combined, and receipts from every purchase order on this invoice are included. Create a goods receipt when none of them match.
                    </p>
                    {matchReason && <p className="srcv-sub">{matchReason}</p>}
                    {!invoice.purchaseOrderId ? (
                      <p className="srcv-sub">Match a purchase order to see its goods receipts.</p>
                    ) : candidates.length === 0 ? (
                      <p className="srcv-sub">No goods receipt for this purchase order yet. Create one from the invoice.</p>
                    ) : (
                      <ul className="srcv-grn-list">
                        {candidates.map((receipt) => {
                          const otherInvoice = Boolean(receipt.invoiceId && receipt.invoiceId !== invoice.id);
                          const known = receipt.invoiceStatus
                            ? { status: receipt.invoiceStatus, erp: receipt.invoiceErpStatus }
                            : receipt.invoiceId ? heldStatus[receipt.invoiceId] : undefined;
                          const held = otherInvoice && Boolean(known) && invoiceHoldsGoodsReceipt(known?.status, known?.erp);
                          const reusable = otherInvoice && Boolean(known?.status) && !held;
                          return (
                            <li key={receipt.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={selectedGrns.includes(receipt.id)}
                                  disabled={grnLocked || busy !== null || held}
                                  onChange={() => toggleGrn(receipt.id)}
                                />
                                <span>
                                  {receipt.erpReference?.trim() || receipt.grnNumber} · {receivingLabel(receipt.status)}
                                  {receipt.poNumber ? ` · ${receipt.poNumber}` : ""}
                                  {receipt.erpReference ? ` · ${receipt.grnNumber}` : ""}
                                  {held ? ` · already posted on invoice ${receipt.invoiceNumber || "another invoice"}` : ""}
                                  {reusable ? ` · on invoice ${receipt.invoiceNumber || "another invoice"}, not posted — available` : ""}
                                  {otherInvoice && !held && !reusable ? ` · on invoice ${receipt.invoiceNumber || "another invoice"} — available if that invoice was not posted` : ""}
                                  {!receipt.invoiceId ? " · no invoice" : ""}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {grnNote && <p className="srcv-error" role="status">{grnNote}</p>}
                    {invoice.purchaseOrderId && (grnDirty || grnNote) && (
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={grnLocked || busy !== null} onClick={saveGrns}>
                        {busy === "link" ? "Saving..." : "Save goods receipt selection"}
                      </button>
                    )}
                  </div>
                )}
                <div>
                  <h3 className="sila-section-title">S/4 posting</h3>
                  <p className="srcv-sub">SAP Invoice Number: {invoice.erpReference || "—"}</p>
                  <p className="srcv-sub">Fiscal Year: {invoice.fiscalYear || "—"}</p>
                  <p className="srcv-sub">Posting Status: {invoice.erpStatus ? receivingLabel(invoice.erpStatus) : "—"}</p>
                </div>
                <div>
                  <h3 className="sila-section-title">S/4 attachment</h3>
                  <p className="srcv-sub">Business Object: {invoice.attachment?.businessObject || "Supplier Invoice"}</p>
                  <p className="srcv-sub">Business Object Type: {invoice.attachment?.businessObjectType || "BUS2081"}</p>
                  <p className="srcv-sub">Linked SAP Object Key: {linkedSapObjectKey(invoice)}</p>
                  <p className="srcv-sub">Document: {invoice.attachment?.fileName || invoice.fileName || "—"}</p>
                  <p className="srcv-sub">Attachment path: {invoice.attachment?.url || "—"}</p>
                  <p className="srcv-sub">Attachment Status: {attachmentStatus(invoice)}</p>
                  {invoice.attachment?.httpStatus != null && <p className="srcv-sub">HTTP status: {invoice.attachment.httpStatus}</p>}
                  <p className="srcv-sub">Last Attempt: {invoice.attachment?.lastAttempt ? invoice.attachment.lastAttempt.replace("T", " ").slice(0, 19) : "—"}</p>
                  {invoice.attachment?.message && <p className={attachmentStatus(invoice) === "Failed" ? "srcv-error" : "srcv-sub"}>{invoice.attachment.message}</p>}
                  {invoice.attachment?.canReprocess && (
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary sila-btn--sm"
                      disabled={busy !== null}
                      onClick={() => run("attachment", async () => {
                        const updated = await reprocessInvoiceAttachment(invoiceId);
                        show(updated);
                        onChanged();
                        const failed = attachmentStatus(updated) === "Failed";
                        if (failed) toastService.error(updated.attachment?.message || "The attachment was not accepted. The invoice was not posted again.");
                        else toastService.success(updated.attachment?.message || "Attachment updated. The invoice posting was not sent again.");
                      })}
                    >
                      {busy === "attachment"
                        ? "Sending..."
                        : attachmentStatus(invoice) === "Failed"
                          ? "Reprocess Attachment"
                          : "Send attachment"}
                    </button>
                  )}
                </div>
                {(invoice.timeline ?? []).length > 0 && (
                  <div>
                    <h3 className="sila-section-title">Lifecycle</h3>
                    <ul>
                      {invoice.timeline?.filter((step) => step.step !== "GRN PDF").map((step) => (
                        <li key={step.step}>
                          {step.status === "SUCCESS" ? "✓" : step.status === "FAILED" ? "✕" : "○"} {step.step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h3 className="sila-section-title">Attachments</h3>
                  {(invoice.documents ?? []).filter((document) => document.documentType !== "GRN PDF").length === 0 ? <p className="srcv-sub">No documents stored.</p> : (
                    <ul>
                      {invoice.documents?.filter((document) => document.documentType !== "GRN PDF").map((document) => (
                        <li key={`${document.documentType}-${document.fileName}`}>
                          <span>{document.documentType}</span>
                          {document.poNumber ? <span> · PO {document.poNumber}</span> : null}
                          {document.generatedOn ? <span> · {document.generatedOn.slice(0, 10)}</span> : null}
                          <span> · {document.fileName}</span>
                          {document.documentType === "Original Supplier Invoice" && (
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={handleFile}>View</button>
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
