import React from 'react';
import { Skeleton } from '../Skeleton';

/* Building blocks shared by the buyer and supplier analytics views. */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from today until the date (negative once passed). */
export const daysUntil = (iso: string): number => {
  const end = new Date(iso);
  const today = new Date();
  const a = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / DAY_MS);
};

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Today", "Tomorrow", "In 5 days" — urgent (≤3 days) rendered in the warning tone. */
export const DueIn: React.FC<{ endDate: string }> = ({ endDate }) => {
  const days = daysUntil(endDate);
  const text = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return (
    <span className={`sila-due${days <= 3 ? ' sila-due--urgent' : ''}`} title={formatDate(endDate)}>
      {text}
    </span>
  );
};

/** Placeholder layout while analytics load: KPI strip plus two chart rows. */
export const AnalyticsSkeleton: React.FC = () => (
  <div className="sila-analytics" role="status" aria-live="polite">
    <span className="sila-visually-hidden">Loading dashboard analytics…</span>
    <div className="sila-kpi-strip sila-kpi-strip--cards">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="sila-kpi-strip-cell">
          <div className="sila-kpi-strip-head">
            <Skeleton width={36} height={36} radius="var(--sila-radius-md)" />
            <Skeleton width="50%" height={12} />
          </div>
          <Skeleton width="40%" height={30} />
          <Skeleton width="55%" height={10} />
        </div>
      ))}
    </div>
    <div className="sila-dash-grid">
      <div className="sila-card sila-span-8 sila-analytics-placeholder"><Skeleton height="100%" /></div>
      <div className="sila-card sila-span-4 sila-analytics-placeholder"><Skeleton height="100%" /></div>
    </div>
  </div>
);

/**
 * Quiet status line shown above a zero-filled dashboard when its figures could not be loaded.
 * Deliberately non-technical; the underlying reason is logged to the console by the API layer.
 */
export const AnalyticsNotice: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="sila-analytics-status" role="status">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
    <span>Dashboard figures are temporarily unavailable.</span>
    <button type="button" className="sila-analytics-retry" onClick={onRetry}>
      Retry
    </button>
  </div>
);
