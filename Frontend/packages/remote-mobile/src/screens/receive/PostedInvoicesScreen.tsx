import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getInvoices } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'POSTED', label: 'Posted' },
  { value: 'ERP_POSTING_FAILED', label: 'Posting failed' },
];

const PostedInvoicesScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => getInvoices(query, status, { index: 0, limit: 50 }),
    `invoices-${query}-${status}`,
  );

  return (
    <>
      <ScreenHeader title="Invoices" eyebrow="Receive" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search invoices"
          placeholder="Invoice number, supplier, PO or SAP invoice"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="sm-input" aria-label="Invoice status" value={status} onChange={(event) => setStatus(event.target.value)}>
          {STATUSES.map((option) => (
            <option key={option.value || 'all'} value={option.value}>{option.label}</option>
          ))}
        </select>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && (data ?? []).length === 0 && <Empty text="No invoices match these filters." />}
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
