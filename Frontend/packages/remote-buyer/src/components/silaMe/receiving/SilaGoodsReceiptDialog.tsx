import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import { getGoodsReceipt, reprocessErpPosting, type SilaGoodsReceiptDetail } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import { formatQtyUom, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import SilaDocumentTrackPanel from "./SilaDocumentTrack";
import SilaGoodsReceiptReverseDialog from "./SilaGoodsReceiptReverseDialog";

interface SilaGoodsReceiptDialogProps {
  goodsReceiptId: string;
  canReprocess?: boolean;
  /** POST_SILA_GRN: may reverse a posted GRN. */
  canReverse?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

/** A goods receipt with its lines, step 1 stock / step 2 S4 status, and reprocess for failed ERP posts. */
const SilaGoodsReceiptDialog: React.FC<SilaGoodsReceiptDialogProps> = ({
  goodsReceiptId,
  canReprocess = false,
  canReverse = false,
  onClose,
  onChanged,
}) => {
  const [receipt, setReceipt] = useState<SilaGoodsReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reversing, setReversing] = useState(false);

  const load = () => {
    setError(null);
    getGoodsReceipt(goodsReceiptId)
      .then(setReceipt)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load the goods receipt.");
      });
  };

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
  const stockedLines = receipt?.items.filter((item) => item.stocked && item.acceptedQty > 0).length ?? 0;
  const canSendAgain = canReprocess && posting != null && (posting.status === "FAILED" || posting.status === "SKIPPED");
  const status = (receipt?.status || "").toUpperCase();
  const reversalStatus = (receipt?.reversalStatus || "").toUpperCase();
  const showReverse =
    canReverse &&
    status !== "REVERSED" &&
    (status === "POSTED"
      || status === "PARTIALLY_REVERSED"
      || reversalStatus === "FAILED"
      || reversalStatus === "FAILED_LOCAL"
      || reversalStatus === "ERP_ACCEPTED");

  const handleReprocess = async () => {
    if (!posting) return;
    setReprocessing(true);
    try {
      await reprocessErpPosting(posting.id);
      toastService.success(`${receipt?.grnNumber ?? "GRN"} sent to S4 again.`);
      load();
      onChanged?.();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reprocess the posting.");
    } finally {
      setReprocessing(false);
    }
  };

  if (reversing) {
    return (
      <SilaGoodsReceiptReverseDialog
        goodsReceiptId={goodsReceiptId}
        onClose={() => setReversing(false)}
        onChanged={() => {
          load();
          onChanged?.();
        }}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: receipt ? `Goods receipt ${receipt.grnNumber}` : "Goods receipt" }}
      footerProps={{
        secondaryButton: { text: "Close", onClick: onClose },
        primaryButton: canSendAgain
          ? { text: "Reprocess S4", onClick: handleReprocess, loading: reprocessing, disabled: reprocessing }
          : showReverse
            ? { text: "Reverse GRN", onClick: () => setReversing(true), disabled: reprocessing }
            : undefined,
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {error ? (
          <EmptyState variant="error" title="Couldn't load the goods receipt" description={error} />
        ) : !receipt ? (
          <Loader size={24} message="Loading goods receipt..." />
        ) : (
          <>
            <h3 className="sila-section-title">Posting steps</h3>
            <dl className="srcv-facts">
              <div>
                <dt>Step 1 — Internal stock</dt>
                <dd>
                  {stockedLines > 0
                    ? `Updated (${stockedLines} inventory line${stockedLines === 1 ? "" : "s"})`
                    : "No inventory materials — stock not changed"}
                </dd>
              </div>
              <div>
                <dt>Step 2 — S4 ERP</dt>
                <dd>
                  {posting ? (
                    <span className={receivingBadgeClass(posting.status)}>{receivingLabel(posting.status)}</span>
                  ) : (
                    "Not required (no inventory lines)"
                  )}
                </dd>
              </div>
            </dl>
            <h3 className="sila-section-title">Receipt details</h3>
            <dl className="srcv-facts">
              <div><dt>Purchase order</dt><dd>{receipt.poNumber}</dd></div>
              <div><dt>Supplier</dt><dd>{receipt.supplierName || "—"}</dd></div>
              <div><dt>Invoice</dt><dd>{receipt.invoiceNumber || "Not linked"}</dd></div>
              <div><dt>Store</dt><dd>{receipt.locationName || "—"}</dd></div>
              <div><dt>Received at</dt><dd>{formatDateTime(receipt.receivedOn)}</dd></div>
              <div><dt>Delivery note</dt><dd>{receipt.deliveryNote || "—"}</dd></div>
              <div><dt>Status</dt><dd><span className={receivingBadgeClass(receipt.status)}>{receivingLabel(receipt.status)}</span></dd></div>
              {(receipt.materialDocument || posting?.erpReference) && (
                <div>
                  <dt>SAP Material Document</dt>
                  <dd>
                    {receipt.materialDocument ?? posting?.erpReference}
                    {receipt.materialDocumentYear ? ` / ${receipt.materialDocumentYear}` : ""}
                  </dd>
                </div>
              )}
              {receipt.reversalGrnNumber && (
                <div>
                  <dt>Reversal GRN</dt>
                  <dd>{receipt.reversalGrnNumber}{receipt.parentGoodsReceiptId ? ` · linked` : ""}</dd>
                </div>
              )}
              {receipt.parentGoodsReceiptId && (
                <div>
                  <dt>Original GRN</dt>
                  <dd>Linked reversal document</dd>
                </div>
              )}
              {receipt.reversalMaterialDocument && (
                <div>
                  <dt>Reversal Material Document</dt>
                  <dd>
                    {receipt.reversalMaterialDocument}
                    {receipt.reversalMaterialDocumentYear ? ` / ${receipt.reversalMaterialDocumentYear}` : ""}
                  </dd>
                </div>
              )}
            </dl>
            {showReverse && (
              <div className="srcv-actions">
                <button type="button" className="sila-btn sila-btn--secondary" disabled={reprocessing} onClick={() => setReversing(true)}>
                  Reverse GRN
                </button>
              </div>
            )}
            <SilaDocumentTrackPanel key={receipt.id} track={receipt.documentTrack} historyAsPanel startCollapsed />
            <h3 className="sila-section-title">Received lines</h3>
            <p className="srcv-sub">Receipt quantities are never inferred from invoice quantities. Inventory lines update stock and post to S4.</p>
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
              <p className="srcv-sub">Not posted to S4 (no inventory materials accepted).</p>
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
