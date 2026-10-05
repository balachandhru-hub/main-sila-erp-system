import React, { useId } from 'react';

export interface FormFieldProps {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Spans the full row of a `.sila-form-grid`. */
  fullWidth?: boolean;
  className?: string;
  /**
   * Render prop receiving the ids to wire onto the control, so the label, hint and error
   * are announced by assistive technology.
   */
  children: (control: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string; required?: boolean }) => React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, hint, error, fullWidth, className = '', children }) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const classes = ['sila-field', fullWidth && 'sila-field--full', error && 'sila-field--error', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <label className="sila-label" htmlFor={id}>
        {label}
        {required && <span className="sila-required" aria-hidden="true">*</span>}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, required })}
      {error ? (
        <span id={errorId} className="sila-error-text">{error}</span>
      ) : (
        hint && <span id={hintId} className="sila-help">{hint}</span>
      )}
    </div>
  );
};

export default FormField;
