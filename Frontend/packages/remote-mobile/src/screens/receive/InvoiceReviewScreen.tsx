import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  decideInvoice,
  getInvoice,
  getInvoiceExtractions,
  reconcileErpPosting,
  refreshInvoicePosting,
  reprocessErpPosting,
  submitInvoice,
  type SilaInvoiceDetail,
  type SilaInvoiceExtraction,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { useAccess } from '../../access';
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

const statusOf = (invoice: SilaInvoiceDetail): string => (invoice.status || '').toUpperCase();
const erpOf = (invoice: SilaInvoiceDetail): string => (invoice.erpStatus || '').toUpperCase();

const postingTitle = (invoice: SilaInvoiceDetail): { label: string; status: string } => {
  if (invoicePostingFailed(invoice)) return { label: 'Posting Failed', status: 'ERP_POSTING_FAILED' };
  if (statusOf(invoice) === 'POSTING_UNKNOWN' || erpOf(invoice) === 'UNKNOWN') {
    return { label: 'Posting Status Unknown', status: 'POSTING_UNKNOWN' };
  }
  if (statusOf(invoice) === 'LOCAL_FINALIZATION_FAILED' || erpOf(invoice) === 'FAILED_LOCAL') {
    return { label: 'Local Finalization Failed', status: 'LOCAL_FINALIZATION_FAILED' };
  }
  if (invoicePosted(invoice)) return { label: 'Posted', status: invoice.status };
  if (statusOf(invoice) === 'POSTING' || erpOf(invoice) === 'PENDING') {
    return { label: 'Posting', status: 'POSTING' };
  }
  return { label: invoice.status, status: invoice.status };
};

const postingUnknown = (invoice: SilaInvoiceDetail): boolean =>
  statusOf(invoice) === 'POSTING_UNKNOWN' || erpOf(invoice) === 'UNKNOWN';

const localFailed = (invoice: SilaInvoiceDetail): boolean =>
  statusOf(invoice) === 'LOCAL_FINALIZATION_FAILED' || erpOf(invoice) === 'FAILED_LOCAL';

const canRefreshPosting = (invoice: SilaInvoiceDetail): boolean => {
  const status = statusOf(invoice);
  return Boolean(invoice.purchaseOrderId)
    && status !== 'POSTING'
    && status !== 'POSTING_UNKNOWN'
    && status !== 'POSTED'
    && status !== 'AWAITING_PAYMENT'
    && status !== 'LOCAL_FINALIZATION_FAILED'
    && !postingUnknown(invoice)
    && !localFailed(invoice)
    && !invoicePosted(invoice);
};

