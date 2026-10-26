import React, { useState } from 'react';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getAdjustments } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const AdjustmentsScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { location } = useMyLocation();
  const { data, loading, error, reload } = useLoad(
    () => getAdjustments({ locationId: location?.id }),
    location ? `adjustments-${location.id}` : null,
  );
  const [search, setSearch] = useState('');
  const text = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (row) => !text || `${row.adjustmentNumber} ${row.adjustmentType} ${row.reason ?? ''}`.toLowerCase().includes(text),
  );

  return (
    <>
      <ScreenHeader
        title="Waste and adjustments"
        eyebrow="Inventory"
        back
        intro={location ? `Posted at ${location.locationName}.` : 'Choose a location on Home first.'}
      />
      <div className="sm-screen">
        {can.postAdjustment && (
          <button type="button" className="sm-btn sm-btn--primary sm-btn--block" onClick={() => go('inventory/adjustments/new')}>
            New adjustment
          </button>
        )}
        <input
          className="sm-input"
          type="search"
          aria-label="Filter adjustments"
          placeholder="Number, type, reason…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && rows.length === 0 && <Empty text="No adjustments at this location." />}
        <ul className="sm-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`inventory/adjustments/${row.id}`)}>
                <span className="sm-row">
                  <strong>{row.adjustmentNumber}</strong>
                  <span className="sm-meta">{silaLabel(row.adjustmentType)}</span>
                </span>
                <span className="sm-meta">
                  {formatDate(row.postedOn)} · {row.lineCount} material{row.lineCount === 1 ? '' : 's'}
                  {row.reason ? ` · ${row.reason}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default AdjustmentsScreen;
