const SCALE = 10000;
const TOLERANCE = 0.0001;

/** Invoice statuses that keep a linked GRN locked (not reusable on another invoice). */
const HOLDS = new Set([
  "POSTING",
  "POSTED",
  "PENDING_APPROVAL",
  "POSTING_UNKNOWN",
  "LOCAL_FINALIZATION_FAILED",
  "AWAITING_PAYMENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "READY",
  "READY_TO_POST",
  "READY_FOR_INVOICE_SUBMISSION",
  "GRN_POSTED",
  "GRN_IN_PROGRESS",
  "REVIEWED",
  "APPROVED",
  "EXTRACTED",
  "UPLOADED",
]);

/** The other invoice holds this GRN (posted, posting, or in review). Case-insensitive. */
export const invoiceHoldsGoodsReceipt = (status?: string | null, erpStatus?: string | null): boolean => {
  const erp = (erpStatus || "").trim().toUpperCase();
  if (erp === "POSTED" || erp === "ERP_ACCEPTED") return true;
  const normalized = (status || "").trim().toUpperCase();
  return Boolean(normalized && HOLDS.has(normalized));
};

export interface MatchLine {
  purchaseOrderItemId?: string | null;
  quantity: number;
}

export interface MatchReceipt {
  id: string;
  grnNumber: string;
  available: boolean;
  lines: MatchLine[];
}

export interface MatchChoice {
  ids: string[];
  reason: string;
}

const scaled = (quantity: number) => Math.round(quantity * SCALE);

const bag = (lines: MatchLine[], byItem: boolean): Map<string, number> => {
  const result = new Map<string, number>();
  lines.forEach((line) => {
    if (line.quantity <= TOLERANCE) return;
    const value = scaled(line.quantity);
    if (value <= 0) return;
    if (byItem) {
      if (!line.purchaseOrderItemId) return;
      result.set(line.purchaseOrderItemId, (result.get(line.purchaseOrderItemId) ?? 0) + value);
      return;
    }
    const key = String(value);
    result.set(key, (result.get(key) ?? 0) + 1);
  });
  return result;
};

const same = (left: Map<string, number>, right: Map<string, number>): boolean => {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
};

const add = (target: Map<string, number>, source: Map<string, number>) => {
  source.forEach((value, key) => target.set(key, (target.get(key) ?? 0) + value));
};

const best = (demandLines: MatchLine[], available: MatchReceipt[], byItem: boolean): MatchChoice => {
  const demand = bag(demandLines, byItem);
  if (demand.size === 0) return { ids: [], reason: "" };
  const bags = available
    .map((receipt) => ({ receipt, bag: bag(receipt.lines, byItem) }))
    .filter((row) => row.bag.size > 0)
    .slice(0, 12);
  let chosen: MatchChoice = { ids: [], reason: "" };
  const limit = 1 << bags.length;
  for (let mask = 1; mask < limit; mask += 1) {
    const sum = new Map<string, number>();
    const ids: string[] = [];
    const names: string[] = [];
    bags.forEach((row, index) => {
      if ((mask & (1 << index)) === 0) return;
      add(sum, row.bag);
      ids.push(row.receipt.id);
      names.push(row.receipt.grnNumber || "goods receipt");
    });
    if (!same(sum, demand)) continue;
    if (chosen.ids.length === 0 || ids.length < chosen.ids.length) {
      const list = names.join(", ");
      chosen = {
        ids,
        reason: ids.length === 1
          ? `Exact quantity match: ${list}.`
          : `Exact quantity match: ${list}. Together they equal the invoice quantities.`,
      };
    }
  }
  return chosen;
};

/** The smallest available set whose quantities equal the invoice lines. */
export const selectGoodsReceipts = (invoiceLines: MatchLine[], receipts: MatchReceipt[]): MatchChoice => {
  const available = receipts.filter((row) => row.available).slice(0, 12);
  const demand = invoiceLines.filter((line) => line.quantity > TOLERANCE);
  if (available.length === 0 || demand.length === 0) return { ids: [], reason: "" };
  if (demand.every((line) => line.purchaseOrderItemId)) {
    const byItem = best(demand, available, true);
    if (byItem.ids.length > 0) return byItem;
  }
  return best(demand, available, false);
};

/** Accepted quantity when the receipt recorded one, otherwise the received quantity. */
export const billableQuantity = (accepted: number, received: number): number => (accepted > 0 ? accepted : received);
