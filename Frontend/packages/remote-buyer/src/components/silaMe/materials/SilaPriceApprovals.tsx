import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import { decidePriceChange, getPriceApprovals, type SilaPriceChange } from "../../../api/silaMe/silaMaterialsApi";
import { formatDate, formatDateTime, formatPrice } from "./materialFormat";
import "../silaMeTheme.css";
import "./SilaMaterials.css";

const PAGE_SIZE = 50;

interface Decision {
  change: SilaPriceChange;
  approve: boolean;
}

/** Material price changes waiting for the signed-in user's decision (APPROVE_SILA_PRICE). */
const SilaPriceApprovals: React.FC = () => {
  const [rows, setRows] = useState<SilaPriceChange[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPriceApprovals(page * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the price approvals.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (change: SilaPriceChange, approve: boolean) => {
    setComment("");
    setDecision({ change, approve });
  };

  const close = () => {
    if (!saving) setDecision(null);
  };

  const handleDecide = async () => {
    if (!decision) return;
    if (!decision.approve && !comment.trim()) {
      toastService.error("Enter why you reject the price change.");
      return;
    }
    setSaving(true);
    try {
      await decidePriceChange(decision.change.id, decision.approve, comment);
      toastService.success(`${decision.change.requestNumber} ${decision.approve ? "approved" : "rejected"}.`);
      setDecision(null);
      load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sila-me smat-page">
      <PageHeader
        className="pud-page-header"
        title="Price Approvals"
        description="Material unit-price changes waiting for your approval."
      />
      <section className="sila-card">
        {loading ? (
          <Loader size={24} message="Loading price approvals..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the price approvals"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title={page > 0 ? "No more price changes" : "Nothing is waiting for you"} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Material</th>
                  <th scope="col" className="smat-num">Approved price</th>
                  <th scope="col" className="smat-num">New price</th>
                  <th scope="col">Effective from</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Level</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.requestNumber}</span>
                      <span className="smat-sub">{row.requestedByName || "—"} · {formatDateTime(row.requestedOn)}</span>
                    </td>
                    <td>
                      <span className="sila-cell-strong">{row.materialCode}</span>
                      <span className="smat-sub">{row.description}</span>
                      <span className="smat-sub">{row.outletName ? `Outlet: ${row.outletName}` : "Default price (all outlets)"}</span>
                    </td>
                    <td className="smat-num">{formatPrice(row.currentUnitCost, row.currency, row.baseUom)}</td>
                    <td className="smat-num">{formatPrice(row.proposedUnitCost, row.currency, row.priceUom)}</td>
                    <td>{formatDate(row.effectiveFrom)}</td>
                    <td>{row.reason}</td>
                    <td>{row.currentLevel ? `${row.currentLevel} of ${row.steps.length}` : "—"}</td>
                    <td className="sila-cell-actions">
                      <div className="smat-counts">
                        <button type="button" className="sila-btn sila-btn--primary sila-btn--sm"
                          aria-label={`Approve ${row.requestNumber}`} onClick={() => open(row, true)}>
                          Approve
                        </button>
                        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm"
                          aria-label={`Reject ${row.requestNumber}`} onClick={() => open(row, false)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && (page > 0 || rows.length === PAGE_SIZE) && (
          <div className="smat-toolbar">
            <span>Page {page + 1}</span>
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={page === 0 || loading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}>
              Previous
            </button>
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={rows.length < PAGE_SIZE || loading}
              onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        )}
      </section>

      {decision && (
        <Modal
          isOpen
          onClose={close}
          size="md"
          variant={decision.approve ? "default" : "danger"}
          headerProps={{
            heading: `${decision.approve ? "Approve" : "Reject"} ${decision.change.requestNumber}`,
            subHeading: `${decision.change.materialCode}: ${formatPrice(decision.change.proposedUnitCost, decision.change.currency, decision.change.priceUom)}`,
          }}
          footerProps={{
            secondaryButton: { text: "Cancel", variant: "secondary", onClick: close, disabled: saving },
            primaryButton: { text: decision.approve ? "Approve" : "Reject", onClick: handleDecide, loading: saving },
          }}
        >
          <div className="sila-root sila-me smat-panel">
            <div className="sila-field">
              <label className="sila-label" htmlFor="smat-decision-comment">
                Comment{decision.approve ? "" : " *"}
              </label>
              <textarea id="smat-decision-comment" className="sila-input" rows={3} maxLength={500} value={comment}
                onChange={(event) => setComment(event.target.value)} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SilaPriceApprovals;
