import React, { useMemo, useState } from 'react';
import { FaSearch, FaPaperclip } from 'react-icons/fa';
import { Button, KpiCard, StatusBadge, Table } from '@vosox/shared-ui';
import type { TableColumn } from '@vosox/shared-ui';
import type { ContractRecord } from './contractApi';
import { formatContractAmount, formatContractDate } from './contractApi';
import './ContractTable.css';

/** Purchase order actions of the Buyer Admin contract page. Without them the table is the approvals list. */
export interface ContractPurchaseOrderActions {
  /** Id of the contract whose purchase order is being created, while a create request is running. */
  creatingId: string | null;
  onCreate: (record: ContractRecord) => void;
}

interface ContractTableProps {
  records: ContractRecord[];
  loading: boolean;
  error: string | null;
  onRowClick: (record: ContractRecord) => void;
  page: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  hasNextPage: boolean;
  /** Adds supplier, purchase order figures and the Create Purchase Order action. */
  purchaseOrders?: ContractPurchaseOrderActions;
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
  purchaseOrders,
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
      r.rfqTitle?.toLowerCase().includes(query) ||
      (!!purchaseOrders && !!r.supplierName?.toLowerCase().includes(query))
  );

  const approvalColumns: TableColumn<ContractRecord>[] = [
    {
      id: 'sno',
      header: 'S.No',
      headerClassName: 'ctr-col-sno',
      align: 'right',
      className: 'ctr-sno',
      cell: ({ rowIndex }) => (page - 1) * 10 + rowIndex + 1,
    },
    {
      id: 'contractNumber',
      header: 'Contract No.',
      cell: ({ row }) => <span className="bad-code-badge sila-ref">{row.contractNumber}</span>,
    },
    { id: 'contractName', header: 'Contract Name', accessorKey: 'contractName', className: 'ctr-title-cell' },
    {
      id: 'rfq',
      header: 'RFQ',
      className: 'ctr-rfq-cell',
      cell: ({ row }) => (
        <>
          <span className="bad-code-badge sila-ref">{row.rfqNumber}</span>
          <span className="ctr-rfq-title">{row.rfqTitle}</span>
        </>
      ),
    },
    {
      id: 'startDate',
      header: 'Start Date',
      className: 'ctr-date',
      cell: ({ row }) => formatContractDate(row.startDate),
    },
    {
      id: 'endDate',
      header: 'End Date',
      className: 'ctr-date',
      cell: ({ row }) => formatContractDate(row.endDate),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      className: 'ctr-amount',
      cell: ({ row }) => formatContractAmount(row.amount),
    },
    {
      id: 'attachments',
      header: 'Attachments',
      align: 'right',
      className: 'ctr-attachments',
      cell: ({ row }) =>
        row.attachments?.length ? (
          <span className="ctr-attachment-count">
            <FaPaperclip aria-hidden="true" /> {row.attachments.length}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'chevron',
      header: <span className="sila-visually-hidden">Open</span>,
      className: 'ctr-cell-chevron',
      cell: () => <IconChevronRight />,
    },
  ];

  const purchaseOrderColumns: TableColumn<ContractRecord>[] = [
    approvalColumns[0],
    approvalColumns[1],
    approvalColumns[2],
    {
      id: 'supplier',
      header: 'Supplier',
      className: 'ctr-supplier-cell',
      cell: ({ row }) => row.supplierName || '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (row.status ? <StatusBadge status={row.status} size="sm" /> : '—'),
    },
    approvalColumns[6],
    {
      id: 'erpContractId',
      header: 'ERP Contract ID',
      className: 'ctr-latest-po',
      cell: ({ row }) => (
        <>
          {row.erpContractId || '—'}
          {!row.erpContractId && (row.erpSyncStatus === 'FAILED' || row.erpSyncStatus === 'UNKNOWN') && (
            <span className="ctr-po-sub">
              <StatusBadge status={row.erpSyncStatus} size="sm" />
            </span>
          )}
        </>
      ),
    },
    {
      id: 'poTotal',
      header: 'PO Total',
      align: 'right',
      className: 'ctr-amount',
      cell: ({ row }) => {
        const summary = row.purchaseOrderSummary;
        if (!summary) return '—';
        return (
          <>
            {formatContractAmount(summary.purchaseOrderTotal)}
            <span className="ctr-po-sub">
              {summary.purchaseOrderCount} {summary.purchaseOrderCount === 1 ? 'PO' : 'POs'}
            </span>
          </>
        );
      },
    },
    {
      id: 'remaining',
      header: 'Remaining',
      align: 'right',
      className: 'ctr-amount',
      cell: ({ row }) => formatContractAmount(row.purchaseOrderSummary?.remainingAmount),
    },
    {
      id: 'latestPo',
      header: 'Latest PO',
      className: 'ctr-latest-po',
      cell: ({ row }) => {
        const latest = row.purchaseOrderSummary?.latestPurchaseOrder;
        if (!latest) return '—';
        return (
          <>
            <span className="sila-ref">{latest.poNumber}</span>
            <span className="ctr-po-sub">
              <StatusBadge status={latest.erpSyncStatus} size="sm" />
            </span>
          </>
        );
      },
    },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => {
        const creating = purchaseOrders?.creatingId === row.id;
        const busy = !!purchaseOrders && purchaseOrders.creatingId !== null;
        return (
          // The row opens the detail on click; this cell must not.
          // Always available: when the contract cannot take a purchase order the backend says why, and it is shown as a message.
          <div className="ctr-po-action" onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              variant="primary"
              loading={creating}
              disabled={busy && !creating}
              onClick={() => purchaseOrders?.onCreate(row)}
            >
              Create Purchase Order
            </Button>
          </div>
        );
      },
    },
    approvalColumns[approvalColumns.length - 1],
  ];

  const columns = purchaseOrders ? purchaseOrderColumns : approvalColumns;

  return (
    <div className="bad-table ctr-panel">
      <div className="ctr-stack">
        <div className="ctr-header">
          <div>
            <h1 className="bad-title ctr-title">Contracts</h1>
            <div className="bad-subtitle ctr-subtitle">
              {purchaseOrders
                ? 'Approved contracts your organization has issued to suppliers. Create purchase orders against them.'
                : 'Contracts your organization has issued to suppliers.'}
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
          </>
        )}

        <Table<ContractRecord>
          headerComponent={
            records.length > 0 ? (
              <div className="ctr-search sila-search" role="search">
                <FaSearch className="sila-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  className="sila-input"
                  placeholder={purchaseOrders ? 'Search by contract no., name, supplier or RFQ' : 'Search by contract no., name or RFQ'}
                  aria-label="Search contracts"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            ) : undefined
          }
          columns={columns}
          data={visible}
          getRowId={(record) => record.id}
          loading={loading}
          loadingLabel="Loading contracts…"
          error={error && records.length === 0 ? error : undefined}
          emptyState={{ title: records.length === 0 ? 'No contracts found.' : 'No contracts match your search.' }}
          onRowClick={onRowClick}
          className="ctr-table"
          pagination={{
            page,
            hasNext: hasNextPage,
            onPrevious: onPreviousPage,
            onNext: onNextPage,
            disabled: loading,
            summary: `Page ${page}`,
          }}
        />
      </div>
    </div>
  );
};

export default ContractTable;
