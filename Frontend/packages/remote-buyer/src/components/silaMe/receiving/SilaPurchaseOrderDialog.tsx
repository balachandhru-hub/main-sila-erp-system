import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal } from "@vosox/shared-ui";
import { getPurchaseOrder, type SilaPurchaseOrderDetail } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import { formatAmount, formatQtyUom, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import SilaDocumentTrackPanel from "./SilaDocumentTrack";

interface SilaPurchaseOrderDialogProps {
  purchaseOrderId: string;
  onClose: () => void;
  /** Shown when the user may receive goods against the order. */
  onReceive?: (purchaseOrderId: string) => void;
}

type Tab = "details" | "lines" | "track";

/** Purchase order detail: header fields, line items, and document track / history panel. */
const SilaPurchaseOrderDialog: React.FC<SilaPurchaseOrderDialogProps> = ({ purchaseOrderId, onClose, onReceive }) => {
  const [order, setOrder] = useState<SilaPurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");

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
            <div className="srcv-tabs" role="tablist" aria-label="Purchase order sections">
              {(
                [
                  { key: "details" as const, label: "Details" },
                  { key: "lines" as const, label: `Line items (${order.lines.length})` },
                  { key: "track" as const, label: "Track & history" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className="sila-btn sila-btn--secondary sila-btn--sm srcv-tab"
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "details" && (
              <div className="srcv-stack" role="tabpanel">
                <h3 className="sila-section-title">Header</h3>
                <dl className="srcv-facts">
                  <div><dt>PO number</dt><dd>{order.poNumber}</dd></div>
                  <div><dt>Status</dt><dd><span className={receivingBadgeClass(order.status)}>{receivingLabel(order.status)}</span></dd></div>
                  <div><dt>Supplier</dt><dd>{order.supplierName || "—"}</dd></div>
                  <div><dt>Supplier code</dt><dd>{order.supplierCode || "—"}</dd></div>
                  <div><dt>Entity / company code</dt><dd>{order.entityCode || order.companyCode || "—"}</dd></div>
                  <div><dt>Plant</dt><dd>{order.plantCode || "—"}</dd></div>
                  <div><dt>Currency</dt><dd>{order.currency || "—"}</dd></div>
                  <div><dt>Order date</dt><dd>{formatDate(order.orderDate)}</dd></div>
                  <div><dt>Expected delivery</dt><dd>{order.deliveryDate ? formatDate(order.deliveryDate) : "—"}</dd></div>
                  <div><dt>Total amount</dt><dd>{formatAmount(order.totalAmount, order.currency)}</dd></div>
                  <div><dt>Ordered quantity</dt><dd>{order.totalOrderedQuantity != null ? order.totalOrderedQuantity.toLocaleString() : "—"}</dd></div>
                  <div><dt>Received quantity</dt><dd>{order.totalReceivedQuantity != null ? order.totalReceivedQuantity.toLocaleString() : "—"}</dd></div>
                  <div><dt>Open quantity</dt><dd>{order.totalOpenQuantity != null ? order.totalOpenQuantity.toLocaleString() : "—"}</dd></div>
                  <div><dt>Open lines</dt><dd>{order.openLineCount != null ? `${order.openLineCount} / ${order.lineCount ?? order.lines.length}` : "—"}</dd></div>
                  <div><dt>Source system</dt><dd>{order.sourceSystem || "—"}</dd></div>
                  <div><dt>Source type</dt><dd>{order.sourceType || "—"}</dd></div>
                  <div><dt>ERP PO id</dt><dd>{order.erpPurchaseOrderId || "—"}</dd></div>
                  <div><dt>Supplier SO</dt><dd>{order.supplierErpSalesOrderNumber || "—"}</dd></div>
                  <div><dt>Bucket</dt><dd>{order.bucketCode || "—"}</dd></div>
                </dl>
              </div>
            )}

            {tab === "lines" && (
              <div className="srcv-stack" role="tabpanel">
                <h3 className="sila-section-title">Line items</h3>
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
                        <th scope="col">Discount</th>
                        <th scope="col">Line amount</th>
                        <th scope="col">Tax</th>
                        <th scope="col">Storage loc.</th>
                        <th scope="col">Cost center</th>
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
                            {line.sku ? <span className="srcv-sub">SKU {line.sku}</span> : null}
                            {line.materialGroup ? <span className="srcv-sub">{line.materialGroup}</span> : null}
                            {!line.materialId && <span className="sila-me-flag">Not stocked</span>}
                          </td>
                          <td>{formatQtyUom(line.orderedQty, line.uom)}</td>
                          <td>{formatQtyUom(line.receivedQty, line.uom)}</td>
                          <td className="sila-cell-strong">{formatQtyUom(line.openQty, line.uom)}</td>
                          <td>{formatAmount(line.unitPrice, order.currency)}</td>
                          <td>{line.discountPercent != null ? `${line.discountPercent}%` : "—"}</td>
                          <td>{formatAmount(line.lineAmount, order.currency)}</td>
                          <td>{line.taxCode || "—"}</td>
                          <td>{line.storageLocation || "—"}</td>
                          <td>{line.costCenter || "—"}</td>
                          <td>{line.goodsReceiptExpected === false ? "No" : "Yes"}</td>
                          <td>{line.status ? <span className={receivingBadgeClass(line.status)}>{receivingLabel(line.status)}</span> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "track" && (
              <div className="srcv-stack" role="tabpanel">
                <SilaDocumentTrackPanel track={order.documentTrack} historyAsPanel startCollapsed={false} />
                {!order.documentTrack && <p className="srcv-sub">No related documents yet.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaPurchaseOrderDialog;
