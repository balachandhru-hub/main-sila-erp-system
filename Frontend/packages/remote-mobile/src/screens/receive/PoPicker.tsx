import React, { useEffect, useState } from 'react';
import { getOpenPurchaseOrders, type SilaOpenPurchaseOrder } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatDate, formatMoney } from '../../format';
import { errorText } from '../../useLoad';

interface PoPickerProps {
  /** Only this supplier's orders are offered when set. */
  supplierId: string | null;
  initialSearch: string;
  /** PO number read by the OCR; an exact match is selected automatically. */
  ocrPoNumber: string | null;
  selectedId: string | null;
  /** `auto` is true when the OCR PO number matched exactly. */
  onSelect: (order: SilaOpenPurchaseOrder, auto?: boolean) => void;
}

const normalize = (value: string): string => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

/** Open purchase orders to link the invoice to. */
const PoPicker: React.FC<PoPickerProps> = ({ supplierId, initialSearch, ocrPoNumber, selectedId, onSelect }) => {
  const [search, setSearch] = useState<string>(initialSearch);
  const [orders, setOrders] = useState<SilaOpenPurchaseOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getOpenPurchaseOrders(search, { index: 0, limit: 50 })
        .then((found) => {
          if (!active) return;
          const mine = supplierId ? found.filter((order) => order.supplierId === supplierId) : found;
          setOrders(mine);
          if (!selectedId && ocrPoNumber) {
            const exact = mine.find((order) => normalize(order.poNumber) === normalize(ocrPoNumber));
            if (exact) onSelect(exact, true);
          }
        })
        .catch((caught: unknown) => {
          if (active) setError(errorText(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // Re-search on text or supplier change only; selection changes must not trigger a new search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, supplierId]);

  return (
    <section className="sm-section" aria-labelledby="sm-po-picker">
      <h2 id="sm-po-picker">Purchase order</h2>
      <div className="sm-field">
        <label htmlFor="sm-po-search">PO number</label>
        <input id="sm-po-search" className="sm-input" type="search" placeholder="Search open PO number" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {loading && <p className="sm-muted" role="status">Loading purchase orders…</p>}
      {error && <p className="sm-notice sm-notice--error" role="alert">{error}</p>}
      {!loading && !error && orders.length === 0 && (
        <p className="sm-empty">No eligible open purchase orders found{supplierId ? ' for this supplier' : ''}.</p>
      )}
      <ul className="sm-list">
        {orders.map((order) => (
          <li key={order.id}>
            <button
              type="button"
              className={`sm-list-btn${order.id === selectedId ? ' sm-list-btn--selected' : ''}`}
              aria-pressed={order.id === selectedId}
              onClick={() => onSelect(order)}
            >
              <span className="sm-row">
                <strong>{order.poNumber}</strong>
                <span>{formatMoney(order.totalAmount, order.currency)}</span>
              </span>
              <span className="sm-meta">
                {order.supplierName ?? '—'} · PO Date {formatDate(order.orderDate)}
                {order.plantCode ? ` · Plant ${order.plantCode}` : ''}
              </span>
              <span className="sm-meta">
                Status {order.status} · {order.openLineCount} open item{order.openLineCount === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PoPicker;
