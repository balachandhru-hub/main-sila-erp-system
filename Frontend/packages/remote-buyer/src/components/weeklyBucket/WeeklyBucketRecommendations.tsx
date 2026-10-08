import React from "react";
import type { WeeklyBucketDecision, WeeklyBucketItem, WeeklyBucketRecommendation } from "../../api/weeklyBucketApi";
import { formatDateTime, formatNumber, formatPrice, sameId } from "../cart/lineFormat";
import { statusBadgeClass, statusLabel } from "./weeklyBucketStatus";

interface WeeklyBucketRecommendationsProps {
  recommendations: WeeklyBucketRecommendation[];
  items: WeeklyBucketItem[];
  currentUserId: string | null;
  /** Outlets the signed-in user belongs to: their users may decide for the outlet's lines. */
  myOutletIds: string[];
  /** The bucket is OPEN and this view allows changes. */
  editable: boolean;
  busy: boolean;
  onDecide: (recommendation: WeeklyBucketRecommendation, status: WeeklyBucketDecision) => void;
}

/** Alternatives proposed for lines the supplier cannot fully deliver. The server decides who may approve one. */
const WeeklyBucketRecommendations: React.FC<WeeklyBucketRecommendationsProps> = ({
  recommendations,
  items,
  currentUserId,
  myOutletIds,
  editable,
  busy,
  onDecide,
}) => (
  <div className="sila-table-wrap">
    <table className="sila-table">
      <thead>
        <tr>
          <th scope="col">No.</th>
          <th scope="col">For line</th>
          <th scope="col">Recommended product</th>
          <th scope="col">Supplier</th>
          <th scope="col">Price</th>
          <th scope="col">Stock</th>
          <th scope="col">Quantity</th>
          <th scope="col">Status</th>
          {editable && <th scope="col">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {recommendations.map((recommendation) => {
          const lineIndex = items.findIndex((item) => item.id === recommendation.weeklyBucketItemId);
          const line = lineIndex >= 0 ? items[lineIndex] : undefined;
          const mayDecide = Boolean(
            line &&
              (sameId(line.requestorUserId, currentUserId) ||
                myOutletIds.some((outletId) => sameId(outletId, line.outletId))),
          );
          return (
            <tr key={recommendation.id}>
              <td className="sila-cell-strong">{recommendation.recommendationNumber}</td>
              <td>
                {line ? `${lineIndex + 1}. ${line.originalProductName || line.productName}` : "—"}
                {line?.requestorName && <span className="wb-sub">{line.requestorName}</span>}
              </td>
              <td>
                {recommendation.productName}
                {recommendation.sku && <span className="wb-sub">SKU: {recommendation.sku}</span>}
              </td>
              <td>{recommendation.supplierName || "—"}</td>
              <td>{formatPrice(recommendation.price, recommendation.currency)}</td>
              <td>{formatNumber(recommendation.availableStock)}</td>
              <td>{recommendation.quantity}</td>
              <td>
                <span className={statusBadgeClass(recommendation.status)}>{statusLabel(recommendation.status)}</span>
                {recommendation.decidedOn && (
                  <span className="wb-sub">
                    {recommendation.decidedByName ? `${recommendation.decidedByName}, ` : ""}{formatDateTime(recommendation.decidedOn)}
                  </span>
                )}
              </td>
              {editable && (
                <td>
                  {recommendation.status === "PENDING" && mayDecide && (
                    <div className="sila-btn-group">
                      <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy} onClick={() => onDecide(recommendation, "APPROVE")}>
                        Approve
                      </button>
                      <button type="button" className="sila-btn sila-btn--danger sila-btn--sm" disabled={busy} onClick={() => onDecide(recommendation, "REJECT")}>
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default WeeklyBucketRecommendations;
