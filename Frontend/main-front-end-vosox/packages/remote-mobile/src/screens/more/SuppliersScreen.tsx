import React, { useEffect, useState } from 'react';
import { getSuppliers } from '../../../../remote-buyer/src/api/silaMe/silaMasterDataApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

/** Supplier Master, searched by name, supplier ID or TRN. An empty search lists the first page. */
const SuppliersScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, loading, error, reload } = useLoad(
    () => getSuppliers(query, '', { index: 0, limit: 50 }),
    `suppliers-${query}`,
  );

  return (
    <>
      <ScreenHeader title="Suppliers" eyebrow="More" back />
      <div className="sm-screen">
        <input
          className="sm-input"
          type="search"
          aria-label="Search suppliers"
          placeholder="Supplier name, ID, or TRN"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && (data ?? []).length === 0 && <Empty text="No suppliers matched." />}
        {!loading && (
          <ul className="sm-list">
            {(data ?? []).map((supplier) => (
              <li key={supplier.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`more/suppliers/${supplier.id}`)}>
                  <strong>{supplier.name}</strong>
                  <span className="sm-meta">
                    {supplier.supplierCode}
                    {supplier.taxNumber ? ` · TRN ${supplier.taxNumber}` : ''}
                    {supplier.country ? ` · ${supplier.country}` : ''}
                  </span>
                  <StatusBadge status={supplier.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

export default SuppliersScreen;
