import React from "react";
import type { SilaPosTransaction } from "../../../api/silaMe/silaPosApi";
import { formatDate } from "../../cart/lineFormat";
import { formatQty } from "../recipes/recipeFormat";
import { posLabel, posStatusBadgeClass, stepBadgeClass } from "./posFormat";

interface SilaTransactionRowProps {
  transaction: SilaPosTransaction;
  reprocessing: boolean;
  disabled: boolean;
  onReprocess: (transaction: SilaPosTransaction) => void;
  /** Opens the transaction detail. */
  onOpen: (transaction: SilaPosTransaction) => void;
}

/** One POS sale with its two steps: Step 1 SILA inventory (deduction), Step 2 ERP (SAP posting with the material document). */
const SilaTransactionRow: React.FC<SilaTransactionRowProps> = ({ transaction, reprocessing, disabled, onReprocess, onOpen }) => {
  const message = transaction.failureMessage
    ? `${transaction.failedStep ? `${posLabel(transaction.failedStep)}: ` : ""}${transaction.failureMessage}`
    : transaction.postedOn
      ? "Posted to SAP."
      : "—";

  return (
    <tr>
      <td>
        <button
          type="button"
          className="sila-btn sila-btn--ghost sila-btn--sm"
          aria-label={`Open transaction ${transaction.sourceTransactionId} line ${transaction.lineNumber}`}
          onClick={() => onOpen(transaction)}
        >
          {transaction.sourceTransactionId} / {transaction.lineNumber}
        </button>
        <span className="srec-sub">{formatDate(transaction.businessDate)}{transaction.batchNumber ? ` · ${transaction.batchNumber}` : ""}</span>
      </td>
      <td>
        {transaction.outletLocationName || transaction.outletCode}
        {transaction.outletLocationName && (
          <span className="srec-sub">
            {transaction.outletCode}
            {transaction.locationType ? ` · ${posLabel(transaction.locationType)}` : ""}
          </span>
        )}
      </td>
      <td>
        {transaction.posCode}
        {transaction.recipeCode && (
          <span className="srec-sub">
            {transaction.recipeCode} {transaction.recipeName}
            {transaction.recipeVersion != null ? ` · v${transaction.recipeVersion}` : ""}
          </span>
        )}
      </td>
      <td className="srec-num">{formatQty(transaction.quantitySold)}</td>
      <td>
        <span className={stepBadgeClass(transaction.step1Status || transaction.deductState)}>{posLabel(transaction.step1Status || transaction.deductState)}</span>
        {transaction.receivedState !== "DONE" && <span className="srec-sub">Received: {posLabel(transaction.receivedState)}</span>}
        {transaction.step1Message && <span className="srec-sub">{transaction.step1Message}</span>}
      </td>
      <td>
        <span className={stepBadgeClass(transaction.step2Status || transaction.postState)}>{posLabel(transaction.step2Status || transaction.postState)}</span>
        {transaction.erpReference && <span className="srec-sub">Material document {transaction.erpReference}</span>}
        {(transaction.integrationSystem || transaction.movementType || transaction.erpHttpStatus != null) && (
          <span className="srec-sub">
            {[
              transaction.integrationSystem,
              transaction.movementType ? `Mvt ${transaction.movementType}` : null,
              transaction.erpHttpStatus != null ? `HTTP ${transaction.erpHttpStatus}` : null,
            ].filter(Boolean).join(" · ")}
          </span>
        )}
      </td>
      <td><span className={posStatusBadgeClass(transaction.status)}>{posLabel(transaction.status)}</span></td>
      <td className="srec-message">{message}</td>
      <td>
        {transaction.canReprocess ? (
          <button
            type="button"
            className="sila-btn sila-btn--secondary sila-btn--sm"
            disabled={disabled}
            aria-label={`Reprocess transaction ${transaction.sourceTransactionId} line ${transaction.lineNumber}`}
            onClick={() => onReprocess(transaction)}
          >
            {reprocessing ? "Reprocessing..." : "Reprocess"}
          </button>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
};

export default SilaTransactionRow;
