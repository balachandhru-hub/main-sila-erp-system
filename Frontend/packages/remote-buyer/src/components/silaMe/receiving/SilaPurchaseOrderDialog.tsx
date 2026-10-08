import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal } from "@vosox/shared-ui";
import { getPurchaseOrder, type SilaPurchaseOrderDetail } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import { formatAmount, formatQtyUom, receivingBadgeClass, receivingLabel } from "./receivingFormat";

interface SilaPurchaseOrderDialogProps {
  purchaseOrderId: string;
  onClose: () => void;
  /** Shown when the user may receive goods against the order. */
  onReceive?: (purchaseOrderId: string) => void;
}

/** A purchase order with the ordered, received and open quantity of each line. */
const SilaPurchaseOrderDialog: React.FC<SilaPurchaseOrderDialogProps> = ({ purchaseOrderId, onClose, onReceive }) => {
  const [order, setOrder] = useState<SilaPurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPurchaseOrder(purchaseOrderId)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the purchase order.");
      });
    return () => {
      active = false;
    };
  }, [purchaseOrderId]);

  const canReceive = Boolean(onReceive && order && order.lines.some((line) => line.openQty > 0));

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: order ? `Purchase order ${order.poNumber}` : "Purchase order" }}
      footerProps={{
        primaryButton: canReceive && onReceive ? { text: "Receive goods", onClick: () => onReceive(purchaseOrderId) } : undefined,
        secondaryButton: { text: "Close", onClick: onClose },
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {error ? (
          <EmptyState variant="error" title="Couldn't load the purchase order" description={error} />
        ) : !order ? (
          <Loader size={24} message="Loading purchase order..." />
        ) : (
          <>
            <dl className="srcv-facts">
              <div><dt>Supplier</dt><dd>{order.supplierName || "—"}</dd></div>
              <div><dt>Entity / company code</dt><dd>{order.entityCode || order.companyCode || "—"}</dd></div>
              <div><dt>Plant</dt><dd>{order.plantCode || "—"}</dd></div>
              <div><dt>Order date</dt><dd>{formatDate(order.orderDate)}</dd></div>
              <div><dt>Expected delivery</dt><dd>{order.deliveryDate ? formatDate(order.deliveryDate) : "—"}</dd></div>
              <div><dt>Total</dt><dd>{formatAmount(order.totalAmount, order.currency)}</dd></div>
              <div><dt>Ordered quantity</dt><dd>{order.totalOrderedQuantity != null ? order.totalOrderedQuantity.toLocaleString() : "—"}</dd></div>
              <div><dt>Source</dt><dd>{order.sourceSystem || "—"}</dd></div>
              <div><dt>Status</dt><dd><span className={receivingBadgeClass(order.status)}>{receivingLabel(order.status)}</span></dd></div>
            </dl>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    <th scope="col">Item</th>
                    <th scope="col">Ordered</th>
                    <th scope="col">Received</th>
                    <th scope="col">Open</th>
                    <th scope="col">Unit price</th>
                    <th scope="col">GR expected</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.itemNumber || line.lineNumber}</td>
                      <td>
                        <span className="sila-cell-strong">{line.productName}</span>
                        <span className="srcv-sub">{line.materialCode || "No material code"}</span>
                        {!line.materialId && <span className="sila-me-flag">Not stocked</span>}
                      </td>
                      <td>{formatQtyUom(line.orderedQty, line.uom)}</td>
                      <td>{formatQtyUom(line.receivedQty, line.uom)}</td>
                      <td className="sila-cell-strong">{formatQtyUom(line.openQty, line.uom)}</td>
                      <td>{formatAmount(line.unitPrice, order.currency)}</td>
                      <td>{line.goodsReceiptExpected === false ? "No" : "Yes"}</td>
                      <td>{line.status ? <span className={receivingBadgeClass(line.status)}>{receivingLabel(line.status)}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaPurchaseOrderDialog;
