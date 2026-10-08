import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getInvoice,
  getInvoiceExtractions,
  type SilaInvoiceDetail,
  type SilaInvoiceExtraction,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import InvoiceDocumentCard from './InvoiceDocumentCard';
import InvoiceReviewForm from './InvoiceReviewForm';

/** Newest completed reading (it holds what the OCR read before the user corrected anything). */
const latestReading = (extractions: SilaInvoiceExtraction[] | null): SilaInvoiceExtraction | null =>
  (extractions ?? [])
    .filter((item) => item.status === 'COMPLETED')
    .sort((left, right) => right.attempt - left.attempt)[0] ?? null;

/** Invoice review: document, supplier (OCR → Supplier Master), invoice fields, open PO, items; then Finalize GRN. */
const InvoiceReviewScreen: React.FC = () => {
  const { invoiceId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getInvoice(invoiceId), invoiceId || null);
  const readings = useLoad(() => getInvoiceExtractions(invoiceId), invoiceId || null);
  /** Re-read result; it replaces the loaded invoice and remounts the form with the new values. */
  const [reread, setReread] = useState<{ invoice: SilaInvoiceDetail; version: number } | null>(null);
  const invoice = reread?.invoice ?? data;
  const posted = invoice?.status === 'GRN_POSTED';
  const reading = latestReading(readings.data);

  return (
    <>
      <ScreenHeader title="Invoice Review" eyebrow="Invoice receiving · OCR then supplier then open PO" back />
      <div className="sm-screen">
        {loading && !invoice && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {invoice && (
          <>
            <div className="sm-row">
              <span className="sm-meta">
                {invoice.invoiceNumber || 'Invoice'} · {formatDate(invoice.uploadedOn)}
              </span>
              <StatusBadge status={invoice.status} />
            </div>
            <InvoiceDocumentCard
              invoice={invoice}
              extraction={reading}
              onReread={(updated) => {
                setReread((current) => ({ invoice: updated, version: (current?.version ?? 0) + 1 }));
                readings.reload();
              }}
            />
            {readings.error && <p className="sm-muted">The OCR reading history could not be loaded: {readings.error}</p>}
            {invoice.goodsReceipts.length > 0 && (
              <section className="sm-section" aria-labelledby="sm-invoice-grns">
                <h2 id="sm-invoice-grns">Goods receipts of this invoice</h2>
                <ul className="sm-list">
                  {invoice.goodsReceipts.map((grn) => (
                    <li key={grn.id}>
                      <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                        <span className="sm-row">
                          <strong>{grn.grnNumber}</strong>
                          <StatusBadge status={grn.erpStatus ?? grn.status} />
                        </span>
                        <span className="sm-meta">
                          PO {grn.poNumber} · {formatDate(grn.receivedOn)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!posted && (
              <InvoiceReviewForm key={`${invoice.id}-${reread?.version ?? 0}`} invoice={invoice} ocr={reading?.fields ?? null} />
            )}
          </>
        )}
      </div>
    </>
  );
};

export default InvoiceReviewScreen;
