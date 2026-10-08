import React, { useEffect, useState } from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import { searchMaterials, type SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import type { SilaMovementLineWrite } from "../../../api/silaMe/silaMovementsApi";

/** One editable material line of a transfer, goods issue or adjustment. */
export interface MovementLine {
  key: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  baseUom: string;
  /** Units the quantity may be entered in: the base unit first, then the converted units. */
  uomOptions: string[];
  quantity: string;
  uom: string;
  unitCost: string;
  /** Second line under the material, e.g. what the weekly bucket approved. */
  note?: string;
}

interface MovementLinesEditorProps {
  idPrefix: string;
  lines: MovementLine[];
  onChange: (lines: MovementLine[]) => void;
  /** Manual adjustments: a negative quantity removes stock. */
  allowNegative?: boolean;
  showUnitCost?: boolean;
  disabled?: boolean;
}

const SEARCH_LIMIT = 8;

let nextKey = 0;
const newKey = (): string => {
  nextKey += 1;
  return `line-${nextKey}`;
};

export const lineFromMaterial = (material: SilaMaterial): MovementLine => {
  const units = [material.baseUom, ...material.conversions.flatMap((conversion) => [conversion.fromUom, conversion.toUom])]
    .map((unit) => (unit || "").trim().toUpperCase())
    .filter(Boolean);
  return {
    key: newKey(),
    materialId: material.id,
    materialCode: material.materialCode,
    materialName: material.description,
    baseUom: material.baseUom,
    uomOptions: Array.from(new Set(units)),
    quantity: "",
    uom: material.baseUom,
    unitCost: "",
  };
};

/** A line in the base unit, e.g. one suggested from the weekly bucket. */
export const lineInBaseUnit = (
  materialId: string,
  materialCode: string,
  materialName: string,
  baseUom: string,
  quantity: number,
  note?: string,
): MovementLine => ({
  key: newKey(),
  materialId,
  materialCode,
  materialName,
  baseUom,
  uomOptions: [baseUom],
  quantity: String(quantity),
  uom: baseUom,
  unitCost: "",
  note,
});

/** The first problem of the lines as user-facing text, or null when they can be sent. */
export const validateLines = (lines: MovementLine[], allowNegative = false): string | null => {
  if (lines.length === 0) return "Add at least one material.";
  for (const line of lines) {
    const quantity = Number(line.quantity);
    if (line.quantity.trim() === "" || Number.isNaN(quantity)) return `Enter a quantity for ${line.materialCode}.`;
    if (allowNegative ? quantity === 0 : quantity <= 0) {
      return allowNegative
        ? `The quantity of ${line.materialCode} cannot be zero.`
        : `The quantity of ${line.materialCode} must be greater than zero.`;
    }
    if (line.unitCost.trim() !== "" && (Number.isNaN(Number(line.unitCost)) || Number(line.unitCost) < 0)) {
      return `Enter a valid unit cost for ${line.materialCode}.`;
    }
  }
  return null;
};

export const toLineWrites = (lines: MovementLine[]): SilaMovementLineWrite[] =>
  lines.map((line) => ({
    materialId: line.materialId,
    quantity: Number(line.quantity),
    uom: line.uom && line.uom !== line.baseUom ? line.uom : null,
  }));

/** Material search plus the editable lines (quantity, unit, optional unit cost). */
const MovementLinesEditor: React.FC<MovementLinesEditorProps> = ({
  idPrefix,
  lines,
  onChange,
  allowNegative = false,
  showUnitCost = false,
  disabled = false,
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SilaMaterial[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Search runs on the server shortly after the user stops typing.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchMaterials(term);
        if (active) setResults(rows.slice(0, SEARCH_LIMIT));
      } catch (err: unknown) {
        if (active) setSearchError(err instanceof Error ? err.message : "Could not search the materials.");
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const update = (key: string, changes: Partial<MovementLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...changes } : line)));

  const addMaterial = (material: SilaMaterial) => {
    if (lines.some((line) => line.materialId === material.id)) return;
    onChange([...lines, lineFromMaterial(material)]);
    setSearch("");
    setResults([]);
  };

  return (
    <div className="smov-lines">
      <div className="sila-field">
        <label className="sila-label" htmlFor={`${idPrefix}-material-search`}>Add material</label>
        <input
          id={`${idPrefix}-material-search`}
          className="sila-input"
          type="search"
          placeholder="Code, description or barcode"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {search.trim().length >= 2 && (
        <div className="smov-results">
          {searching ? (
            <Loader size={20} message="Searching materials..." />
          ) : searchError ? (
            <EmptyState variant="error" title="Couldn't search the materials" description={searchError} />
          ) : results.length === 0 ? (
            <EmptyState title="No materials found" />
          ) : (
            <ul className="smov-result-list" aria-label="Materials found">
              {results.map((material) => {
                const added = lines.some((line) => line.materialId === material.id);
                return (
                  <li key={material.id} className="smov-result">
                    <span>
                      <span className="sila-cell-strong">{material.materialCode}</span>
                      <span className="smov-sub">{material.description} · {material.baseUom}</span>
                    </span>
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary sila-btn--sm"
                      disabled={disabled || added}
                      onClick={() => addMaterial(material)}
                      aria-label={`Add ${material.materialCode}`}
                    >
                      {added ? "Added" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {lines.length === 0 ? (
        <EmptyState title="No materials yet" description="Search for a material to add a line." />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit</th>
                {showUnitCost && <th scope="col">Unit cost (per base unit)</th>}
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    <span className="sila-cell-strong">{line.materialCode}</span>
                    <span className="smov-sub">{line.materialName}</span>
                    {line.note && <span className="smov-sub">{line.note}</span>}
                  </td>
                  <td>
                    <input
                      className="sila-input smov-qty"
                      type="number"
                      step="any"
                      min={allowNegative ? undefined : 0}
                      aria-label={`Quantity of ${line.materialCode}`}
                      value={line.quantity}
                      disabled={disabled}
                      onChange={(event) => update(line.key, { quantity: event.target.value })}
                    />
                  </td>
                  <td>
                    {line.uomOptions.length > 1 ? (
                      <select
                        className="sila-select smov-uom"
                        aria-label={`Unit of ${line.materialCode}`}
                        value={line.uom}
                        disabled={disabled}
                        onChange={(event) => update(line.key, { uom: event.target.value })}
                      >
                        {line.uomOptions.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    ) : (
                      line.uom
                    )}
                  </td>
                  {showUnitCost && (
                    <td>
                      <input
                        className="sila-input smov-qty"
                        type="number"
                        step="any"
                        min={0}
                        aria-label={`Unit cost of ${line.materialCode}`}
                        value={line.unitCost}
                        disabled={disabled}
                        onChange={(event) => update(line.key, { unitCost: event.target.value })}
                      />
                    </td>
                  )}
                  <td>
                    <button
                      type="button"
                      className="sila-btn sila-btn--ghost sila-btn--sm"
                      disabled={disabled}
                      onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                      aria-label={`Remove ${line.materialCode}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MovementLinesEditor;
