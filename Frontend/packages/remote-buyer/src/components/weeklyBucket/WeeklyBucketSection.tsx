import React, { useMemo, useState } from "react";
import { Dropdown, EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { getWeeklyBucket, type WeeklyBucketDetail as WeeklyBucket } from "../../api/weeklyBucketApi";
import { useCurrentWeeklyBucket } from "../../hooks/useCurrentWeeklyBucket";
import { useCartStore } from "../../store/useCartStore";
import WeeklyBucketApprovals from "./WeeklyBucketApprovals";
import WeeklyBucketDetail from "./WeeklyBucketDetail";
import WeeklyBucketHistory from "./WeeklyBucketHistory";
import { isOpenStatus } from "./weeklyBucketStatus";
import "./WeeklyBucket.css";

interface WeeklyBucketSectionProps {
  buyerId: string;
  currentUserId: string | null;
  /** Store Manager and Buyer Administrator: review the bucket (stock refresh, final quantities, remove any line). */
  canReview: boolean;
  /** Store Manager: freezes the bucket and retries failed purchase orders. */
  canFreeze?: boolean;
  /** Buyer Administrator: maps products to Item Master materials. */
  canMapMaterial?: boolean;
  /** manage: the current bucket and the history. approve: inbox of buckets waiting for this user. */
  mode?: "manage" | "approve";
  /** Opens the cart, where products are added to the weekly bucket. */
  onOpenCart?: () => void;
}

const WeeklyBucketSection: React.FC<WeeklyBucketSectionProps> = ({
  buyerId,
  currentUserId,
  canReview,
  canFreeze = false,
  canMapMaterial = false,
  mode = "manage",
  onOpenCart,
}) => {
  const isInbox = mode === "approve";
  const cartCount = useCartStore((state) => state.products.length);
  const current = useCurrentWeeklyBucket(!isInbox);
  // A bucket opened from the history or the inbox; null shows the landing page.
  const [opened, setOpened] = useState<WeeklyBucket | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const outletOptions = useMemo(
    () => current.outlets.map((outlet) => ({
      name: `${outlet.outletName}${outlet.propertyName ? ` — ${outlet.propertyName}` : ""}`,
      value: outlet.id,
    })),
    [current.outlets],
  );
  const myOutletIds = useMemo(() => current.outlets.map((outlet) => outlet.id), [current.outlets]);

  const openBucket = async (bucketId: string) => {
    setOpeningId(bucketId);
    try {
      setOpened(await getWeeklyBucket(bucketId));
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not load this weekly bucket.");
    } finally {
      setOpeningId(null);
    }
  };

  if (!isInbox && canReview && !buyerId) {
    return <EmptyState title="Buyer profile is still loading" description="The weekly bucket opens after the buyer profile is available." />;
  }

  if (opened) {
    return (
      <>
        <PageHeader
          className="pud-page-header"
          title={`Weekly Bucket ${opened.bucketCode}`}
          onBack={() => setOpened(null)}
          backLabel={isInbox ? "Back to approvals" : "Back to weekly bucket"}
        />
        <WeeklyBucketDetail
          key={opened.id ?? opened.bucketCode}
          bucket={opened}
          onBucket={setOpened}
          buyerId={buyerId}
          currentUserId={currentUserId}
          canReview={canReview}
          canFreeze={canFreeze}
          canMapMaterial={canMapMaterial}
          readOnly
          allowDecide={isInbox}
        />
      </>
    );
  }

  if (isInbox) {
    return (
      <>
        <PageHeader className="pud-page-header" title="Weekly Bucket approvals" />
        <WeeklyBucketApprovals currentUserId={currentUserId} openingId={openingId} onOpen={openBucket} />
      </>
    );
  }

  const bucket = current.bucket;

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title="Weekly Bucket"
        actions={onOpenCart ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={onOpenCart}>
            Cart ({cartCount})
          </button>
        ) : undefined}
      />

      {current.showOutletPicker && (
        <section className="sila-card">
          <div className="sila-card-body">
            <div className="wb-outlet-picker">
              <Dropdown
                label="Outlet"
                placeholder="Select an outlet"
                options={outletOptions}
                value={outletOptions.find((option) => option.value === current.outletId) ?? null}
                onChange={(selected) => {
                  if (selected) current.setOutletId(selected.value);
                }}
              />
            </div>
          </div>
        </section>
      )}

      {current.loading ? (
        <section className="sila-card">
          <Loader size={24} message="Loading weekly bucket..." />
        </section>
      ) : current.error ? (
        <section className="sila-card">
          <EmptyState
            variant="error"
            title="Couldn't load the weekly bucket"
            description={current.error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={current.reload}>Try again</button>}
          />
        </section>
      ) : current.mustChooseOutlet ? (
        <section className="sila-card">
          <EmptyState title="Select an outlet" description="Your outlets belong to more than one property." />
        </section>
      ) : bucket ? (
        <WeeklyBucketDetail
          key={bucket.id ?? bucket.bucketCode}
          bucket={bucket}
          onBucket={current.setBucket}
          buyerId={buyerId}
          currentUserId={currentUserId}
          canReview={canReview}
          canFreeze={canFreeze}
          canMapMaterial={canMapMaterial}
          myOutletIds={myOutletIds}
        />
      ) : null}

      {/* The history is read again when the bucket on screen is frozen. */}
      <WeeklyBucketHistory
        refreshKey={bucket && !isOpenStatus(bucket.status) ? "frozen" : "open"}
        openingId={openingId}
        onOpen={openBucket}
      />
    </>
  );
};

export default WeeklyBucketSection;
