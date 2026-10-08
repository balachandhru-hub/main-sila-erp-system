import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import {
  approveTransfer,
  cancelTransfer,
  confirmTransferHandover,
  dispatchTransfer,
  disputeTransfer,
  getTransfer,
  receiveTransfer,
  rejectTransfer,
  type SilaTransferDetail as TransferDetail,
  type SilaTransferItem,
} from "../../../api/silaMe/silaMovementsApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { formatValue, movementBadgeClass, movementLabel, relationshipLabel } from "./movementFormat";
import TransferApprovals from "./TransferApprovals";

interface SilaTransferDetailProps {
  transferId: string;
  /** Approve, reject and dispatch need the transfer approval permission. */
  canApprove: boolean;
  onClose: () => void;
  /** Called after an action changed the transfer, so the list can reload. */
  onChanged: () => void;
}

type ActionMode = "APPROVE" | "REJECT" | "DISPATCH" | "RECEIVE" | "CANCEL" | "CONFIRM_HANDOVER" | "DISPUTE";

const ACTION_TEXT: Record<ActionMode, { button: string; confirm: string; done: string }> = {
  APPROVE: { button: "Approve", confirm: "Confirm approval", done: "Transfer approved." },
  REJECT: { button: "Reject", confirm: "Confirm rejection", done: "Transfer rejected." },
  DISPATCH: { button: "Dispatch", confirm: "Confirm dispatch", done: "Transfer dispatched." },
  RECEIVE: { button: "Receive", confirm: "Confirm receipt", done: "Transfer received." },
  CANCEL: { button: "Cancel transfer", confirm: "Confirm cancellation", done: "Transfer cancelled." },
  CONFIRM_HANDOVER: { button: "Confirm handover", confirm: "Confirm handover", done: "Handover confirmed." },
  DISPUTE: { button: "Dispute", confirm: "Confirm dispute", done: "Handover disputed." },
};

/** Statuses in which the received quantities are final. */
const RECEIVED_STATUSES = ["RECEIVED", "DISCREPANCY"];

/** Stage dates shown in the header once they are set. */
const STAGE_DATES: { key: "approvedOn" | "dispatchedOn" | "receivedOn"; label: string }[] = [
  { key: "approvedOn", label: "Approved on" },
  { key: "dispatchedOn", label: "Dispatched on" },
  { key: "receivedOn", label: "Received on" },
];

/** Actions shown as destructive (red) buttons. */
const DANGER_ACTIONS: ActionMode[] = ["REJECT", "CANCEL", "DISPUTE"];

const APPROVER_ACTIONS: ActionMode[] = ["APPROVE", "REJECT", "DISPATCH", "CONFIRM_HANDOVER", "DISPUTE"];

/** The editable quantity of a line starts at the quantity of the previous step. */
const startQuantity = (mode: ActionMode, item: SilaTransferItem): string =>
  String(mode === "APPROVE" ? item.requestedQty : item.dispatchedQty);

