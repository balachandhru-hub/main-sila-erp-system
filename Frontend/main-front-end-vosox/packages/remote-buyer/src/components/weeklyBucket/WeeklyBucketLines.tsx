import React from "react";
import { EmptyState } from "@vosox/shared-ui";
import type { WeeklyBucketItem } from "../../api/weeklyBucketApi";
import QuantityInput from "../cart/QuantityInput";
import { formatDateTime, formatDiscount, formatNumber, formatPrice, sameId } from "../cart/lineFormat";
import { statusBadgeClass, statusLabel } from "./weeklyBucketStatus";

interface WeeklyBucketLinesProps {
  items: WeeklyBucketItem[];
  currentUserId: string | null;
  /** The bucket is OPEN and this view allows changes. */
  editable: boolean;
  /** The user reviews the bucket: final quantity, remove any line. */
  canReview: boolean;
  /** The user maps products to Item Master materials. */
  canMapMaterial: boolean;
  busy: boolean;
  onRequestedQuantity: (item: WeeklyBucketItem, quantity: number) => void;
  onFinalQuantity: (item: WeeklyBucketItem, quantity: number) => void;
  onRemove: (item: WeeklyBucketItem) => void;
  onMapMaterial: (item: WeeklyBucketItem) => void;
}

/** The lines of a weekly bucket. A requester changes his own lines; the reviewer sets final quantities and materials. */
const WeeklyBucketLines: React.FC<WeeklyBucketLinesProps> = ({
  items,
  currentUserId,
  editable,
  canReview,
  canMapMaterial,
  busy,
  onRequestedQuantity,
  onFinalQuantity,
  onRemove,
  onMapMaterial,
}) => {
  if (items.length === 0) {
    return <EmptyState title="No lines yet" description='Add products from the cart with "Add to Weekly Bucket".' />;
  }

  return (
    <div className="sila-table-wrap">
      <table className="sila-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">SKU</th>
            <th scope="col">Material</th>
            <th scope="col">Name</th>
            <th scope="col">Description</th>
            <th scope="col">Requested qty</th>
            <th scope="col">Final qty</th>
            <th scope="col">Unit</th>
            <th scope="col">Price</th>
            <th scope="col">Discount</th>
            <th scope="col">Stock in hand</th>
            <th scope="col">Supplier stock</th>
            <th scope="col">Availability</th>
            <th scope="col">Requester</th>
            <th scope="col">Outlet / storage location</th>
            {editable && <th scope="col"><span className="sila-visually-hidden">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const isMine = sameId(item.requestorUserId, currentUserId);
            const finalQuantity = item.approvedQuantity ?? item.requestedQuantity;
            return (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.sku || "—"}</td>
                <td>
                  {item.materialCode ? (
                    editable && canMapMaterial ? (
                      <div className="sila-btn-group">
                        <span>{item.materialCode}</span>
                        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" disabled={busy} onClick={() => onMapMaterial(item)}>
                          Change
                        </button>
                      </div>
                    ) : (
                      item.materialCode
                    )
                  ) : editable && canMapMaterial ? (
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={() => onMapMaterial(item)}>
                      Map material
                    </button>
                  ) : (
                    <span className="sila-badge sila-badge--warning">Not mapped</span>
                  )}
                </td>
                <td>
                  <span className="sila-cell-strong">{item.productName}</span>
                  {item.originalProductName && item.originalProductName !== item.productName && (
                    <span className="wb-sub">Originally: {item.originalProductName}</span>
                  )}
                </td>
                <td>{item.description || "—"}</td>
                <td>
                  {editable && isMine ? (
                    <QuantityInput
                      value={item.requestedQuantity}
                      label={`Requested quantity of ${item.productName}`}
                      disabled={busy}
                      onCommit={(quantity) => onRequestedQuantity(item, quantity)}
                    />
                  ) : (
                    item.requestedQuantity
                  )}
                </td>
                <td>
                  {editable && canReview ? (
                    <QuantityInput
                      value={finalQuantity}
                      label={`Final quantity of ${item.productName}`}
                      disabled={busy}
                      onCommit={(quantity) => onFinalQuantity(item, quantity)}
                    />
                  ) : (
                    finalQuantity
                  )}
                </td>
                <td>{item.unitOfMeasure || "—"}</td>
                <td>{formatPrice(item.price, item.currency)}</td>
                <td>{formatDiscount(item.discountPercent)}</td>
                <td>{formatNumber(item.stockInHand)}</td>
                <td>
                  {formatNumber(item.supplierStock)}
                  <span className="wb-sub">
                    {item.supplierStockRefreshedOn ? `Refreshed ${formatDateTime(item.supplierStockRefreshedOn)}` : "Not refreshed"}
                  </span>
                </td>
                <td>
                  <span className={statusBadgeClass(item.availabilityStatus)}>{statusLabel(item.availabilityStatus)}</span>
                  {item.lineStatus && item.lineStatus !== "REQUESTED" && (
                    <span className="wb-sub">{statusLabel(item.lineStatus)}</span>
                  )}
                </td>
                <td>{item.requestorName || "—"}</td>
                <td>
                  {item.outletName || "—"}
                  {item.storageLocation && <span className="wb-sub">{item.storageLocation}</span>}
                </td>
                {editable && (
                  <td>
                    {(isMine || canReview) && (
                      <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" disabled={busy} onClick={() => onRemove(item)}>
                        Remove
                      </button>
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
};

export default WeeklyBucketLines;
