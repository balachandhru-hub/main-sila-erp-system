import React, { useState } from 'react';
import {
  SILA_COUNT_TYPES,
  createStockCount,
  getStockCounts,
  type SilaCountType,
  type SilaStockCountListItem,
} from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';

const REVIEW_STATUSES = new Set(['SUBMITTED', 'ENQUIRY_PENDING']);

const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const loadOpenCounts = async (): Promise<SilaStockCountListItem[]> => {
  const groups = await Promise.all([
    getStockCounts('IN_PROGRESS'),
    getStockCounts('SUBMITTED'),
    getStockCounts('ENQUIRY_PENDING'),
  ]);
  const seen = new Set<string>();
  return groups.flat().filter((count) => {
    const id = count.id.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

/** Open counts to count or review. Admin, cost controller and F&B director start a count for a location. */
const CountListScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { locations, location } = useMyLocation();
  const { data, loading, error, reload } = useLoad(loadOpenCounts, 'open-counts');
  const [countType, setCountType] = useState<SilaCountType>('ADHOC');
  const [chosenLocationId, setChosenLocationId] = useState<string>('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const startLocationId = chosenLocationId || location?.id || '';
  // Managers count the locations marked as theirs. When none are marked, they count every location they can open.
  const assigned = locations.filter((item) => item.assigned);
  const scope = can.initiateCount ? locations : assigned.length > 0 ? assigned : locations;
  const scopeIds = new Set(scope.map((item) => item.id.toLowerCase()));
  const counts = (data ?? []).filter((count) => scopeIds.size === 0 || scopeIds.has(count.locationId.toLowerCase()));

  const start = async () => {
    if (!startLocationId) return;
    setStarting(true);
    setStartError(null);
    try {
      const id = await createStockCount({
        locationId: startLocationId,
        countType,
        blindCount: false,
        businessDate: today(),
      });
      go(`inventory/counts/${id}`);
    } catch (caught: unknown) {
      setStartError(errorText(caught, 'Could not start the stock count.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Stock Count" eyebrow="Inventory" back />
      <div className="sm-screen">
        {can.initiateCount && (
          <section className="sm-section" aria-labelledby="sm-count-start">
            <h2 id="sm-count-start">Start a count</h2>
            <p className="sm-meta">Pick the outlet or store. The manager there enters the physical count. Today.</p>
            <LocationPicker label="Location" locations={locations} value={startLocationId} onChange={setChosenLocationId} placeholder="Choose a location" />
            <label className="sm-label" htmlFor="sm-count-type">Count type</label>
            <select
              id="sm-count-type"
              className="sm-select"
              value={countType}
              onChange={(event) => setCountType(event.target.value as SilaCountType)}
            >
              {SILA_COUNT_TYPES.map((type) => (
                <option key={type} value={type}>{silaLabel(type)}</option>
              ))}
            </select>
            {startError && <ErrorNotice message={startError} />}
            <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={starting || !startLocationId} onClick={start}>
              {starting ? 'Starting…' : 'Start stock count'}
            </button>
          </section>
        )}

        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && counts.length === 0 && (
          <Empty
            text="No counts to work"
            description={can.initiateCount ? 'Start a count for a location, or wait for one to be submitted for review.' : 'No count is open for your outlets or stores.'}
          />
        )}
        {counts.length > 0 && (
          <section className="sm-section" aria-labelledby="sm-count-open">
            <h2 id="sm-count-open">Open and waiting for review</h2>
            <ul className="sm-list">
              {counts.map((count) => {
                const review = REVIEW_STATUSES.has(count.status);
                const recount = count.status === 'IN_PROGRESS' && Boolean(count.submittedOn);
                const matched = Math.max(count.countedItems - count.shortageItems - count.surplusItems, 0);
                return (
                  <li key={count.id}>
                    <button type="button" className="sm-list-btn" onClick={() => go(`inventory/counts/${count.id}`)}>
                      <span className="sm-row">
                        <strong>{count.countNumber}</strong>
                        {recount ? <StatusBadge status="RECOUNT_REQUESTED" label="Recount requested" /> : <StatusBadge status={count.status} label={review ? 'Review' : undefined} />}
                      </span>
                      <span className="sm-meta">
                        {count.locationName ?? '—'} · {formatDate(count.dateCreated)} · {count.totalItems} materials · {silaLabel(count.countType)}
                        {count.blindCount ? ' · blind' : ''}
                      </span>
                      <span className="sm-meta">
                        {review ? 'Open to review and approve' : `Counted ${count.countedItems} of ${count.totalItems}`}
                        {count.blindCount || review ? '' : ` · Matched ${matched} · Shortage ${count.shortageItems} · Surplus ${count.surplusItems}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
};

export default CountListScreen;
