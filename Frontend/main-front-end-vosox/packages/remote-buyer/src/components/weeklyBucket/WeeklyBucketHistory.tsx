import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination } from "@vosox/shared-ui";
import { getWeeklyBuckets, type WeeklyBucketListItem } from "../../api/weeklyBucketApi";
import WeeklyBucketTable from "./WeeklyBucketTable";

const PAGE_SIZE = 20;

interface WeeklyBucketHistoryProps {
  /** Changes when the list has to be read again (a bucket was created or frozen). */
  refreshKey: string;
  openingId: string | null;
  onOpen: (bucketId: string) => void;
}

/** The weekly buckets of the organization, newest first. */
const WeeklyBucketHistory: React.FC<WeeklyBucketHistoryProps> = ({ refreshKey, openingId, onOpen }) => {
  const [rows, setRows] = useState<WeeklyBucketListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One extra row tells whether there is a next page.
      const data = await getWeeklyBuckets((page - 1) * PAGE_SIZE, PAGE_SIZE + 1);
      setHasNext(data.length > PAGE_SIZE);
      setRows(data.slice(0, PAGE_SIZE));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load weekly buckets.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">History</h2>
      </div>
      {loading ? (
        <Loader size={24} message="Loading weekly buckets..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load weekly buckets"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No weekly buckets yet" />
      ) : (
        <>
          <WeeklyBucketTable rows={rows} openingId={openingId} onOpen={onOpen} />
          <Pagination
            page={page}
            hasNext={hasNext}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
            disabled={loading}
          />
        </>
      )}
    </section>
  );
};

export default WeeklyBucketHistory;
