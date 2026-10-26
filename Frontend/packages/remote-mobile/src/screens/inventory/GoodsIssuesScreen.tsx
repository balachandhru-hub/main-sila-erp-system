import React, { useState } from 'react';
import { getGoodsIssues } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const GoodsIssuesScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(() => getGoodsIssues(), 'goods-issues');
  const [search, setSearch] = useState('');
  const text = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (row) => !text || `${row.issueNumber} ${row.fromLocationName ?? ''} ${row.toLocationName ?? ''}`.toLowerCase().includes(text),
  );

  return (
    <>
      <ScreenHeader title="Goods issue" eyebrow="Inventory" back intro="Stock issued from a store to an outlet." />
      <div className="sm-screen">
        {can.postGoodsIssue && (
          <button type="button" className="sm-btn sm-btn--primary sm-btn--block" onClick={() => go('inventory/goods-issues/new')}>
            New goods issue
          </button>
        )}
        <input
          className="sm-input"
          type="search"
          aria-label="Filter goods issues"
          placeholder="Issue number, store, outlet…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && rows.length === 0 && <Empty text="No goods issues." />}
        <ul className="sm-list">
          {rows.map((issue) => (
            <li key={issue.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`inventory/goods-issues/${issue.id}`)}>
                <span className="sm-row">
                  <strong>{issue.issueNumber}</strong>
                  <span className="sm-meta">{formatDate(issue.issuedOn)}</span>
                </span>
                <span>
                  {issue.fromLocationName ?? '—'} → {issue.toLocationName ?? '—'}
                </span>
                <span className="sm-meta">
                  {issue.lineCount} material{issue.lineCount === 1 ? '' : 's'}
                  {issue.bucketCode ? ` · bucket ${issue.bucketCode}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default GoodsIssuesScreen;
