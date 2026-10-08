import { silaLabel } from "../../../api/silaMe/silaInventoryApi";

const LABELS: Record<string, string> = {
  RECEIVED: "Received",
  INVENTORY_DEDUCTED: "Inventory deducted",
  POSTED: "Posted to SAP",
  FAILED: "Failed",
  MATCH: "Matching",
  DEDUCT: "Inventory deduction",
  POST: "SAP posting",
  FILE: "File",
  API: "POS API",
  DONE: "Done",
  PENDING: "Pending",
  SKIPPED: "Skipped",
  UNKNOWN: "Unknown",
  PREVIEW: "Awaiting processing",
  PROCESSED: "Processed",
  READY: "Ready",
  INVALID: "Invalid",
  DUPLICATE: "Duplicate",
  UNMAPPED_POS_CODE: "Unmapped POS code",
  INVALID_OUTLET: "Invalid outlet",
  INVALID_UOM: "Invalid UOM",
  RECIPE_NOT_READY: "Recipe not ready",
  MATCHED: "Matched to outlet and recipe",
  MATCH_FAILED: "Matching failed",
  DEDUCT_FAILED: "Inventory deduction failed",
  ERP_POSTING_QUEUED: "Queued for SAP posting",
  ERP_POSTING_REQUEUED: "SAP posting queued again",
  REPROCESS_REQUESTED: "Reprocess requested",
  ERP_POSTED: "Posted to SAP",
  ERP_FAILED: "SAP posting failed",
  ERP_SKIPPED: "SAP posting skipped",
  ERP_UNKNOWN: "SAP outcome unknown",
  OPERA: "Opera",
  MICROS: "Micros",
  SIMPHONY: "Simphony",
  INFOR: "Infor",
  OTHER: "Other",
};

export const POS_STATUSES = ["RECEIVED", "INVENTORY_DEDUCTED", "POSTED", "FAILED"];

export const POS_POSTING_STATUSES = ["PENDING", "POSTED", "FAILED", "SKIPPED", "UNKNOWN"];

export const posLabel = (code?: string | null): string => (code ? LABELS[code] ?? silaLabel(code) : "—");

/** Prototype tones: good (posted/processed/active), bad (failed/invalid/inactive), warn (pending/awaiting), blue (everything else). */
export const posStatusBadgeClass = (status?: string | null): string => {
  switch ((status ?? "").toUpperCase()) {
    case "POSTED":
    case "PROCESSED":
    case "READY":
    case "DONE":
    case "ACTIVE":
    case "APPROVED":
      return "sila-badge sila-badge--success";
    case "FAILED":
    case "INVALID":
    case "INACTIVE":
    case "CANCELLED":
    case "REJECTED":
      return "sila-badge sila-badge--danger";
    case "PREVIEW":
    case "PENDING":
    case "PROCESSING":
    case "UNKNOWN":
    case "DUPLICATE":
    case "UNMAPPED_POS_CODE":
    case "INVALID_OUTLET":
    case "INVALID_UOM":
    case "RECIPE_NOT_READY":
      return "sila-badge sila-badge--warning";
    default:
      return "sila-badge sila-badge--info";
  }
};

/** Badge of one step state: DONE | FAILED | PENDING | SKIPPED | UNKNOWN. */
export const stepBadgeClass = (state?: string | null): string => {
  switch ((state ?? "").toUpperCase()) {
    case "DONE":
      return "sila-badge sila-badge--success sila-badge--sm";
    case "FAILED":
      return "sila-badge sila-badge--danger sila-badge--sm";
    case "PENDING":
    case "UNKNOWN":
      return "sila-badge sila-badge--warning sila-badge--sm";
    default:
      return "sila-badge sila-badge--info sila-badge--sm";
  }
};

export const errorText = (err: unknown, fallback: string): string => (err instanceof Error ? err.message : fallback);
