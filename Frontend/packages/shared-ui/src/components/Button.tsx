import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  /** Shows a spinner and disables the button while an action is in flight. */
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const classes = [
    // `vosox-button btn-*` kept for existing selectors that target them.
    'vosox-button',
    `btn-${variant}`,
    'sila-btn',
    `sila-btn--${variant}`,
    size !== 'md' && `sila-btn--${size}`,
    fullWidth && 'sila-btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="sila-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
};
