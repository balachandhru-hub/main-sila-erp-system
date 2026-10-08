import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import { formatQty, silaLabel } from "../../../api/silaMe/silaInventoryApi";
import {
  SILA_PAGE_LIMIT,
  SILA_PR_STATUSES,
  addPurchaseRequestToBucket,
  cancelPurchaseRequest,
  getPurchaseRequests,
  type SilaPurchaseRequest,
} from "../../../api/silaMe/silaInventoryControlApi";
import "../silaMeTheme.css";
import "./SilaInventory.css";

interface SilaPurchaseRequestsProps {
  /** Managers: add a request to the current weekly bucket of its outlet. */
  canAddToBucket?: boolean;
}

type Confirm = { kind: "cancel" | "bucket"; request: SilaPurchaseRequest };

const statusBadge = (status: string): string =>
  status === "SUBMITTED"
    ? "sila-badge--warning"
    : status === "ADDED_TO_BUCKET"
      ? "sila-badge--success"
      : status === "CANCELLED"
        ? "sila-badge--danger"
        : "sila-badge--info";

/** Internal purchase requests of the caller's locations: filter by status, cancel, or add to the weekly bucket. */
const SilaPurchaseRequests: React.FC<SilaPurchaseRequestsProps> = ({ canAddToBucket = false }) => {
  const [status, setStatus] = useState("SUBMITTED");
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<SilaPurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [bucketQty, setBucketQty] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPurchaseRequests(status, index)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the purchase requests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, index, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const openConfirm = (next: Confirm) => {
    setBucketQty(String(next.request.quantity));
    setConfirm(next);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const quantity = Number(bucketQty);
    if (confirm.kind === "bucket" && (bucketQty.trim() === "" || Number.isNaN(quantity) || quantity <= 0)) {
      toastService.error("Enter a quantity greater than zero.");
      return;
    }
    setSaving(true);
    try {
      if (confirm.kind === "cancel") {
        await cancelPurchaseRequest(confirm.request.id);
        toastService.success(`${confirm.request.requestNumber} cancelled.`);
      } else {
        const bucketCode = await addPurchaseRequestToBucket(confirm.request.id, quantity);
        toastService.success(`${confirm.request.requestNumber} added to weekly bucket ${bucketCode}.`);
      }
      setConfirm(null);
      reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not update the purchase request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sila-me sinv-page">
      <PageHeader className="pud-page-header" title="Purchase Requests" />
      <section className="sila-card">
        <div className="sinv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-pr-status">Status</label>
            <select
              id="sinv-pr-status"
              className="sila-select"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setIndex(0);
              }}
            >
              <option value="">All statuses</option>
              {SILA_PR_STATUSES.map((value) => (
                <option key={value} value={value}>{silaLabel(value)}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <Loader size={24} message="Loading purchase requests..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the purchase requests"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={reload}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No purchase requests" description={index > 0 ? "No more requests." : undefined} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Location</th>
                  <th scope="col">Material</th>
                  <th scope="col" className="sinv-num">Quantity</th>
                  <th scope="col">Source</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.requestNumber}</span>
                      {row.reason && <span className="sinv-sub">{row.reason}</span>}
                    </td>
                    <td>{row.locationName ?? "—"}</td>
                    <td>
                      <span className="sila-cell-strong">{row.materialCode ?? "—"}</span>
                      <span className="sinv-sub">{row.materialName}</span>
                    </td>
                    <td className="sinv-num">{formatQty(row.quantity)} {row.uom}</td>
                    <td>{silaLabel(row.source)}</td>
                    <td>
                      {row.requestedByName ?? "—"}
                      <span className="sinv-sub">{new Date(row.requestedOn).toLocaleString()}</span>
                    </td>
                    <td>
                      <span className={`sila-badge ${statusBadge(row.status)}`}>{silaLabel(row.status)}</span>
                      {row.weeklyBucketCode && <span className="sinv-sub">{row.weeklyBucketCode}</span>}
                    </td>
                    <td className="sila-cell-actions">
                      {row.status === "SUBMITTED" && (
                        <div className="sinv-inline">
                          {canAddToBucket && (
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              disabled={!row.catalogMapped}
                              title={row.catalogMapped ? undefined : "Map this material to a catalog product first"}
                              aria-label={`Add ${row.requestNumber} to the weekly bucket`}
                              onClick={() => openConfirm({ kind: "bucket", request: row })}
                            >
                              Add to weekly bucket
                            </button>
                          )}
                          <button
                            type="button"
                            className="sila-btn sila-btn--ghost sila-btn--sm"
                            aria-label={`Cancel ${row.requestNumber}`}
                            onClick={() => openConfirm({ kind: "cancel", request: row })}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && (index > 0 || rows.length === SILA_PAGE_LIMIT) && (
          <div className="sinv-pager">
            <button
              type="button"
              className="sila-btn sila-btn--secondary sila-btn--sm"
              disabled={index === 0}
              onClick={() => setIndex((current) => Math.max(0, current - SILA_PAGE_LIMIT))}
            >
              Previous
            </button>
            <span>Rows {index + 1}–{index + rows.length}</span>
            <button
              type="button"
              className="sila-btn sila-btn--secondary sila-btn--sm"
              disabled={rows.length < SILA_PAGE_LIMIT}
              onClick={() => setIndex((current) => current + SILA_PAGE_LIMIT)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {confirm && (
        <Modal
          isOpen
          onClose={saving ? () => undefined : () => setConfirm(null)}
          variant={confirm.kind === "cancel" ? "warning" : undefined}
          size="sm"
          headerProps={{ heading: confirm.kind === "cancel" ? "Cancel purchase request" : "Add to weekly bucket" }}
          footerProps={{
            secondaryButton: { text: "Back", variant: "secondary", onClick: () => setConfirm(null), disabled: saving },
            primaryButton: {
              text: confirm.kind === "cancel" ? "Cancel request" : "Add to bucket",
              onClick: handleConfirm,
              loading: saving,
              disabled: saving,
              variant: confirm.kind === "cancel" ? "danger" : "primary",
            },
          }}
        >
          <div className="sila-root sila-me sinv-dialog">
            {confirm.kind === "cancel" ? (
              <p>Cancel {confirm.request.requestNumber} for {confirm.request.materialCode} at {confirm.request.locationName}?</p>
            ) : (
              <div className="sila-field">
                <label className="sila-label" htmlFor="sinv-pr-bucket-qty">Quantity of the catalog product</label>
                <input
                  id="sinv-pr-bucket-qty"
                  className="sila-input"
                  type="number"
                  min={0}
                  step="any"
                  value={bucketQty}
                  disabled={saving}
                  onChange={(event) => setBucketQty(event.target.value)}
                />
                <span className="sila-help">
                  Requested: {formatQty(confirm.request.quantity)} {confirm.request.uom}. The product is added to the current weekly bucket of the outlet.
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SilaPurchaseRequests;
