import React, { useEffect, useState } from 'react';
import {
  formatQty,
  searchLiveInventory,
  SILA_LIVE_PAGE_SIZE,
  type SilaLiveInventoryRow,
} from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';

const MIN_SEARCH = 2;

const LiveStockScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState<string>('');
  const [rows, setRows] = useState<SilaLiveInventoryRow[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const text = search.trim();

  useEffect(() => {
    if (text.length < MIN_SEARCH) {
      setRows([]);
      setHasMore(false);
      setError(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      searchLiveInventory(text, null, 0)
        .then((found) => {
          if (!active) return;
          setRows(found);
          setHasMore(found.length === SILA_LIVE_PAGE_SIZE);
        })
        .catch((caught: unknown) => {
          if (active) setError(errorText(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [text, attempt]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const found = await searchLiveInventory(text, null, rows.length);
      setRows((current) => [...current, ...found]);
      setHasMore(found.length === SILA_LIVE_PAGE_SIZE);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Live Inventory" eyebrow="Inventory" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search material"
          placeholder="Search or scan material ID, name, barcode…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {text.length < MIN_SEARCH && <p className="sm-muted">Type at least 2 characters to search.</p>}
        {error && <ErrorNotice message={error} onRetry={() => setAttempt((value) => value + 1)} />}
        {!loading && !error && text.length >= MIN_SEARCH && rows.length === 0 && <Empty text="No materials" description={`Server-side search found no matches for “${text}”.`} />}
        <ul className="sm-list">
          {rows.map((row) => (
            <li key={row.materialId}>
              <button type="button" className="sm-list-btn" onClick={() => go(`inventory/stock/${row.materialId}`)}>
                <strong>{row.materialCode}</strong>
                <span>{row.description}</span>
                <span className="sm-row">
                  <span>
                    On hand <strong>{formatQty(row.onHandQty)}</strong> {row.baseUom}
                  </span>
                  <span className="sm-meta">
                    {row.locationCount} location{row.locationCount === 1 ? '' : 's'}
                  </span>
                </span>
                {row.inTransitQty > 0 && <span className="sm-meta">In transit {formatQty(row.inTransitQty)}</span>}
              </button>
            </li>
          ))}
        </ul>
        {loading && <Loading text="Searching…" />}
        {hasMore && !loading && (
          <button type="button" className="sm-btn sm-btn--block" onClick={loadMore}>
            Load more
          </button>
        )}
      </div>
    </>
  );
};

export default LiveStockScreen;
