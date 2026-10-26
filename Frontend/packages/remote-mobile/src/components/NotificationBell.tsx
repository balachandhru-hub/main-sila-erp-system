import React, { useEffect, useId, useRef, useState } from 'react';
import { loadInboxItems, mobilePathForInbox, type SilaInboxItem } from '../../../remote-buyer/src/components/silaMe/silaNotifications';
import { useGo } from '../navigation';

interface NotificationBellProps {
  items?: SilaInboxItem[];
  locationId?: string;
}

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="1.25rem" height="1.25rem" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

/** Top-bar inbox. Prefers items already loaded on Home; otherwise reads the receiving dashboard. */
const NotificationBell: React.FC<NotificationBellProps> = ({ items: given, locationId }) => {
  const go = useGo();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SilaInboxItem[]>(given ?? []);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (given) {
      setItems(given);
      return undefined;
    }
    let active = true;
    loadInboxItems(locationId)
      .then((next) => {
        if (active) setItems(next);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [given, locationId]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = items.length;
  return (
    <div className="sm-notify" ref={root}>
      <button
        type="button"
        className="sm-notify__btn"
        aria-label={count ? `${count} notifications` : 'Notifications'}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {count > 0 && <span className="sm-notify__badge">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div id={menuId} className="sm-notify__menu" role="menu">
          <p className="sm-notify__heading">Approvals and alerts</p>
          {items.length === 0 && <p className="sm-notify__empty">No items waiting for you.</p>}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className="sm-notify__item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                go(mobilePathForInbox(item));
              }}
            >
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
          <button
            type="button"
            className="sm-notify__all"
            onClick={() => {
              setOpen(false);
              go('tasks?tab=approvals');
            }}
          >
            Open approvals
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
