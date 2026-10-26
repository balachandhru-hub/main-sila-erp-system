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

const UOM_ALIASES: Record<string, string> = {
  KILO: "KG",
  KILOGRAM: "KG",
  KILOGRAMS: "KG",
  GRAM: "G",
  GRAMS: "G",
  LITRE: "L",
  LITER: "L",
  LITRES: "L",
  LITERS: "L",
  LT: "L",
  MILLILITRE: "ML",
  MILLILITER: "ML",
  MILLILITERS: "ML",
  MLS: "ML",
  EACH: "EA",
  UNIT: "EA",
  UNITS: "EA",
  PIECE: "PC",
  PIECES: "PC",
  PCS: "PC",
  BOTTLE: "BTL",
  BOTTLES: "BTL",
  BOT: "BTL",
  BT: "BTL",
};

/** One code for units the recipe treats as the same, e.g. BOTTLE and BTL. */
export const canonicalUom = (uom?: string | null): string => {
  const key = (uom ?? "").trim().toUpperCase();
  return UOM_ALIASES[key] ?? key;
};

/** Units a recipe line can use even when the material is stocked as EA: a 750 ML bottle is entered as 30 ML. */
const RECIPE_UNITS = ["ML", "L", "BTL", "G", "KG"];

/** The material's own units, plus ML/L/BTL and G/KG so the line can ask for the 1-to-750 conversion. */
export const materialUoms = (material: ConvertibleMaterial): string[] => {
  const units = new Set<string>([canonicalUom(material.baseUom), ...RECIPE_UNITS]);
  material.conversions.forEach((conversion) => {
    units.add(canonicalUom(conversion.fromUom));
    units.add(canonicalUom(conversion.toUom));
  });
  return Array.from(units).filter(Boolean);
};

/**
 * The quantity in the material's base unit, like the API's UomConverter.
 * 1 fromUom = factor toUom, both directions, plus L/ML and KG/G. null when the unit has no path.
 */
export const toBaseQuantity = (material: ConvertibleMaterial, quantity: number, uom: string): number | null => {
  const base = canonicalUom(material.baseUom);
  const unit = canonicalUom(uom) || base;
  if (unit === base) return quantity;

  const edges = new Map<string, { to: string; factor: number }[]>();
  const add = (left: string, right: string, factor: number) => {
    if (!left || !right || left === right || factor === 0) return;
    const list = edges.get(left) ?? [];
    list.push({ to: right, factor });
    edges.set(left, list);
  };
  add("KG", "G", 1000);
  add("G", "KG", 0.001);
  add("L", "ML", 1000);
  add("ML", "L", 0.001);
  material.conversions.forEach((conversion) => {
    if (conversion.factor <= 0) return;
    const from = canonicalUom(conversion.fromUom);
    const to = canonicalUom(conversion.toUom);
    add(from, to, conversion.factor);
    add(to, from, 1 / conversion.factor);
  });

  const visited = new Map<string, number>([[unit, 1]]);
  const queue = [unit];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of edges.get(current) ?? []) {
      if (visited.has(edge.to)) continue;
      const scale = (visited.get(current) as number) * edge.factor;
      if (edge.to === base) return Math.round(quantity * scale * 1e6) / 1e6;
      visited.set(edge.to, scale);
      queue.push(edge.to);
    }
  }
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

/** Pack / conversion summary of a material, e.g. "1 BTL = 750 ML", or "Base: BTL" without conversions. */
export const conversionSummary = (material: ConvertibleMaterial): string =>
  material.conversions.length === 0
    ? `Base: ${canonicalUom(material.baseUom)}`
    : material.conversions
        .map((x) => `1 ${canonicalUom(x.fromUom)} = ${formatQty(x.factor)} ${canonicalUom(x.toUom)}`)
        .join(" · ");

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
