import React, { useState } from 'react';
import { extractInvoice, uploadInvoice } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import PageScanner from '../../components/PageScanner';
import ScreenHeader from '../../components/ScreenHeader';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import { buildInvoicePdf, type ScannedPage } from './invoicePdf';

type Step = 'idle' | 'pdf' | 'upload' | 'ocr';

const STEP_TEXT: Record<Step, string> = {
  idle: '',
  pdf: 'Building the PDF…',
  upload: 'Uploading the invoice…',
  ocr: 'Reading the invoice…',
};

/** Photograph the invoice pages, send them as one A4 PDF and read them with OCR. */
const ScanInvoiceScreen: React.FC = () => {
  const go = useGo();
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [step, setStep] = useState<Step>('idle');
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  /** Kept after the upload so a failed OCR call does not upload the invoice twice. */
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const busy = step !== 'idle';

  const send = async () => {
    setNotice(null);
    let id = invoiceId;
    try {
      if (!id) {
        setStep('pdf');
        const file = await buildInvoicePdf(pages);
        setStep('upload');
        id = await uploadInvoice(file);
        setInvoiceId(id);
      }
      setStep('ocr');
      await extractInvoice(id);
      go(`receive/invoices/${id}`, { replace: true });
    } catch (caught: unknown) {
      setStep('idle');
      setNotice({ tone: 'error', text: errorText(caught) });
    }
  };

  return (
    <>
      <ScreenHeader title="Scan invoice" eyebrow="Receive" back intro="Photograph each page in order (up to 20). The pages are sent as one A4 PDF and read with OCR." />
      <div className="sm-screen">
        <PageScanner
          pages={pages}
          onChange={(next) => {
            setPages(next);
            setInvoiceId(null);
          }}
          disabled={busy}
        />
        <Notice notice={notice} />
        {busy && <Notice notice={{ tone: 'info', text: STEP_TEXT[step] }} />}
        {invoiceId && !busy && (
          <button type="button" className="sm-btn sm-btn--block" onClick={() => go(`receive/invoices/${invoiceId}`)}>
            Enter the invoice by hand
          </button>
        )}
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={busy || pages.length === 0} onClick={send}>
          {busy ? STEP_TEXT[step] : invoiceId ? 'Read the invoice again' : 'Upload and read invoice'}
        </button>
      </div>
    </>
  );
};

export default ScanInvoiceScreen;
