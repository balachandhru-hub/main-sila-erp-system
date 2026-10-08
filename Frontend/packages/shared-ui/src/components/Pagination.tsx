import React from 'react';

export interface PaginationProps {
  page: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Known total page count; when omitted, use `hasNext` for cursor-style APIs. */
  totalPages?: number;
  hasNext?: boolean;
  /** Jump to a page; enables numbered buttons when totalPages is known. */
  onPageChange?: (page: number) => void;
  /** Summary text on the left, e.g. "Showing 1–10 of 42". */
  summary?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const IconPrev = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const IconNext = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/** Page numbers around the current page, with ellipses: 1 … 4 5 6 … 12 */
const pageWindow = (current: number, total: number): (number | 'gap')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
};

export const Pagination: React.FC<PaginationProps> = ({
  page,
  onPrevious,
  onNext,
  totalPages,
  hasNext,
  onPageChange,
  summary,
  disabled = false,
  className = '',
}) => {
  const canNext = totalPages !== undefined ? page < totalPages : Boolean(hasNext);
  const showNumbers = Boolean(onPageChange && totalPages && totalPages > 1);

  return (
    <nav className={`sila-pagination ${className}`.trim()} aria-label="Pagination">
      <span>{summary ?? (totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`)}</span>
      <div className="sila-pagination-pages">
        <button type="button" className="sila-page-btn" onClick={onPrevious} disabled={disabled || page <= 1} aria-label="Previous page">
          <IconPrev />
          <span>Previous</span>
        </button>
        {showNumbers &&
          pageWindow(page, totalPages as number).map((entry, index) =>
            entry === 'gap' ? (
              <span key={`gap-${index}`} aria-hidden="true">…</span>
            ) : (
              <button
                key={entry}
                type="button"
                className="sila-page-btn"
                aria-current={entry === page ? 'page' : undefined}
                disabled={disabled}
                onClick={() => onPageChange?.(entry)}
              >
                {entry}
              </button>
            )
          )}
        <button type="button" className="sila-page-btn" onClick={onNext} disabled={disabled || !canNext} aria-label="Next page">
          <span>Next</span>
          <IconNext />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
