import React, { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  getGoodsReceipt,
  submitInvoice,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDateTime } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import DocumentTrackCard from './DocumentTrackCard';
import GrnErpCard from './GrnErpCard';

const INVOICE_SUBMIT_OK = new Set([
  'GRN_POSTED',
  'READY_FOR_INVOICE_SUBMISSION',
  'REVIEWED',
  'EXTRACTED',
  'APPROVED',
]);

/** A goods receipt; right after posting it is the result screen. */
const GrnDetailScreen: React.FC = () => {
  const { grnId = '' } = useParams();
  const [params] = useSearchParams();
  const justPosted = params.get('posted') === '1';
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getGoodsReceipt(grnId), grnId || null);
  const [busy, setBusy] = useState<'invoice' | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const status = (data?.status || '').toUpperCase();
  const reversalStatus = (data?.reversalStatus || '').toUpperCase();
  const canPostInvoice = !!data?.invoiceId && INVOICE_SUBMIT_OK.has((data.invoiceStatus || '').toUpperCase());
  const showReverse =
    status !== 'REVERSED' &&
    (status === 'POSTED' ||
      status === 'PARTIALLY_REVERSED' ||
      reversalStatus === 'FAILED' ||
      reversalStatus === 'FAILED_LOCAL' ||
      reversalStatus === 'ERP_ACCEPTED');

  const onPostInvoice = async () => {
    if (!data?.invoiceId) return;
    setBusy('invoice');
    setNotice(null);
    try {
      await submitInvoice(data.invoiceId);
      setNotice({ tone: 'success', text: 'Invoice submitted for posting.' });
      go(`receive/invoices/${data.invoiceId}`, { replace: false });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Could not submit the invoice.') });
      setBusy(null);
    }
  };

  return (
    <>
      <ScreenHeader title={justPosted ? 'GRN result' : data?.grnNumber ?? 'Goods receipt'} eyebrow="Receive" backTo={justPosted ? 'receive' : undefined} back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            {justPosted && (
              <p className="sm-notice sm-notice--success" role="status">
                Goods receipt {data.grnNumber} posted. The accepted stock is now at {data.locationName ?? 'the store'}.
              </p>
            )}
            <Card title={data.grnNumber} aside={<StatusBadge status={data.status} />}>
              <dl className="sm-kv">
                <dt>Purchase order</dt>
                <dd>{data.poNumber}</dd>
                <dt>Supplier</dt>
                <dd>{data.supplierName ?? '—'}</dd>
                <dt>Store</dt>
                <dd>{data.locationName ?? '—'}</dd>
                {(data.materialDocument || data.erpPosting?.erpReference) && (
                  <>
                    <dt>SAP Material Document</dt>
                    <dd>
                      {data.materialDocument ?? data.erpPosting?.erpReference}
                      {data.materialDocumentYear ? ` / ${data.materialDocumentYear}` : ''}
                    </dd>
                  </>
                )}
                {data.reversalMaterialDocument && (
                  <>
                    <dt>Reversal Material Document</dt>
                    <dd>
                      {data.reversalMaterialDocument}
                      {data.reversalMaterialDocumentYear ? ` / ${data.reversalMaterialDocumentYear}` : ''}
                    </dd>
                  </>
                )}
                {data.invoiceNumber && (
                  <>
                    <dt>Invoice</dt>
                    <dd>{data.invoiceNumber}</dd>
                  </>
                )}
                {data.deliveryNote && (
                  <>
                    <dt>Delivery note</dt>
                    <dd>{data.deliveryNote}</dd>
                  </>
                )}
                <dt>Received</dt>
                <dd>{formatDateTime(data.receivedOn)}</dd>
              </dl>
            </Card>

            <GrnErpCard grn={data} onChanged={reload} />
            <DocumentTrackCard track={data.documentTrack} />

            {(showReverse || canPostInvoice) && (
              <div className="sm-actions sm-grid-2">
                {showReverse && (
                  <button
                    type="button"
                    className="sm-btn"
                    disabled={busy !== null}
                    onClick={() => go(`receive/grns/${data.id}/reverse`)}
                  >
                    Reverse GRN
                  </button>
                )}
                {canPostInvoice && (
                  <button type="button" className="sm-btn sm-btn--primary" disabled={busy !== null} onClick={onPostInvoice}>
                    {busy === 'invoice' ? 'Submitting…' : 'Post invoice'}
                  </button>
                )}
              </div>
            )}
            <Notice notice={notice} />

            <section className="sm-section" aria-labelledby="sm-grn-lines">
              <h2 id="sm-grn-lines">Lines ({data.items.length})</h2>
              <ul className="sm-list">
                {data.items.map((item) => (
                  <li key={item.id} className="sm-card">
                    <strong className="sm-title">{item.materialName}</strong>
                    <span className="sm-meta">
                      {item.materialCode ?? '—'} · {item.uom ?? ''}
                      {!item.stocked && ' · not stocked'}
                    </span>
                    <div className="sm-grid-2 sm-meta">
                      <span>Ordered {formatQty(item.orderedQty)}</span>
                      <span>Received {formatQty(item.receivedQty)}</span>
                      <span>Accepted {formatQty(item.acceptedQty)}</span>
                      <span>Rejected {formatQty(item.rejectedQty)}</span>
                      <span>Damaged {formatQty(item.damagedQty)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {justPosted && (
              <div className="sm-actions">
                <button type="button" className="sm-btn sm-btn--primary" onClick={() => go('receive/history')}>
                  View GRN history
                </button>
                <div className="sm-grid-2">
                  <button type="button" className="sm-btn" onClick={() => go('receive/scan')}>
                    Scan next invoice
                  </button>
                  <button type="button" className="sm-btn" onClick={() => go('receive', { replace: true })}>
                    Done
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default GrnDetailScreen;
