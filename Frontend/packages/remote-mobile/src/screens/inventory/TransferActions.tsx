import React, { useState } from 'react';
import {
  approveTransfer,
  cancelTransfer,
  confirmTransferHandover,
  dispatchTransfer,
  disputeTransfer,
  receiveTransfer,
  rejectTransfer,
  type SilaTransferDetail,
} from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import QtyInput, { parseQty } from '../../components/QtyInput';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { errorText } from '../../useLoad';

type ActionKey = 'APPROVE' | 'REJECT' | 'DISPATCH' | 'RECEIVE' | 'CANCEL' | 'CONFIRM_HANDOVER' | 'DISPUTE';

const LABELS: Record<ActionKey, string> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  DISPATCH: 'Hand over',
  RECEIVE: 'Received',
  CANCEL: 'Cancel transfer',
  CONFIRM_HANDOVER: 'Confirm collected',
  DISPUTE: 'Dispute collected',
};

const ORDER: ActionKey[] = ['APPROVE', 'DISPATCH', 'RECEIVE', 'CONFIRM_HANDOVER', 'REJECT', 'DISPUTE', 'CANCEL'];

/** Actions that undo or refuse: red, and they need a reason. */
const NEGATIVE: ActionKey[] = ['REJECT', 'CANCEL', 'DISPUTE'];
const NEEDS_REASON: ActionKey[] = ['REJECT', 'DISPUTE'];

interface TransferActionsProps {
  transfer: SilaTransferDetail;
  onDone: () => void;
}

/** The actions the API allows the user now; approve and receive take a quantity per line. */
const TransferActions: React.FC<TransferActionsProps> = ({ transfer, onDone }) => {
  const [active, setActive] = useState<ActionKey | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const allowed = ORDER.filter((action) => transfer.allowedActions.map((item) => item.toUpperCase()).includes(action));
  if (allowed.length === 0 && !notice) return null;

  const open = (action: ActionKey) => {
    setActive(action);
    setComment('');
    setNotice(null);
    const defaults: Record<string, string> = {};
    transfer.items.forEach((item) => {
      defaults[item.id] = String(action === 'RECEIVE' ? item.dispatchedQty : item.requestedQty);
    });
    setQty(defaults);
  };

  const lineLimit = (itemId: string): number => {
    const item = transfer.items.find((line) => line.id === itemId);
    if (!item) return 0;
    return active === 'RECEIVE' ? item.dispatchedQty : item.requestedQty;
  };

  const confirm = async () => {
    if (!active) return;
    const text = comment.trim() || null;
    const lines = transfer.items.map((item) => ({ itemId: item.id, quantity: parseQty(qty[item.id] ?? '') }));
    if (active === 'APPROVE' || active === 'RECEIVE') {
      const invalid = lines.find((line) => line.quantity === null || line.quantity > lineLimit(line.itemId));
      if (invalid) {
        setNotice({ tone: 'error', text: `Each quantity must be between 0 and the ${active === 'RECEIVE' ? 'dispatched' : 'requested'} quantity.` });
        return;
      }
    }
    if (NEEDS_REASON.includes(active) && !text) {
      setNotice({ tone: 'error', text: active === 'DISPUTE' ? 'Explain why the stock was not handed over.' : 'Enter the reason for rejecting.' });
      return;
    }
    const items = lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity ?? 0 }));
    setSaving(true);
    setNotice(null);
    try {
      if (active === 'APPROVE') await approveTransfer(transfer.id, items, text);
      if (active === 'REJECT') await rejectTransfer(transfer.id, text ?? '');
      if (active === 'DISPATCH') await dispatchTransfer(transfer.id, text);
      if (active === 'RECEIVE') await receiveTransfer(transfer.id, items, text);
      if (active === 'CANCEL') await cancelTransfer(transfer.id, text);
      if (active === 'CONFIRM_HANDOVER') await confirmTransferHandover(transfer.id, text);
      if (active === 'DISPUTE') await disputeTransfer(transfer.id, text ?? '');
      setNotice({ tone: 'success', text: `${LABELS[active]}: done.` });
      setActive(null);
      onDone();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sm-section" aria-labelledby="sm-ito-actions">
      <h2 id="sm-ito-actions">Actions</h2>
      <Notice notice={notice} />
      {!active && (
        <div className="sm-grid-2">
          {allowed.map((action) => (
            <button
              key={action}
              type="button"
              className={`sm-btn${NEGATIVE.includes(action) ? ' sm-btn--danger' : ' sm-btn--primary'}`}
              onClick={() => open(action)}
            >
              {LABELS[action]}
            </button>
          ))}
        </div>
      )}
      {active && (
        <div className="sm-card">
          <h3 className="sm-card__title">{LABELS[active]}</h3>
          {active === 'CONFIRM_HANDOVER' && (
            <p className="sm-meta">The requester already took the stock. Confirming moves it from your location and completes the transfer.</p>
          )}
          {active === 'DISPUTE' && (
            <p className="sm-meta">No stock moves; the transfer becomes a discrepancy for the managers to resolve.</p>
          )}
          {(active === 'APPROVE' || active === 'RECEIVE') &&
            transfer.items.map((item) => (
              <QtyInput
                key={item.id}
                label={`${item.materialName} (max ${lineLimit(item.id)})`}
                value={qty[item.id] ?? ''}
                onChange={(value) => setQty((current) => ({ ...current, [item.id]: value }))}
                uom={item.uom}
                max={lineLimit(item.id)}
              />
            ))}
          <div className="sm-field">
            <label htmlFor="sm-ito-comment">{NEEDS_REASON.includes(active) ? 'Reason' : 'Comment (optional)'}</label>
            <textarea id="sm-ito-comment" className="sm-textarea" value={comment} onChange={(event) => setComment(event.target.value)} />
          </div>
          <div className="sm-grid-2">
            <button type="button" className="sm-btn" disabled={saving} onClick={() => setActive(null)}>
              Back
            </button>
            <button
              type="button"
              className={`sm-btn ${NEGATIVE.includes(active) ? 'sm-btn--danger' : 'sm-btn--primary'}`}
              disabled={saving}
              onClick={confirm}
            >
              {saving ? 'Saving…' : `Confirm ${LABELS[active].toLowerCase()}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default TransferActions;