/** Invoice review: document, supplier (OCR → Supplier Master), invoice fields, open PO, items; then Finalize GRN. */
const InvoiceReviewScreen: React.FC = () => {
  const { invoiceId = '' } = useParams();
  const go = useGo();
  const { can, person } = useAccess();
  const { data, loading, error, reload } = useLoad(() => getInvoice(invoiceId), invoiceId || null);
  const readings = useLoad(() => getInvoiceExtractions(invoiceId), invoiceId || null);
  /** Re-read result; it replaces the loaded invoice and remounts the form with the new values. */
  const [reread, setReread] = useState<{ invoice: SilaInvoiceDetail; version: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [comment, setComment] = useState('');
  const [sapReference, setSapReference] = useState('');
  const [decisionDenied, setDecisionDenied] = useState(false);
  const invoice = reread?.invoice ?? data;
  const reading = latestReading(readings.data);
  const posting = invoice ? postingTitle(invoice) : null;
  const failure = invoice ? safeErpMessage(invoice.erpMessage) : null;
  const pendingApproval = invoice ? statusOf(invoice) === 'PENDING_APPROVAL' : false;
  const showDecision = pendingApproval && !decisionDenied && can.approveInvoice;
  const manageErp = can.manageErpPosting;

  const show = (updated: SilaInvoiceDetail) => {
    setReread((current) => ({ invoice: updated, version: (current?.version ?? 0) + 1 }));
  };

  const run = async (kind: string, action: () => Promise<void>, success?: string) => {
    setBusy(kind);
    setNotice(null);
    try {
      await action();
      if (success) setNotice({ tone: 'success', text: success });
    } catch (caught: unknown) {
      const text = errorText(caught, 'The action failed.');
      if (kind === 'decide' && /not an approver|not waiting for approval|earlier approval/i.test(text)) {
        setDecisionDenied(true);
      }
      setNotice({ tone: 'error', text });
    } finally {
      setBusy(null);
    }
  };

  const retry = () => {
    if (!invoice) return;
    void run('retry', async () => {
      show(await submitInvoice(invoice.id));
    }, 'Invoice resubmitted from stored posting data. SAP GET PO was not called.');
  };

  const decide = (approve: boolean) => {
    if (!invoice) return;
    if (!approve && comment.trim() === '') {
      setNotice({ tone: 'error', text: 'A comment is required.' });
      return;
    }
    void run('decide', async () => {
      show(await decideInvoice(invoice.id, approve, comment));
      setComment('');
    }, approve ? 'Approval recorded.' : 'Invoice rejected. SAP was not called.');
  };

  return (
    <>
      <ScreenHeader title="Invoice Review" back />
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
            {pendingApproval && (
              <section className="sm-section" aria-labelledby="sm-invoice-approval">
                <h2 id="sm-invoice-approval">Approval</h2>
                <p className="sm-meta">Status {invoice.status}</p>
                {showDecision ? (
                  <>
                    <label className="sm-label" htmlFor="sm-invoice-approval-comment">Comment</label>
                    <input
                      id="sm-invoice-approval-comment"
                      className="sm-input"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                    <div className="sm-actions">
                      <button type="button" className="sm-btn sm-btn--primary" disabled={busy !== null} onClick={() => decide(true)}>
                        {busy === 'decide' ? 'Saving…' : 'Approve'}
                      </button>
                      <button type="button" className="sm-btn" disabled={busy !== null} onClick={() => decide(false)}>
                        Reject
                      </button>
                    </div>
                    {person?.name ? <p className="sm-meta">Decision is recorded for the current user. The API decides eligibility.</p> : null}
                  </>
                ) : (
                  <p className="sm-notice">Waiting for approval. This user cannot decide this invoice.</p>
                )}
              </section>
            )}
            {invoicePostingFailed(invoice) && (
              <p className="sm-notice sm-notice--error">
                {failure ?? 'Invoice posting failed.'}
              </p>
            )}
            {postingUnknown(invoice) && (
              <section className="sm-section">
                <p className="sm-notice sm-notice--warning">
                  Posting status unknown. Reconcile with SAP before anything is sent again. Retry is not available.
                </p>
                {manageErp && invoice.erpPostingId && (
                  <>
                    <label className="sm-label" htmlFor="sm-invoice-sap-ref">SAP invoice reference</label>
                    <input
                      id="sm-invoice-sap-ref"
                      className="sm-input"
                      value={sapReference}
                      onChange={(event) => setSapReference(event.target.value)}
                      placeholder="Supplier invoice number"
                    />
                    <div className="sm-actions">
                      <button
                        type="button"
                        className="sm-btn sm-btn--primary"
                        disabled={busy !== null || sapReference.trim() === ''}
                        onClick={() => run('reconcile', async () => {
                          await reconcileErpPosting(invoice.erpPostingId!, true, sapReference);
                          show(await getInvoice(invoice.id));
                        }, 'Reconciled as posted. Local finalization only.')}
                      >
                        {busy === 'reconcile' ? 'Reconciling…' : 'Reconcile'}
                      </button>
                      <button
                        type="button"
                        className="sm-btn"
                        disabled={busy !== null}
                        onClick={() => run('reconcile', async () => {
                          await reconcileErpPosting(invoice.erpPostingId!, false, '');
                          show(await getInvoice(invoice.id));
                        }, 'Reconciled as not posted. The next send is allowed.')}
                      >
                        Not posted
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
            {localFailed(invoice) && (
              <section className="sm-section">
                <p className="sm-notice sm-notice--warning">
                  SAP invoice was created successfully. Complete local finalization only. SAP will not be called.
                </p>
                <p className="sm-meta">SAP Invoice: {invoice.erpReference || '—'}</p>
                {manageErp && invoice.erpPostingId && (
                  <div className="sm-actions">
                    <button
                      type="button"
                      className="sm-btn sm-btn--primary"
                      disabled={busy !== null}
                      onClick={() => run('local', async () => {
                        await reprocessErpPosting(invoice.erpPostingId!);
                        show(await getInvoice(invoice.id));
                      }, 'Local finalization completed. SAP was not called.')}
                    >
                      {busy === 'local' ? 'Completing…' : 'Complete local finalization'}
                    </button>
                  </div>
                )}
              </section>
            )}
            {invoicePosted(invoice) && (
              <p className="sm-notice sm-notice--success">
                Posted
                {invoice.erpReference ? ` · ${invoice.erpReference}` : ''}
                {invoice.fiscalYear ? ` · FY ${invoice.fiscalYear}` : ''}
              </p>
            )}
            {invoicePosted(invoice) && (
              <section className="sm-section">
                <p className="sm-meta">Invoice Number {invoice.invoiceNumber || invoice.fileName}</p>
                <p className="sm-meta">Supplier {invoice.supplierName || '—'}</p>
                <p className="sm-meta">PO {invoice.poNumber || '—'}</p>
                <p className="sm-meta">Invoice Date {formatDate(invoice.invoiceDate)}</p>
                <p className="sm-meta">Gross Amount {invoice.grossAmount ?? '—'} {invoice.currency || ''}</p>
                <p className="sm-meta">ERP/SAP Invoice ID {invoice.erpReference || '—'}</p>
                <p className="sm-meta">Fiscal Year {invoice.fiscalYear || '—'}</p>
                <p className="sm-meta">Posting Date {invoice.postingData?.preparedAt ? formatDate(invoice.postingData.preparedAt) : '—'}</p>
                <p className="sm-meta">Status {invoice.status}</p>
                <div className="sm-actions">
                  {can.processCreditMemo && (
                    <button type="button" className="sm-btn sm-btn--primary" onClick={() => go(`receive/invoices/${invoice.id}/credit-memo`)}>
                      Credit Memo
                    </button>
                  )}
                </div>
              </section>
            )}
            <DocumentTrackCard track={invoice.documentTrack} linkedInvoiceId={invoice.id} />
            <InvoiceHistoryCard invoice={invoice} />
            {(invoice.creditMemos ?? []).length > 0 && (
              <section className="sm-section">
                <h2>Credit Memo</h2>
                <ul className="sm-list">
                  {(invoice.creditMemos ?? []).map((row) => (
                    <li key={row.id}>
                      <button type="button" className="sm-list-btn" onClick={() => go(`receive/invoices/${invoice.id}/credit-memos/${row.id}`)}>
                        <span className="sm-row">
                          <strong>{row.creditMemoNumber || 'Credit Memo'}</strong>
                          <StatusBadge status={row.status} />
                        </span>
                        <span className="sm-meta">{row.erpReference ? `SAP ${row.erpReference}` : 'Not posted'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
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
              <InvoiceReviewForm key={`${invoice.id}-${reread?.version ?? 0}`} invoice={invoice} ocr={reading?.fields ?? null} canProcess={can.processInvoice} />
            )}
            {invoicePostingFailed(invoice) && can.processInvoice && (
              <div className="sm-actions">
                <button type="button" className="sm-btn sm-btn--primary" disabled={busy !== null} onClick={retry}>
                  {busy === 'retry' ? 'Submitting…' : 'Retry / Resubmit'}
                </button>
              </div>
            )}
            {manageErp && canRefreshPosting(invoice) && (
              <div className="sm-actions">
                <button
                  type="button"
                  className="sm-btn"
                  disabled={busy !== null}
                  onClick={() => run('refresh', async () => {
                    show(await refreshInvoicePosting(invoice.id));
                  }, 'Posting data refreshed from S/4. The invoice was not posted.')}
                >
                  {busy === 'refresh' ? 'Refreshing…' : 'Refresh posting data from S/4'}
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
