import React, { useState } from 'react';
import {
  getInvoiceFile,
  rereadInvoice,
  type SilaInvoiceDetail,
  type SilaInvoiceExtraction,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDate } from '../../format';
import { errorText } from '../../useLoad';

interface InvoiceDocumentCardProps {
  invoice: SilaInvoiceDetail;
  /** Newest reading of the invoice, when known. */
  extraction: SilaInvoiceExtraction | null;
  /** Called after a re-read with the invoice as read again. */
  onReread: (invoice: SilaInvoiceDetail) => void;
}

/** "Invoice document": the stored file, its reading status, View document and Re-read invoice. */
const InvoiceDocumentCard: React.FC<InvoiceDocumentCardProps> = ({ invoice, extraction, onReread }) => {
  const [busy, setBusy] = useState<'view' | 'reread' | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const posted = invoice.status === 'GRN_POSTED';

  const view = async () => {
    setBusy('view');
    setNotice(null);
    // Opened synchronously so mobile browsers do not block it as a pop-up; filled once the file arrives.
    const tab = window.open('', '_blank');
    try {
      const blob = await getInvoiceFile(invoice.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (caught: unknown) {
      tab?.close();
      setNotice({ tone: 'error', text: errorText(caught, 'The scanned document could not be opened.') });
    } finally {
      setBusy(null);
    }
  };

  const reread = async () => {
    setBusy('reread');
    setNotice(null);
    try {
      const updated = await rereadInvoice(invoice.id);
      setNotice({ tone: 'success', text: 'Invoice read again. Values you corrected were kept.' });
      onReread(updated);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Re-read failed.') });
    } finally {
      setBusy(null);
    }
  };

  const confidence = invoice.ocrConfidence ?? extraction?.confidence ?? null;

  return (
    <section className="sm-card" aria-labelledby="sm-invoice-doc">
      <h2 id="sm-invoice-doc" className="sm-label">
        Invoice document
      </h2>
      <p className="sm-meta">
        <strong>Original document ready</strong> · {invoice.fileName} · uploaded {formatDate(invoice.uploadedOn)}
      </p>
      {invoice.status === 'OCR_FAILED' && (
        <p className="sm-notice sm-notice--warning">
          The invoice could not be read{invoice.ocrMessage ? `: ${invoice.ocrMessage}` : '.'} Enter the fields by hand or re-read it.
        </p>
      )}
      {invoice.status !== 'OCR_FAILED' && confidence !== null && (
        <p className={invoice.needsReview ? 'sm-notice sm-notice--warning' : 'sm-meta'}>
          Read with {Math.round(confidence * 100)}% confidence{extraction ? ` (${extraction.method.replace(/_/g, ' ').toLowerCase()}, attempt ${extraction.attempt})` : ''}.
          {invoice.needsReview ? ' Below the minimum confidence: check every field.' : ' Check every field.'}
        </p>
      )}
      <Notice notice={notice} />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--small" disabled={busy !== null} onClick={view}>
          {busy === 'view' ? 'Opening…' : 'View document'}
        </button>
        {!posted && (
          <button type="button" className="sm-btn sm-btn--small" disabled={busy !== null} onClick={reread}>
            {busy === 'reread' ? 'Re-reading…' : 'Re-read invoice'}
          </button>
        )}
      </div>
    </section>
  );
};

export default InvoiceDocumentCard;
