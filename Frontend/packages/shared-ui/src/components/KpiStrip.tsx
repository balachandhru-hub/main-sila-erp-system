import React from 'react';

export interface KpiStripItem {
  key: string;
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Short hint under the value; rendered as a link affordance only when `onClick` is set. */
  caption?: string;
  /** Marks the metric as needing action, e.g. "Needs action". */
  attention?: string;
  onClick?: () => void;
  /** Tints the icon badge in the card layout (`sila-kpi-strip--cards`). */
  tone?: 'success' | 'warning' | 'danger';
}

export interface KpiStripProps {
  items: KpiStripItem[];
  /** Accessible name for the group, e.g. "Procurement summary". */
  label?: string;
  className?: string;
}

const IconArrow = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const IconAttention = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

/** Strips trailing "›", ">" and arrows that older data embedded in link text. */
const cleanCaption = (text: string) => text.replace(/\s*[>›→]+\s*$/, '');

/** A single compact card of headline metrics separated by hairlines. */
export const KpiStrip: React.FC<KpiStripProps> = ({ items, label = 'Key metrics', className = '' }) => (
  <section className={`sila-kpi-strip ${className}`.trim()} aria-label={label}>
    {items.map((item) => {
      const content = (
        <>
          <span className="sila-kpi-strip-head">
            {item.icon && <span className="sila-kpi-strip-icon" aria-hidden="true">{item.icon}</span>}
            <span className="sila-kpi-strip-label">{item.label}</span>
          </span>
          <span className="sila-kpi-strip-value">{item.value}</span>
          <span className="sila-kpi-strip-foot">
            {item.attention && (
              <span className="sila-kpi-strip-attention">
                <IconAttention />
                {item.attention}
              </span>
            )}
            {item.caption && (
              <span className={item.onClick ? 'sila-kpi-strip-link' : 'sila-kpi-strip-caption'}>
                {cleanCaption(item.caption)}
                {item.onClick && <IconArrow />}
              </span>
            )}
          </span>
        </>
      );

      const toneClass = item.tone ? ` sila-kpi-strip-cell--${item.tone}` : '';

      return item.onClick ? (
        <button key={item.key} type="button" className={`sila-kpi-strip-cell sila-kpi-strip-cell--action${toneClass}`} onClick={item.onClick}>
          {content}
        </button>
      ) : (
        <div key={item.key} className={`sila-kpi-strip-cell${toneClass}`}>
          {content}
        </div>
      );
    })}
  </section>
);

export default KpiStrip;
