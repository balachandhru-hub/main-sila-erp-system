import React, { useEffect, useState } from 'react';
import { getSuppliers, type SilaSupplier } from '../../../../remote-buyer/src/api/silaMe/silaMasterDataApi';
import {
  getGoodsReceipts,
  getOpenPurchaseOrders,
  type SilaGoodsReceipt,
  type SilaOpenPurchaseOrder,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, Loading } from '../../components/StateViews';
import { formatDate, todayIso } from '../../format';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import { daysAgoIso, grnErpStatus } from '../receive/grnStatus';

const MIN_SEARCH = 2;
const PAGE = { index: 0, limit: 10 };

interface Results {
  suppliers: SilaSupplier[];
  orders: SilaOpenPurchaseOrder[];
  grns: SilaGoodsReceipt[];
  /** Searches that failed, by group. */
  errors: string[];
}

const EMPTY: Results = { suppliers: [], orders: [], grns: [], errors: [] };

/** Settles one search: its rows, or an error line for the group. */
const settle = async <T,>(group: string, request: Promise<T[]>, errors: string[]): Promise<T[]> => {
  try {
    return await request;
  } catch (caught: unknown) {
    errors.push(`${group}: ${errorText(caught)}`);
    return [];
  }
};

/** Global search: suppliers, open purchase orders and goods receipts (last year) in one list. */
const SearchScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState<string>('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState<boolean>(false);
  const text = search.trim();

  useEffect(() => {
    if (text.length < MIN_SEARCH) {
      setResults(EMPTY);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const errors: string[] = [];
      const [suppliers, orders, grns] = await Promise.all([
        settle('Suppliers', getSuppliers(text, '', PAGE), errors),
        settle('Purchase orders', getOpenPurchaseOrders(text, PAGE), errors),
        settle('GRNs', getGoodsReceipts({ search: text, fromDate: daysAgoIso(365), toDate: todayIso() }, PAGE), errors),
      ]);
      if (!active) return;
      setResults({ suppliers, orders, grns, errors });
      setLoading(false);
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [text]);

  const none = !loading && text.length >= MIN_SEARCH && results.errors.length === 0
    && results.suppliers.length + results.orders.length + results.grns.length === 0;

  return (
    <>
      <ScreenHeader title="Search" eyebrow="SILA ME" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search suppliers, POs, GRNs"
          placeholder="Suppliers, POs, GRNs"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {text.length < MIN_SEARCH && <p className="sm-muted">Type at least 2 characters.</p>}
        {loading && <Loading text="Searching…" />}
        {results.errors.map((message) => (
          <p key={message} className="sm-notice sm-notice--error" role="alert">
            {message}
          </p>
        ))}
        {none && <Empty text="No matches." description="Materials are searched in Inventory › Live stock." />}

        {!loading && results.suppliers.length > 0 && (
          <section className="sm-section" aria-labelledby="sm-search-suppliers">
            <h2 id="sm-search-suppliers">Suppliers</h2>
            <ul className="sm-list">
              {results.suppliers.map((supplier) => (
                <li key={supplier.id}>
                  <button type="button" className="sm-list-btn" onClick={() => go(`more/suppliers/${supplier.id}`)}>
                    <strong>{supplier.name}</strong>
                    <span className="sm-meta">{supplier.supplierCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && results.orders.length > 0 && (
          <section className="sm-section" aria-labelledby="sm-search-pos">
            <h2 id="sm-search-pos">Purchase orders</h2>
            <ul className="sm-list">
              {results.orders.map((order) => (
                <li key={order.id}>
                  <button type="button" className="sm-list-btn" onClick={() => go(`receive/pos/${order.id}`)}>
                    <strong>{order.poNumber}</strong>
                    <span className="sm-meta">{order.supplierName ?? '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!loading && results.grns.length > 0 && (
          <section className="sm-section" aria-labelledby="sm-search-grns">
            <h2 id="sm-search-grns">GRNs</h2>
            <ul className="sm-list">
              {results.grns.map((grn) => (
                <li key={grn.id}>
                  <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                    <span className="sm-row">
                      <strong>{grn.grnNumber}</strong>
                      <StatusBadge status={grnErpStatus(grn)} />
                    </span>
                    <span className="sm-meta">
                      {grn.supplierName ?? '—'} · PO {grn.poNumber} · {formatDate(grn.receivedOn)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
};

export default SearchScreen;
