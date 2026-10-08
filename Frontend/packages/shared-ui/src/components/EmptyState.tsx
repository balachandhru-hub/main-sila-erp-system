import React from 'react';

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Error variant: red icon, and announced to screen readers. */
  variant?: 'empty' | 'error';
  className?: string;
}

const IconInbox = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const IconAlert = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action, variant = 'empty', className = '' }) => (
  <div
    className={`sila-empty${variant === 'error' ? ' sila-empty--error' : ''} ${className}`.trim()}
    role={variant === 'error' ? 'alert' : undefined}
  >
    <span className="sila-empty-icon">{icon ?? (variant === 'error' ? <IconAlert /> : <IconInbox />)}</span>
    <p className="sila-empty-title">{title}</p>
    {description && <p className="sila-empty-text">{description}</p>}
    {action && <div className="sila-empty-action">{action}</div>}
  </div>
);

export default EmptyState;
