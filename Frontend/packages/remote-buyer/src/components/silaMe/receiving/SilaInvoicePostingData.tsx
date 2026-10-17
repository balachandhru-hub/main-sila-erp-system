import React from "react";
import type { SilaInvoicePostingData as PostingData, SilaInvoicePostingField } from "../../../api/silaMe/silaReceivingApi";
import { receivingLabel } from "./receivingFormat";

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

const FieldRow: React.FC<{ field: SilaInvoicePostingField }> = ({ field }) => (
  <div className="sila-field">
    <span className="sila-label">{field.label}</span>
    <span>{field.value || (field.required ? "Missing" : "—")}</span>
    <span className="srcv-sub">Source: {sourceLabel(field.source)}</span>
  </div>
);

/** The stored S/4 posting values. ERP-derived fields stay read only. */
const SilaInvoicePostingPanel: React.FC<{
  posting: PostingData | null | undefined;
  canRefresh: boolean;
  busy: boolean;
  onRefresh: () => void;
}> = ({ posting, canRefresh, busy, onRefresh }) => {
  if (!posting) {
    return (
      <div className="srcv-stack">
        <p className="srcv-sub">Posting data is stored after the invoice is submitted and the purchase order is read. The invoice post is built from those stored values.</p>
        {canRefresh && (
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={onRefresh}>Refresh from S/4</button>
        )}
      </div>
    );
  }

  const prepared = posting.preparedAt ? new Date(posting.preparedAt).toLocaleString() : "—";
  return (
    <div className="srcv-stack">
      <h3 className="sila-section-title">S/4 posting data</h3>
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
      {canRefresh && (
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy} onClick={onRefresh}>Refresh from S/4</button>
      )}
    </div>
  );
};

export default SilaInvoicePostingPanel;
