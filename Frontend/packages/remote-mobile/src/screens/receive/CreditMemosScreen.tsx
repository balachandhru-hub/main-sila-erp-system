import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCreditMemos } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const CreditMemosScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const preset = params.get('status') ?? '';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(preset);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => getCreditMemos(query, status, { index: 0, limit: 50 }),
    `credit-memos-${query}-${status}`,
  );

  return (
    <>
      <ScreenHeader title="Credit memos" eyebrow="Receive" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search credit memos"
          placeholder="Credit memo, invoice, supplier, PO or SAP"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="sm-input" aria-label="Credit memo status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="FAILED">Posting failed</option>
          <option value="POSTED">Posted</option>
        </select>
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && (data ?? []).length === 0 && <Empty text="No credit memos match these filters." />}
        <ul className="sm-list">
          {(data ?? []).map((row) => (
            <li key={row.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`receive/credit-memos/${row.id}`)}>
                <span className="sm-row">
                  <strong>{row.creditMemoNumber || 'Credit memo'}</strong>
                  <StatusBadge status={row.status} />
                </span>
                <span className="sm-meta">
                  {row.referenceSupplierInvoiceNumber || 'Invoice'} · {row.supplierName || 'Supplier'}
                </span>
                <span className="sm-meta">
                  {formatDate(row.createdOn)} · {row.grossAmount ?? '—'} {row.currency || ''}
                </span>
                {row.erpReference ? <span className="sm-meta">SAP {row.erpReference}{row.fiscalYear ? ` / ${row.fiscalYear}` : ''}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default CreditMemosScreen;
