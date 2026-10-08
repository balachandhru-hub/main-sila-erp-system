import { silaLabel, type SilaUomConversion } from "../../../api/silaMe/silaInventoryApi";

/** What unit conversion needs of a material: its base unit and conversions. */
export interface ConvertibleMaterial {
  baseUom: string;
  conversions: SilaUomConversion[];
}

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  INACTIVE: "Inactive",
  PENDING: "Pending",
  DIRECT: "Direct item",
  RECIPE: "Recipe",
  BATCH: "Batch",
  CREATED: "Created",
  UPDATED: "Saved",
  NEW_VERSION: "New version",
  SUBMITTED: "Sent for approval",
  DEACTIVATED: "Deactivated",
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  CANCELLED: "Cancelled",
  MISSING: "Price missing",
};

export const recipeLabel = (code?: string | null): string => (code ? LABELS[code] ?? silaLabel(code) : "—");

/** Prototype tones: good (approved/active), bad (rejected/inactive/cancelled), warn (pending), blue (everything else). */
export const recipeBadgeClass = (status?: string | null): string => {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
    case "ACTIVE":
      return "sila-badge sila-badge--success";
    case "REJECTED":
    case "INACTIVE":
    case "CANCELLED":
      return "sila-badge sila-badge--danger";
    case "PENDING_APPROVAL":
    case "PENDING":
      return "sila-badge sila-badge--warning";
    default:
      return "sila-badge sila-badge--info";
  }
};

export const RECIPE_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "INACTIVE"];

/** Money or cost with up to 4 decimals. */
export const formatCost = (value?: number | null, currency?: string | null): string => {
  if (value == null || Number.isNaN(value)) return "—";
  const text = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return currency ? `${currency} ${text}` : text;
};

export const formatPercent = (value?: number | null): string =>
  value == null || Number.isNaN(value) ? "—" : `${value.toFixed(2)}%`;

export const formatQty = (value?: number | null): string =>
  value == null || Number.isNaN(value) ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 4 });

/** Cost of one serving: recipe cost / serving qty (a batch for 5 sells per plate); a qty of 0 counts as one serving. */
export const costPerServing = (totalCost: number, servingQty: number): number => (servingQty > 0 ? totalCost / servingQty : totalCost);

/** Cost % of a menu price: cost (of one serving) / price x 100, or null without a price. */
export const costPercent = (cost: number, price: number): number | null => (price > 0 ? (cost / price) * 100 : null);

/** Margin % of a menu price: (price - cost) / price x 100, or null without a price. */
export const marginPercent = (cost: number, price: number): number | null => (price > 0 ? ((price - cost) / price) * 100 : null);

/** The units a material can be entered in: its base unit and every unit of its conversions. */
export const materialUoms = (material: ConvertibleMaterial): string[] => {
  const units = new Set<string>([material.baseUom.toUpperCase()]);
  material.conversions.forEach((conversion) => {
    units.add(conversion.fromUom.toUpperCase());
    units.add(conversion.toUom.toUpperCase());
  });
  return Array.from(units);
};

/**
 * The quantity in the material's base unit, like the API's UomConverter (1 fromUom = factor toUom, both directions).
 * null when the unit has no conversion.
 */
export const toBaseQuantity = (material: ConvertibleMaterial, quantity: number, uom: string): number | null => {
  const base = material.baseUom.toUpperCase();
  const unit = (uom || base).toUpperCase();
  if (unit === base) return quantity;
  const forward = material.conversions.find(
    (x) => x.fromUom.toUpperCase() === unit && x.toUom.toUpperCase() === base && x.factor > 0,
  );
  if (forward) return quantity * forward.factor;
  const backward = material.conversions.find(
    (x) => x.fromUom.toUpperCase() === base && x.toUom.toUpperCase() === unit && x.factor > 0,
  );
  if (backward) return quantity / backward.factor;
  return null;
};

/** "READY FOR APPROVAL" or "NOT READY (n)" (prototype edge text). */
export const readinessLabel = (issueCount: number): string => (issueCount === 0 ? "READY FOR APPROVAL" : `NOT READY (${issueCount})`);

