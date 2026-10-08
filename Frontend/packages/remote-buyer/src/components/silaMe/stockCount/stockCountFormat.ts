const LABELS: Record<string, string> = {
  // Count
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  ENQUIRY_PENDING: "Enquiry pending",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
  // Count type
  MONTHLY: "Monthly",
  PERIODIC: "Periodic",
  SURPRISE: "Surprise",
  ADHOC: "Ad hoc",
  // Line
  NOT_COUNTED: "Not counted",
  COUNTED: "Counted",
  MATCHED: "Matched",
  SHORTAGE: "Shortage",
  SURPLUS: "Surplus",
  // Enquiry
  SENT: "Awaiting response",
  RESPONDED: "Responded",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  MORE_INFORMATION_REQUIRED: "More information required",
  // Physical inventory
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  // Shortage report
  NOT_JUSTIFIED: "Not justified",
  // Alert
  NEW: "New",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  DISMISSED: "Dismissed",
  LOW_STOCK: "Low stock",
  NEGATIVE_STOCK: "Negative stock",
  INVENTORY_VARIANCE: "Count variance",
  TRANSFER_DISCREPANCY: "Transfer discrepancy",
  POS_POSTING_FAILED: "POS posting failed",
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  INFO: "Info",
  REQUEST_TRANSFER: "Request a transfer",
  REQUEST_PHYSICAL_INVENTORY: "Request physical inventory",
  INVESTIGATE: "Investigate",
  REVIEW_TRANSFER: "Review the transfer",
};

// Tones follow the prototype: good, bad, warn, and blue (info) for everything else.
const DANGER = ["SHORTAGE", "REJECTED", "CRITICAL", "CANCELLED", "FAILED"];
const SUCCESS = ["POSTED", "MATCHED", "ACCEPTED", "RESOLVED", "COMPLETED", "APPROVED", "CLOSED"];
const WARNING = ["ENQUIRY_PENDING", "SENT", "HIGH", "NEW", "SUBMITTED", "MORE_INFORMATION_REQUIRED", "SCHEDULED", "PENDING"];
const NEUTRAL = ["DISMISSED", "NOT_COUNTED"];

/** PARTIALLY_RECEIVED becomes "Partially received" when no label is defined. */
const humanise = (value: string): string => {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const scLabel = (value?: string | null): string => (value ? LABELS[value] ?? humanise(value) : "—");

export const scBadgeClass = (value?: string | null): string => {
  const key = (value ?? "").toUpperCase();
  if (DANGER.includes(key)) return "sila-badge sila-badge--danger";
  if (SUCCESS.includes(key)) return "sila-badge sila-badge--success";
  if (WARNING.includes(key)) return "sila-badge sila-badge--warning";
  if (NEUTRAL.includes(key)) return "sila-badge sila-badge--neutral";
  return "sila-badge sila-badge--info";
};

/** Quantities: up to 4 decimals, no trailing zeros. */
export const formatQty = (value?: number | null): string =>
  value === null || value === undefined ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Signed variance, e.g. +2 or -0.5. */
export const formatVariance = (value?: number | null): string => {
  if (value === null || value === undefined) return "—";
  const text = formatQty(Math.abs(value));
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
};

export const formatMoney = (value?: number | null): string =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parses a typed quantity; empty or invalid text is null. */
export const parseQty = (text: string): number | null => {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
};
