import React from 'react';
import { getStockCounts } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

/** Open (in progress) counts at the user's locations; a submitted count sent back is a recount. */
const CountListScreen: React.FC = () => {
  const go = useGo();
  const { locations } = useMyLocation();
  const { data, loading, error, reload } = useLoad(() => getStockCounts('IN_PROGRESS'), 'open-counts');
  const myIds = locations.map((location) => location.id);
  const counts = (data ?? []).filter((count) => myIds.length === 0 || myIds.includes(count.locationId));

  return (
    <>
      <ScreenHeader title="Stock Count" eyebrow="Inventory" back />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && counts.length === 0 && (
          <Empty text="No open counts" description="Counts at your locations are started by your store manager." />
        )}
        <ul className="sm-list">
          {counts.map((count) => {
            const recount = Boolean(count.submittedOn);
            const matched = Math.max(count.countedItems - count.shortageItems - count.surplusItems, 0);
            return (
              <li key={count.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`inventory/counts/${count.id}`)}>
                  <span className="sm-row">
                    <strong>{count.countNumber}</strong>
                    {recount ? <StatusBadge status="RECOUNT_REQUESTED" label="Recount requested" /> : <StatusBadge status={count.status} />}
                  </span>
                  <span className="sm-meta">
                    {count.locationName ?? '—'} · {formatDate(count.dateCreated)} · {count.totalItems} materials · {silaLabel(count.countType)}
                    {count.blindCount ? ' · blind' : ''}
                  </span>
                  <span className="sm-meta">
                    Counted {count.countedItems} of {count.totalItems}
                    {count.blindCount ? '' : ` · Matched ${matched} · Shortage ${count.shortageItems} · Surplus ${count.surplusItems}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default CountListScreen;
