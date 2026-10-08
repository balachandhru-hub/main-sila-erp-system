import React from 'react';
import { toRem } from '../utils/units';

interface LoaderProps {
  fullScreen?: boolean;
  /** Spinner colour; defaults to the brand primary. */
  color?: string;
  size?: number;
  message?: string;
  /** Kept for compatibility; the loader always renders on the app background. */
  theme?: 'light' | 'dark';
}

export const Loader: React.FC<LoaderProps> = ({ fullScreen = false, color, size = 32, message }) => (
  <div
    className={`sila-root sila-loader${fullScreen ? ' sila-loader--fullscreen' : ''}`}
    role="status"
    aria-live="polite"
    style={color ? ({ '--sila-loader-color': color } as React.CSSProperties) : undefined}
  >
    <span
      className="sila-spinner"
      style={{ '--sila-spinner-size': toRem(size), '--sila-spinner-stroke': toRem(Math.max(2, Math.round(size / 12))) } as React.CSSProperties}
      aria-hidden="true"
    />
    {message ? <span className="sila-loader-message">{message}</span> : <span className="sila-visually-hidden">Loading</span>}
  </div>
);
