import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getGoodsReceipt } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDateTime } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import GrnErpCard from './GrnErpCard';

/** A goods receipt; right after posting it is the result screen. */
const GrnDetailScreen: React.FC = () => {
  const { grnId = '' } = useParams();
  const [params] = useSearchParams();
  const justPosted = params.get('posted') === '1';
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getGoodsReceipt(grnId), grnId || null);

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
