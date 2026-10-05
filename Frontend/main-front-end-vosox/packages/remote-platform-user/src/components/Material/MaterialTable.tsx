import React, { useEffect, useState } from 'react';
import type { PendingMaterialApproval, MaterialApprovalKpi, MaterialUploadType } from './materialApi';
import {
  classifyStatusText,
  fetchMaterialApprovalKpi,
  fetchPendingMaterialApprovals,
  formatMaterialStatus,
  MATERIAL_STATUS_FILTER_OPTIONS,
} from './materialApi';
import readXlsxFile from 'read-excel-file/browser';
import type { Sheet } from 'read-excel-file/browser';
import { ExcelSheetGrid, loadMaterialAssetFile, saveLoadedAssetFile } from './MaterialAssetFile';
import { toastService } from '@vosox/shared-ui';
import { Dropdown, KpiCard, Modal, StatusBadge, Table } from '@vosox/shared-ui';
import type { DropdownOption, DropdownValue, TableColumn } from '@vosox/shared-ui';
import './MaterialApproval.css';

const STATUS_DROPDOWN_OPTIONS: DropdownOption[] = MATERIAL_STATUS_FILTER_OPTIONS.map((opt) => ({
  name: opt.label,
  value: opt.value,
}));

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const IconX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconStack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
);

const IconClock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconXCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

interface MaterialTableProps {
  onRowClick: (record: PendingMaterialApproval) => void;
}

interface PreviewFile {
  fileName: string;
  /** Blob URL shown in an iframe for PDF/image/text files. Empty for Excel workbooks. */
  url: string;
  /** Parsed workbook for .xlsx files, shown as a spreadsheet grid. */
  sheets: Sheet[];
  isPreviewable: boolean;
}

const PAGE_SIZE = 10;

const MATERIAL_TABS: { type: MaterialUploadType; label: string }[] = [
  { type: 'MANUAL', label: 'Single Material Approval' },
  { type: 'EXCEL', label: 'Bulk Material Approval' },
];

const TONE_BY_STATUS = {
  approved: 'success',
  rejected: 'danger',
  pending: 'warning',
  neutral: 'neutral',
} as const;

/** Status code from the API shown as a readable, colour-coded badge (APPROVE → Approved). */
export const MaterialStatusBadge: React.FC<{ value: string }> = ({ value }) => (
  <StatusBadge
    status={value || '—'}
    label={formatMaterialStatus(value)}
    tone={TONE_BY_STATUS[classifyStatusText(value)]}
    size="sm"
    dot
  />
);

// The table remounts when a detail view is closed; remembering the tab here brings the user back to it.
let lastMaterialType: MaterialUploadType = 'MANUAL';

