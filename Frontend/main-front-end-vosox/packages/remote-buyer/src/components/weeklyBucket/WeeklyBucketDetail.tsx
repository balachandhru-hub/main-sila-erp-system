import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  decideWeeklyBucket,
  decideWeeklyBucketRecommendation,
  deleteWeeklyBucketItem,
  freezeWeeklyBucket,
  getWeeklyBucket,
  refreshWeeklyBucketInventory,
  retryWeeklyBucketPurchaseOrders,
  setWeeklyBucketItemFinalQuantity,
  setWeeklyBucketItemQuantity,
  type WeeklyBucketDetail as WeeklyBucket,
  type WeeklyBucketItem,
} from "../../api/weeklyBucketApi";
import { formatDateTime } from "../cart/lineFormat";
import MapMaterialDialog from "./MapMaterialDialog";
import WeeklyBucketApproval from "./WeeklyBucketApproval";
import WeeklyBucketLines from "./WeeklyBucketLines";
import WeeklyBucketRecommendations from "./WeeklyBucketRecommendations";
import { isExcludedOnFreeze, isOpenStatus, statusBadgeClass, statusLabel } from "./weeklyBucketStatus";
import "./WeeklyBucket.css";

interface WeeklyBucketDetailProps {
  bucket: WeeklyBucket;
  /** Receives the bucket again after every change. */
  onBucket: (bucket: WeeklyBucket) => void;
  buyerId: string;
  currentUserId: string | null;
  /** Store Manager and Buyer Administrator: refresh stock, final quantities, remove any line. */
  canReview: boolean;
  /** Store Manager: freeze the bucket, retry failed purchase orders. */
  canFreeze?: boolean;
  /** Buyer Administrator: map products to Item Master materials. */
  canMapMaterial?: boolean;
  /** History and the approvals inbox show a bucket without its edit actions, even while it is OPEN. */
  readOnly?: boolean;
  /** Approvals inbox: the approver whose turn it is gets Approve/Reject. */
  allowDecide?: boolean;
  /** Outlets the signed-in user belongs to. */
  myOutletIds?: string[];
}

type RefreshState = "idle" | "refreshing" | "done" | "failed";

const NO_OUTLETS: string[] = [];

