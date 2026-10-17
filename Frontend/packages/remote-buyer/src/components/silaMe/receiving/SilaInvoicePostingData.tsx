import React, { useEffect, useState } from "react";
import { getSupplier } from "../../../api/silaMe/silaMasterDataApi";
import type {
  SilaInvoiceDetail,
  SilaInvoicePostingData as PostingData,
  SilaInvoicePostingField,
  SilaPurchaseOrderDetail,
  SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import { formatAmount, receivingLabel } from "./receivingFormat";

const SOURCE: Record<string, string> = {
  INVOICE: "Supplier invoice",
  INVOICE_LINE: "Supplier invoice line",
  S4_PO_HEADER: "S/4 PO",
  S4_PO_ITEM: "S/4 PO item",
  GRN: "Goods receipt",
  CONFIGURATION: "Posting configuration",
  DERIVED: "Invoice date",
};

const sourceLabel = (source: string) => SOURCE[source] || source;

const dateText = (value?: string | null) => (value ? value.slice(0, 10) : "—");

const itemNumber = (line: SilaPurchaseOrderLine) => line.itemNumber || String(line.lineNumber).padStart(5, "0");

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An ERP number. A system id is not a supplier or a goods receipt. */
const erpCode = (value?: string | null) => {
  const text = value?.trim();
  return text && !GUID.test(text) ? text : "";
};

const goodsReceiptId = (receipt: { erpReference?: string | null; grnNumber: string }) =>
  receipt.erpReference?.trim() || receipt.grnNumber;

const FieldRow: React.FC<{ field: SilaInvoicePostingField }> = ({ field }) => (
  <div className="sila-field">
    <span className="sila-label">{field.label}</span>
    <span>{field.value || (field.required ? "Missing" : "—")}</span>
    <span className="srcv-sub">Source: {sourceLabel(field.source)}</span>
  </div>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || "—"}</dd>
  </div>
);

