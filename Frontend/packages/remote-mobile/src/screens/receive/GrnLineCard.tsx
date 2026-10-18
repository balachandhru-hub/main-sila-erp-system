import React, { useState } from 'react';
import type { SilaPurchaseOrderLine } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import QtyInput, { parseQty } from '../../components/QtyInput';

export interface GrnLineEntry {
  accepted: string;
  rejected: string;
  damaged: string;
}

interface GrnLineCardProps {
  line: SilaPurchaseOrderLine;
  entry: GrnLineEntry;
  /** Quantity on the linked invoice for this PO item, when known. */
  invoiceQty: number | null;
  /** Messages of the last check for this line. */
  messages: string[];
  disabled: boolean;
  onChange: (change: Partial<GrnLineEntry>) => void;
}

/** Compact one-line PO item; rejected / damaged expand only when the arrow is pressed. */
const GrnLineCard: React.FC<GrnLineCardProps> = ({ line, entry, invoiceQty, messages, disabled, onChange }) => {
  const [openExtra, setOpenExtra] = useState(false);
  const received = (parseQty(entry.accepted) ?? 0) + (parseQty(entry.rejected || '0') ?? 0) + (parseQty(entry.damaged || '0') ?? 0);
  const uom = line.uom ?? '';
  const hasExtra = (parseQty(entry.rejected || '0') ?? 0) > 0 || (parseQty(entry.damaged || '0') ?? 0) > 0;

  return (
    <section className="sm-grn-line" aria-label={`PO item ${line.lineNumber}`}>
      <div className="sm-grn-line__row">
        <div className="sm-grn-line__info">
          <strong>
            PO Item {line.lineNumber} · {line.materialCode ?? '—'}
          </strong>
          <span className="sm-grn-line__name">{line.productName}</span>
          <span className="sm-grn-line__qty">
            Ordered Qty {formatQty(line.orderedQty)} {uom} · Open Qty {formatQty(line.openQty)} {uom}
            {invoiceQty !== null ? ` · Invoice Qty ${formatQty(invoiceQty)} ${uom}` : ''}
          </span>
          {!line.materialId && <span className="sm-meta">Not stocked</span>}
        </div>
        <div className="sm-grn-line__accept">
          <QtyInput
            label="Accepted GRN qty"
            value={entry.accepted}
            max={line.openQty}
            uom={uom || undefined}
            disabled={disabled}
            onChange={(value) => onChange({ accepted: value })}
          />
        </div>
        <button
          type="button"
          className="sm-grn-line__toggle"
          aria-expanded={openExtra}
          aria-label={openExtra ? 'Hide rejected and damaged' : 'Show rejected and damaged'}
          disabled={disabled}
          onClick={() => setOpenExtra((current) => !current)}
        >
          {openExtra ? '▲' : '▼'}
          {hasExtra && !openExtra ? <span className="sm-grn-line__dot" aria-hidden="true" /> : null}
        </button>
      </div>
      {openExtra && (
        <div className="sm-grn-line__extra sm-grid-2">
          <QtyInput label="Rejected qty" value={entry.rejected} disabled={disabled} onChange={(value) => onChange({ rejected: value })} />
          <QtyInput label="Damaged qty" value={entry.damaged} disabled={disabled} onChange={(value) => onChange({ damaged: value })} />
          <span className="sm-meta">Received {formatQty(received)} {uom}</span>
        </div>
      )}
      {messages.map((message) => (
        <p key={message} className="sm-notice sm-notice--warning">
          {message}
        </p>
      ))}
    </section>
  );
};

export default GrnLineCard;
