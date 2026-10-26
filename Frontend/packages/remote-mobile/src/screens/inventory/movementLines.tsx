import React from 'react';
import MaterialPicker, { materialUoms } from '../../components/MaterialPicker';
import QtyInput, { parseQty } from '../../components/QtyInput';

export interface MovementFormLine {
  key: string;
  materialId: string;
  label: string;
  uoms: string[];
  uom: string;
  qty: string;
  unitCost: string;
}

/** Quantity, or null when it is empty or not a number. Zero is rejected; negatives only when allowed. */
export const parseMovementQty = (text: string, allowNegative: boolean): number | null => {
  if (!allowNegative) return parseQty(text);
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value !== 0 ? value : null;
};

interface MovementLinesProps {
  lines: MovementFormLine[];
  onChange: (lines: MovementFormLine[]) => void;
  onNotice: (text: string) => void;
  allowNegative?: boolean;
  showUnitCost?: boolean;
}

/** Materials and quantities shared by goods issue and stock adjustment. */
const MovementLines: React.FC<MovementLinesProps> = ({ lines, onChange, onNotice, allowNegative = false, showUnitCost = false }) => {
  const update = (key: string, change: Partial<MovementFormLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...change } : line)));

  return (
    <section className="sm-section" aria-labelledby="sm-move-lines">
      <h2 id="sm-move-lines">Materials ({lines.length})</h2>
      {lines.map((line) => (
        <div key={line.key} className="sm-card">
          <div className="sm-row">
            <strong>{line.label}</strong>
            <button
              type="button"
              className="sm-btn sm-btn--small sm-btn--danger"
              aria-label={`Remove ${line.label}`}
              onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
            >
              Remove
            </button>
          </div>
          {allowNegative ? (
            <div className="sm-field">
              <label htmlFor={`sm-qty-${line.key}`}>Quantity (negative removes stock)</label>
              <input
                id={`sm-qty-${line.key}`}
                className="sm-input"
                type="number"
                inputMode="decimal"
                step="any"
                value={line.qty}
                onChange={(event) => update(line.key, { qty: event.target.value })}
              />
            </div>
          ) : (
            <QtyInput
              label="Quantity"
              value={line.qty}
              onChange={(qty) => update(line.key, { qty })}
              uoms={line.uoms}
              uom={line.uom}
              onUomChange={(uom) => update(line.key, { uom })}
            />
          )}
          {showUnitCost && (
            <div className="sm-field">
              <label htmlFor={`sm-cost-${line.key}`}>Unit cost (optional)</label>
              <input
                id={`sm-cost-${line.key}`}
                className="sm-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={line.unitCost}
                onChange={(event) => update(line.key, { unitCost: event.target.value })}
              />
            </div>
          )}
        </div>
      ))}
      <MaterialPicker
        label="Add material"
        onPick={(material) => {
          if (lines.some((line) => line.materialId === material.id)) {
            onNotice(`${material.description} is already in the list.`);
            return;
          }
          onChange([
            ...lines,
            {
              key: material.id,
              materialId: material.id,
              label: `${material.description} (${material.materialCode})`,
              uoms: materialUoms(material),
              uom: material.baseUom,
              qty: '',
              unitCost: '',
            },
          ]);
        }}
      />
    </section>
  );
};

export default MovementLines;
