const DASH = "—";

export const formatDate = (value?: string | null): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const formatNumber = (value?: number | null, maximumFractionDigits = 2): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
};

export const formatMoney = (value?: number | null, currency?: string | null): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return currency ? `${amount} ${currency}` : amount;
};

export const formatPercent = (value?: number | null): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  return `${Math.round(value * 100)}%`;
};

export const formatFileSize = (bytes?: number | null): string => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return DASH;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** READY_FOR_GRN -> "Ready for grn" style label for API status codes. */
export const statusLabel = (value?: string | null): string => {
  if (!value) return "Unknown";
  const text = value.toLowerCase().split("_").join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const SUCCESS = new Set([
  "POSTED", "CLOSED", "GRN_POSTED", "ACTIVE", "FULL_EXTRACTION_COMPLETE", "PROCESSED", "COMPLETED", "SUCCESS",
  "MATCHED", "CONNECTED", "VALID", "TESTED", "READY_FOR_GRN", "READY_TO_POST", "GRN_READY", "VALIDATED",
]);
const DANGER = new Set([
  "FAILED", "CANCELLED", "OCR_FAILED", "TEST_FAILED", "INVALID", "BLOCKED", "FAILED_AUTHENTICATION",
  "VALIDATION_FAILED", "EXPIRED", "UNMATCHED",
]);
const WARNING = new Set([
  "REVIEW_REQUIRED", "PARTIALLY_RECEIVED", "PROCESSING", "READING", "POSTING", "PARTIAL", "RUNNING",
  "RETRY_PENDING", "SUGGESTED", "UNKNOWN", "PENDING", "AUTHENTICATION_REQUIRED", "CONSENT_REQUIRED",
  "SITE_SELECTION_REQUIRED", "LIBRARY_SELECTION_REQUIRED", "FOLDER_SELECTION_REQUIRED", "VALIDATING",
  "AUTHENTICATING", "FULL_EXTRACTION_PROCESSING",
]);
const NEUTRAL = new Set(["DRAFT", "INACTIVE", "DISCONNECTED", "NOT_CONNECTED", "SKIPPED", "UPLOADED"]);

export const statusBadgeClass = (value?: string | null): string => {
  const status = (value ?? "").toUpperCase();
  if (SUCCESS.has(status)) return "sila-badge sila-badge--success";
  if (DANGER.has(status)) return "sila-badge sila-badge--danger";
  if (WARNING.has(status)) return "sila-badge sila-badge--warning";
  if (NEUTRAL.has(status)) return "sila-badge sila-badge--neutral";
  return "sila-badge sila-badge--info";
};

/** Trimmed text, or null when the field was left empty. */
export const blank = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/** A number typed into a text/number input, or null when empty or not a number. */
export const toNumberOrNull = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;
