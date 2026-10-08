import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { formatQty, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { createGoodsIssue, getGoodsIssueFromBucket } from "../../../api/silaMe/silaMovementsApi";
import MovementLinesEditor, { lineInBaseUnit, toLineWrites, validateLines, type MovementLine } from "./MovementLinesEditor";

interface SilaGoodsIssueFormProps {
  /** Stores the user may issue from. */
  stores: SilaLocation[];
  /** Outlet locations of the organization. */
  outlets: SilaLocation[];
  onClose: () => void;
  onCreated: () => void;
}

/** New goods issue from a store to an outlet of the same property, optionally loaded from the weekly bucket. */
const SilaGoodsIssueForm: React.FC<SilaGoodsIssueFormProps> = ({ stores, outlets, onClose, onCreated }) => {
  const [storeId, setStoreId] = useState(stores.length === 1 ? stores[0].id : "");
  const [outletId, setOutletId] = useState("");
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [bucket, setBucket] = useState<{ id: string; code: string } | null>(null);
  const [loadingBucket, setLoadingBucket] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const store = stores.find((location) => location.id === storeId);
  const outletOptions = store ? outlets.filter((location) => location.propertyId === store.propertyId) : [];

  const handleStore = (value: string) => {
    setStoreId(value);
    const next = stores.find((location) => location.id === value);
    const outlet = outlets.find((location) => location.id === outletId);
    if (!next || !outlet || outlet.propertyId !== next.propertyId) {
      setOutletId("");
      setBucket(null);
    }
  };

  const handleOutlet = (value: string) => {
    setOutletId(value);
    setBucket(null);
  };

  const loadFromBucket = async () => {
    if (!outletId) return;
    setLoadingBucket(true);
    try {
      const result = await getGoodsIssueFromBucket(outletId);
      const open = result.lines.filter((line) => line.remainingQuantity > 0);
      if (!result.weeklyBucketId) {
        toastService.info("This outlet has no frozen weekly bucket.");
        return;
      }
      if (open.length === 0) {
        toastService.info(`Everything in weekly bucket ${result.bucketCode ?? ""} has been issued.`.trim());
        return;
      }
      setBucket({ id: result.weeklyBucketId, code: result.bucketCode ?? "" });
      setLines(
        open.map((line) =>
          lineInBaseUnit(
            line.materialId,
            line.materialCode,
            line.materialName,
            line.uom,
            line.remainingQuantity,
            `Approved ${formatQty(line.approvedQuantity)}, issued ${formatQty(line.issuedQuantity)} ${line.uom}`,
          ),
        ),
      );
      toastService.success(`${open.length} line(s) loaded from weekly bucket ${result.bucketCode ?? ""}.`.trim());
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not load the weekly bucket lines.");
    } finally {
      setLoadingBucket(false);
    }
  };

  const handleSubmit = async () => {
    if (!storeId || !outletId) {
      setFormError("Select the store and the outlet.");
      return;
    }
    const lineError = validateLines(lines);
    if (lineError) {
      setFormError(lineError);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await createGoodsIssue({
        fromLocationId: storeId,
        toLocationId: outletId,
        weeklyBucketId: bucket?.id ?? null,
        comment: comment.trim() || null,
        items: toLineWrites(lines),
      });
      toastService.success("Goods issue posted.");
      onCreated();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not post the goods issue.");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || loadingBucket;

  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: "New goods issue" }}
      footerProps={{
        primaryButton: { text: "Post goods issue", onClick: handleSubmit, loading: saving, disabled: busy },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: busy },
      }}
    >
      <div className="sila-root sila-me smov-dialog">
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-gi-store">Store<span className="sila-required">*</span></label>
            <select
              id="smov-gi-store"
              className="sila-select"
              value={storeId}
              disabled={busy}
              onChange={(event) => handleStore(event.target.value)}
            >
              <option value="">Select the store</option>
              {stores.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode}){location.propertyName ? ` — ${location.propertyName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-gi-outlet">Outlet<span className="sila-required">*</span></label>
            <select
              id="smov-gi-outlet"
              className="sila-select"
              value={outletId}
              disabled={busy || !store}
              onChange={(event) => handleOutlet(event.target.value)}
            >
              <option value="">{store ? "Select the outlet" : "Select the store first"}</option>
              {outletOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.locationName} ({location.locationCode})</option>
              ))}
            </select>
          </div>
          <div className="sila-field smov-field-action">
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              disabled={busy || !outletId}
              onClick={loadFromBucket}
            >
              {loadingBucket ? "Loading..." : "Load from weekly bucket"}
            </button>
          </div>
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="smov-gi-comment">Comment</label>
            <input
              id="smov-gi-comment"
              className="sila-input"
              value={comment}
              maxLength={500}
              disabled={busy}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        </div>

        {bucket && (
          <div className="smov-bucket">
            <span className="sila-badge sila-badge--info">Weekly bucket {bucket.code}</span>
            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" disabled={busy} onClick={() => setBucket(null)}>
              Unlink bucket
            </button>
          </div>
        )}

        <MovementLinesEditor idPrefix="smov-gi" lines={lines} onChange={setLines} disabled={busy} />

        {formError && <p className="sila-error-text" role="alert">{formError}</p>}
      </div>
    </Modal>
  );
};

export default SilaGoodsIssueForm;
