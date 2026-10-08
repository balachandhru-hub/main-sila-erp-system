import React, { useId } from 'react';

interface QtyInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Unit choice; a single unit is shown as text. */
  uoms?: string[];
  uom?: string;
  onUomChange?: (uom: string) => void;
  max?: number;
  disabled?: boolean;
}

/** Decimal quantity with an optional unit picker. Keeps the typed text; parse with parseQty. */
const QtyInput: React.FC<QtyInputProps> = ({ label, value, onChange, uoms, uom, onUomChange, max, disabled }) => {
  const id = useId();
  const showPicker = uoms && uoms.length > 1 && onUomChange;
  return (
    <div className="sm-field">
      <label htmlFor={id}>{label}</label>
      <div className="sm-row">
        <input
          id={id}
          className="sm-input"
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step="any"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {showPicker ? (
          <select
            className="sm-select"
            aria-label={`${label} unit`}
            value={uom}
            disabled={disabled}
            onChange={(event) => onUomChange(event.target.value)}
          >
            {uoms.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        ) : (
          (uom || uoms?.[0]) && <span className="sm-muted">{uom || uoms?.[0]}</span>
        )}
      </div>
    </div>
  );
};

/** Parsed quantity, or null when empty / not a number / negative. */
export const parseQty = (text: string): number | null => {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export default QtyInput;
