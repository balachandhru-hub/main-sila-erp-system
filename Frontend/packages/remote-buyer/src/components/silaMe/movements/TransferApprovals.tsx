import React from "react";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import type { SilaTransferApproval } from "../../../api/silaMe/silaMovementsApi";
import { formatDateTime } from "../../cart/lineFormat";
import { movementBadgeClass, movementLabel } from "./movementFormat";

interface TransferApprovalsProps {
  approvals: SilaTransferApproval[];
  uom?: string;
}

const SIDE_LABEL: Record<string, string> = { SOURCE: "Source", DESTINATION: "Destination" };

/** Approval of the source (approve / reject) and the destination (receive) of a transfer. */
const TransferApprovals: React.FC<TransferApprovalsProps> = ({ approvals, uom }) => {
  if (approvals.length === 0) return null;
  const unit = uom ? ` ${uom}` : "";
  const qty = (value?: number | null) => (value == null ? "—" : `${formatQty(value)}${unit}`);

  return (
    <section aria-labelledby="smov-approvals-title">
      <h3 id="smov-approvals-title" className="sila-section-title">Approvals</h3>
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">Side</th>
              <th scope="col">Status</th>
              <th scope="col" className="smov-num">Available</th>
              <th scope="col" className="smov-num">Requested</th>
              <th scope="col" className="smov-num">Approved</th>
              <th scope="col" className="smov-num">Stock after</th>
              <th scope="col">By</th>
              <th scope="col">Comment</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr key={approval.side}>
                <td className="sila-cell-strong">{SIDE_LABEL[approval.side] ?? approval.side}</td>
                <td><span className={movementBadgeClass(approval.status)}>{movementLabel(approval.status)}</span></td>
                <td className="smov-num">{qty(approval.availableQty)}</td>
                <td className="smov-num">{qty(approval.requestedQty)}</td>
                <td className="smov-num">{qty(approval.approvedQty)}</td>
                <td className="smov-num">{qty(approval.stockAfter)}</td>
                <td>
                  {approval.actorName || "—"}
                  {approval.on && <span className="smov-sub">{formatDateTime(approval.on)}</span>}
                </td>
                <td>{approval.comment || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default TransferApprovals;
