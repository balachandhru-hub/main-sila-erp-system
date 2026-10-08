import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, toastService } from "@vosox/shared-ui";
import {
  getWeeklyBucket,
  getWeeklyBuckets,
  type WeeklyBucketDetail,
  type WeeklyBucketListItem,
} from "../../api/weeklyBucketApi";
import WeeklyBucketTable from "./WeeklyBucketTable";
import { isMyApprovalTurn } from "./weeklyBucketStatus";

const BATCH_SIZE = 50;
const MAX_BATCHES = 10;

interface WeeklyBucketApprovalsProps {
  currentUserId: string | null;
  openingId: string | null;
  onOpen: (bucketId: string) => void;
}

/** Approvals inbox: the frozen buckets waiting for the signed-in user's decision. */
const WeeklyBucketApprovals: React.FC<WeeklyBucketApprovalsProps> = ({ currentUserId, openingId, onOpen }) => {
  const [rows, setRows] = useState<WeeklyBucketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The list does not say whose turn it is, so every pending bucket is opened to read its approval steps.
      const pending: WeeklyBucketListItem[] = [];
      for (let index = 0; index < MAX_BATCHES; index += 1) {
        const batch = await getWeeklyBuckets(index * BATCH_SIZE, BATCH_SIZE);
        pending.push(...batch.filter((row) => row.status === "PENDING_APPROVAL"));
        if (batch.length < BATCH_SIZE) break;
      }
      const results = await Promise.allSettled(pending.map((row) => getWeeklyBucket(row.id)));
      const details = results
        .filter((result): result is PromiseFulfilledResult<WeeklyBucketDetail> => result.status === "fulfilled")
        .map((result) => result.value);
      const failed = results.length - details.length;
      if (failed > 0) {
        toastService.error(`${failed} pending bucket${failed === 1 ? "" : "s"} could not be checked.`);
      }
      const mine = new Set(details.filter((detail) => isMyApprovalTurn(detail, currentUserId)).map((detail) => detail.id));
      setRows(pending.filter((row) => mine.has(row.id)));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load weekly buckets.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="sila-card">
      {loading ? (
        <Loader size={24} message="Loading approvals..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load approvals"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing is waiting for you" />
      ) : (
        <WeeklyBucketTable rows={rows} openingId={openingId} onOpen={onOpen} />
      )}
    </section>
  );
};

export default WeeklyBucketApprovals;
