import React, { useState } from 'react';
import type { SilaStockCountItem } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import StatusBadge from '../../components/StatusBadge';
import { Empty } from '../../components/StateViews';
import { useGo } from '../../navigation';

interface CountSheetProps {
  items: SilaStockCountItem[];
  editable: boolean;
  /** Reopened for recount: only lines marked for recount can be counted. */
  reopened: boolean;
  onOpen: (item: SilaStockCountItem) => void;
}

/** The count list: every line with its status, recount mark, review and enquiry. */
const CountSheet: React.FC<CountSheetProps> = ({ items, editable, reopened, onOpen }) => {
  const go = useGo();
  const [filter, setFilter] = useState<string>('');
  const [onlyRecount, setOnlyRecount] = useState<boolean>(reopened);
  const text = filter.trim().toLowerCase();
  const visible = items.filter(
    (item) =>
      (!onlyRecount || item.recountRequested) &&
      (!text || item.materialName.toLowerCase().includes(text) || item.materialCode.toLowerCase().includes(text)),
  );

  return (
    <section className="sm-section" aria-labelledby="sm-count-sheet">
      <h2 id="sm-count-sheet">Count list ({items.length})</h2>
      <input
        className="sm-input"
        type="search"
        aria-label="Filter the count list"
        placeholder="Search material, id, or group"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      {reopened && (
        <label className="sm-check">
          <input type="checkbox" checked={onlyRecount} onChange={(event) => setOnlyRecount(event.target.checked)} />
          Only lines to recount
        </label>
      )}
      {visible.length === 0 && <Empty text={text || onlyRecount ? 'No line matches the filter.' : 'The count list is empty.'} />}
      <ul className="sm-list">
        {visible.map((item) => {
          const countable = editable && (!reopened || Boolean(item.recountRequested));
          const needsAnswer = item.reviewStatus === 'MORE_INFORMATION_REQUIRED' && item.enquiryId;
          return (
            <li key={item.id}>
              <button type="button" className="sm-list-btn" disabled={!countable} onClick={() => onOpen(item)}>
                <span className="sm-row">
                  <strong>{item.materialName}</strong>
                  {item.recountRequested ? <StatusBadge status="RECOUNT_REQUESTED" label="Recount requested" /> : <StatusBadge status={item.status} />}
                </span>
                <span className="sm-meta">
                  {item.materialCode} · counted {formatQty(item.countedQty)} {item.baseUom}
                  {item.systemQty !== null && item.systemQty !== undefined ? ` · system ${formatQty(item.systemQty)}` : ''}
                  {item.varianceQty !== null && item.varianceQty !== undefined ? ` · variance ${formatQty(item.varianceQty)}` : ''}
                  {(item.photos ?? []).length > 0 ? ` · ${(item.photos ?? []).length} photo${(item.photos ?? []).length === 1 ? '' : 's'}` : ''}
                </span>
                {item.reviewStatus && !item.recountRequested && (
                  <span className="sm-meta">
                    Review: <StatusBadge status={item.reviewStatus} />
                  </span>
                )}
                {item.reviewComment && <span className="sm-meta">“{item.reviewComment}”</span>}
              </button>
              {needsAnswer && (
                <button type="button" className="sm-link" onClick={() => go(`tasks/enquiries/${item.enquiryId}`)}>
                  More information requested on {item.enquiryNumber ?? 'the enquiry'} – answer now ›
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CountSheet;
