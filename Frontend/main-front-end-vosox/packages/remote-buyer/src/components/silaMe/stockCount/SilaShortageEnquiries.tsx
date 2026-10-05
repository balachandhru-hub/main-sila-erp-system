import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import {
  SILA_JUSTIFICATION_CATEGORIES,
  getEnquiries,
  getEnquiry,
  respondEnquiry,
  reviewEnquiry,
  type SilaEnquiry,
} from "../../../api/silaMe/silaStockCountApi";
import { formatDateTime } from "../../cart/lineFormat";
import { formatMoney, formatQty, scBadgeClass, scLabel } from "./stockCountFormat";
import "../silaMeTheme.css";
import "./StockCount.css";

export interface SilaShortageEnquiriesProps {
  /** The user may accept or reject responses (APPROVE_SILA_STOCK_COUNT). */
  canReview: boolean;
}

const STATUSES = ["SENT", "RESPONDED", "MORE_INFORMATION_REQUIRED", "ACCEPTED", "REJECTED"];

const categoryLabel = (value?: string | null): string =>
  SILA_JUSTIFICATION_CATEGORIES.find((category) => category.value === value)?.label ?? value ?? "—";

/** Shortage enquiries raised by submitted stock counts: the location responds, the reviewer accepts or rejects. */
const SilaShortageEnquiries: React.FC<SilaShortageEnquiriesProps> = ({ canReview }) => {
  const [rows, setRows] = useState<SilaEnquiry[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<SilaEnquiry | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [responseText, setResponseText] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getEnquiries(status || undefined));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the shortage enquiries.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (enquiryId: string) => {
    setOpeningId(enquiryId);
    try {
      const enquiry = await getEnquiry(enquiryId);
      setOpened(enquiry);
      setCategory(enquiry.justificationCategory ?? "");
      setResponseText(enquiry.response ?? "");
      setComment("");
      setFormError(null);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not load the shortage enquiry.");
    } finally {
      setOpeningId(null);
    }
  };

  const close = () => setOpened(null);

  const respond = async () => {
    if (!opened) return;
    if (!category) {
      setFormError("Choose a justification category.");
      return;
    }
    if (!responseText.trim()) {
      setFormError("Explain the shortage.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await respondEnquiry(opened.id, category, responseText.trim());
      toastService.success("Response sent for review.");
      close();
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not send the response.");
    } finally {
      setBusy(false);
    }
  };

  const review = async (accept: boolean) => {
    if (!opened) return;
    if (!accept && !comment.trim()) {
      setFormError("Say why the justification is rejected.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await reviewEnquiry(opened.id, accept, comment);
      toastService.success(accept ? "Justification accepted." : "Justification rejected.");
      close();
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not save the review.");
    } finally {
      setBusy(false);
    }
  };

  const canRespond = opened !== null && (opened.status === "SENT" || opened.status === "RESPONDED" || opened.status === "MORE_INFORMATION_REQUIRED");
  const canDecide = opened !== null && canReview && opened.status === "RESPONDED";

  return (
    <div className="sila-root sila-me sc-stack">
      <PageHeader
        className="pud-page-header"
        title="Shortage & Enquiries"
        description="Shortages from physical counts. The location justifies each shortage, then the reviewer accepts or rejects it."
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Enquiries</h2>
          <div className="sila-field sc-filter">
            <label className="sila-label" htmlFor="se-status-filter">Status</label>
            <select id="se-status-filter" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{scLabel(value)}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <Loader size={24} message="Loading shortage enquiries..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load shortage enquiries"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No shortage enquiries" />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Enquiry</th>
                  <th scope="col">Material</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="sila-num">Shortage</th>
                  <th scope="col" className="sila-num">Value</th>
                  <th scope="col">Justification</th>
                  <th scope="col">Status</th>
                  <th scope="col">Raised</th>
                  <th scope="col" className="sila-cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.enquiryNumber}</span>
                      <span className="sc-sub">{row.countNumber}</span>
                    </td>
                    <td>
                      {row.materialName}
                      <span className="sc-sub">{row.materialCode}</span>
                    </td>
                    <td>{row.locationName || "—"}</td>
                    <td className="sila-num">{formatQty(row.shortageQty)} {row.uom}</td>
                    <td className="sila-num">{formatMoney(row.shortageValue)}</td>
                    <td>{categoryLabel(row.justificationCategory)}</td>
                    <td><span className={scBadgeClass(row.status)}>{scLabel(row.status)}</span></td>
                    <td>{formatDateTime(row.dateCreated)}</td>
                    <td className="sila-cell-actions">
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Open ${row.enquiryNumber}`}
                        disabled={openingId !== null}
                        onClick={() => open(row.id)}
                      >
                        {openingId === row.id ? "Opening..." : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {opened && (
        <Modal
          isOpen
          onClose={close}
          size="lg"
          headerProps={{ heading: `Enquiry ${opened.enquiryNumber}` }}
          footerProps={
            canDecide
              ? {
                secondaryButton: { text: "Reject", onClick: () => review(false), disabled: busy },
                primaryButton: { text: "Accept", onClick: () => review(true), loading: busy },
              }
              : canRespond
                ? {
                  secondaryButton: { text: "Close", onClick: close, disabled: busy },
                  primaryButton: { text: opened.status === "RESPONDED" ? "Update response" : "Send response", onClick: respond, loading: busy },
                }
                : { primaryButton: { text: "Close", onClick: close } }
          }
        >
          <div className="sila-root sila-me sc-stack">
            <dl className="sila-meta-grid">
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Material</dt>
                <dd className="sila-meta-value">{opened.materialName} ({opened.materialCode})</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Location</dt>
                <dd className="sila-meta-value">{opened.locationName || "—"}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Stock count</dt>
                <dd className="sila-meta-value">{opened.countNumber || "—"}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Shortage</dt>
                <dd className="sila-meta-value">{formatQty(opened.shortageQty)} {opened.uom} ({formatMoney(opened.shortageValue)})</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Status</dt>
                <dd className="sila-meta-value"><span className={scBadgeClass(opened.status)}>{scLabel(opened.status)}</span></dd>
              </div>
              {opened.reviewComment && (
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Review comment</dt>
                  <dd className="sila-meta-value">{opened.reviewComment}</dd>
                </div>
              )}
            </dl>

            {canRespond && !canDecide ? (
              <>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="se-category">Justification category<span className="sila-required">*</span></label>
                  <select id="se-category" className="sila-select" value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">Select a category</option>
                    {SILA_JUSTIFICATION_CATEGORIES.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="se-response">Response<span className="sila-required">*</span></label>
                  <textarea
                    id="se-response"
                    className="sila-textarea"
                    rows={4}
                    value={responseText}
                    onChange={(event) => setResponseText(event.target.value)}
                  />
                </div>
              </>
            ) : (
              opened.response && (
                <dl className="sila-meta-grid">
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Justification</dt>
                    <dd className="sila-meta-value">{categoryLabel(opened.justificationCategory)}</dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Response</dt>
                    <dd className="sila-meta-value">{opened.response}</dd>
                  </div>
                </dl>
              )
            )}

            {canDecide && (
              <div className="sila-field">
                <label className="sila-label" htmlFor="se-comment">Review comment (required to reject)</label>
                <textarea id="se-comment" className="sila-textarea" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} />
              </div>
            )}

            {opened.events.length > 0 && (
              <div className="sila-field">
                <span className="sila-label">History</span>
                <ul className="sc-timeline">
                  {opened.events.map((event, index) => (
                    <li key={`${event.action}-${index}`}>
                      <span className={scBadgeClass(event.action)}>{scLabel(event.action)}</span> {event.comment}
                      <span className="sc-sub">{formatDateTime(event.dateCreated)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SilaShortageEnquiries;
