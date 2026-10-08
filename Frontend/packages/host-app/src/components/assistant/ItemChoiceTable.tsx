import React from 'react';
import { getItemMaster, type ItemCandidate, type ItemChoice, type ItemTable, type ItemTableRow } from '../../api/assistantApi';

interface Props {
  table: ItemTable;
  disabled: boolean;
  /** Called with a line for the conversation and the choice for each item that was decided or changed. */
  onSubmit: (summary: string, choices: ItemChoice[]) => void;
}

const NONE = '';

const label = (c: ItemCandidate) => (c.group ? `${c.description} · ${c.group}` : c.description);

/** What a row starts with: its entry when it already has one; otherwise nothing, and the buyer has to choose. */
const initialChoice = (row: ItemTableRow): string => (row.state === 'matched' && row.code ? row.code : NONE);

const ItemChoiceTable: React.FC<Props> = ({ table, disabled, onSubmit }) => {
  const [entries, setEntries] = React.useState<ItemCandidate[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [choices, setChoices] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(table.rows.map((r) => [r.name, initialChoice(r)])),
  );

  React.useEffect(() => {
    let cancelled = false;
    getItemMaster()
      .then((list) => !cancelled && setEntries(list))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  /** The entry a code stands for: from the full item master, else from the row's own suggestions. */
  const findEntry = (row: ItemTableRow, code: string): ItemCandidate | undefined =>
    row.candidates.find((c) => c.code === code) ?? entries.find((c) => c.code === code);

  const complete = table.rows.every((r) => choices[r.name] !== NONE);

  const submit = () => {
    // Every item has an entry. Only items that were not matched yet, or that were changed, are sent; an item left as it was keeps what it has.
    const changed = table.rows.filter((r) => choices[r.name] !== initialChoice(r));
    const sent: ItemChoice[] = changed.map((r) => ({ item: r.name, code: choices[r.name] }));
    const summary = changed
      .map((r) => {
        const entry = findEntry(r, choices[r.name]);
        return `${r.name} → ${entry ? `${entry.description} (${entry.code})` : choices[r.name]}`;
      })
      .join('; ');
    onSubmit(summary || 'Continue', sent);
  };

  return (
    <div className="va-table-wrap">
      <table className="va-table va-item-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Quantity</th>
            <th>Group</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const code = choices[row.name];
            const entry = code === NONE ? undefined : findEntry(row, code);
            const suggested = new Set(row.candidates.map((c) => c.code));
            return (
              <tr key={row.name}>
                <td>
                  {/* The entry's description replaces what was typed. */}
                  <div>{entry ? entry.description : row.name}</div>
                  {entry && entry.description !== row.name && <small className="va-muted">{row.name}</small>}
                </td>
                <td>{row.quantity !== null ? `${row.quantity} ${row.uom ?? ''}`.trim() : '—'}</td>
                <td>
                  <select
                    className="va-select"
                    value={code}
                    disabled={disabled}
                    onChange={(e) => setChoices((prev) => ({ ...prev, [row.name]: e.target.value }))}
                  >
                    <option value={NONE} disabled>Select…</option>
                    {row.candidates.length > 0 && (
                      <optgroup label="Suggested">
                        {row.candidates.map((c) => (
                          <option key={`s-${c.code}`} value={c.code}>{label(c)}</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Item master">
                      {entries
                        .filter((c) => !suggested.has(c.code))
                        .map((c) => (
                          <option key={c.code} value={c.code}>{label(c)}</option>
                        ))}
                      {/* The row's current entry stays selectable until the list has loaded. */}
                      {row.state === 'matched' && row.code && !entries.some((c) => c.code === row.code) && !suggested.has(row.code) && (
                        <option value={row.code}>{row.description} · {row.group}</option>
                      )}
                    </optgroup>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {loadError && <div className="va-error va-table-title">The full item master could not be loaded; only the suggestions are available.</div>}
      <div className="va-table-actions">
        <button type="button" className="va-submit" disabled={disabled || !complete} onClick={submit}>Submit</button>
      </div>
    </div>
  );
};

export default ItemChoiceTable;