export const readinessBadgeClass = (issueCount: number): string =>
  issueCount === 0 ? "sila-badge sila-badge--success" : "sila-badge sila-badge--warning";

/**
 * The server's readiness status (ACTIVE, INACTIVE, PENDING APPROVAL, READY FOR APPROVAL, NOT READY (n)); falls back to the
 * issue count when the server sent none.
 */
export const readinessText = (status: string | null | undefined, issueCount: number): string => status || readinessLabel(issueCount);

export const readinessStatusBadgeClass = (status: string | null | undefined, issueCount: number): string => {
  const text = readinessText(status, issueCount).toUpperCase();
  if (text === "ACTIVE" || text === "READY FOR APPROVAL") return "sila-badge sila-badge--success";
  if (text === "INACTIVE") return "sila-badge sila-badge--danger";
  if (text === "PENDING APPROVAL") return "sila-badge sila-badge--info";
  return "sila-badge sila-badge--warning";
};

/** Price status of a material line, as the prototype labels it: Approved, Price Missing, Pending Approval. */
export const priceStatusLabel = (status?: string | null): string => {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return "Approved";
    case "PENDING_APPROVAL":
      return "Pending Approval";
    case "MISSING":
      return "Price Missing";
    default:
      return "—";
  }
};

export const priceStatusBadgeClass = (status?: string | null): string => {
  switch ((status ?? "").toUpperCase()) {
    case "APPROVED":
      return "sila-badge sila-badge--success";
    case "PENDING_APPROVAL":
      return "sila-badge sila-badge--warning";
    case "MISSING":
      return "sila-badge sila-badge--danger";
    default:
      return "sila-badge sila-badge--info";
  }
};

/** Unit price of a material: "AED 1.25 / KG" when approved, otherwise "PRICE MISSING" (prototype). */
export const unitPriceText = (status: string | null | undefined, unitCost: number | null | undefined, currency: string | null | undefined, uom: string): string =>
  (status ?? "").toUpperCase() === "APPROVED" && unitCost != null ? `${formatCost(unitCost, currency)} / ${uom}` : "PRICE MISSING";

/** Pack / conversion summary of a material, e.g. "1 CS = 12 KG", or "Base: KG" without conversions. */
export const conversionSummary = (material: ConvertibleMaterial): string =>
  material.conversions.length === 0
    ? `Base: ${material.baseUom}`
    : material.conversions.map((x) => `1 ${x.fromUom} = ${formatQty(x.factor)} ${x.toUom}`).join(" · ");

/** Costing notes: "n MATERIAL PRICE(S) PENDING", "n MATERIAL PRICE(S) MISSING", "COST PENDING MATERIAL PRICE APPROVAL". */
export const priceNotes = (statuses: (string | null | undefined)[]): string[] => {
  const pending = statuses.filter((x) => (x ?? "").toUpperCase() === "PENDING_APPROVAL").length;
  const missing = statuses.filter((x) => (x ?? "").toUpperCase() === "MISSING").length;
  return [
    pending ? `${pending} MATERIAL PRICE${pending === 1 ? "" : "S"} PENDING` : "",
    missing ? `${missing} MATERIAL PRICE${missing === 1 ? "" : "S"} MISSING` : "",
    pending && !missing ? "COST PENDING MATERIAL PRICE APPROVAL" : "",
  ].filter(Boolean);
};

/** Approval event of a recipe: CHANGE once a version was approved, otherwise CREATE. */
export const approvalEvent = (activeVersion: number): string => (activeVersion > 0 ? "CHANGE" : "CREATE");

/** "V1 Active · V2 Draft" */
export const versionsSummary = (versions: { version: number; status: string }[]): string =>
  versions
    .slice()
    .sort((a, b) => a.version - b.version)
    .filter((item) => item.status !== "SUPERSEDED")
    .map((item) => `V${item.version} ${recipeLabel(item.status)}`)
    .join(" · ");