/** Purchase order values already in SILA, and the invoice values that will be sent to S/4. */
const SilaInvoicePostingPanel: React.FC<{
  posting: PostingData | null | undefined;
  invoice: SilaInvoiceDetail;
  order: SilaPurchaseOrderDetail | null;
  canRefresh: boolean;
  busy: boolean;
  onRefresh: () => void;
}> = ({ posting, invoice, order, canRefresh, busy, onRefresh }) => {
  const prepared = posting?.preparedAt ? new Date(posting.preparedAt).toLocaleString() : null;
  const currency = invoice.currency || order?.currency || null;
  const knownSupplier = erpCode(order?.supplierCode) || erpCode(invoice.supplierCode);
  const [supplierCode, setSupplierCode] = useState(knownSupplier);
  useEffect(() => {
    if (knownSupplier) {
      setSupplierCode(knownSupplier);
      return undefined;
    }
    const supplierId = order?.supplierId || invoice.supplierId;
    if (!supplierId) {
      setSupplierCode("");
      return undefined;
    }
    let active = true;
    getSupplier(supplierId)
      .then((supplier) => { if (active) setSupplierCode(erpCode(supplier.supplierCode)); })
      .catch(() => { if (active) setSupplierCode(""); });
    return () => { active = false; };
  }, [knownSupplier, order?.supplierId, invoice.supplierId]);
  const supplierName = order?.supplierName || invoice.supplierName || "";
  const supplierText = supplierCode ? (supplierName ? `${supplierCode} · ${supplierName}` : supplierCode) : (supplierName || "—");
  const goodsReceipts = invoice.goodsReceipts.map(goodsReceiptId).filter(Boolean).join(", ");
  const taxCodes = [...new Set((order?.lines ?? []).map((line) => line.taxCode?.trim()).filter((code): code is string => Boolean(code)))];
  return (
    <div className="srcv-stack">
      <h3 className="sila-section-title">Purchase order extracted</h3>
      {!invoice.purchaseOrderId ? (
        <p className="srcv-sub">Match a purchase order to see the company, supplier, currency and lines that posting uses.</p>
      ) : !order ? (
        <p className="srcv-sub">Loading the purchase order...</p>
      ) : (
        <>
          <dl className="srcv-facts">
            <Fact label="Purchase order" value={order.poNumber} />
            <Fact label="Company code" value={order.companyCode || order.entityCode || "—"} />
            <Fact label="Supplier" value={supplierText} />
            <Fact label="Tax code" value={taxCodes.join(", ") || "—"} />
            <Fact label="Currency" value={order.currency || "—"} />
            <Fact label="Plant" value={order.plantCode || "—"} />
            <Fact label="Order date" value={dateText(order.orderDate)} />
          </dl>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Material</th>
                  <th scope="col">Description</th>
                  <th scope="col">UOM</th>
                  <th scope="col">Tax code</th>
                  <th scope="col">Ordered</th>
                  <th scope="col">Open</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{itemNumber(line)}</td>
                    <td>{line.materialCode || "—"}</td>
                    <td>{line.productName}</td>
                    <td>{line.uom || "—"}</td>
                    <td>{line.taxCode || "—"}</td>
                    <td>{line.orderedQty}</td>
                    <td>{line.openQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="sila-section-title">Invoice data submitted to ERP</h3>
      {posting ? (
        <>
          <p className="srcv-sub">This is the stored request. Submit and reprocess send these values. They are not read from S/4 again.</p>
          <p className="srcv-sub">Preparation: {receivingLabel(posting.preparationStatus || "")}</p>
          <p className="srcv-sub">Prepared: {prepared}</p>
          <p className="srcv-sub">Purchase order: {posting.purchaseOrder || "—"}</p>
          <p className="srcv-sub">Version: {posting.version}</p>
          <p className="srcv-sub">Source: {posting.sourceApi || "FIVE S4 - GET PO"}</p>
          {posting.stale && (
            <div className="sila-alert sila-alert--warning" role="status">
              The invoice changed after this data was prepared. Refresh from S/4 before posting. Reprocess does not read the purchase order again.
            </div>
          )}
          <h3 className="sila-section-title">Header</h3>
          <div className="sila-form-grid">
            {posting.header.map((field) => <FieldRow key={field.apiField} field={field} />)}
          </div>
          <h3 className="sila-section-title">Items</h3>
          {posting.lines.map((line) => (
            <div key={line.invoiceLine} className="srcv-stack">
              <p className="srcv-sub">
                Invoice line {line.invoiceLine}
                {line.grnNumber ? ` · GRN ${line.grnNumber}` : ""}
                {line.materialDocument ? ` · Material document ${line.materialDocument}` : ""}
              </p>
              <div className="sila-form-grid">
                {line.fields.map((field) => <FieldRow key={`${line.invoiceLine}-${field.apiField}`} field={field} />)}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="srcv-sub">
            Nothing has been sent. These are the invoice values the post will use. The supplier number, unit of measure and tax code come from the purchase order.
          </p>
          <dl className="srcv-facts">
            <Fact label="Supplier invoice number" value={invoice.invoiceNumber || "—"} />
            <Fact label="Invoice date" value={dateText(invoice.invoiceDate)} />
            <Fact label="Posting date" value={dateText(invoice.invoiceDate)} />
            <Fact label="Supplier" value={supplierText} />
            <Fact label="Currency" value={currency || "—"} />
            <Fact label="Gross amount" value={formatAmount(invoice.grossAmount, currency)} />
            <Fact label="Net amount" value={formatAmount(invoice.netAmount, currency)} />
            <Fact label="Tax amount" value={formatAmount(invoice.taxAmount, currency)} />
            <Fact label="Company code" value={order?.companyCode || order?.entityCode || "—"} />
            <Fact label="Purchase order" value={invoice.poNumber || "—"} />
            <Fact label="Accounting document type" value="RE" />
            <Fact label="Tax calculated automatically" value="true" />
            <Fact label="Goods receipts" value={goodsReceipts || "—"} />
          </dl>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">PO item</th>
                  <th scope="col">Material</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">UOM</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Tax code</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => {
                  const poLine = order?.lines.find((line) => line.id === item.purchaseOrderItemId);
                  return (
                    <tr key={item.id || item.lineNumber}>
                      <td>{String(item.lineNumber).padStart(5, "0")}</td>
                      <td>{poLine ? itemNumber(poLine) : "—"}</td>
                      <td>{poLine?.materialCode || item.supplierMaterialCode || "—"}</td>
                      <td>{item.quantity ?? "—"}</td>
                      <td>{poLine?.uom || item.uom || "—"}</td>
                      <td>{formatAmount(item.amount, currency)}</td>
                      <td>{poLine?.taxCode || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {canRefresh && (
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={onRefresh}>Refresh from S/4</button>
      )}
    </div>
  );
};

export default SilaInvoicePostingPanel;
