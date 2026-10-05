import React from 'react';
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

/** One PO item of Finalize GRN: ordered / open / invoice quantities and the accepted, rejected and damaged quantities. */
const GrnLineCard: React.FC<GrnLineCardProps> = ({ line, entry, invoiceQty, messages, disabled, onChange }) => {
  const received = (parseQty(entry.accepted) ?? 0) + (parseQty(entry.rejected || '0') ?? 0) + (parseQty(entry.damaged || '0') ?? 0);
  const uom = line.uom ?? '';
  return (
    <section className="sm-card" aria-label={`PO item ${line.lineNumber}`}>
      <strong className="sm-title">
        PO Item {line.lineNumber} · {line.materialCode ?? 'No material code'}
      </strong>
      <span className="sm-meta">{line.productName}</span>
      <span className="sm-meta">
        Ordered Qty {formatQty(line.orderedQty)} {uom} · Open Qty {formatQty(line.openQty)} {uom}
        {invoiceQty !== null ? ` · Invoice Qty ${formatQty(invoiceQty)} ${uom}` : ''}
      </span>
      {!line.materialId && <span className="sm-meta">Not stocked: received on the PO, no stock is added.</span>}
      <QtyInput label="Accepted GRN qty" value={entry.accepted} max={line.openQty} uom={uom || undefined} disabled={disabled} onChange={(value) => onChange({ accepted: value })} />
      <div className="sm-grid-2">
        <QtyInput label="Rejected qty" value={entry.rejected} disabled={disabled} onChange={(value) => onChange({ rejected: value })} />
        <QtyInput label="Damaged qty" value={entry.damaged} disabled={disabled} onChange={(value) => onChange({ damaged: value })} />
      </div>
      <span className="sm-meta">
        Received {formatQty(received)} {uom} · UOM {uom || '—'}
      </span>
      {messages.map((message) => (
        <p key={message} className="sm-notice sm-notice--warning">
          {message}
        </p>
      ))}
    </section>
  );
};

export default GrnLineCard;
