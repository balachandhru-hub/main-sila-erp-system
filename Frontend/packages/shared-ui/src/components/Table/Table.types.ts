import type React from 'react';
import type { PaginationProps } from '../Pagination';

export interface TableColumnContext<TRow, TValue> {
  row: TRow;
  rowIndex: number;
  value: TValue;
}

export interface TableColumn<TRow, TValue = unknown> {
  /** Unique column key, used as the React key. Required when there is no accessorKey (e.g. actions/expand-only columns). */
  id: string;
  header: React.ReactNode;
  /** Optional data accessor; omit for columns with no direct field (actions, expand-only). */
  accessorKey?: keyof TRow;
  /** Custom cell renderer. When omitted, the resolved `value` is rendered directly. */
  cell?: (ctx: TableColumnContext<TRow, TValue>) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
  headerClassName?: string;
}

export interface TableExpandableConfig<TRow> {
  /** Renders the content shown under an expanded row; may itself render another <Table />. */
  renderExpandedRow: (row: TRow, rowIndex: number) => React.ReactNode;
  /** Return false to hide the expand toggle for a row with nothing to show. */
  isRowExpandable?: (row: TRow) => boolean;
  /** Controlled mode: pass both expandedRowIds and onExpandedRowsChange. Omit both for uncontrolled internal state. */
  expandedRowIds?: Set<string>;
  onExpandedRowsChange?: (expandedRowIds: Set<string>) => void;
  /** Initial expanded rows when uncontrolled. */
  defaultExpandedRowIds?: Set<string>;
}

export interface TableSelectionConfig<TRow> {
  selectedRowIds: Set<string>;
  onSelectionChange: (selectedRowIds: Set<string>) => void;
  /** Return false to disable selection for a specific row. */
  isRowSelectable?: (row: TRow) => boolean;
}

export interface TablePaginationConfig extends PaginationProps {
  /** Rows per page; combined with totalItems to auto-compute a "Showing X-Y of Z" summary and serial numbers. */
  pageSize?: number;
  totalItems?: number;
}

export interface TableEmptyStateConfig {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional action (e.g. a button) shown under the empty-state message. */
  action?: React.ReactNode;
}

export interface TableProps<TRow> {
  columns: TableColumn<TRow>[];
  data: TRow[];
  /** Stable row identity used for expand/selection state; defaults to the row's index. */
  getRowId?: (row: TRow, index: number) => string;

  loading?: boolean;
  /** Number of skeleton rows to show while loading. Default 5. */
  loadingRows?: number;
  /** Screen-reader label announced while loading. Defaults to TableSkeleton's own default. */
  loadingLabel?: string;
  /** When set, renders an error EmptyState in the table body (header and footer stay visible). */
  error?: React.ReactNode;
  /** Optional supporting text shown below `error` (e.g. the raw error message under a friendly title). */
  errorDescription?: React.ReactNode;
  /** Optional action (e.g. a Retry button) shown under the error message. */
  errorAction?: React.ReactNode;
  emptyState?: TableEmptyStateConfig;
  /** @deprecated No effect: the column headers are now always visible; loading, error and empty states render in the body. */
  alwaysShowHeader?: boolean;

  /** Content rendered inside the container above the table (search, filters, etc.); stays visible while loading, empty or on error. */
  headerComponent?: React.ReactNode;

  onRowClick?: (row: TRow, rowIndex: number) => void;
  rowClassName?: string | ((row: TRow, rowIndex: number) => string);

  expandable?: TableExpandableConfig<TRow>;
  selection?: TableSelectionConfig<TRow>;
  pagination?: TablePaginationConfig;

  /** Applied to the outer container (wraps the table and, when present, its Pagination). Pass "sila-table--nested" when rendering inside another Table's expanded row. */
  className?: string;
  /** Applied to the scrollable wrapper around just the <table> element (not the Pagination below it). */
  wrapClassName?: string;
  ariaLabel?: string;
  /** Draws a bordered, rounded card around the table (header bar, rows and pagination). */
  bordered?: boolean;
}
