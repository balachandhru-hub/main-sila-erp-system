import React from "react";
import type { SilaPurchaseOrderLine } from "../../../api/silaMe/silaReceivingApi";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";

/** One editable invoice line; numbers are kept as typed. */
export interface InvoiceLineInput {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  purchaseOrderItemId: string;
  uom?: string;
  supplierMaterialCode?: string;
  taxRate?: string;
  /** SUGGESTED while the automatic match proposal is kept; cleared when the user picks a PO line. */
  matchStatus?: string;
}

/** MATCHED, SUGGESTED (automatic proposal not yet confirmed) or UNMATCHED. */
export const lineMatchStatus = (line: InvoiceLineInput): string =>
  !line.purchaseOrderItemId ? "UNMATCHED" : line.matchStatus === "SUGGESTED" ? "SUGGESTED" : "MATCHED";

let nextKey = 0;
export const newInvoiceLine = (values?: Partial<InvoiceLineInput>): InvoiceLineInput => {
  nextKey += 1;
  return { key: `inv-line-${nextKey}`, description: "", quantity: "", unitPrice: "", amount: "", purchaseOrderItemId: "", ...values };
};

interface SilaInvoiceLinesEditorProps {
  lines: InvoiceLineInput[];
  poLines: SilaPurchaseOrderLine[];
  onChange: (lines: InvoiceLineInput[]) => void;
  disabled?: boolean;
}

/** Invoice lines as read by the OCR, corrected by the user and linked to purchase order lines. */
const SilaInvoiceLinesEditor: React.FC<SilaInvoiceLinesEditorProps> = ({ lines, poLines, onChange, disabled = false }) => {
  const update = (key: string, values: Partial<InvoiceLineInput>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...values } : line)));

  return (
    <div className="srcv-stack">
      {lines.length === 0 && <p className="srcv-sub">No extracted lines. Read the invoice or add the lines by hand.</p>}
      {lines.length > 0 && (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Description</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit price</th>
                <th scope="col">Amount</th>
                <th scope="col">UOM</th>
                <th scope="col">Supplier code</th>
                <th scope="col">Tax %</th>
                <th scope="col">PO line</th>
                <th scope="col">Match</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.key}>
                  <td>
                    <input className="sila-input srcv-desc" aria-label={`Description of line ${index + 1}`} value={line.description} disabled={disabled} onChange={(event) => update(line.key, { description: event.target.value })} />
                  </td>
                  {(["quantity", "unitPrice", "amount"] as const).map((field) => (
                    <td key={field}>
                      <input
                        className="sila-input srcv-qty"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label={`${field === "unitPrice" ? "Unit price" : field === "amount" ? "Amount" : "Quantity"} of line ${index + 1}`}
                        value={line[field]}
                        disabled={disabled}
                        onChange={(event) => update(line.key, { [field]: event.target.value })}
                      />
                    </td>
                  ))}
                  <td>
                    <input className="sila-input srcv-code" maxLength={20} aria-label={`Unit of line ${index + 1}`} value={line.uom ?? ""} disabled={disabled} onChange={(event) => update(line.key, { uom: event.target.value.toUpperCase() })} />
                  </td>
                  <td>
                    <input className="sila-input srcv-code" maxLength={50} aria-label={`Supplier material code of line ${index + 1}`} value={line.supplierMaterialCode ?? ""} disabled={disabled} onChange={(event) => update(line.key, { supplierMaterialCode: event.target.value })} />
                  </td>
                  <td>
                    <input className="sila-input srcv-code" type="number" min="0" max="100" step="any" inputMode="decimal" aria-label={`Tax rate of line ${index + 1}`} value={line.taxRate ?? ""} disabled={disabled} onChange={(event) => update(line.key, { taxRate: event.target.value })} />
                  </td>
                  <td>
                    <select
                      className="sila-select"
                      aria-label={`Purchase order line of line ${index + 1}`}
                      value={line.purchaseOrderItemId}
                      disabled={disabled || poLines.length === 0}
                      onChange={(event) => update(line.key, { purchaseOrderItemId: event.target.value, matchStatus: "" })}
                    >
                      <option value="">Not linked</option>
                      {poLines.map((poLine) => (
                        <option key={poLine.id} value={poLine.id}>{poLine.itemNumber || poLine.lineNumber}. {poLine.productName}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={receivingBadgeClass(lineMatchStatus(line))}>{receivingLabel(lineMatchStatus(line))}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="sila-btn sila-btn--ghost sila-btn--sm"
                      aria-label={`Remove line ${index + 1}`}
                      disabled={disabled}
                      onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="srcv-sub">Invoice quantity is kept distinct from actual received quantity. Actual receipt is recorded on a GRN.</p>
      {!disabled && (
        <div className="srcv-actions">
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => onChange([...lines, newInvoiceLine()])}>
            Add line
          </button>
        </div>
      )}
    </div>
  );
};

export default SilaInvoiceLinesEditor;
