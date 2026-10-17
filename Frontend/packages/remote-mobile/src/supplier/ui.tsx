import React, { useEffect, useId, useState } from 'react';
import { CLOUD_LATER } from './format';

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  intro?: string;
  back?: () => void;
  aside?: React.ReactNode;
}> = ({ eyebrow, title, intro, back, aside }) => (
  <header className="sp-header">
    <div className="sp-header__bar">
      {back ? (
        <button type="button" className="sp-icon-btn" onClick={back} aria-label="Back">
          ←
        </button>
      ) : (
        <span className="sp-mark">SILA</span>
      )}
      <strong>Supplier</strong>
      {aside ?? <span />}
    </div>
    <div className="sp-header__title">
      {eyebrow && <span className="sp-eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {intro && <p>{intro}</p>}
    </div>
  </header>
);

export const StatusBadge: React.FC<{ value?: string | null; tone?: 'ok' | 'warn' | 'bad' | 'info' | 'muted' }> = ({
  value,
  tone = 'info',
}) => <span className={`sp-badge sp-badge--${tone}`}>{value || '—'}</span>;

export const toneOfStatus = (value?: string | null): 'ok' | 'warn' | 'bad' | 'info' | 'muted' => {
  const status = (value || '').toUpperCase();
  if (/(SUCCESS|POSTED|AWARDED|WON|ACTIVE|VERIFIED|FULFILLED|DELIVERED)/.test(status)) return 'ok';
  if (/(FAIL|REJECT|ERROR|CANCEL)/.test(status)) return 'bad';
  if (/(PEND|LIVE|PROCESS|PARTIAL|RUNNING|ATTENTION)/.test(status)) return 'warn';
  if (!status) return 'muted';
  return 'info';
};

export const KpiCard: React.FC<{ label: string; value?: string | number | null; hint?: string; onClick?: () => void }> = ({
  label,
  value,
  hint,
  onClick,
}) => {
  const body = (
    <>
      <span>{label}</span>
      <strong>{value == null || value === '' ? '—' : value}</strong>
      {hint && <small>{hint}</small>}
    </>
  );
  if (!onClick) return <article className="sp-kpi">{body}</article>;
  return (
    <button type="button" className="sp-kpi sp-kpi--button" onClick={onClick}>
      {body}
    </button>
  );
};

export const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="sp-empty">
    <strong>{title}</strong>
    <p>{text}</p>
  </div>
);

export const NotConnected: React.FC<{ title?: string; text?: string }> = ({
  title = 'Not connected',
  text = 'No Cloud service is connected for this module yet. Figures will appear here when it is.',
}) => (
  <div className="sp-empty sp-empty--quiet">
    <span className="sp-badge sp-badge--muted">Not connected</span>
    <strong>{title}</strong>
    <p>{text}</p>
  </div>
);

export const Loading: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => (
  <p className="sp-loading" role="status">
    {text}
  </p>
);

export const ErrorNote: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="sp-error" role="alert">
    <p>{message}</p>
    {onRetry && (
      <button type="button" className="sp-btn sp-btn--secondary" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const SearchField: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <label className="sp-search">
    <span className="sp-sr">Search</span>
    <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
  </label>
);

export const ChipRow: React.FC<{ options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }> = ({
  options,
  value,
  onChange,
}) => (
  <div className="sp-chips" role="tablist">
    {options.map((option) => (
      <button
        key={option.id}
        type="button"
        className="sp-chip"
        aria-selected={value === option.id}
        onClick={() => onChange(option.id)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const FilterSheet: React.FC<{ title?: string; children: React.ReactNode }> = ({ title = 'Filters', children }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="sp-filters">
      <div className="sp-filters__inline">{children}</div>
      <button type="button" className="sp-btn sp-btn--secondary sp-filters__open" aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>
        {title}
      </button>
      {open && (
        <div className="sp-sheet" role="presentation">
          <button type="button" className="sp-sheet__backdrop" aria-label="Close filters" onClick={() => setOpen(false)} />
          <div className="sp-sheet__panel" id={id} role="dialog" aria-label={title}>
            <div className="sp-row">
              <strong>{title}</strong>
              <button type="button" className="sp-btn sp-btn--secondary" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export const BusinessCard: React.FC<{
  title: string;
  meta?: string;
  status?: string;
  lines: { label: string; value: string }[];
  onOpen?: () => void;
}> = ({ title, meta, status, lines, onOpen }) => (
  <article className="sp-card">
    <div className="sp-row">
      <div>
        <h2>{title}</h2>
        {meta && <p className="sp-meta">{meta}</p>}
      </div>
      {status && <StatusBadge value={status} tone={toneOfStatus(status)} />}
    </div>
    <dl className="sp-facts">
      {lines.map((line) => (
        <div key={line.label}>
          <dt>{line.label}</dt>
          <dd>{line.value || '—'}</dd>
        </div>
      ))}
    </dl>
    {onOpen && (
      <button type="button" className="sp-btn" onClick={onOpen}>
        View
      </button>
    )}
  </article>
);

export const Timeline: React.FC<{ steps: { label: string; state: 'done' | 'current' | 'open' | 'wait'; detail?: string }[] }> = ({
  steps,
}) => (
  <ol className="sp-timeline">
    {steps.map((step) => (
      <li key={step.label} className={`sp-timeline__step sp-timeline__step--${step.state}`}>
        <span aria-hidden="true">{step.state === 'done' ? '✓' : step.state === 'current' ? '●' : '○'}</span>
        <div>
          <strong>{step.label}</strong>
          {step.detail && <p>{step.detail}</p>}
        </div>
      </li>
    ))}
  </ol>
);

export const ConfirmDialog: React.FC<{
  title: string;
  text: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, text, confirmLabel, busy, onCancel, onConfirm }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="sp-sheet" role="presentation">
      <button type="button" className="sp-sheet__backdrop" aria-label="Close" onClick={onCancel} />
      <div className="sp-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="sp-row">
          <button type="button" className="sp-btn sp-btn--secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="sp-btn" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LaterButton: React.FC<{ label: string }> = ({ label }) => (
  <button type="button" className="sp-btn sp-btn--secondary" disabled title={CLOUD_LATER}>
    {label}
  </button>
);

export const Pager: React.FC<{ page: number; hasNext: boolean; onPage: (page: number) => void }> = ({ page, hasNext, onPage }) => (
  <div className="sp-row">
    <button type="button" className="sp-btn sp-btn--secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>
      Previous
    </button>
    <span className="sp-meta">Page {page + 1}</span>
    <button type="button" className="sp-btn sp-btn--secondary" disabled={!hasNext} onClick={() => onPage(page + 1)}>
      Next
    </button>
  </div>
);
