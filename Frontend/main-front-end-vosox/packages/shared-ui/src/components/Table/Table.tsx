import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../EmptyState';
import { Pagination } from '../Pagination';
import { TableSkeleton } from '../Skeleton';
import type { TableColumn, TableProps } from './Table.types';
import './Table.css';

const ChevronIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const alignClassName = (align: TableColumn<unknown>['align']): string | undefined => {
  if (align === 'right') return 'sila-num';
  if (align === 'center') return 'sila-table-cell-center';
  return undefined;
};

export function Table<TRow>({
  columns,
  data,
  getRowId,
  loading = false,
  loadingRows = 5,
  loadingLabel,
  error,
  errorDescription,
  emptyState,
  alwaysShowHeader = false,
  onRowClick,
  rowClassName,
  expandable,
  selection,
  pagination,
  className = '',
  wrapClassName = '',
  ariaLabel,
}: TableProps<TRow>): React.ReactElement {
  const resolveRowId = useCallback(
    (row: TRow, index: number) => (getRowId ? getRowId(row, index) : String(index)),
    [getRowId]
  );
  const rowIds = useMemo(() => data.map((row, index) => resolveRowId(row, index)), [data, resolveRowId]);

  const hasExpand = Boolean(expandable);
  const isExpandControlled = Boolean(expandable?.expandedRowIds && expandable?.onExpandedRowsChange);
  const [internalExpandedIds, setInternalExpandedIds] = useState<Set<string>>(
    () => new Set(expandable?.defaultExpandedRowIds)
  );
  const expandedRowIds = isExpandControlled ? (expandable!.expandedRowIds as Set<string>) : internalExpandedIds;

  const toggleExpanded = (rowId: string) => {
    const next = new Set(expandedRowIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    if (isExpandControlled) {
      expandable!.onExpandedRowsChange!(next);
    } else {
      setInternalExpandedIds(next);
    }
  };

  const hasSelection = Boolean(selection);
  const selectableRowIds = useMemo(() => {
    if (!selection) return [];
    return data.reduce<string[]>((acc, row, index) => {
      if (!selection.isRowSelectable || selection.isRowSelectable(row)) acc.push(rowIds[index]);
      return acc;
    }, []);
  }, [data, rowIds, selection]);

  const allOnPageSelected =
    hasSelection && selectableRowIds.length > 0 && selectableRowIds.every((id) => selection!.selectedRowIds.has(id));
  const someOnPageSelected = hasSelection && selectableRowIds.some((id) => selection!.selectedRowIds.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected]);

  const handleToggleSelectAll = () => {
    if (!selection) return;
    const next = new Set(selection.selectedRowIds);
    if (allOnPageSelected) {
      selectableRowIds.forEach((id) => next.delete(id));
    } else {
      selectableRowIds.forEach((id) => next.add(id));
    }
    selection.onSelectionChange(next);
  };

  const handleToggleRow = (rowId: string) => {
    if (!selection) return;
    const next = new Set(selection.selectedRowIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    selection.onSelectionChange(next);
  };

  const totalColumnCount = columns.length + (hasSelection ? 1 : 0) + (hasExpand ? 1 : 0);

  const autoSummary = useMemo(() => {
    if (pagination?.summary !== undefined) return pagination.summary;
    if (!pagination?.pageSize || pagination.totalItems === undefined) return undefined;
    if (pagination.totalItems === 0) return 'No results';
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);
    return `Showing ${start}–${end} of ${pagination.totalItems}`;
  }, [pagination]);

  const tableHead = (
    <thead>
      <tr>
        {hasSelection && (
          <th className="sila-table-select-cell">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allOnPageSelected}
              disabled={selectableRowIds.length === 0}
              aria-label={allOnPageSelected ? 'Deselect all rows' : 'Select all rows'}
              onChange={handleToggleSelectAll}
            />
          </th>
        )}
        {hasExpand && (
          <th className="sila-table-expand-cell">
            <span className="sila-visually-hidden">Expand</span>
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.id}
            className={[alignClassName(column.align), column.headerClassName].filter(Boolean).join(' ') || undefined}
            style={column.width ? { width: column.width } : undefined}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  // With `alwaysShowHeader`, error and empty states render inside the table body so the column headers stay visible.
  const renderStatePanel = (state: React.ReactNode) => (
    <div className={['sila-table-container', className].filter(Boolean).join(' ')}>
      {alwaysShowHeader ? (
        <div className={['sila-table-wrap', wrapClassName].filter(Boolean).join(' ')}>
          <table className="sila-table" aria-label={ariaLabel}>
            {tableHead}
            <tbody>
              <tr className="sila-table-state-row">
                <td className="sila-table-state-cell" colSpan={totalColumnCount}>{state}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        state
      )}
    </div>
  );

  if (error) {
    return renderStatePanel(<EmptyState variant="error" title={error} description={errorDescription} />);
  }

  if (alwaysShowHeader && !loading && data.length === 0) {
    return renderStatePanel(
      <EmptyState
        title={emptyState?.title ?? 'No records found.'}
        description={emptyState?.description}
        icon={emptyState?.icon}
      />
    );
  }

  return (
    <div className={['sila-table-container', className].filter(Boolean).join(' ')}>
      {loading ? (
        <TableSkeleton rows={loadingRows} columns={totalColumnCount} label={loadingLabel} />
      ) : data.length === 0 ? (
        <EmptyState
          title={emptyState?.title ?? 'No records found.'}
          description={emptyState?.description}
          icon={emptyState?.icon}
        />
      ) : (
        <>
          <div className={['sila-table-wrap', wrapClassName].filter(Boolean).join(' ')}>
            <table className="sila-table" aria-label={ariaLabel}>
              {tableHead}
              <tbody>
                {data.map((row, rowIndex) => {
                  const rowId = rowIds[rowIndex];
                  const canExpand = hasExpand && (!expandable!.isRowExpandable || expandable!.isRowExpandable(row));
                  const isExpanded = canExpand && expandedRowIds.has(rowId);
                  const isSelected = hasSelection && selection!.selectedRowIds.has(rowId);
                  const isSelectable = !selection?.isRowSelectable || selection.isRowSelectable(row);
                  const expandedContentId = `sila-table-expanded-${rowId}`;
                  const resolvedRowClassName = typeof rowClassName === 'function' ? rowClassName(row, rowIndex) : rowClassName;
                  const rowClasses = [
                    onRowClick ? 'sila-row-clickable' : '',
                    isSelected ? 'sila-row-selected' : '',
                    resolvedRowClassName,
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={rowClasses || undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
                        onKeyDown={
                          onRowClick
                            ? (event) => {
                                if (event.key === 'Enter') onRowClick(row, rowIndex);
                              }
                            : undefined
                        }
                      >
                        {hasSelection && (
                          <td className="sila-table-select-cell" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelectable}
                              aria-label={isSelected ? 'Deselect row' : 'Select row'}
                              onChange={() => handleToggleRow(rowId)}
                            />
                          </td>
                        )}
                        {hasExpand && (
                          <td className="sila-table-expand-cell">
                            {canExpand && (
                              <button
                                type="button"
                                className="sila-table-expand-toggle"
                                aria-expanded={isExpanded}
                                aria-controls={expandedContentId}
                                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpanded(rowId);
                                }}
                              >
                                <ChevronIcon />
                              </button>
                            )}
                          </td>
                        )}
                        {columns.map((column) => {
                          const value = column.accessorKey ? row[column.accessorKey] : undefined;
                          const content = column.cell
                            ? column.cell({ row, rowIndex, value })
                            : (value as React.ReactNode);
                          return (
                            <td
                              key={column.id}
                              className={[alignClassName(column.align), column.className].filter(Boolean).join(' ') || undefined}
                            >
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                      {isExpanded && (
                        <tr className="sila-table-expanded-row">
                          <td id={expandedContentId} colSpan={totalColumnCount}>
                            {expandable!.renderExpandedRow(row, rowIndex)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && (
            <Pagination
              {...pagination}
              summary={autoSummary}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Table;
