import { silaLabel } from "../../../api/silaMe/silaInventoryApi";

const LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  DISPATCHED: "In transit",
  RECEIVED: "Received",
  DISCREPANCY: "Received with discrepancy",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CREATED: "Requested",
  STANDARD: "Standard",
  QUICK: "Quick",
  OPENING_STOCK: "Opening stock",
  MANUAL_ADJUSTMENT: "Manual adjustment",
};

// Tones follow the prototype: good, bad, warn, and blue for everything else.
const DANGER = ["REJECTED", "DISCREPANCY", "CANCELLED", "FAILED"];
const SUCCESS = ["RECEIVED", "APPROVED", "POSTED", "CLOSED"];
const WARNING = ["PENDING_APPROVAL", "PENDING"];

export const movementLabel = (code?: string | null): string => (code ? LABELS[code] ?? silaLabel(code) : "—");

export const movementBadgeClass = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  if (DANGER.includes(key)) return "sila-badge sila-badge--danger";
  if (SUCCESS.includes(key)) return "sila-badge sila-badge--success";
  if (WARNING.includes(key)) return "sila-badge sila-badge--warning";
  return "sila-badge sila-badge--info";
};

/** Today as yyyy-mm-dd in the browser's time zone, for date inputs. */
export const todayInput = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

/** Money with its currency, "—" when unknown. */
export const formatValue = (value?: number | null, currency?: string | null): string =>
  value == null
    ? "—"
    : `${currency ? `${currency} ` : ""}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** STORE_TO_OUTLET → "Store → Outlet". */
export const relationshipLabel = (value?: string | null): string =>
  value ? value.split("_TO_").map((part) => silaLabel(part)).join(" → ") : "—";
