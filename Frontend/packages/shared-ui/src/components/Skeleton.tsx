import React from 'react';
import { toRem } from '../utils/units';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 14, radius, className = '' }) => (
  <span
    className={`sila-skeleton ${className}`.trim()}
    style={{ '--sila-skeleton-width': toRem(width), '--sila-skeleton-height': toRem(height), '--sila-skeleton-radius': toRem(radius) } as React.CSSProperties}
    aria-hidden="true"
  />
);

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /** Screen-reader text announced while loading. */
  label?: string;
}

/** Placeholder rows shaped like a data table, shown while a list loads. */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 6, columns = 5, label = 'Loading…' }) => (
  <div className="sila-skeleton-stack sila-table-skeleton" role="status" aria-live="polite">
    <span className="sila-visually-hidden">{label}</span>
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="sila-table-skeleton-row" style={{ '--sila-skeleton-columns': columns } as React.CSSProperties}>
        {Array.from({ length: columns }, (_, col) => (
          <Skeleton key={col} height={row === 0 ? 10 : 14} width={col === 0 ? '70%' : '90%'} />
        ))}
      </div>
    ))}
  </div>
);

export default Skeleton;
