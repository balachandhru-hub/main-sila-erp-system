import React, { useState } from 'react';
import type { SilaInvoiceDetail } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import StatusBadge from '../../components/StatusBadge';
import { safeErpMessage } from './invoicePosting';

interface InvoiceHistoryCardProps {
  invoice: SilaInvoiceDetail;
}

const InvoiceHistoryCard: React.FC<InvoiceHistoryCardProps> = ({ invoice }) => {
  const [open, setOpen] = useState(false);
  const history = [...(invoice.documentTrack?.history ?? [])].sort((left, right) =>
    String(left.occurredOn).localeCompare(String(right.occurredOn)),
  );
  const timeline = invoice.timeline ?? [];
  const failure = safeErpMessage(invoice.erpMessage);

  if (history.length === 0 && timeline.length === 0 && !invoice.erpStatus && !invoice.erpReference) {
    return null;
  }

  return (
    <section className="sm-section" aria-labelledby="sm-invoice-history">
      <div className="sm-row">
        <h2 id="sm-invoice-history">Invoice History</h2>
        <button type="button" className="sm-btn" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {open && (
        <div>
          {history.length > 0 && (
            <ul className="sm-list">
              {history.map((event, index) => (
                <li key={`${event.action}-${event.occurredOn}-${index}`} className="sm-meta">
                  {event.action}
                  {event.comment ? ` · ${event.comment}` : ''}
                  {event.occurredOn ? ` · ${String(event.occurredOn).replace('T', ' ').slice(0, 19)}` : ''}
                </li>
              ))}
            </ul>
          )}
          {timeline.length > 0 && (
            <>
              <h3 className="sm-subtitle">Lifecycle</h3>
              <ul className="sm-list">
                {timeline.map((step) => (
                  <li key={step.step} className="sm-row">
                    <span className="sm-meta">{step.step}</span>
                    <StatusBadge status={step.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {(invoice.erpStatus || invoice.erpReference || invoice.fiscalYear || failure) && (
            <>
              <h3 className="sm-subtitle">ERP posting</h3>
              <p className="sm-meta">
                {invoice.erpStatus ? `Status ${invoice.erpStatus}` : ''}
                {invoice.erpReference ? ` · ${invoice.erpReference}` : ''}
                {invoice.fiscalYear ? ` · FY ${invoice.fiscalYear}` : ''}
              </p>
              {failure ? <p className="sm-notice sm-notice--error">{failure}</p> : null}
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default InvoiceHistoryCard;
