/** Display helpers of the material master and the price approval screens. */

const PRICE_STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Approved", tone: "success" },
  MISSING: { label: "Price Missing", tone: "danger" },
  PENDING_APPROVAL: { label: "Pending Approval", tone: "warning" },
  REJECTED: { label: "Rejected", tone: "danger" },
  EXPIRED: { label: "Invalid", tone: "danger" },
  INVALID: { label: "Invalid", tone: "danger" },
};

/** Known price statuses get their label; any other code is humanised, e.g. PARTIALLY_APPROVED -> "Partially Approved". */
export const priceStatusLabel = (status: string | null | undefined): string =>
  (status && PRICE_STATUS[status]?.label) ||
  (status ? status.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : "—");

export const priceStatusTone = (status: string | null | undefined): string =>
  (status && PRICE_STATUS[status]?.tone) || (status ? "info" : "neutral");

export const formatPrice = (value: number | null | undefined, currency?: string | null, uom?: string | null): string => {
  if (value === null || value === undefined) return "—";
  const amount = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return `${currency ? `${currency} ` : ""}${amount}${uom ? ` / ${uom}` : ""}`;
};

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

/** "STOCK" → "Stock", "NON_STOCK" → "Non stock". */
export const codeLabel = (code: string | null | undefined): string => {
  if (!code) return "—";
  const text = code.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
