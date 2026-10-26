import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/sila-logo.png';
import { useGo } from '../navigation';
import NotificationBell from './NotificationBell';
import type { SilaInboxItem } from '../../../remote-buyer/src/components/silaMe/silaNotifications';

interface ScreenHeaderProps {
  title: string;
  /** Small upper-case line above the title (e.g. RECEIVE). */
  eyebrow?: string;
  /** Short explanation under the title. */
  intro?: string;
  /** Compact summary next to the title (e.g. Finalize GRN supplier / PO / store). */
  summary?: React.ReactNode;
  /** Show a back button; goes back in history, or to `backTo` when given. */
  back?: boolean;
  backTo?: string;
  /** Right side of the top bar (e.g. the profile avatar). */
  aside?: React.ReactNode;
  /** Inbox items already loaded on the screen (Home). When omitted the bell reads the dashboard. */
  notifications?: SilaInboxItem[] | boolean;
}

/** Top bar (back, brand) followed by the eyebrow and the screen title, like the SILA Store prototype. */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, eyebrow, intro, summary, back = false, backTo, aside, notifications = true }) => {
  const navigate = useNavigate();
  const go = useGo();

  const onBack = () => {
    if (backTo) go(backTo);
    else navigate(-1);
  };

  return (
    <header>
      <div className="sm-topbar">
        <span className="sm-topbar__lead">
          <img className="sm-logo" src={logo} alt="SILA" />
          {(back || backTo) && (
            <button type="button" className="sm-header__back" aria-label="Back" onClick={onBack}>
              ←
            </button>
          )}
        </span>
        <span className="sm-brand" aria-label="SILA Store">
          SILA <span>Store</span>
        </span>
        <span className="sm-topbar__aside">
          {notifications !== false && <NotificationBell items={Array.isArray(notifications) ? notifications : undefined} />}
          {aside ?? <span aria-hidden="true" />}
        </span>
      </div>
      <div className={`sm-titleblock${summary ? ' sm-titleblock--with-summary' : ''}`}>
        {eyebrow && <span className="sm-eyebrow">{eyebrow}</span>}
        <div className="sm-titleblock__main">
          <h1>{title}</h1>
          {summary && <div className="sm-titleblock__summary">{summary}</div>}
        </div>
        {intro && <p>{intro}</p>}
      </div>
    </header>
  );
};

export default ScreenHeader;
