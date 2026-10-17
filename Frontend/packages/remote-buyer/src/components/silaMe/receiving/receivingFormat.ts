import { formatQty, silaLabel } from "../../../api/silaMe/silaInventoryApi";

const LABELS: Record<string, string> = {
  // Purchase order
  CREATED: "Open",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  // Goods receipt
  POSTED: "Posted",
  // Invoice
  UPLOADED: "Uploaded",
  EXTRACTED: "Read by OCR",
  REVIEW_REQUIRED: "Needs review",
  OCR_FAILED: "OCR failed",
  REVIEWED: "Reviewed",
  GRN_POSTED: "Goods received",
  GRN_IN_PROGRESS: "Goods receipt posting",
  GRN_FAILED: "Goods receipt failed",
  READY_FOR_INVOICE_SUBMISSION: "Ready to submit",
  PENDING_APPROVAL: "Pending approval",
  APPROVAL_REJECTED: "Approval rejected",
  READY_TO_POST: "Ready to post",
  POSTING: "Posting",
  ERP_POSTING_FAILED: "Invoice posting failed",
  GET_PO_FAILED: "Purchase order read failed",
  VALIDATION_FAILED: "Validation failed",
  POSTING_DATA_STALE: "Posting data needs a refresh",
  LOCAL_FINALIZATION_FAILED: "Local finalization failed",
  POSTING_UNKNOWN: "Posting unknown",
  AWAITING_PAYMENT: "Awaiting payment",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  ERP_ACCEPTED: "Accepted by SAP",
  FAILED_LOCAL: "Local finalization failed",
  // ERP posting
  PENDING: "Pending",
  FAILED: "Failed",
  SKIPPED: "Skipped",
  UNKNOWN: "Unknown — reconcile",
  OPEN: "Open",
  INVOICE: "Invoice",
  // Master data
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  // Invoice line match
  MATCHED: "Matched",
  UNMATCHED: "Unmatched",
  SUGGESTED: "Suggested",
  // Invoice type and supplier status
  MATERIAL: "Material",
  SERVICE: "Service",
  MIXED: "Mixed",
  BLOCKED: "Blocked",
};

// Tones of the prototype: good, bad and warn; everything else is blue (info).
const DANGER = ["FAILED", "OCR_FAILED", "CANCELLED", "INACTIVE", "REJECTED", "BLOCKED", "GRN_FAILED", "ERP_POSTING_FAILED", "GET_PO_FAILED", "VALIDATION_FAILED", "APPROVAL_REJECTED", "LOCAL_FINALIZATION_FAILED", "FAILED_LOCAL", "POSTING_UNKNOWN"];
const SUCCESS = ["POSTED", "RECEIVED", "GRN_POSTED", "REVIEWED", "CLOSED", "ACTIVE", "PROCESSED", "APPROVED", "MATCHED", "AWAITING_PAYMENT", "PAID", "READY_FOR_INVOICE_SUBMISSION", "ERP_ACCEPTED"];
const WARNING = ["PENDING", "PARTIALLY_RECEIVED", "SKIPPED", "UNKNOWN", "REVIEW_REQUIRED", "READY_TO_POST", "PROCESSING", "SUGGESTED", "GRN_IN_PROGRESS", "PENDING_APPROVAL", "POSTING", "PARTIALLY_PAID", "OVERDUE"];

export const receivingLabel = (code?: string | null): string => (code ? LABELS[code] ?? silaLabel(code) : "—");

export const receivingBadgeClass = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  if (DANGER.includes(key)) return "sila-badge sila-badge--danger";
  if (SUCCESS.includes(key)) return "sila-badge sila-badge--success";
  if (WARNING.includes(key)) return "sila-badge sila-badge--warning";
  return "sila-badge sila-badge--info";
};

export const PAGE_SIZE = 20;

/** A number typed in a field, or null when it is empty or not a number. */
export const parseNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
};

/** A quantity with its unit of measure, e.g. "12 KG". */
export const formatQtyUom = (value: number, uom?: string | null): string => `${formatQty(value)}${uom ? ` ${uom}` : ""}`;

/** OCR confidence (0..1) as a percentage. */
export const formatConfidence = (value?: number | null): string =>
  value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;

export const formatAmount = (value?: number | null, currency?: string | null): string =>
  value === null || value === undefined
    ? "—"
    : `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

/** Opens a downloaded file in a new tab (the browser shows PDFs and images inline). */
export const openBlob = (blob: Blob): void => {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};
