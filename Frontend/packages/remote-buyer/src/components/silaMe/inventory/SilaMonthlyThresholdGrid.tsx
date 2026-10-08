import React from "react";

/** Month overrides as typed text, keyed by month 1-12. */
export type MonthlyTexts = Record<number, { minimumStock: string; reorderPoint: string }>;

interface SilaMonthlyThresholdGridProps {
  materialCode: string;
  uom: string;
  months: MonthlyTexts;
  onChange: (months: MonthlyTexts) => void;
}

export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export const monthName = (month: number): string =>
  new Date(2000, month - 1, 1).toLocaleString(undefined, { month: "short" });

/** Optional per-month minimum stock and reorder point; an empty month uses the base levels. */
const SilaMonthlyThresholdGrid: React.FC<SilaMonthlyThresholdGridProps> = ({ materialCode, uom, months, onChange }) => {
  const setValue = (month: number, field: "minimumStock" | "reorderPoint", value: string) => {
    const current = months[month] ?? { minimumStock: "", reorderPoint: "" };
    onChange({ ...months, [month]: { ...current, [field]: value } });
  };

  return (
    <div className="sinv-month-grid">
      {MONTHS.map((month) => (
        <fieldset key={month} className="sinv-month-cell">
          <legend className="sila-label">{monthName(month)}</legend>
          <input
            className="sila-input"
            type="number"
            min={0}
            step="any"
            placeholder="Minimum"
            aria-label={`Minimum stock of ${materialCode} in ${monthName(month)} (${uom})`}
            value={months[month]?.minimumStock ?? ""}
            onChange={(event) => setValue(month, "minimumStock", event.target.value)}
          />
          <input
            className="sila-input"
            type="number"
            min={0}
            step="any"
            placeholder="Reorder point"
            aria-label={`Reorder point of ${materialCode} in ${monthName(month)} (${uom})`}
            value={months[month]?.reorderPoint ?? ""}
            onChange={(event) => setValue(month, "reorderPoint", event.target.value)}
          />
        </fieldset>
      ))}
    </div>
  );
};

export default SilaMonthlyThresholdGrid;
