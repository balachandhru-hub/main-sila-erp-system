import React from 'react';
import type { SilaInvoiceItem } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { formatMoney } from '../../format';

interface InvoiceItemsCardProps {
  items: SilaInvoiceItem[];
  currency: string | null;
}

/** "Invoice items": the lines the OCR read, with quantity, unit price and amount. */
const InvoiceItemsCard: React.FC<InvoiceItemsCardProps> = ({ items, currency }) => {
  if (items.length === 0) return null;
  return (
    <section className="sm-card" aria-labelledby="sm-inv-items">
      <h2 id="sm-inv-items" className="sm-label">
        Invoice items ({items.length})
      </h2>
      <ul className="sm-list">
        {items.map((item) => (
          <li key={item.id ?? item.lineNumber}>
            <strong className="sm-title">
              {item.lineNumber}. {item.description || '—'}
            </strong>
            <p className="sm-meta">
              Qty {formatQty(item.quantity)}
              {item.unitPrice !== null && item.unitPrice !== undefined ? ` · Unit ${formatMoney(item.unitPrice, currency)}` : ''}
              {item.amount !== null && item.amount !== undefined ? ` · ${formatMoney(item.amount, currency)}` : ''}
              {item.purchaseOrderItemId ? ' · matched to a PO item' : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default InvoiceItemsCard;
