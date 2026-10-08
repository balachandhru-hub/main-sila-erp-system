import React from "react";
import { Button, Table } from "@vosox/shared-ui";
import type { TableColumn } from "@vosox/shared-ui";
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
  const columns: TableColumn<WeeklyBucketItem>[] = [
    { id: "item", header: "Item", cell: ({ rowIndex }) => rowIndex + 1 },
    { id: "sku", header: "SKU", cell: ({ row }) => row.sku || "—" },
    {
      id: "material",
      header: "Material",
      cell: ({ row }) =>
        row.materialCode ? (
          editable && canMapMaterial ? (
            <div className="sila-btn-group">
              <span>{row.materialCode}</span>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onMapMaterial(row)}>
                Change
              </Button>
            </div>
          ) : (
            row.materialCode
          )
        ) : editable && canMapMaterial ? (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onMapMaterial(row)}>
            Map material
          </Button>
        ) : (
          <span className="sila-badge sila-badge--warning">Not mapped</span>
        ),
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <>
          <span className="sila-cell-strong">{row.productName}</span>
          {row.originalProductName && row.originalProductName !== row.productName && (
            <span className="wb-sub">Originally: {row.originalProductName}</span>
          )}
        </>
      ),
    },
    { id: "description", header: "Description", className: "wb-description-col", headerClassName: "wb-description-col", cell: ({ row }) => row.description || "—" },
    {
      id: "requestedQuantity",
      header: "Requested qty",
      cell: ({ row }) =>
        editable && sameId(row.requestorUserId, currentUserId) ? (
          <QuantityInput
            value={row.requestedQuantity}
            label={`Requested quantity of ${row.productName}`}
            disabled={busy}
            onCommit={(quantity) => onRequestedQuantity(row, quantity)}
          />
        ) : (
          row.requestedQuantity
        ),
    },
    {
      id: "finalQuantity",
      header: "Final qty",
      cell: ({ row }) => {
        const finalQuantity = row.approvedQuantity ?? row.requestedQuantity;
        return editable && canReview ? (
          <QuantityInput
            value={finalQuantity}
            label={`Final quantity of ${row.productName}`}
            disabled={busy}
            onCommit={(quantity) => onFinalQuantity(row, quantity)}
          />
        ) : (
          finalQuantity
        );
      },
    },
    { id: "unit", header: "Unit", cell: ({ row }) => row.unitOfMeasure || "—" },
    { id: "price", header: "Price", cell: ({ row }) => formatPrice(row.price, row.currency) },
    { id: "discount", header: "Discount", cell: ({ row }) => formatDiscount(row.discountPercent) },
    { id: "stockInHand", header: "Stock in hand", cell: ({ row }) => formatNumber(row.stockInHand) },
    {
      id: "supplierStock",
      header: "Supplier stock",
      cell: ({ row }) => (
        <>
          {formatNumber(row.supplierStock)}
          <span className="wb-sub">
            {row.supplierStockRefreshedOn ? `Refreshed ${formatDateTime(row.supplierStockRefreshedOn)}` : "Not refreshed"}
          </span>
        </>
      ),
    },
    {
      id: "availability",
      header: "Availability",
      cell: ({ row }) => (
        <>
          <span className={statusBadgeClass(row.availabilityStatus)}>{statusLabel(row.availabilityStatus)}</span>
          {row.lineStatus && row.lineStatus !== "REQUESTED" && (
            <span className="wb-sub">{statusLabel(row.lineStatus)}</span>
          )}
        </>
      ),
    },
    { id: "requester", header: "Requester", cell: ({ row }) => row.requestorName || "—" },
    {
      id: "outlet",
      header: "Outlet / storage location",
      cell: ({ row }) => (
        <>
          {row.outletName || "—"}
          {row.storageLocation && <span className="wb-sub">{row.storageLocation}</span>}
        </>
      ),
    },
  ];

  if (editable) {
    columns.push({
      id: "actions",
      header: <span className="sila-visually-hidden">Actions</span>,
      cell: ({ row }) =>
        sameId(row.requestorUserId, currentUserId) || canReview ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onRemove(row)}>
            Remove
          </Button>
        ) : null,
    });
  }

  return (
    <Table<WeeklyBucketItem>
      columns={columns}
      data={items}
      getRowId={(item) => item.id}
      emptyState={{ title: "No lines yet", description: 'Add products from the cart with "Add to Weekly Bucket".' }}
    />
  );
};

export default WeeklyBucketLines;