const MaterialTable: React.FC<MaterialTableProps> = ({ onRowClick }) => {
  const [materialType, setMaterialType] = useState<MaterialUploadType>(lastMaterialType);
  const pageSize = PAGE_SIZE;
  const [records, setRecords] = useState<PendingMaterialApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<MaterialApprovalKpi | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  // searchTerm is the debounced value that drives the API call.
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const isBulk = materialType === 'EXCEL';
  const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null);
  const [previewingAssetId, setPreviewingAssetId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Any filter change starts again from the first page.
  useEffect(() => {
    setPage(1);
  }, [materialType, statusFilter, searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPendingMaterialApprovals({
      type: materialType,
      status: statusFilter,
      searchTerm,
      index: (page - 1) * pageSize,
      limit: pageSize,
    })
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load material approvals.');
        setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [materialType, statusFilter, searchTerm, page, pageSize]);

  // Loaded once so tab/search/status changes don't refetch KPI.
  useEffect(() => {
    setLoadingKpi(true);
    fetchMaterialApprovalKpi()
      .then(setKpi)
      .catch((err: Error) => toastService.error(err.message || 'Failed to load approval summary counts.'))
      .finally(() => setLoadingKpi(false));
  }, []);

  const handleDownload = async (record: PendingMaterialApproval) => {
    if (!record.asset) return;
    setDownloadingAssetId(record.asset.id);
    const file = await loadMaterialAssetFile(record.asset, 'Unable to download document.');
    setDownloadingAssetId(null);
    if (file) saveLoadedAssetFile(file);
  };

  const handlePreview = async (record: PendingMaterialApproval) => {
    if (!record.asset) return;
    setPreviewingAssetId(record.asset.id);
    const file = await loadMaterialAssetFile(record.asset, 'Unable to preview document.');
    setPreviewingAssetId(null);
    if (!file) return;
    if (/\.xlsx$/i.test(file.fileName)) {
      URL.revokeObjectURL(file.url);
      try {
        const sheets = await readXlsxFile(file.blob);
        setPreviewFile({ fileName: file.fileName, url: '', sheets, isPreviewable: true });
      } catch {
        toastService.error('Unable to read the Excel file for preview.');
      }
      return;
    }
    // Browsers render PDFs, images and text inline; other Office files can only be downloaded.
    const isPreviewable = /^(application\/pdf|image\/|text\/)/.test(file.mime);
    setPreviewFile({ fileName: file.fileName, url: file.url, sheets: [], isPreviewable });
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const showError = Boolean(error) && records.length === 0;
  const matchedStatusOption = STATUS_DROPDOWN_OPTIONS.find((opt) => opt.value === statusFilter);
  const selectedStatusOption: DropdownValue | null = matchedStatusOption
    ? { name: matchedStatusOption.name, value: matchedStatusOption.value ?? matchedStatusOption.name }
    : null;
  // The API has no total count; a full page means there's likely another one.
  const hasNextPage = records.length === pageSize;

  const snoColumn: TableColumn<PendingMaterialApproval> = {
    id: 'sno',
    header: 'S.No',
    headerClassName: 'matap-col-sno',
    align: 'right',
    className: 'matap-cell-sno',
    cell: ({ rowIndex }) => (page - 1) * pageSize + rowIndex + 1,
  };
  const orderColumn: TableColumn<PendingMaterialApproval> = {
    id: 'order',
    header: 'Order',
    align: 'right',
    cell: ({ row }) => <span className="matap-order-chip">{row.order}</span>,
  };
  const approvalStatusColumn: TableColumn<PendingMaterialApproval> = {
    id: 'approvalStatus',
    header: 'Approval Status',
    cell: ({ row }) => <MaterialStatusBadge value={row.approvalStatus} />,
  };
  const statusColumn: TableColumn<PendingMaterialApproval> = {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <MaterialStatusBadge value={row.status} />,
  };

  const bulkColumns: TableColumn<PendingMaterialApproval>[] = [
    snoColumn,
    { ...orderColumn, width: '5rem' },
    // No width on Title so it takes the remaining space.
    { id: 'title', header: 'Title', accessorKey: 'title', className: 'matap-cell-strong' },
    { ...approvalStatusColumn, width: '11rem' },
    { ...statusColumn, width: '10rem' },
    {
      id: 'actions',
      header: 'Actions',
      width: '8rem',
      cell: ({ row }) => (
        <div className="matap-row-actions">
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
            disabled={!row.asset || previewingAssetId === row.asset.id}
            aria-label={`Preview ${row.asset?.fileName ?? row.title ?? 'file'}`}
            title="Preview"
            onClick={(e) => {
              e.stopPropagation();
              void handlePreview(row);
            }}
          >
            {previewingAssetId === row.asset?.id ? <span className="sila-spinner" aria-hidden="true" /> : <IconEye />}
          </button>
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
            disabled={!row.asset || downloadingAssetId === row.asset.id}
            aria-label={`Download ${row.asset?.fileName ?? row.title ?? 'file'}`}
            title="Download"
            onClick={(e) => {
              e.stopPropagation();
              void handleDownload(row);
            }}
          >
            {downloadingAssetId === row.asset?.id ? <span className="sila-spinner" aria-hidden="true" /> : <IconDownload />}
          </button>
        </div>
      ),
    },
  ];

  const singleColumns: TableColumn<PendingMaterialApproval>[] = [
    snoColumn,
    { ...orderColumn, width: '5rem' },
    {
      id: 'materialCode',
      header: 'Material Code',
      width: '10rem',
      cell: ({ row }) => <span className="sila-ref matap-code">{row.materialCode}</span>,
    },
    {
      // No width on Description so it takes the remaining space.
      id: 'description',
      header: 'Description',
      accessorKey: 'description',
      className: 'matap-cell-strong',
    },
    {
      id: 'productType',
      header: 'Product Type',
      width: '11rem',
      accessorKey: 'productType',
      className: 'matap-cell-muted',
    },
    {
      id: 'materialGroup',
      header: 'Material Group',
      width: '11rem',
      accessorKey: 'materialGroup',
      className: 'matap-cell-muted',
    },
    { ...approvalStatusColumn, width: '11rem' },
    { ...statusColumn, width: '9rem' },
    {
      id: 'chevron',
      width: '3rem',
      header: <span className="sila-visually-hidden">Open</span>,
      className: 'matap-cell-chevron',
      cell: () => <IconChevronRight />,
    },
  ];

  const columns = isBulk ? bulkColumns : singleColumns;

  return (
    <div className="matap-panel">
      <div className="matap-header-row">
        <h1 className="matap-title">Material Approvals</h1>
        <p className="matap-subtitle">Material requests awaiting your approval across your organization.</p>
      </div>

      <div className="matap-kpi-grid">
        <KpiCard label="Total" value={kpi?.totalCount ?? 0} loading={loadingKpi} icon={<IconStack />} tone="primary" />
        <KpiCard
          label="Pending"
          value={kpi?.pendingCount ?? 0}
          loading={loadingKpi}
          icon={<IconClock />}
          tone={(kpi?.pendingCount ?? 0) > 0 ? 'warning' : 'neutral'}
        />
        <KpiCard label="Approved" value={kpi?.approvedCount ?? 0} loading={loadingKpi} icon={<IconCheckCircle />} tone="success" />
        <KpiCard label="Rejected" value={kpi?.rejectedCount ?? 0} loading={loadingKpi} icon={<IconXCircle />} tone="danger" />
      </div>

      <div className="matap-tabs" role="tablist" aria-label="Material approval type">
        {MATERIAL_TABS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            role="tab"
            id={`matap-tab-${type}`}
            aria-selected={materialType === type}
            aria-controls="matap-tabpanel"
            className={`matap-tab${materialType === type ? ' matap-tab--active' : ''}`}
            onClick={() => {
              lastMaterialType = type;
              setMaterialType(type);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="matap-table-card" role="tabpanel" id="matap-tabpanel" aria-labelledby={`matap-tab-${materialType}`}>
        <div className="matap-filter-bar" role="search">
          <div className="matap-search-wrap">
            <span className="matap-search-icon" aria-hidden="true"><IconSearch /></span>
            <input
              type="text"
              className="sila-input matap-search-input"
              placeholder="Search by material code or material group..."
              aria-label="Search material approvals"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearchTerm(searchInput); }}
            />
            {searchInput && (
              <button type="button" className="matap-search-clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                <IconX />
              </button>
            )}
          </div>

          <Dropdown
            className="matap-status-select"
            label="Status"
            hideLabel
            placeholder="All Status"
            options={STATUS_DROPDOWN_OPTIONS}
            value={selectedStatusOption}
            onChange={(value) => setStatusFilter(value?.value ?? '')}
          />
        </div>

        <Table<PendingMaterialApproval>
          columns={columns}
          data={records}
          getRowId={(record) => record.predefinedMaterialId}
          loading={loading}
          loadingRows={pageSize}
          loadingLabel="Loading material approvals…"
          error={showError ? error : undefined}
          alwaysShowHeader
          emptyState={{ title: 'No material approvals found.', description: 'Try a different status or search term.' }}
          onRowClick={onRowClick}
          rowClassName={(record) => (classifyStatusText(record.approvalStatus) === 'pending' ? 'matap-row-pending' : '')}
          className="matap-table"
          pagination={
            records.length > 0
              ? {
                  page,
                  hasNext: hasNextPage,
                  onPrevious: () => setPage((p) => Math.max(1, p - 1)),
                  onNext: () => setPage((p) => p + 1),
                  disabled: loading,
                  summary: `Page ${page}`,
                }
              : undefined
          }
        />
      </div>

      <Modal
        isOpen={previewFile !== null}
        onClose={closePreview}
        size="xl"
        headerProps={{ heading: previewFile?.fileName }}
        footerProps={{ secondaryButton: { text: 'Close', onClick: closePreview } }}
      >
        {previewFile && previewFile.sheets.length > 0 ? (
          <ExcelSheetGrid sheets={previewFile.sheets} />
        ) : previewFile?.isPreviewable ? (
          <iframe src={previewFile.url} title={previewFile.fileName} className="matap-preview-frame" />
        ) : (
          <p>This file type can't be previewed in the browser. Use the Download icon to open it.</p>
        )}
      </Modal>
    </div>
  );
};

export default MaterialTable;
