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

/** Photograph the invoice pages or pick a PDF, send them, and read with OCR. */
const ScanInvoiceScreen: React.FC = () => {
  const go = useGo();
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  /** Kept after the upload so a failed OCR call does not upload the invoice twice. */
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const busy = step !== 'idle';
  const ready = Boolean(pdfFile) || pages.length > 0;

  const send = async () => {
    setNotice(null);
    let id = invoiceId;
    try {
      if (!id) {
        let file = pdfFile;
        if (!file) {
          setStep('pdf');
          file = await buildInvoicePdf(pages);
        }
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
      <ScreenHeader title="Scan invoice" eyebrow="Receive" back intro="Photograph each page, pick gallery images, or pick a PDF. The document is read with OCR." />
      <div className="sm-screen">
        <PageScanner
          pages={pages}
          pdfFile={pdfFile}
          onChange={(next) => {
            setPages(next);
            setInvoiceId(null);
          }}
          onPdfChange={(file) => {
            setPdfFile(file);
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
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={busy || !ready} onClick={send}>
          {busy ? STEP_TEXT[step] : invoiceId ? 'Read the invoice again' : 'Upload and read invoice'}
        </button>
      </div>
    </>
  );
};

export default ScanInvoiceScreen;
