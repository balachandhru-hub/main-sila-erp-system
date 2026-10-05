import React from 'react';

export const Loading: React.FC<{ text?: string }> = ({ text = 'Loading…' }) => (
  <p className="sm-loading" role="status">
    {text}
  </p>
);

/** Empty state: a short text, or a bold title with a description (prototype style). */
export const Empty: React.FC<{ text: string; description?: string }> = ({ text, description }) =>
  description ? (
    <p className="sm-empty">
      <strong>{text}</strong>
      <span>{description}</span>
    </p>
  ) : (
    <p className="sm-empty">{text}</p>
  );

/** Whether the browser reports a connection; follows the online / offline events. */
export const useOnline = (): boolean => {
  const [online, setOnline] = React.useState<boolean>(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
};

/** Shown while the device has no connection: posting needs one. */
export const OfflineBanner: React.FC = () => {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="sm-offline" role="status">
      <span className="sm-badge sm-badge--warning">Offline</span>
      <span>You are offline. Drafts can be kept, but posting requires a connection.</span>
    </div>
  );
};

/** "Powered by SILA" line at the end of the screens. */
export const PoweredFooter: React.FC = () => (
  <footer className="sm-footer" aria-label="Powered by SILA">
    <span>POWERED BY</span>
    <strong>SILA</strong>
  </footer>
);

interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorNotice: React.FC<ErrorNoticeProps> = ({ message, onRetry }) => (
  <div className="sm-notice sm-notice--error sm-section" role="alert">
    <p>{message}</p>
    {onRetry && (
      <button type="button" className="sm-btn sm-btn--small sm-btn--danger" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

export interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

/** Result message of an action (saved, failed, ...). */
export const Notice: React.FC<{ notice: NoticeMessage | null }> = ({ notice }) => {
  if (!notice) return null;
  const toneClass = notice.tone === 'info' ? '' : ` sm-notice--${notice.tone}`;
  return (
    <p className={`sm-notice${toneClass}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.text}
    </p>
  );
};
