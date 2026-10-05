import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Status badge or reference shown inline after the title. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}

const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  meta,
  actions,
  onBack,
  backLabel = 'Back',
  className = '',
}) => (
  <div className={`sila-page-header ${className}`.trim()}>
    <div className="sila-page-header-main">
      {onBack && (
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm sila-page-back" onClick={onBack} aria-label={backLabel} title={backLabel}>
          <IconArrowLeft />
        </button>
      )}
      <div>
        <div className="sila-page-title-row">
          <h1 className="sila-page-title">{title}</h1>
          {meta}
        </div>
        {description && <p className="sila-page-description">{description}</p>}
      </div>
    </div>
    {actions && <div className="sila-page-actions">{actions}</div>}
  </div>
);

export default PageHeader;
