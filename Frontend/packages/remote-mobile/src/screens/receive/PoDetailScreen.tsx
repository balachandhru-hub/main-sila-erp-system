import React from 'react';
import { useParams } from 'react-router-dom';
import { getPurchaseOrder } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate, formatMoney } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const PoDetailScreen: React.FC = () => {
  const { poId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getPurchaseOrder(poId), poId || null);
  const openLines = (data?.lines ?? []).filter((line) => line.openQty > 0);
  // Prototype "SERVICE PO": no line is a stocked material, so there is nothing to put in a store.
  const serviceOnly = (data?.lines ?? []).length > 0 && (data?.lines ?? []).every((line) => !line.materialId);

  return (
    <>
      <ScreenHeader title={data?.poNumber ?? 'Purchase order'} eyebrow="Purchase order" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && !data && <Empty text="Purchase order not found." />}
        {data && (
          <>
            <Card title={data.supplierName ?? '—'} aside={<StatusBadge status={data.status} />}>
              <p className="sm-meta">
                Company {data.companyCode ?? '—'}
                {data.plantCode ? ` · Plant ${data.plantCode}` : ''}
              </p>
              <p className="sm-meta">
                Date {formatDate(data.orderDate)} · {data.currency ?? '—'} · Total {formatMoney(data.totalAmount, data.currency)}
              </p>
            </Card>
            {serviceOnly && <Empty text="SERVICE PO" description="None of its lines is a stocked material; it is not received into a store." />}
            <section className="sm-section" aria-labelledby="sm-po-lines">
              <h2 id="sm-po-lines">Items ({data.lines.length})</h2>
              <ul className="sm-list">
                {data.lines.map((line) => (
                  <li key={line.id} className="sm-card">
                    <strong className="sm-title">
                      {line.lineNumber} · {line.materialCode ?? 'No material code'}
                    </strong>
                    <span className="sm-meta">{line.productName}</span>
                    <span className="sm-meta">
                      Ordered {formatQty(line.orderedQty)} · Received {formatQty(line.receivedQty)} · Open {formatQty(line.openQty)} {line.uom ?? ''}
                    </span>
                    <span className="sm-meta">
                      {line.unitPrice !== null && line.unitPrice !== undefined ? `Unit ${formatMoney(line.unitPrice, data.currency)} · ` : ''}
                      {line.materialId ? 'Stocked material' : 'Not stocked'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <button
              type="button"
              className="sm-btn sm-btn--primary sm-btn--block"
              disabled={openLines.length === 0}
              onClick={() => go(`receive/grn/new?poId=${encodeURIComponent(data.id)}`)}
            >
              {openLines.length === 0 ? 'Fully received' : 'Receive goods'}
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default PoDetailScreen;
