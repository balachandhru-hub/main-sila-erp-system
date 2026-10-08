import React from "react";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import type { SilaPurchaseOrderLine } from "../../../api/silaMe/silaReceivingApi";
import { parseNumber } from "./receivingFormat";

/** What the user typed for one purchase order line. Accepted = received − rejected − damaged. */
export interface ReceiveLineInput {
  received: string;
  rejected: string;
  damaged: string;
  /** Batch number; asked when the material is batch managed. */
  batch?: string;
  /** Expiry date (yyyy-MM-dd); asked when the material is expiry managed. */
  expiry?: string;
}

/** What the batch / expiry of a line still needs before it can be received, or null. */
export const batchExpiryProblem = (line: SilaPurchaseOrderLine, input?: ReceiveLineInput): string | null => {
  if (!input || acceptedOf(input) <= 0) return null;
  if (line.batchManaged && !(input.batch ?? "").trim()) return `Enter the batch number of ${line.productName}.`;
  if (line.expiryManaged && !input.expiry) return `Enter the expiry date of ${line.productName}.`;
  if (input.expiry && input.expiry < new Date().toISOString().slice(0, 10)) return `The expiry date of ${line.productName} has passed; reject the goods instead.`;
  return null;
};

export const acceptedOf = (input?: ReceiveLineInput): number =>
  (parseNumber(input?.received ?? "") ?? 0) - (parseNumber(input?.rejected ?? "") ?? 0) - (parseNumber(input?.damaged ?? "") ?? 0);

interface SilaReceiveLinesTableProps {
  lines: SilaPurchaseOrderLine[];
  inputs: Record<string, ReceiveLineInput>;
  onChange: (lineId: string, input: ReceiveLineInput) => void;
  disabled?: boolean;
}

const FIELDS: { key: keyof ReceiveLineInput; label: string }[] = [
  { key: "received", label: "Received" },
  { key: "rejected", label: "Rejected" },
  { key: "damaged", label: "Damaged" },
];

/** The open lines of the purchase order with the received, rejected and damaged quantities. */
const SilaReceiveLinesTable: React.FC<SilaReceiveLinesTableProps> = ({ lines, inputs, onChange, disabled = false }) => (
  <div className="sila-table-wrap">
    <table className="sila-table">
      <thead>
        <tr>
          <th scope="col">Material</th>
          <th scope="col">Open</th>
          {FIELDS.map((field) => <th key={field.key} scope="col">{field.label}</th>)}
          <th scope="col">Accepted</th>
          <th scope="col">Batch / expiry</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const input = inputs[line.id] ?? { received: "", rejected: "", damaged: "" };
          const accepted = acceptedOf(input);
          const tooMuch = accepted > line.openQty + 0.0001;
          return (
            <tr key={line.id}>
              <td>
                <span className="sila-cell-strong">{line.productName}</span>
                <span className="srcv-sub">
                  {line.materialCode || "No material code"} · {line.uom || "—"}
                  {line.materialId ? "" : " · not stocked"}
                </span>
              </td>
              <td>{formatQty(line.openQty)}</td>
              {FIELDS.map((field) => (
                <td key={field.key}>
                  <input
                    className="sila-input srcv-qty"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    aria-label={`${field.label} quantity of ${line.productName}`}
                    value={input[field.key]}
                    disabled={disabled}
                    onChange={(event) => onChange(line.id, { ...input, [field.key]: event.target.value })}
                  />
                </td>
              ))}
              <td>
                <span className={tooMuch || accepted < 0 ? "srcv-error" : "sila-cell-strong"}>{formatQty(accepted)}</span>
                {tooMuch && <span className="srcv-error">More than open</span>}
              </td>
              <td>
                {line.batchManaged || line.expiryManaged ? (
                  <div className="srcv-batch">
                    {line.batchManaged && (
                      <input
                        className="sila-input"
                        maxLength={40}
                        placeholder="Batch number"
                        aria-label={`Batch number of ${line.productName}`}
                        value={input.batch ?? ""}
                        disabled={disabled}
                        onChange={(event) => onChange(line.id, { ...input, batch: event.target.value })}
                      />
                    )}
                    {line.expiryManaged && (
                      <input
                        className="sila-input"
                        type="date"
                        aria-label={`Expiry date of ${line.productName}`}
                        value={input.expiry ?? ""}
                        disabled={disabled}
                        onChange={(event) => onChange(line.id, { ...input, expiry: event.target.value })}
                      />
                    )}
                  </div>
                ) : (
                  <span className="srcv-sub">Not managed</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default SilaReceiveLinesTable;
