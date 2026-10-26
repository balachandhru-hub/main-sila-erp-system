/** Shared Credit Memo qty/amount rules for Cloud and SILA Store. Invoice remaining values are authoritative. */

export interface CreditMemoAmountSource {
  originalQuantity: number;
  originalAmount: number;
  previouslyCreditedQuantity: number;
  previouslyCreditedAmount: number;
  remainingQuantity: number;
  remainingAmount: number;
}

export interface CreditMemoEligibleLineSource extends CreditMemoAmountSource {
  invoiceLineId: string;
  lineNumber: number;
  poNumber?: string | null;
  poItem?: string | null;
  material?: string | null;
  description: string;
  uom?: string | null;
  taxCode?: string | null;
}

export interface CreditMemoSavedLineSource {
  referenceInvoiceLineId?: string | null;
  quantity?: number | null;
  amount?: number | null;
  reason?: string | null;
  originalQuantity?: number;
  originalAmount?: number;
  previouslyCreditedQuantity?: number;
  previouslyCreditedAmount?: number;
  remainingQuantity?: number;
  remainingAmount?: number;
}

export interface CreditMemoLineDraft {
  included: boolean;
  quantity: string;
  amount: string;
  reason: string;
}

const QTY_SCALE = 1000;
const MONEY_SCALE = 100;

export const asCreditNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const qtyUnits = (value: number): number => Math.round(value * QTY_SCALE);

const moneyUnits = (value: number): number => Math.round(value * MONEY_SCALE);

export const formatCreditQuantity = (value: number): string => {
  const units = qtyUnits(value);
  if (units % QTY_SCALE === 0) return String(units / QTY_SCALE);
  return String(units / QTY_SCALE);
};

export const formatCreditAmount = (value: number): string => (moneyUnits(value) / MONEY_SCALE).toFixed(2);

export const quantitiesEqual = (left: number, right: number): boolean => qtyUnits(left) === qtyUnits(right);

export const creditMemoUnitValue = (line: CreditMemoAmountSource): number | null => {
  const remainingQty = asCreditNumber(line.remainingQuantity);
  const remainingAmount = asCreditNumber(line.remainingAmount);
  if (remainingQty > 0) return remainingAmount / remainingQty;
  const originalQty = asCreditNumber(line.originalQuantity);
  const originalAmount = asCreditNumber(line.originalAmount);
  if (originalQty > 0) return originalAmount / originalQty;
  return null;
};

export const creditMemoAmountForQuantity = (line: CreditMemoAmountSource, quantity: number): number => {
  if (!(quantity > 0)) return 0;
  const remainingQty = asCreditNumber(line.remainingQuantity);
  const remainingAmount = asCreditNumber(line.remainingAmount);
  if (remainingQty > 0 && quantitiesEqual(quantity, remainingQty)) {
    return moneyUnits(remainingAmount) / MONEY_SCALE;
  }

  const unit = creditMemoUnitValue(line);
  if (unit == null) return 0;

  const suggested = remainingQty > 0
    ? Math.round((quantity * moneyUnits(remainingAmount)) / remainingQty) / MONEY_SCALE
    : moneyUnits(quantity * unit) / MONEY_SCALE;
  if (remainingQty > 0 || remainingAmount > 0) {
    return Math.min(suggested, moneyUnits(remainingAmount) / MONEY_SCALE);
  }
  return suggested;
};

/** Blank stays blank. Incomplete keystrokes leave amount unchanged (null). */
export const creditMemoAmountTextForQuantity = (line: CreditMemoAmountSource, rawQuantity: string): string | null => {
  const trimmed = rawQuantity.trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed === "." || trimmed === "-.") return "";
  if (!/^-?\d*\.?\d*$/.test(trimmed)) return null;
  const quantity = Number(trimmed);
  if (!Number.isFinite(quantity)) return null;
  if (quantity === 0) return formatCreditAmount(0);
  return formatCreditAmount(creditMemoAmountForQuantity(line, quantity));
};

export const normalizeCreditMemoEligibleLine = (line: CreditMemoEligibleLineSource): CreditMemoEligibleLineSource => ({
  ...line,
  originalQuantity: asCreditNumber(line.originalQuantity),
  originalAmount: asCreditNumber(line.originalAmount),
  previouslyCreditedQuantity: asCreditNumber(line.previouslyCreditedQuantity),
  previouslyCreditedAmount: asCreditNumber(line.previouslyCreditedAmount),
  remainingQuantity: asCreditNumber(line.remainingQuantity),
  remainingAmount: asCreditNumber(line.remainingAmount),
});

export const mergeCreditMemoEligibleLines = <T extends CreditMemoEligibleLineSource>(
  eligible: T[],
  savedLines?: CreditMemoSavedLineSource[] | null,
): T[] => eligible.map((line) => {
  const saved = savedLines?.find((item) => item.referenceInvoiceLineId === line.invoiceLineId);
  if (!saved) return normalizeCreditMemoEligibleLine(line) as T;
  return normalizeCreditMemoEligibleLine({
    ...line,
    originalQuantity: saved.originalQuantity ?? line.originalQuantity,
    originalAmount: saved.originalAmount ?? line.originalAmount,
    previouslyCreditedQuantity: saved.previouslyCreditedQuantity ?? line.previouslyCreditedQuantity,
    previouslyCreditedAmount: saved.previouslyCreditedAmount ?? line.previouslyCreditedAmount,
    remainingQuantity: saved.remainingQuantity ?? line.remainingQuantity,
    remainingAmount: saved.remainingAmount ?? line.remainingAmount,
  }) as T;
});

export const creditMemoDraftFromLine = (
  line: CreditMemoAmountSource,
  saved?: { quantity?: number | null; amount?: number | null; reason?: string | null },
): CreditMemoLineDraft => {
  const remainingQty = asCreditNumber(line.remainingQuantity);
  const remainingAmount = asCreditNumber(line.remainingAmount);
  const savedQty = asCreditNumber(saved?.quantity);
  const savedAmount = asCreditNumber(saved?.amount);
  if (saved && (savedQty > 0 || savedAmount > 0)) {
    return {
      included: true,
      quantity: saved.quantity != null ? formatCreditQuantity(savedQty) : "",
      amount: saved.amount != null ? formatCreditAmount(savedAmount) : "",
      reason: saved.reason || "",
    };
  }
  const remaining = remainingQty > 0 || remainingAmount > 0;
  return {
    included: remaining,
    quantity: remaining ? formatCreditQuantity(remainingQty) : "0",
    amount: remaining ? formatCreditAmount(remainingAmount) : formatCreditAmount(0),
    reason: "",
  };
};

export const creditMemoIncludeDraft = (line: CreditMemoAmountSource, reason = ""): CreditMemoLineDraft => ({
  included: true,
  quantity: formatCreditQuantity(asCreditNumber(line.remainingQuantity)),
  amount: formatCreditAmount(asCreditNumber(line.remainingAmount)),
  reason,
});

export const creditMemoExcludeDraft = (reason = ""): Pick<CreditMemoLineDraft, "included" | "quantity" | "amount" | "reason"> => ({
  included: false,
  quantity: "0",
  amount: formatCreditAmount(0),
  reason,
});
