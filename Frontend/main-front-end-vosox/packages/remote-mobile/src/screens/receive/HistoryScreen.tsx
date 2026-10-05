import React, { useEffect, useState } from 'react';
import { getGoodsReceipts } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate, todayIso } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { daysAgoIso, grnErpStatus } from './grnStatus';

type Range = 'today' | '7' | '30' | 'custom';

const RANGES: { key: Range; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7', label: '7 Days', days: 7 },
  { key: '30', label: '30 Days', days: 30 },
  { key: 'custom', label: 'Custom', days: 30 },
];

/** Goods receipts, searched by GRN / PO number, over a date range. */
const HistoryScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [range, setRange] = useState<Range>('30');
  const [customFrom, setCustomFrom] = useState<string>(daysAgoIso(30));
  const [customTo, setCustomTo] = useState<string>(todayIso());

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const days = RANGES.find((item) => item.key === range)?.days ?? 30;
  const fromDate = range === 'custom' ? customFrom : daysAgoIso(days);
  const toDate = range === 'custom' ? customTo : todayIso();
  const invalidRange = range === 'custom' && (!customFrom || !customTo || customFrom > customTo);
  const { data, loading, error, reload } = useLoad(
    () => getGoodsReceipts({ search: query, fromDate, toDate }, { index: 0, limit: 50 }),
    invalidRange ? null : `grns-${query}-${fromDate}-${toDate}`,
  );

  return (
    <>
      <ScreenHeader title="Receiving history" eyebrow="Receive" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search receiving history"
          placeholder="GRN, PO or delivery note"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="sm-tabs sm-tabs--wrap" role="group" aria-label="Period">
          {RANGES.map((item) => (
            <button key={item.key} type="button" className="sm-tab" aria-pressed={item.key === range} onClick={() => setRange(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="sm-grid-2">
            <div className="sm-field">
              <label htmlFor="sm-grn-from">From</label>
              <input id="sm-grn-from" className="sm-input" type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-grn-to">To</label>
              <input id="sm-grn-to" className="sm-input" type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} />
            </div>
          </div>
        )}
        {invalidRange && <p className="sm-notice sm-notice--warning">Choose a start date on or before the end date.</p>}
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && !invalidRange && (data ?? []).length === 0 && <Empty text="No receipts match these filters." />}
        {!loading && (
          <ul className="sm-list">
            {(data ?? []).map((grn) => (
              <li key={grn.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                  <span className="sm-row">
                    <strong>{grn.grnNumber}</strong>
                    <span aria-hidden="true">›</span>
                  </span>
                  <span>{grn.supplierName ?? '—'}</span>
                  <span className="sm-meta">
                    PO {grn.poNumber} · Invoice {grn.invoiceNumber ?? '—'} · MD {grn.erpReference ?? '—'}
                  </span>
                  <span className="sm-meta">{grn.locationName ?? '—'}</span>
                  <span className="sm-row">
                    <StatusBadge status={grnErpStatus(grn)} />
                    <span className="sm-meta">{formatDate(grn.receivedOn)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default HistoryScreen;
