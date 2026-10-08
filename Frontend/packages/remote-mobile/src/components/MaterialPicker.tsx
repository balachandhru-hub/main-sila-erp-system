import React, { useEffect, useId, useState } from 'react';
import { searchMaterials, type SilaMaterial } from '../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { errorText } from '../useLoad';

interface MaterialPickerProps {
  label?: string;
  onPick: (material: SilaMaterial) => void;
}

const MIN_SEARCH = 2;

/** Searches the Item Master (code, description, barcode) and lets the user pick one result. */
const MaterialPicker: React.FC<MaterialPickerProps> = ({ label = 'Find material', onPick }) => {
  const id = useId();
  const [search, setSearch] = useState<string>('');
  const [results, setResults] = useState<SilaMaterial[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const text = search.trim();
    if (text.length < MIN_SEARCH) {
      setResults([]);
      setError(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchMaterials(text)
        .then((found) => {
          if (active) {
            setResults(found.slice(0, 20));
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (active) setError(errorText(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const pick = (material: SilaMaterial) => {
    onPick(material);
    setSearch('');
    setResults([]);
  };

  const text = search.trim();
  return (
    <div className="sm-section">
      <div className="sm-field">
        <label htmlFor={id}>{label}</label>
        <input
          id={id}
          className="sm-input"
          type="search"
          placeholder="Code, name or barcode"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading && <p className="sm-muted" role="status">Searching…</p>}
      {error && <p className="sm-notice sm-notice--error" role="alert">{error}</p>}
      {!loading && !error && text.length >= MIN_SEARCH && results.length === 0 && (
        <p className="sm-muted">No material matches “{text}”.</p>
      )}
      {results.length > 0 && (
        <ul className="sm-list" aria-label="Materials found">
          {results.map((material) => (
            <li key={material.id}>
              <button type="button" className="sm-list-btn" onClick={() => pick(material)}>
                <strong>{material.description}</strong>
                <span className="sm-muted">
                  {material.materialCode} · {material.baseUom}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Units a material can be entered in: base unit first, then the units it converts from/to. */
export const materialUoms = (material: Pick<SilaMaterial, 'baseUom' | 'conversions'>): string[] => {
  const units = [material.baseUom];
  (material.conversions ?? []).forEach((conversion) => {
    [conversion.fromUom, conversion.toUom].forEach((unit) => {
      if (unit && !units.includes(unit)) units.push(unit);
    });
  });
  return units;
};

export default MaterialPicker;