/** One transfer: all lines, the timeline and the actions the signed-in user may take. */
const SilaTransferDetail: React.FC<SilaTransferDetailProps> = ({ transferId, canApprove, onClose, onChanged }) => {
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTransfer(await getTransfer(transferId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the transfer.");
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = (transfer?.allowedActions ?? []).filter(
    (action): action is ActionMode =>
      action in ACTION_TEXT && (canApprove || !APPROVER_ACTIONS.includes(action as ActionMode)),
  );

  const startAction = (next: ActionMode) => {
    if (!transfer) return;
    setMode(next);
    setComment("");
    setActionError(null);
    const start: Record<string, string> = {};
    transfer.items.forEach((item) => {
      start[item.id] = startQuantity(next, item);
    });
    setQuantities(start);
  };

  const editsQuantity = mode === "APPROVE" || mode === "RECEIVE";

  // The first problem with the entered quantities, or null.
  const quantityError = (): string | null => {
    if (!transfer || !editsQuantity) return null;
    for (const item of transfer.items) {
      const value = Number(quantities[item.id]);
      const limit = mode === "APPROVE" ? item.requestedQty : item.dispatchedQty;
      if (quantities[item.id] === "" || Number.isNaN(value) || value < 0) return `Enter zero or more for ${item.materialCode}.`;
      if (value > limit) return `${item.materialCode}: at most ${formatQty(limit)} ${item.uom}.`;
    }
    if (mode === "APPROVE" && transfer.items.every((item) => Number(quantities[item.id]) === 0)) {
      return "Approve at least one line, or reject the transfer.";
    }
    return null;
  };

  const handleConfirm = async () => {
    if (!transfer || !mode) return;
    const problem = quantityError();
    if (problem) {
      setActionError(problem);
      return;
    }
    if (mode === "REJECT" && !comment.trim()) {
      setActionError("Enter why the transfer is rejected.");
      return;
    }
    if (mode === "DISPUTE" && !comment.trim()) {
      setActionError("Enter why the handover is disputed.");
      return;
    }
    setActionError(null);
    setSaving(true);
    const note = comment.trim() || null;
    const lines = transfer.items.map((item) => ({ itemId: item.id, quantity: Number(quantities[item.id]) }));
    try {
      if (mode === "APPROVE") await approveTransfer(transfer.id, lines, note);
      if (mode === "REJECT") await rejectTransfer(transfer.id, comment.trim());
      if (mode === "DISPATCH") await dispatchTransfer(transfer.id, note);
      if (mode === "RECEIVE") await receiveTransfer(transfer.id, lines, note);
      if (mode === "CANCEL") await cancelTransfer(transfer.id, note);
      if (mode === "CONFIRM_HANDOVER") await confirmTransferHandover(transfer.id, note);
      if (mode === "DISPUTE") await disputeTransfer(transfer.id, comment.trim());
      toastService.success(ACTION_TEXT[mode].done);
      setMode(null);
      onChanged();
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not update the transfer.");
    } finally {
      setSaving(false);
    }
  };

  const footer = mode
    ? {
        primaryButton: {
          text: ACTION_TEXT[mode].confirm,
          onClick: handleConfirm,
          loading: saving,
          disabled: saving,
          variant: DANGER_ACTIONS.includes(mode) ? ("danger" as const) : ("primary" as const),
        },
        secondaryButton: { text: "Back", onClick: () => setMode(null), disabled: saving },
      }
    : { secondaryButton: { text: "Close", onClick: onClose } };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="xl"
      headerProps={{
        heading: transfer ? `Transfer ${transfer.itoNumber}` : "Transfer",
        subHeading: transfer ? `${transfer.fromLocationName ?? "—"} → ${transfer.toLocationName ?? "—"}` : undefined,
      }}
      footerProps={footer}
    >
      <div className="sila-root sila-me smov-dialog">
        {loading ? (
          <Loader size={24} message="Loading transfer..." />
        ) : error || !transfer ? (
          <EmptyState
            variant="error"
            title="Couldn't load the transfer"
            description={error ?? undefined}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : (
          <>
            <dl className="sila-meta-grid">
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Status</dt>
                <dd className="sila-meta-value"><span className={movementBadgeClass(transfer.status)}>{movementLabel(transfer.status)}</span></dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Mode</dt>
                <dd className="sila-meta-value">{movementLabel(transfer.mode)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">From</dt>
                <dd className="sila-meta-value">{transfer.fromLocationName || "—"}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">To</dt>
                <dd className="sila-meta-value">{transfer.toLocationName || "—"}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Relationship</dt>
                <dd className="sila-meta-value">{relationshipLabel(transfer.transferRelationship)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Total value</dt>
                <dd className="sila-meta-value">{formatValue(transfer.totalValue, transfer.currency)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Requested by</dt>
                <dd className="sila-meta-value">{transfer.requestedByName || transfer.requestedBy}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Requested on</dt>
                <dd className="sila-meta-value">{formatDateTime(transfer.requestedOn)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Required by</dt>
                <dd className="sila-meta-value">{formatDate(transfer.requiredBy)}</dd>
              </div>
              {STAGE_DATES.filter((stage) => transfer[stage.key]).map((stage) => (
                <div key={stage.key} className="sila-meta-item">
                  <dt className="sila-meta-label">{stage.label}</dt>
                  <dd className="sila-meta-value">{formatDateTime(transfer[stage.key])}</dd>
                </div>
              ))}
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Reason</dt>
                <dd className="sila-meta-value">{transfer.reason || "—"}</dd>
              </div>
              {transfer.alreadyCollected && (
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Collection</dt>
                  <dd className="sila-meta-value"><span className="sila-badge sila-badge--info">Already collected</span></dd>
                </div>
              )}
              {transfer.disputeReason && (
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Dispute reason</dt>
                  <dd className="sila-meta-value">{transfer.disputeReason}</dd>
                </div>
              )}
              {transfer.comment && transfer.comment !== transfer.disputeReason && (
                <div className="sila-meta-item">
                  <dt className="sila-meta-label">Comment</dt>
                  <dd className="sila-meta-value">{transfer.comment}</dd>
                </div>
              )}
            </dl>

            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col" className="smov-num">Requested</th>
                    <th scope="col" className="smov-num">Approved</th>
                    <th scope="col" className="smov-num">Dispatched</th>
                    <th scope="col" className="smov-num">Received</th>
                    <th scope="col" className="smov-num">Variance</th>
                    <th scope="col">UOM</th>
                    <th scope="col" className="smov-num">Unit cost</th>
                    <th scope="col" className="smov-num">Value</th>
                    <th scope="col" className="smov-num">Source available</th>
                    <th scope="col" className="smov-num">Source after</th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.items.map((item) => {
                    const received = RECEIVED_STATUSES.includes(transfer.status);
                    // Received minus dispatched, once the destination confirmed the receipt.
                    const variance = item.varianceQty ?? (received ? item.receivedQty - item.dispatchedQty : null);
                    const short = item.dispatchedQty > 0 && variance !== null && variance < 0;
                    const input = (
                      <input
                        className="sila-input smov-qty"
                        type="number"
                        step="any"
                        min={0}
                        max={mode === "APPROVE" ? item.requestedQty : item.dispatchedQty}
                        aria-label={`${mode === "APPROVE" ? "Approved" : "Received"} quantity of ${item.materialCode}`}
                        value={quantities[item.id] ?? ""}
                        disabled={saving}
                        onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                      />
                    );
                    return (
                      <tr key={item.id}>
                        <td>
                          <span className="sila-cell-strong">{item.materialCode}</span>
                          <span className="smov-sub">{item.materialName}</span>
                        </td>
                        <td className="smov-num">{formatQty(item.requestedQty)}</td>
                        <td className="smov-num">{mode === "APPROVE" ? input : formatQty(item.approvedQty)}</td>
                        <td className="smov-num">{formatQty(item.dispatchedQty)}</td>
                        <td className={`smov-num${short ? " smov-short" : ""}`}>
                          {mode === "RECEIVE" ? input : formatQty(item.receivedQty)}
                        </td>
                        <td className={`smov-num${short ? " smov-short" : ""}`}>{formatQty(variance)}</td>
                        <td>{item.uom}</td>
                        <td className="smov-num">{formatValue(item.unitCost, transfer.currency)}</td>
                        <td className="smov-num">{formatValue(item.transferValue, transfer.currency)}</td>
                        <td className="smov-num">{formatQty(item.sourceAvailable ?? null)}</td>
                        <td className={`smov-num${(item.sourceAfter ?? 0) < 0 ? " smov-short" : ""}`}>{formatQty(item.sourceAfter ?? null)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {mode ? (
              <div className="smov-action">
                {mode === "RECEIVE" && (
                  <p className="sila-help">A quantity below the dispatched quantity is recorded as a discrepancy.</p>
                )}
                {mode === "DISPATCH" && <p className="sila-help">The approved quantities leave the source location now.</p>}
                {mode === "CONFIRM_HANDOVER" && (
                  <p className="sila-help">The requester already took the stock: it leaves the source and reaches the destination now.</p>
                )}
                {mode === "DISPUTE" && (
                  <p className="sila-help">No stock moves. The transfer is marked as a discrepancy and an alert is raised for review.</p>
                )}
                <div className="sila-field">
                  <label className="sila-label" htmlFor="smov-transfer-comment">
                    {mode === "DISPUTE" ? "Dispute reason" : "Comment"}
                    {(mode === "REJECT" || mode === "DISPUTE") && <span className="sila-required">*</span>}
                  </label>
                  <textarea
                    id="smov-transfer-comment"
                    className="sila-textarea"
                    value={comment}
                    maxLength={500}
                    disabled={saving}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </div>
                {actionError && <p className="sila-error-text" role="alert">{actionError}</p>}
              </div>
            ) : actions.length > 0 ? (
              <div className="sila-btn-group smov-actions">
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className={`sila-btn ${DANGER_ACTIONS.includes(action) ? "sila-btn--danger" : "sila-btn--primary"}`}
                    onClick={() => startAction(action)}
                  >
                    {ACTION_TEXT[action].button}
                  </button>
                ))}
              </div>
            ) : null}

            <TransferApprovals approvals={transfer.approvals ?? []} uom={transfer.items.length === 1 ? transfer.items[0].uom : undefined} />

            <section aria-labelledby="smov-timeline-title">
              <h3 id="smov-timeline-title" className="sila-section-title">History</h3>
              {transfer.events.length === 0 ? (
                <EmptyState title="No events yet" />
              ) : (
                <ol className="smov-timeline">
                  {transfer.events.map((event, index) => (
                    <li key={`${event.on}-${index}`} className="smov-event">
                      <span className="sila-cell-strong">{movementLabel(event.action)}</span>
                      <span className="smov-sub">{event.actorName} · {formatDateTime(event.on)}</span>
                      {event.comment && <span className="smov-event-comment">{event.comment}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaTransferDetail;