/** One weekly bucket: header, lines, recommendations and, once frozen, its approval and purchase orders. */
const WeeklyBucketDetail: React.FC<WeeklyBucketDetailProps> = ({
  bucket,
  onBucket,
  buyerId,
  currentUserId,
  canReview,
  canFreeze = false,
  canMapMaterial = false,
  readOnly = false,
  allowDecide = false,
  myOutletIds = NO_OUTLETS,
}) => {
  const bucketId = bucket.id;
  const isOpen = isOpenStatus(bucket.status);
  const editable = isOpen && !readOnly && bucketId !== null;
  const reviewing = editable && canReview;

  const [busy, setBusy] = useState(false);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [mappingItem, setMappingItem] = useState<WeeklyBucketItem | null>(null);
  const [confirmingFreeze, setConfirmingFreeze] = useState(false);
  const mountedRef = useRef(true);
  const autoRefreshedRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!bucketId) return;
    try {
      const next = await getWeeklyBucket(bucketId);
      if (mountedRef.current) onBucket(next);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not load this weekly bucket.");
    }
  }, [bucketId, onBucket]);

  const refreshInventory = useCallback(async () => {
    if (!bucketId) return;
    setRefreshState("refreshing");
    setRefreshError(null);
    try {
      const next = await refreshWeeklyBucketInventory(bucketId);
      if (!mountedRef.current) return;
      onBucket(next);
      setRefreshState("done");
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setRefreshError(err instanceof Error ? err.message : "Could not refresh supplier stock.");
      setRefreshState("failed");
    }
  }, [bucketId, onBucket]);

  // The reviewer always works on current supplier stock: it is refreshed once when he opens the bucket.
  const hasItems = bucket.items.length > 0;
  useEffect(() => {
    if (!reviewing || !bucketId || !hasItems || autoRefreshedRef.current === bucketId) return;
    autoRefreshedRef.current = bucketId;
    refreshInventory();
  }, [reviewing, bucketId, hasItems, refreshInventory]);

  const closeMapping = useCallback(() => setMappingItem(null), []);
  const closeFreeze = useCallback(() => setConfirmingFreeze(false), []);

  /** Runs a change, tells the user when the server refuses it, and shows the bucket as the server has it now. */
  const run = async (action: () => Promise<void>, success: string | null, fallback: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toastService.success(success);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : fallback);
    }
    await reload();
    if (mountedRef.current) setBusy(false);
  };

  const handleFreeze = async () => {
    if (!bucketId) return;
    await run(() => freezeWeeklyBucket(bucketId), "Weekly bucket frozen and sent for approval.", "Could not freeze the weekly bucket.");
    if (mountedRef.current) setConfirmingFreeze(false);
  };

  const refreshing = refreshState === "refreshing";
  const excludedItems = bucket.items.filter(isExcludedOnFreeze);
  const proceedingItems = bucket.items.filter((item) => !isExcludedOnFreeze(item));
  const unmappedItems = proceedingItems.filter((item) => !item.materialCode);
  // Freezing on figures that could not be refreshed would exclude or keep lines on stale stock.
  const freezeReady = reviewing && canFreeze && refreshState === "done" && hasItems && !busy;

  return (
    <>
      <section className="sila-card">
        <div className="sila-card-header">
          <div className="wb-badges">
            <h2 className="sila-card-title">{bucket.bucketCode}</h2>
            <span className={statusBadgeClass(bucket.status)}>{statusLabel(bucket.status)}</span>
            {!isOpen && <span className="sila-badge sila-badge--neutral">FROZEN</span>}
          </div>
          {reviewing && (
            <div className="sila-btn-group">
              <button type="button" className="sila-btn sila-btn--secondary" disabled={busy || refreshing || !hasItems} onClick={refreshInventory}>
                {refreshing ? "Refreshing..." : "Refresh supplier stock"}
              </button>
              {canFreeze && (
                <button type="button" className="sila-btn sila-btn--primary" disabled={!freezeReady} onClick={() => setConfirmingFreeze(true)}>
                  Freeze bucket
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sila-card-body wb-stack">
          <dl className="sila-meta-grid">
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Property</dt>
              <dd className="sila-meta-value">{bucket.propertyName || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Plant</dt>
              <dd className="sila-meta-value">{bucket.plantCode || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Company code</dt>
              <dd className="sila-meta-value">{bucket.companyCode || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Week / year</dt>
              <dd className="sila-meta-value">{bucket.weekNumber} / {bucket.year}</dd>
            </div>
            {!isOpen && (
              <>
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Frozen by</dt>
                  <dd className="sila-meta-value">{bucket.frozenByName || "—"}</dd>
                </div>
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Frozen on</dt>
                  <dd className="sila-meta-value">{formatDateTime(bucket.frozenOn)}</dd>
                </div>
              </>
            )}
            {bucket.finalApprovedOn && (
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Approved on</dt>
                <dd className="sila-meta-value">{formatDateTime(bucket.finalApprovedOn)}</dd>
              </div>
            )}
          </dl>
          {!isOpen && (
            <div className="sila-alert" role="status">
              <span><span className="sila-alert-title">FROZEN</span> — this bucket is read-only. New requests go to the next week's bucket.</span>
            </div>
          )}
          {bucket.lastError && <div className="sila-alert sila-alert--danger" role="alert">{bucket.lastError}</div>}
          {refreshing && (
            <div className="sila-alert" role="status">
              <span className="sila-spinner" aria-hidden="true" />
              <span>Refreshing supplier stock…</span>
            </div>
          )}
          {refreshState === "failed" && (
            <div className="sila-alert sila-alert--danger" role="alert">
              <span>
                <span className="sila-alert-title">Supplier stock was not refreshed.</span>{" "}
                {refreshError} The stock and availability below are not current, so the bucket cannot be frozen.
              </span>
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={refreshInventory}>
                Try again
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Lines ({bucket.items.length})</h2>
        </div>
        <WeeklyBucketLines
          items={bucket.items}
          currentUserId={currentUserId}
          editable={editable}
          canReview={canReview}
          canMapMaterial={canMapMaterial}
          busy={busy || refreshing}
          onRequestedQuantity={(item, quantity) => {
            if (bucketId) run(() => setWeeklyBucketItemQuantity(bucketId, item.id, quantity), null, "Could not update the requested quantity.");
          }}
          onFinalQuantity={(item, quantity) => {
            if (bucketId) run(() => setWeeklyBucketItemFinalQuantity(bucketId, item.id, quantity), null, "Could not update the final quantity.");
          }}
          onRemove={(item) => {
            if (bucketId) run(() => deleteWeeklyBucketItem(bucketId, item.id), "Line removed.", "Could not remove the line.");
          }}
          onMapMaterial={setMappingItem}
        />
      </section>

      {bucket.recommendations.length > 0 && (
        <section className="sila-card">
          <div className="sila-card-header">
            <h2 className="sila-card-title">Recommendations ({bucket.recommendations.length})</h2>
          </div>
          <WeeklyBucketRecommendations
            recommendations={bucket.recommendations}
            items={bucket.items}
            currentUserId={currentUserId}
            myOutletIds={myOutletIds}
            editable={editable}
            busy={busy || refreshing}
            onDecide={(recommendation, status) => {
              if (!bucketId) return;
              run(
                () => decideWeeklyBucketRecommendation(bucketId, recommendation.id, status),
                status === "APPROVE"
                  ? `${recommendation.recommendationNumber} approved.`
                  : `${recommendation.recommendationNumber} rejected.`,
                "Could not record the decision on the recommendation.",
              );
            }}
          />
        </section>
      )}

      {!isOpen && (
        <WeeklyBucketApproval
          bucket={bucket}
          currentUserId={currentUserId}
          allowDecide={allowDecide}
          canRetry={canFreeze}
          busy={busy}
          onDecide={(status, comment) => {
            if (!bucketId) return;
            run(
              () => decideWeeklyBucket(bucketId, status, comment),
              status === "APPROVE" ? "Weekly bucket approved." : "Weekly bucket rejected.",
              "Could not record the approval decision.",
            );
          }}
          onRetryPurchaseOrders={() => {
            if (bucketId) run(() => retryWeeklyBucketPurchaseOrders(bucketId), "Purchase orders retried.", "Could not retry the purchase orders.");
          }}
        />
      )}

      {mappingItem && (
        <MapMaterialDialog
          buyerId={buyerId}
          item={mappingItem}
          onClose={closeMapping}
          onMapped={() => {
            closeMapping();
            reload();
          }}
        />
      )}

      <Modal
        isOpen={confirmingFreeze}
        onClose={closeFreeze}
        variant="danger"
        headerProps={{ heading: `Freeze bucket ${bucket.bucketCode}` }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: closeFreeze, disabled: busy },
          primaryButton: { text: "Freeze bucket", onClick: handleFreeze, loading: busy },
        }}
      >
        <div className="sila-root wb-dialog">
          <p className="sila-modal-text">
            Freezing cannot be undone. The bucket becomes read-only for ever and goes for approval;
            later requests go to the next week's bucket.
          </p>
          <p className="sila-modal-text">{proceedingItems.length} of {bucket.items.length} lines will proceed.</p>
          {excludedItems.length > 0 && (
            <div className="sila-alert sila-alert--warning">
              <div className="wb-dialog">
                <span className="sila-alert-title">
                  Excluded: unavailable with no approved recommendation ({excludedItems.length})
                </span>
                <ul className="wb-list">
                  {excludedItems.map((item) => (
                    <li key={item.id}>
                      {item.productName} — {item.requestorName || "Unknown requester"}{item.outletName ? `, ${item.outletName}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {unmappedItems.length > 0 && (
            <div className="sila-alert sila-alert--danger" role="alert">
              <div className="wb-dialog">
                <span className="sila-alert-title">Without a material ({unmappedItems.length}) — the buyer administrator maps them before the bucket can be frozen</span>
                <ul className="wb-list">
                  {unmappedItems.map((item) => (
                    <li key={item.id}>{item.productName}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default WeeklyBucketDetail;
