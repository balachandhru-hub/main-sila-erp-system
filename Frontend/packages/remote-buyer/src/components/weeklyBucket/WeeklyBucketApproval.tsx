import React, { useState } from "react";
import type { WeeklyBucketDecision, WeeklyBucketDetail } from "../../api/weeklyBucketApi";
import { formatDateTime } from "../cart/lineFormat";
import { isMyApprovalTurn, sortedSteps, statusBadgeClass, statusLabel, waitingStep } from "./weeklyBucketStatus";

interface WeeklyBucketApprovalProps {
  bucket: WeeklyBucketDetail;
  currentUserId: string | null;
  /** Shows the comment and Approve/Reject to the approver whose turn it is. On in the approvals inbox only. */
  allowDecide: boolean;
  /** Shows "Retry purchase orders" when the purchase orders failed. */
  canRetry: boolean;
  busy: boolean;
  onDecide: (status: WeeklyBucketDecision, comment: string) => void;
  onQuickPO?: () => void;
}

/** Frozen bucket: its approval steps and the purchase orders created by the last approval. */
const WeeklyBucketApproval: React.FC<WeeklyBucketApprovalProps> = ({
  bucket,
  currentUserId,
  allowDecide,
  canRetry,
  busy,
  onDecide,
  onQuickPO,
}) => {
  const [comment, setComment] = useState("");
  const steps = sortedSteps(bucket.approvalSteps);
  const waiting = waitingStep(bucket.status, bucket.approvalSteps);
  const isMyTurn = isMyApprovalTurn(bucket, currentUserId);

  return (
    <>
      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Approval{bucket.approvalName ? ` — ${bucket.approvalName}` : ""}</h2>
          {waiting && (
            <span className="sila-badge sila-badge--warning">
              Pending with {waiting.name || waiting.email || "the next approver"}
            </span>
          )}
        </div>
        {steps.length === 0 ? (
          <div className="sila-card-body">
            <span className="sila-help">No approval steps.</span>
          </div>
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Approver</th>
                  <th scope="col">Status</th>
                  <th scope="col">Comment</th>
                  <th scope="col">Acted on</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => (
                  <tr key={`${step.order}-${step.userId}`}>
                    <td>{step.order}</td>
                    <td>
                      <span className="sila-cell-strong">{step.name || step.email || "Unknown user"}</span>
                      {step.name && step.email && <span className="wb-sub">{step.email}</span>}
                    </td>
                    <td>
                      <span className={statusBadgeClass(step.status)}>
                        {step === waiting ? "Waiting for approval" : statusLabel(step.status)}
                      </span>
                    </td>
                    <td>{step.comment || "—"}</td>
                    <td>{formatDateTime(step.actedOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isMyTurn && !allowDecide && (
          <div className="sila-card-body">
            <span className="sila-help">Waiting for you: More → Approval → Weekly Bucket.</span>
          </div>
        )}
        {isMyTurn && allowDecide && (
          <>
            <div className="sila-card-body">
              <div className="sila-field">
                <label className="sila-label" htmlFor="wb-decision-comment">Comment</label>
                <textarea
                  id="wb-decision-comment"
                  className="sila-textarea"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </div>
            </div>
            <div className="sila-card-footer">
              <button type="button" className="sila-btn sila-btn--danger" disabled={busy} onClick={() => onDecide("REJECT", comment)}>
                Reject
              </button>
              <button type="button" className="sila-btn sila-btn--primary" disabled={busy} onClick={() => onDecide("APPROVE", comment)}>
                Approve
              </button>
            </div>
          </>
        )}
      </section>

      {(bucket.purchaseOrders.length > 0 || bucket.status === "PO_FAILED" || bucket.status === "APPROVED") && (
        <section className="sila-card">
          <div className="sila-card-header">
            <h2 className="sila-card-title">Purchase orders</h2>
            <div className="sila-btn-group">
              {onQuickPO && canRetry && bucket.status === "APPROVED" && (
                <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy} onClick={onQuickPO}>
                  Quick PO
                </button>
              )}
            </div>
          </div>
          {bucket.purchaseOrders.length === 0 ? (
            <div className="sila-card-body">
              <span className="sila-help">No purchase orders were created.</span>
            </div>
          ) : (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Supplier</th>
                    <th scope="col">Status</th>
                    <th scope="col">Document number</th>
                    <th scope="col">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.purchaseOrders.map((order) => (
                    <tr key={order.supplierId}>
                      <td className="sila-cell-strong">{order.supplierName || "—"}</td>
                      <td><span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span></td>
                      <td>{order.documentNumber || "—"}</td>
                      <td>{order.errorMessage ? <span className="sila-error-text">{order.errorMessage}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
};

export default WeeklyBucketApproval;
