import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getInvoice,
  getInvoiceExtractions,
  submitInvoice,
  type SilaInvoiceDetail,
  type SilaInvoiceExtraction,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import DocumentTrackCard from './DocumentTrackCard';
import InvoiceDocumentCard from './InvoiceDocumentCard';
import InvoiceHistoryCard from './InvoiceHistoryCard';
import InvoiceReviewForm from './InvoiceReviewForm';
import { invoiceFormVisible, invoicePosted, invoicePostingFailed, safeErpMessage } from './invoicePosting';

/** Newest completed reading (it holds what the OCR read before the user corrected anything). */
const latestReading = (extractions: SilaInvoiceExtraction[] | null): SilaInvoiceExtraction | null =>
  (extractions ?? [])
    .filter((item) => item.status === 'COMPLETED')
    .sort((left, right) => right.attempt - left.attempt)[0] ?? null;

const postingTitle = (invoice: SilaInvoiceDetail): { label: string; status: string } => {
  if (invoicePostingFailed(invoice)) return { label: 'Posting Failed', status: 'ERP_POSTING_FAILED' };
  if ((invoice.status || '').toUpperCase() === 'POSTING_UNKNOWN' || (invoice.erpStatus || '').toUpperCase() === 'UNKNOWN') {
    return { label: 'Posting Status Unknown', status: 'POSTING_UNKNOWN' };
  }
  if (invoicePosted(invoice)) return { label: 'Posted', status: invoice.status };
  if ((invoice.status || '').toUpperCase() === 'POSTING' || (invoice.erpStatus || '').toUpperCase() === 'PENDING') {
    return { label: 'Posting', status: 'POSTING' };
  }
  return { label: invoice.status, status: invoice.status };
};

/** Invoice review: document, supplier (OCR → Supplier Master), invoice fields, open PO, items; then Finalize GRN. */
const InvoiceReviewScreen: React.FC = () => {
  const { invoiceId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getInvoice(invoiceId), invoiceId || null);
  const readings = useLoad(() => getInvoiceExtractions(invoiceId), invoiceId || null);
  /** Re-read result; it replaces the loaded invoice and remounts the form with the new values. */
  const [reread, setReread] = useState<{ invoice: SilaInvoiceDetail; version: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const invoice = reread?.invoice ?? data;
  const reading = latestReading(readings.data);
  const posting = invoice ? postingTitle(invoice) : null;
  const failure = invoice ? safeErpMessage(invoice.erpMessage) : null;

  const retry = async () => {
    if (!invoice) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await submitInvoice(invoice.id);
      setReread((current) => ({ invoice: updated, version: (current?.version ?? 0) + 1 }));
      setNotice({ tone: 'success', text: 'Invoice submitted for posting.' });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Could not submit the invoice.') });
    } finally {
      setBusy(false);
    }
  };

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
              <StatusBadge status={posting?.status} label={posting?.label} />
            </div>
            {invoicePostingFailed(invoice) && (
              <p className="sm-notice sm-notice--error">
                {failure ?? 'Invoice posting failed.'}
              </p>
            )}
            {(invoice.status || '').toUpperCase() === 'POSTING_UNKNOWN' && (
              <p className="sm-notice sm-notice--warning">Posting status unknown. Reconciliation is required before SAP is called again.</p>
            )}
            {invoicePosted(invoice) && (
              <p className="sm-notice sm-notice--success">
                Posted
                {invoice.erpReference ? ` · ${invoice.erpReference}` : ''}
                {invoice.fiscalYear ? ` · FY ${invoice.fiscalYear}` : ''}
              </p>
            )}
            <DocumentTrackCard track={invoice.documentTrack} linkedInvoiceId={invoice.id} />
            <InvoiceHistoryCard invoice={invoice} />
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
            {invoiceFormVisible(invoice) && (
              <InvoiceReviewForm key={`${invoice.id}-${reread?.version ?? 0}`} invoice={invoice} ocr={reading?.fields ?? null} />
            )}
            {invoicePostingFailed(invoice) && (
              <div className="sm-actions">
                <button type="button" className="sm-btn sm-btn--primary" disabled={busy} onClick={retry}>
                  {busy ? 'Submitting…' : 'Retry invoice posting'}
                </button>
              </div>
            )}
            <Notice notice={notice} />
          </>
        )}
      </div>
    </>
  );
};

export default InvoiceReviewScreen;
