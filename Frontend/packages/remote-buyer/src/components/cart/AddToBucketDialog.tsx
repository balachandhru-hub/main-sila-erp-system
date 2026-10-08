import React, { useState } from "react";
import { Loader, Modal, toastService } from "@vosox/shared-ui";
import type { CatalogQuantity } from "../../api/personalWishlistApi";
import { addWeeklyBucketItems, type WeeklyBucketAddResult } from "../../api/weeklyBucketApi";
import { useCurrentWeeklyBucket } from "../../hooks/useCurrentWeeklyBucket";
import { statusBadgeClass, statusLabel } from "../weeklyBucket/weeklyBucketStatus";

interface AddToBucketDialogProps {
  /** The selected cart lines. */
  items: CatalogQuantity[];
  /** Must be a stable callback: the dialog re-focuses itself whenever it changes. */
  onClose: () => void;
  /** The lines are in the weekly bucket now. */
  onAdded: () => void;
  onOpenWeeklyBucket: () => void;
}

/** Cart → weekly bucket: shows the bucket the lines will go to, then posts them. */
const AddToBucketDialog: React.FC<AddToBucketDialogProps> = ({ items, onClose, onAdded, onOpenWeeklyBucket }) => {
  const current = useCurrentWeeklyBucket();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<WeeklyBucketAddResult | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await addWeeklyBucketItems(items, current.outletId || undefined);
      toastService.success(`Added to weekly bucket ${result.bucketCode}.`);
      setAdded(result);
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add the products to the weekly bucket.");
    } finally {
      setSaving(false);
    }
  };

  const bucket = current.bucket;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      headerProps={{ heading: "Add to Weekly Bucket", subHeading: `${items.length} product${items.length === 1 ? "" : "s"}` }}
      footerProps={added ? {
        secondaryButton: { text: "Close", onClick: onClose },
        primaryButton: { text: "Open weekly bucket", onClick: onOpenWeeklyBucket },
      } : {
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
        primaryButton: {
          text: "Add to weekly bucket",
          onClick: handleSubmit,
          loading: saving,
          disabled: current.loading || !bucket,
        },
      }}
    >
      <div className="sila-root cart-dialog">
        {added ? (
          <div className="sila-alert sila-alert--success" role="status">
            Added to weekly bucket {added.bucketCode}.
          </div>
        ) : (
          <>
            {current.showOutletPicker && (
              <div className="sila-field">
                <label className="sila-label" htmlFor="cart-bucket-outlet">Outlet<span className="sila-required">*</span></label>
                <select
                  id="cart-bucket-outlet"
                  className="sila-select"
                  value={current.outletId}
                  disabled={saving}
                  onChange={(event) => current.setOutletId(event.target.value)}
                >
                  {current.mustChooseOutlet && <option value="">Select an outlet</option>}
                  {current.outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.outletName}{outlet.propertyName ? ` — ${outlet.propertyName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {current.loading ? (
              <Loader size={24} message="Loading weekly bucket..." />
            ) : current.error ? (
              <div className="sila-alert sila-alert--danger" role="alert">{current.error}</div>
            ) : bucket ? (
              <dl className="sila-meta-grid">
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Bucket</dt>
                  <dd className="sila-meta-value">{bucket.bucketCode}</dd>
                </div>
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Property</dt>
                  <dd className="sila-meta-value">{bucket.propertyName || bucket.plantCode || "—"}</dd>
                </div>
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Status</dt>
                  <dd className="sila-meta-value">
                    <span className={statusBadgeClass(bucket.status)}>{statusLabel(bucket.status)}</span>
                  </dd>
                </div>
              </dl>
            ) : null}
            {error && <div className="sila-alert sila-alert--danger" role="alert">{error}</div>}
          </>
        )}
      </div>
    </Modal>
  );
};

export default AddToBucketDialog;
