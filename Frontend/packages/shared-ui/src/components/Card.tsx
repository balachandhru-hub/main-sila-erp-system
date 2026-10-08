import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Controls rendered on the right of the header. */
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Removes body padding, for tables that run edge to edge. */
  flush?: boolean;
  as?: 'section' | 'div' | 'article';
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  actions,
  footer,
  flush = false,
  as: Tag = 'section',
  className = '',
  children,
  ...rest
}) => (
  <Tag className={`sila-card ${className}`.trim()} {...rest}>
    {(title || actions) && (
      <div className="sila-card-header">
        <div>
          {title && <h2 className="sila-card-title">{title}</h2>}
          {subtitle && <p className="sila-card-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="sila-btn-group">{actions}</div>}
      </div>
    )}
    <div className={flush ? 'sila-card-body--flush' : 'sila-card-body'}>{children}</div>
    {footer && <div className="sila-card-footer">{footer}</div>}
  </Tag>
);

export default Card;
