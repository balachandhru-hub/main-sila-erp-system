import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTransfers, type SilaTransferTab } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { formatDate } from '../../format';

const TABS: { key: SilaTransferTab; label: string }[] = [
  { key: 'mine', label: 'My requests' },
  { key: 'to-approve', label: 'Requires my approval' },
  { key: 'in-transit', label: 'In transit' },
  { key: 'completed', label: 'Completed' },
];

const isTab = (value: string | null): value is SilaTransferTab => TABS.some((tab) => tab.key === value);

const TransfersScreen: React.FC = () => {
  const go = useGo();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: SilaTransferTab = isTab(requested) ? requested : 'mine';
  const { data, loading, error, reload } = useLoad(() => getTransfers(tab), tab);
  const [search, setSearch] = useState<string>('');
  const text = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (row) => !text || `${row.itoNumber} ${row.fromLocationName ?? ''} ${row.toLocationName ?? ''}`.toLowerCase().includes(text),
  );

  return (
    <>
      <ScreenHeader title="Transfers" eyebrow="Inventory" back />
      <div className="sm-screen">
        <div className="sm-tabs sm-tabs--wrap" role="group" aria-label="Transfer lists">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="sm-tab"
              aria-pressed={item.key === tab}
              onClick={() => setParams({ tab: item.key }, { replace: true })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="sm-grid-2">
          <button type="button" className="sm-btn sm-btn--primary" onClick={() => go('inventory/transfers/new')}>
            + Raise ITO
          </button>
          <button type="button" className="sm-btn" onClick={() => go('inventory/transfers/new?mode=quick')}>
            Quick transfer
          </button>
        </div>
        <input
          className="sm-input"
          type="search"
          aria-label="Filter transfers"
          placeholder="ITO number, from, to…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && rows.length === 0 && (
          <Empty text="No transfers" description="Raise a STANDARD or QUICK ITO from Live Inventory or + Raise ITO." />
        )}
        {!loading && (
          <ul className="sm-list">
            {rows.map((transfer) => (
              <li key={transfer.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`inventory/transfers/${transfer.id}`)}>
                  <span className="sm-row">
                    <strong>{transfer.itoNumber}</strong>
                    <StatusBadge status={transfer.status} label={`${transfer.mode} ${transfer.status}`.replace(/_/g, ' ')} />
                  </span>
                  <span>
                    {transfer.fromLocationName ?? '—'} → {transfer.toLocationName ?? '—'}
                  </span>
                  <span className="sm-meta">
                    {transfer.requiredBy ? `Required by ${formatDate(transfer.requiredBy)} · ` : ''}
                    {transfer.lineCount} line{transfer.lineCount === 1 ? '' : 's'} · {formatDate(transfer.requestedOn)}
                    {transfer.requestedByName ? ` · ${transfer.requestedByName}` : ''}
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

export default TransfersScreen;
