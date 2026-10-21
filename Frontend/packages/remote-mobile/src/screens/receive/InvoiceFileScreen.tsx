import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getInvoiceFile } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { errorText } from '../../useLoad';

/** In-app invoice file. Back returns to the originating invoice review. */
const InvoiceFileScreen: React.FC = () => {
  const { invoiceId = '' } = useParams();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setError(null);
    void getInvoiceFile(invoiceId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorText(caught, 'The invoice document could not be opened.'));
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId]);

  return (
    <>
      <ScreenHeader title="Invoice Attachment" eyebrow="Invoice document" back backTo={`receive/invoices/${invoiceId}`} />
      <div className="sm-screen">
        {!url && !error && <Loading />}
        {error && <ErrorNotice message={error} />}
        {url && (
          <object data={url} type="application/pdf" className="sm-file-frame" aria-label="Invoice attachment">
            <a href={url} className="sm-btn">Open document</a>
          </object>
        )}
      </div>
    </>
  );
};

export default InvoiceFileScreen;
