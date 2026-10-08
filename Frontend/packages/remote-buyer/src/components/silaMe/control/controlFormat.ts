import { SILA_JUSTIFICATION_CATEGORIES } from "../../../api/silaMe/silaStockCountApi";
import { scLabel } from "../stockCount/stockCountFormat";

export const PAGE_SIZE = 20;

/** Label of a justification category; lines without a justification are "Not justified". */
export const categoryLabel = (code?: string | null): string => {
  const value = code || "NOT_JUSTIFIED";
  return SILA_JUSTIFICATION_CATEGORIES.find((option) => option.value === value)?.label ?? scLabel(value);
};

/** yyyy-mm-dd of a date in local time, for date inputs. */
export const toDateInput = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateInput(date);
};
