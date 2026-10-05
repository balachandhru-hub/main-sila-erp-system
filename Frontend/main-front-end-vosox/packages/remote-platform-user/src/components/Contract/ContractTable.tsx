import React, { useMemo, useState } from 'react';
import { FaSearch, FaPaperclip } from 'react-icons/fa';
import { EmptyState, KpiCard, Pagination } from '@vosox/shared-ui';
import type { ContractRecord } from './contractApi';
import { formatContractAmount, formatContractDate } from './contractApi';
import './ContractTable.css';

interface ContractTableProps {
  records: ContractRecord[];
  loading: boolean;
  error: string | null;
  onRowClick: (record: ContractRecord) => void;
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasNextPage: boolean;
}

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const ContractTable: React.FC<ContractTableProps> = ({
  records,
  loading,
  error,
  onRowClick,
  page,
  onPreviousPage,
  onNextPage,
  hasNextPage,
}) => {
  const [search, setSearch] = useState('');

  const counts = useMemo(
    () => ({
      total: records.length,
      totalValue: records.reduce((sum, r) => sum + (r.amount || 0), 0),
      withAttachments: records.filter((r) => (r.attachments?.length || 0) > 0).length,
    }),
    [records]
  );

  const query = search.trim().toLowerCase();
  const visible = records.filter(
    (r) =>
      !query ||
      r.contractNumber?.toLowerCase().includes(query) ||
      r.contractName?.toLowerCase().includes(query) ||
      r.rfqNumber?.toLowerCase().includes(query) ||
      r.rfqTitle?.toLowerCase().includes(query)
  );

  return (
    <div className="bad-table ctr-panel">
      <div className="ctr-stack">
        <div className="ctr-header">
          <div>
            <h1 className="bad-title ctr-title">Contracts</h1>
            <div className="bad-subtitle ctr-subtitle">
              Contracts your organization has issued to suppliers.
            </div>
          </div>
        </div>

        {!loading && !(error && records.length === 0) && records.length > 0 && (
          <>
            <div className="ctr-kpi-grid">
              <KpiCard label="Contracts on this page" value={counts.total} />
              <KpiCard label="Total value on this page" value={formatContractAmount(counts.totalValue)} />
              <KpiCard label="With attachments" value={counts.withAttachments} />
            </div>

            <div className="ctr-toolbar" role="search">
              <div className="ctr-search sila-search">
                <FaSearch className="sila-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="sila-input"
                  placeholder="Search by contract no., name or RFQ"
                  aria-label="Search contracts"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="ctr-state">
            <div className="bad-spinner sila-spinner sila-spinner--md" />
            <span>Loading contracts...</span>
          </div>
        ) : error && records.length === 0 ? (
          <EmptyState variant="error" title={error} />
        ) : records.length === 0 ? (
          <EmptyState title="No contracts found." />
        ) : visible.length === 0 ? (
          <EmptyState title="No contracts match your search." />
        ) : (
          <>
            <div className="bad-rfq-table-container sila-table-wrap ctr-table-wrap">
              <table className="bad-rfq-items-table sila-table ctr-table">
                <thead>
                  <tr>
                    <th className="ctr-col-sno sila-num">S.No</th>
                    <th>Contract No.</th>
                    <th>Contract Name</th>
                    <th>RFQ</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th className="sila-num">Amount</th>
                    <th className="sila-num">Attachments</th>
                    <th><span className="sila-visually-hidden">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record, idx) => (
                    <tr
                      key={record.id}
                      className="sila-row-clickable"
                      tabIndex={0}
                      onClick={() => onRowClick(record)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onRowClick(record); }}
                    >
                      <td className="ctr-sno sila-num">{idx + 1}</td>
                      <td><span className="bad-code-badge sila-ref">{record.contractNumber}</span></td>
                      <td className="ctr-title-cell">{record.contractName}</td>
                      <td className="ctr-rfq-cell">
                        <span className="bad-code-badge sila-ref">{record.rfqNumber}</span>
                        <span className="ctr-rfq-title">{record.rfqTitle}</span>
                      </td>
                      <td className="ctr-date">{formatContractDate(record.startDate)}</td>
                      <td className="ctr-date">{formatContractDate(record.endDate)}</td>
                      <td className="ctr-amount sila-num">{formatContractAmount(record.amount)}</td>
                      <td className="ctr-attachments sila-num">
                        {record.attachments?.length ? (
                          <span className="ctr-attachment-count">
                            <FaPaperclip aria-hidden="true" /> {record.attachments.length}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="ctr-cell-chevron"><IconChevronRight /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              onPrevious={onPreviousPage}
              onNext={onNextPage}
              hasNext={hasNextPage}
              disabled={loading}
              summary={`Page ${page}`}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default ContractTable;
