import React, { useEffect, useState } from 'react';
import { getInvoices } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const PostedInvoicesScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => getInvoices(query, 'POSTED', { index: 0, limit: 50 }),
    `posted-invoices-${query}`,
  );

  return (
    <>
      <ScreenHeader title="Posted Invoices" eyebrow="Receive" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search posted invoices"
          placeholder="Invoice number, supplier, PO or SAP invoice"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && (data ?? []).length === 0 && <Empty text="No posted invoices match these filters." />}
        <ul className="sm-list">
          {(data ?? []).map((invoice) => (
            <li key={invoice.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`receive/invoices/${invoice.id}`)}>
                <span className="sm-row">
                  <strong>{invoice.invoiceNumber || invoice.fileName}</strong>
                  <StatusBadge status={invoice.status} />
                </span>
                <span className="sm-meta">
                  {invoice.supplierName || 'Supplier'} · PO {invoice.poNumber || '—'}
                </span>
                <span className="sm-meta">
                  {formatDate(invoice.invoiceDate)} · {invoice.grossAmount ?? '—'} {invoice.currency || ''}
                </span>
                {invoice.erpReference ? <span className="sm-meta">SAP {invoice.erpReference}{invoice.fiscalYear ? ` / ${invoice.fiscalYear}` : ''}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default PostedInvoicesScreen;
