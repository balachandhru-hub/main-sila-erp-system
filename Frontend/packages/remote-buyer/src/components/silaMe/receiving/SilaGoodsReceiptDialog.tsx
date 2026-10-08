import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal } from "@vosox/shared-ui";
import { getGoodsReceipt, type SilaGoodsReceiptDetail } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import { formatQtyUom, receivingBadgeClass, receivingLabel } from "./receivingFormat";

interface SilaGoodsReceiptDialogProps {
  goodsReceiptId: string;
  onClose: () => void;
}

/** A goods receipt with its lines and the status of its ERP posting. */
const SilaGoodsReceiptDialog: React.FC<SilaGoodsReceiptDialogProps> = ({ goodsReceiptId, onClose }) => {
  const [receipt, setReceipt] = useState<SilaGoodsReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getGoodsReceipt(goodsReceiptId)
      .then((data) => {
        if (active) setReceipt(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the goods receipt.");
      });
    return () => {
      active = false;
    };
  }, [goodsReceiptId]);

  const posting = receipt?.erpPosting;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: receipt ? `Goods receipt ${receipt.grnNumber}` : "Goods receipt" }}
      footerProps={{ secondaryButton: { text: "Close", onClick: onClose } }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {error ? (
          <EmptyState variant="error" title="Couldn't load the goods receipt" description={error} />
        ) : !receipt ? (
          <Loader size={24} message="Loading goods receipt..." />
        ) : (
          <>
            <h3 className="sila-section-title">Receipt details</h3>
            <dl className="srcv-facts">
              <div><dt>Purchase order</dt><dd>{receipt.poNumber}</dd></div>
              <div><dt>Supplier</dt><dd>{receipt.supplierName || "—"}</dd></div>
              <div><dt>Invoice</dt><dd>{receipt.invoiceNumber || "Not linked"}</dd></div>
              <div><dt>Store</dt><dd>{receipt.locationName || "—"}</dd></div>
              <div><dt>Received at</dt><dd>{formatDateTime(receipt.receivedOn)}</dd></div>
              <div><dt>Delivery note</dt><dd>{receipt.deliveryNote || "—"}</dd></div>
              <div><dt>Status</dt><dd><span className={receivingBadgeClass(receipt.status)}>{receivingLabel(receipt.status)}</span></dd></div>
            </dl>
            <h3 className="sila-section-title">Received lines</h3>
            <p className="srcv-sub">Receipt quantities are never inferred from invoice quantities.</p>
            {receipt.items.length === 0 ? (
              <EmptyState title="No receipt lines" description="This receipt has no recorded quantities." />
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Ordered</th>
                      <th scope="col">Open before</th>
                      <th scope="col">Invoice quantity</th>
                      <th scope="col">Physical received</th>
                      <th scope="col">Accepted</th>
                      <th scope="col">Damaged</th>
                      <th scope="col">Rejected</th>
                      <th scope="col">Batch / expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="sila-cell-strong">{item.materialName}</span>
                          <span className="srcv-sub">{item.materialCode || "No material code"}</span>
                          {!item.stocked && <span className="sila-me-flag">Not stocked</span>}
                        </td>
                        <td>{formatQtyUom(item.orderedQty, item.uom)}</td>
                        <td>{item.openQtyBefore != null ? formatQtyUom(item.openQtyBefore, item.uom) : "—"}</td>
                        <td>{item.invoiceQty != null ? formatQtyUom(item.invoiceQty, item.uom) : "—"}</td>
                        <td className="sila-cell-strong">{formatQtyUom(item.receivedQty, item.uom)}</td>
                        <td>{formatQtyUom(item.acceptedQty, item.uom)}</td>
                        <td>{formatQtyUom(item.damagedQty, item.uom)}</td>
                        <td>{formatQtyUom(item.rejectedQty, item.uom)}</td>
                        <td>
                          {item.batchNumber || "—"}
                          {item.expiryDate && <span className="srcv-sub">Expires {item.expiryDate.slice(0, 10)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="sila-section-title">ERP response</h3>
            {posting ? (
              <dl className="srcv-facts">
                <div><dt>Status</dt><dd><span className={receivingBadgeClass(posting.status)}>{receivingLabel(posting.status)}</span></dd></div>
                <div><dt>Material document</dt><dd>{posting.erpReference || "—"}</dd></div>
                <div><dt>Movement</dt><dd>{receivingLabel(posting.movementType)}</dd></div>
                <div><dt>Company code</dt><dd>{posting.companyCode || "—"}</dd></div>
                <div><dt>Attempts</dt><dd>{posting.attempts}</dd></div>
                <div><dt>Posted at</dt><dd>{posting.postedOn ? formatDateTime(posting.postedOn) : "—"}</dd></div>
              </dl>
            ) : (
              <p className="srcv-sub">Not posted (nothing accepted).</p>
            )}
            {posting?.errorMessage && (
              <div className={posting.status === "FAILED" ? "sila-alert sila-alert--danger" : "sila-alert sila-alert--warning"} role="status">
                {posting.errorMessage}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaGoodsReceiptDialog;
