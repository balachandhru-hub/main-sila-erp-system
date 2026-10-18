import React, { useEffect, useState } from "react";
import { getSupplier } from "../../../api/silaMe/silaMasterDataApi";
import type {
  SilaInvoiceDetail,
  SilaInvoicePostingData as PostingData,
  SilaInvoicePostingField,
  SilaPurchaseOrderDetail,
  SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import { receivingLabel } from "./receivingFormat";

const dateText = (value?: string | null) => (value ? value.slice(0, 10) : "—");

const itemNumber = (line: SilaPurchaseOrderLine) => line.itemNumber || String(line.lineNumber).padStart(5, "0");

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An ERP number. A system id is not a supplier or a goods receipt. */
const erpCode = (value?: string | null) => {
  const text = value?.trim();
  return text && !GUID.test(text) ? text : "";
};

const HEADER_FIELDS: { apiField: string; label: string }[] = [
  { apiField: "CompanyCode", label: "Company Code" },
  { apiField: "DocumentDate", label: "Document Date" },
  { apiField: "PostingDate", label: "Posting Date" },
  { apiField: "DueCalculationBaseDate", label: "Due Calculation Base Date" },
  { apiField: "InvoicingParty", label: "Invoicing Party" },
  { apiField: "DocumentCurrency", label: "Currency" },
  { apiField: "InvoiceGrossAmount", label: "Gross Amount" },
  { apiField: "AccountingDocumentType", label: "Accounting Document Type" },
  { apiField: "SupplierInvoiceIDByInvcgParty", label: "Supplier Invoice Reference" },
  { apiField: "TaxIsCalculatedAutomatically", label: "Automatic Tax Calculation" },
];

const storedValue = (fields: SilaInvoicePostingField[] | undefined, apiField: string) =>
  fields?.find((field) => field.apiField === apiField)?.value || "";

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

      <h3 className="sila-section-title">S/4 POSTING DATA</h3>
      {posting ? (
        <>
          <p className="srcv-sub">These values are stored on the invoice. Opening this screen does not read the purchase order from S/4.</p>
          <p className="srcv-sub">Preparation: {receivingLabel(posting.preparationStatus || "")}</p>
          <p className="srcv-sub">Prepared: {prepared}</p>
          <p className="srcv-sub">Version: {posting.version}</p>
          {posting.stale && (
            <div className="sila-alert sila-alert--warning" role="status">
              The invoice changed after this data was prepared. Refresh from S/4 before posting. Reprocess does not read the purchase order again.
            </div>
          )}
          <h3 className="sila-section-title">Header</h3>
          <dl className="srcv-facts">
            {HEADER_FIELDS.map((field) => (
              <Fact key={field.apiField} label={field.label} value={storedValue(posting.header, field.apiField)} />
            ))}
          </dl>
          <h3 className="sila-section-title">Items</h3>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">PO</th>
                  <th scope="col">PO Item</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">PO UOM</th>
                  <th scope="col">Tax Code</th>
                </tr>
              </thead>
              <tbody>
                {posting.lines.map((line) => (
                  <tr key={line.invoiceLine}>
                    <td>{storedValue(line.fields, "SupplierInvoiceItem") || "—"}</td>
                    <td>{storedValue(line.fields, "PurchaseOrder") || "—"}</td>
                    <td>{storedValue(line.fields, "PurchaseOrderItem") || "—"}</td>
                    <td>{storedValue(line.fields, "SupplierInvoiceItemAmount") || "—"}</td>
                    <td>{storedValue(line.fields, "QuantityInPurchaseOrderUnit") || "—"}</td>
                    <td>{storedValue(line.fields, "PurchaseOrderQuantityUnit") || "—"}</td>
                    <td>{storedValue(line.fields, "TaxCode") || "Missing"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="srcv-sub">
          Posting data is not stored. Refresh from S/4 before posting. This screen does not read the purchase order from S/4 to fill these values.
        </p>
      )}
      {canRefresh && (
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={onRefresh}>Refresh from S/4</button>
      )}
    </div>
  );
};

export default SilaInvoicePostingPanel;
