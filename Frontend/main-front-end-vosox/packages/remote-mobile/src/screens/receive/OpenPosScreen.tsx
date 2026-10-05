import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOpenPurchaseOrders, type SilaOpenPurchaseOrder } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate, formatMoney } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const PAGE = 30;

/** Open purchase orders, searched by PO number or supplier; with ?mode=receive a PO opens the goods receipt directly. */
const OpenPosScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const receiving = params.get('mode') === 'receive';
  const [search, setSearch] = useState<string>(() => params.get('search') ?? '');
  const [query, setQuery] = useState<string>(() => (params.get('search') ?? '').trim());

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useLoad<SilaOpenPurchaseOrder[]>(
    () => getOpenPurchaseOrders(query, { index: 0, limit: PAGE }),
    `pos-${query}`,
  );

  return (
    <>
      <ScreenHeader
        title={receiving ? 'Receive against PO' : 'Open purchase orders'}
        eyebrow="Receive"
        back
        intro={receiving ? 'Select the open purchase order of the delivery; no invoice scan is needed first.' : undefined}
      />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search PO number or supplier"
          placeholder="Search PO number or supplier"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && (data ?? []).length === 0 && <Empty text="No open purchase orders found." />}
        {!loading && (
          <ul className="sm-list">
            {(data ?? []).map((order) => (
              <li key={order.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(receiving ? `receive/grn/new?poId=${encodeURIComponent(order.id)}` : `receive/pos/${order.id}`)}>
                  <span className="sm-row">
                    <strong>{order.poNumber}</strong>
                    <StatusBadge status={order.status} />
                  </span>
                  <span>{order.supplierName ?? '—'}</span>
                  <span className="sm-meta">
                    {formatDate(order.orderDate)} · {formatMoney(order.totalAmount, order.currency)} · {order.openLineCount} open item
                    {order.openLineCount === 1 ? '' : 's'} of {order.lineCount}
                    {order.plantCode ? ` · Plant ${order.plantCode}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default OpenPosScreen;
