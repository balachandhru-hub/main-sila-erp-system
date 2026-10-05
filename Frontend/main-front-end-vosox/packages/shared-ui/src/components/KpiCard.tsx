import React from 'react';
import { Skeleton } from './Skeleton';

export interface KpiCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  /** Secondary line under the value, e.g. a badge or "Needs action". */
  meta?: React.ReactNode;
  /** Call-to-action text; shown only when the card is clickable. */
  linkText?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  tone = 'neutral',
  meta,
  linkText,
  onClick,
  loading = false,
  className = '',
}) => {
  const classes = `sila-kpi${tone !== 'neutral' ? ` sila-kpi--${tone}` : ''} ${className}`.trim();
  const content = (
    <>
      <div className="sila-kpi-head">
        <span className="sila-kpi-label">{label}</span>
        {icon && <span className="sila-kpi-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="sila-kpi-value">{loading ? <Skeleton width={56} height={26} /> : value}</div>
      {meta && <div className="sila-kpi-meta">{meta}</div>}
      {onClick && linkText && <span className="sila-kpi-link">{linkText}</span>}
    </>
  );

  return onClick ? (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
};

export default KpiCard;
