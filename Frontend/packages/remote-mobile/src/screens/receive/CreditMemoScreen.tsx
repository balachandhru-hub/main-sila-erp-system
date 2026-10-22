import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  createCreditMemo,
  creditMemoAmountTextForQuantity,
  creditMemoDraftFromLine,
  creditMemoExcludeDraft,
  creditMemoHeaderText,
  creditMemoIncludeDraft,
  getCreditMemo,
  getCreditMemoLines,
  getInvoice,
  mergeCreditMemoEligibleLines,
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
import { safeErpMessage } from './invoicePosting';

const today = (): string => new Date().toISOString().slice(0, 10);

interface LineDraft {
  included: boolean;
  quantity: string;
  amount: string;
  reason: string;
}

const postingField = (invoice: SilaInvoiceDetail | null, name: string): string | null =>
  invoice?.postingData?.header?.find((field) => field.apiField.toLowerCase() === name.toLowerCase())?.value || null;

const CreditMemoScreen: React.FC = () => {
  const { invoiceId = '', creditMemoId = '' } = useParams();
  const go = useGo();
  const memoLoad = useLoad(() => getCreditMemo(creditMemoId), creditMemoId || null);
  const resolvedInvoiceId = invoiceId || memoLoad.data?.referenceInvoiceId || '';
  const invoiceLoad = useLoad(() => getInvoice(resolvedInvoiceId), resolvedInvoiceId || null);
  const [lines, setLines] = useState<SilaCreditMemoEligibleLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [headerText, setHeaderText] = useState('');
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
    if (!resolvedInvoiceId) return;
    let active = true;
    const load = async () => {
      if (creditMemoId && !memo && !memoLoad.data && memoLoad.loading) return;
      const rows = await getCreditMemoLines(resolvedInvoiceId);
      if (!active) return;
      const saved = creditMemoId ? (memo ?? memoLoad.data)?.lines : undefined;
      const merged = mergeCreditMemoEligibleLines(rows, saved);
      setLines(merged);
      setDrafts(Object.fromEntries(merged.map((line) => {
        const item = saved?.find((row) => row.referenceInvoiceLineId === line.invoiceLineId);
        return [line.invoiceLineId, creditMemoDraftFromLine(line, item)];
      })));
    };
    load().catch((caught: unknown) => setNotice({ tone: 'error', text: errorText(caught, 'Could not load credit memo lines.') }));
    return () => { active = false; };
  }, [resolvedInvoiceId, creditMemoId, memo, memoLoad.data]);

  useEffect(() => {
    if (!invoice) return;
    if (!creditMemoId) setHeaderText((current) => current || creditMemoHeaderText(invoice.invoiceNumber));
  }, [invoice, creditMemoId]);

  useEffect(() => {
    if (!memoLoad.data) return;
    const data = memoLoad.data;
    setMemo(data);
    setHeaderText(data.headerText || data.reason || creditMemoHeaderText(data.referenceSupplierInvoiceNumber));
    setDocumentDate((data.documentDate || today()).slice(0, 10));
    setPostingDate((data.postingDate || today()).slice(0, 10));
    setTaxDate((data.taxCalculationDate || today()).slice(0, 10));
    setReference(data.creditMemoReference || data.creditMemoNumber || '');
  }, [memoLoad.data]);

  const changeDraft = (line: SilaCreditMemoEligibleLine, patch: Partial<LineDraft>, recalcAmount = false) => {
    setDrafts((current) => {
      const previous = current[line.invoiceLineId] ?? creditMemoDraftFromLine(line);
      const next = { ...previous, ...patch };
      if (recalcAmount && patch.quantity != null) {
        const amount = creditMemoAmountTextForQuantity(line, patch.quantity);
        if (amount != null) next.amount = amount;
      }
      return { ...current, [line.invoiceLineId]: next };
    });
  };

  const payload = () => ({
    referenceInvoiceId: resolvedInvoiceId,
    creditMemoReference: reference.trim() || null,
    documentDate,
    postingDate,
    taxCalculationDate: taxDate,
    headerText: headerText.trim() || creditMemoHeaderText(invoice?.invoiceNumber),
    reason: headerText.trim() || null,
    lines: lines.map((line) => {
      const draft = drafts[line.invoiceLineId];
      const included = draft?.included !== false;
      return {
        invoiceLineId: line.invoiceLineId,
        quantity: included && draft?.quantity ? Number(draft.quantity) : 0,
        amount: included && draft?.amount ? Number(draft.amount) : 0,
        reason: included ? (draft?.reason || null) : null,
      };
    }),
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

  const unknown = loadedMemo?.status === 'POSTING_UNKNOWN' || loadedMemo?.erpStatus === 'UNKNOWN';
  const posted = loadedMemo?.status === 'POSTED';
  const company = invoice?.companyCode || postingField(invoice, 'CompanyCode') || loadedMemo?.companyCode || loadedMemo?.referenceInvoice?.companyCode;
  const currency = invoice?.currency || postingField(invoice, 'DocumentCurrency') || '—';

  return (
    <>
      <ScreenHeader title="Credit Memo" eyebrow={invoiceId ? 'Posted invoice' : 'Credit memos'} back />
      <div className="sm-screen">
        {invoiceLoad.loading && !invoice && <Loading />}
        {invoiceLoad.error && <ErrorNotice message={invoiceLoad.error} onRetry={invoiceLoad.reload} />}
        {invoice && (
          <>
            <p className="sm-meta">Reference Invoice: {invoice.invoiceNumber || invoice.fileName}</p>
            <p className="sm-meta">SAP Invoice: {invoice.erpReference || loadedMemo?.referenceErpInvoiceId || '—'}</p>
            <p className="sm-meta">Fiscal Year: {invoice.fiscalYear || loadedMemo?.referenceFiscalYear || '—'}</p>
            <p className="sm-meta">Supplier: {invoice.supplierName || '—'}</p>
            <p className="sm-meta">PO: {invoice.poNumber || '—'}</p>
            <p className="sm-meta">Company Code: {company || '—'}</p>
            <p className="sm-meta">Currency: {currency}</p>
            {loadedMemo && (
              <p className="sm-meta">Credit Memo: {loadedMemo.creditMemoNumber || '—'}</p>
            )}
            {loadedMemo && <StatusBadge status={loadedMemo.status} />}
            {loadedMemo?.erpMessage && (
              <p className={posted ? 'sm-notice sm-notice--success' : 'sm-notice sm-notice--error'}>{safeErpMessage(loadedMemo.erpMessage)}</p>
            )}
            {unknown && <p className="sm-notice sm-notice--warning">Posting status unknown. Reconcile before SAP is called again.</p>}
            <div className="sm-field">
              <label htmlFor="sm-cm-ref">Credit memo number</label>
              <input id="sm-cm-ref" className="sm-input" value={loadedMemo?.creditMemoNumber || reference || 'Assigned on save'} readOnly />
            </div>
            <div className="sm-field">
              <label htmlFor="sm-cm-header">Header text</label>
              <input id="sm-cm-header" className="sm-input" value={headerText} onChange={(event) => setHeaderText(event.target.value)} />
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
            {lines.map((line) => {
              const draft = drafts[line.invoiceLineId] ?? creditMemoDraftFromLine(line);
              return (
                <section key={line.invoiceLineId} className="sm-section">
                  <h2>ITEM {line.poItem || String(line.lineNumber).padStart(5, '0')}</h2>
                  <p className="sm-meta">{line.material || '—'} · {line.description}</p>
                  <p className="sm-meta">PO {line.poNumber || invoice.poNumber || '—'} · Tax {line.taxCode || '—'}</p>
                  <p className="sm-meta">Original Qty {line.originalQuantity} {line.uom || ''} · Previously Credit {line.previouslyCreditedQuantity} {line.uom || ''} · Remaining {line.remainingQuantity} {line.uom || ''}</p>
                  <p className="sm-meta">Original Amount {line.originalAmount} · Previously Credit {line.previouslyCreditedAmount} · Remaining {line.remainingAmount}</p>
                  <label className="sm-field">
                    <input
                      type="checkbox"
                      checked={draft.included}
                      onChange={(event) => changeDraft(line, event.target.checked
                        ? creditMemoIncludeDraft(line, draft.reason)
                        : creditMemoExcludeDraft(draft.reason))}
                    />
                    {' '}Included
                  </label>
                  <div className="sm-field">
                    <label>Credit Quantity</label>
                    <input
                      className="sm-input"
                      inputMode="decimal"
                      disabled={!draft.included}
                      value={draft.quantity}
                      onChange={(event) => changeDraft(line, { quantity: event.target.value }, true)}
                    />
                  </div>
                  <div className="sm-field">
                    <label>Credit Amount</label>
                    <input
                      className="sm-input"
                      inputMode="decimal"
                      disabled={!draft.included}
                      value={draft.amount}
                      onChange={(event) => changeDraft(line, { amount: event.target.value })}
                    />
                  </div>
                  <div className="sm-field">
                    <label>Reason</label>
                    <input
                      className="sm-input"
                      disabled={!draft.included}
                      value={draft.reason}
                      onChange={(event) => changeDraft(line, { reason: event.target.value })}
                    />
                  </div>
                </section>
              );
            })}
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
