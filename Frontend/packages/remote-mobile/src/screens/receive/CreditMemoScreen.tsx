import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  createCreditMemo,
  getCreditMemo,
  getCreditMemoLines,
  getInvoice,
  retryCreditMemo,
  submitCreditMemo,
  type SilaCreditMemoDetail,
  type SilaCreditMemoEligibleLine,
  type SilaInvoiceDetail,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import DocumentTrackCard from './DocumentTrackCard';
import { invoicePosted, safeErpMessage } from './invoicePosting';

const today = (): string => new Date().toISOString().slice(0, 10);

const CreditMemoScreen: React.FC = () => {
  const { invoiceId = '', creditMemoId = '' } = useParams();
  const go = useGo();
  const invoiceLoad = useLoad(() => getInvoice(invoiceId), invoiceId || null);
  const memoLoad = useLoad(() => getCreditMemo(creditMemoId), creditMemoId || null);
  const [lines, setLines] = useState<SilaCreditMemoEligibleLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { quantity: string; amount: string; reason: string }>>({});
  const [reason, setReason] = useState('');
  const [documentDate, setDocumentDate] = useState(today);
  const [postingDate, setPostingDate] = useState(today);
  const [taxDate, setTaxDate] = useState(today);
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState<SilaCreditMemoDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const invoice = invoiceLoad.data;
  const loadedMemo = memo ?? memoLoad.data;

  useEffect(() => {
    if (!invoiceId) return;
    let active = true;
    getCreditMemoLines(invoiceId)
      .then((rows) => {
        if (!active) return;
        setLines(rows);
        setDrafts(Object.fromEntries(rows.map((line) => [line.invoiceLineId, { quantity: '', amount: '', reason: '' }])));
      })
      .catch((caught: unknown) => setNotice({ tone: 'error', text: errorText(caught, 'Could not load credit memo lines.') }));
    return () => { active = false; };
  }, [invoiceId]);

  useEffect(() => {
    if (memoLoad.data) setMemo(memoLoad.data);
  }, [memoLoad.data]);

  const payload = () => ({
    referenceInvoiceId: invoiceId,
    creditMemoReference: reference.trim() || null,
    documentDate,
    postingDate,
    taxCalculationDate: taxDate,
    reason: reason.trim() || null,
    lines: lines.map((line) => ({
      invoiceLineId: line.invoiceLineId,
      quantity: drafts[line.invoiceLineId]?.quantity ? Number(drafts[line.invoiceLineId].quantity) : 0,
      amount: drafts[line.invoiceLineId]?.amount ? Number(drafts[line.invoiceLineId].amount) : 0,
      reason: drafts[line.invoiceLineId]?.reason || null,
    })),
  });

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const current = loadedMemo ?? await createCreditMemo(payload());
      const posted = loadedMemo?.canRetry ? await retryCreditMemo(current.id) : await submitCreditMemo(current.id);
      setMemo(posted);
      setNotice({ tone: 'success', text: posted.canRetry ? 'Retry used stored credit memo posting data.' : 'Credit memo submitted.' });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Could not post the credit memo.') });
    } finally {
      setBusy(false);
    }
  };

  const postedInvoice: SilaInvoiceDetail | null = invoice && invoicePosted(invoice) ? invoice : invoice;
  const unknown = loadedMemo?.status === 'POSTING_UNKNOWN' || loadedMemo?.erpStatus === 'UNKNOWN';

  return (
    <>
      <ScreenHeader title="Credit Memo" eyebrow="Posted invoice" back />
      <div className="sm-screen">
        {invoiceLoad.loading && !invoice && <Loading />}
        {invoiceLoad.error && <ErrorNotice message={invoiceLoad.error} onRetry={invoiceLoad.reload} />}
        {postedInvoice && (
          <>
            <p className="sm-meta">Reference Invoice: {postedInvoice.invoiceNumber || postedInvoice.fileName}</p>
            <p className="sm-meta">SAP Invoice: {postedInvoice.erpReference || '—'}</p>
            <p className="sm-meta">Supplier: {postedInvoice.supplierName || '—'}</p>
            <p className="sm-meta">PO: {postedInvoice.poNumber || '—'}</p>
            <p className="sm-meta">Company Code: {postedInvoice.companyCode || '—'}</p>
            <p className="sm-meta">Currency: {postedInvoice.currency || '—'}</p>
            {loadedMemo && <StatusBadge status={loadedMemo.status} />}
            {loadedMemo?.erpMessage && <p className="sm-notice sm-notice--error">{safeErpMessage(loadedMemo.erpMessage)}</p>}
            {unknown && <p className="sm-notice sm-notice--warning">Posting status unknown. Reconcile before SAP is called again.</p>}
            <div className="sm-field">
              <label htmlFor="sm-cm-ref">Credit memo reference</label>
              <input id="sm-cm-ref" className="sm-input" value={reference} onChange={(event) => setReference(event.target.value)} />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-cm-reason">Reason</label>
              <input id="sm-cm-reason" className="sm-input" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-cm-doc">Document date</label>
              <input id="sm-cm-doc" className="sm-input" type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-cm-post">Posting date</label>
              <input id="sm-cm-post" className="sm-input" type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-cm-tax">Tax calculation date</label>
              <input id="sm-cm-tax" className="sm-input" type="date" value={taxDate} onChange={(event) => setTaxDate(event.target.value)} />
            </div>
            {lines.map((line) => (
              <section key={line.invoiceLineId} className="sm-section">
                <h2>PO Item {line.poItem || line.lineNumber}</h2>
                <p className="sm-meta">{line.material || '—'} · {line.description}</p>
                <p className="sm-meta">Original Invoice Qty {line.originalQuantity} · Amount {line.originalAmount}</p>
                <p className="sm-meta">Previously Credited Qty {line.previouslyCreditedQuantity} · Amount {line.previouslyCreditedAmount}</p>
                <p className="sm-meta">Remaining Credit Eligible Qty {line.remainingQuantity} · Amount {line.remainingAmount}</p>
                <div className="sm-field">
                  <label>Credit Quantity</label>
                  <input className="sm-input" inputMode="decimal" value={drafts[line.invoiceLineId]?.quantity ?? ''} onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [line.invoiceLineId]: { ...(current[line.invoiceLineId] ?? { quantity: '', amount: '', reason: '' }), quantity: event.target.value },
                  }))} />
                </div>
                <div className="sm-field">
                  <label>Credit Amount</label>
                  <input className="sm-input" inputMode="decimal" value={drafts[line.invoiceLineId]?.amount ?? ''} onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [line.invoiceLineId]: { ...(current[line.invoiceLineId] ?? { quantity: '', amount: '', reason: '' }), amount: event.target.value },
                  }))} />
                </div>
                <div className="sm-field">
                  <label>Reason</label>
                  <input className="sm-input" value={drafts[line.invoiceLineId]?.reason ?? ''} onChange={(event) => setDrafts((current) => ({
                    ...current,
                    [line.invoiceLineId]: { ...(current[line.invoiceLineId] ?? { quantity: '', amount: '', reason: '' }), reason: event.target.value },
                  }))} />
                </div>
              </section>
            ))}
            {!unknown && (
              <div className="sm-actions">
                <button type="button" className="sm-btn sm-btn--primary" disabled={busy} onClick={() => void submit()}>
                  {busy ? 'Submitting…' : loadedMemo?.canRetry ? 'Retry Credit Memo Posting' : 'Post credit memo'}
                </button>
              </div>
            )}
            <DocumentTrackCard track={loadedMemo?.documentTrack} />
            <Notice notice={notice} />
            <button type="button" className="sm-btn" onClick={() => go(`receive/invoices/${invoiceId}`)}>Back to invoice</button>
          </>
        )}
      </div>
    </>
  );
};

export default CreditMemoScreen;
