import React, { useEffect, useId, useRef, useState } from "react";
import type { SilaInboxItem } from "./silaNotifications";
import { cloudKeyForInbox } from "./silaNotifications";
import { queueSilaCreditMemoSearch } from "./receiving/SilaCreditMemos";
import { queueSilaInvoiceSearch } from "./receiving/SilaInvoices";

interface SilaNotificationBellProps {
  items: SilaInboxItem[];
  onNavigate: (key: string) => void;
}

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

/** Header inbox for Home: dashboard approvals and attention, including invoices waiting for this user. */
const SilaNotificationBell: React.FC<SilaNotificationBellProps> = ({ items, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = items.length;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const openItem = (item: SilaInboxItem) => {
    if (item.creditMemoId) queueSilaCreditMemoSearch({ creditMemoId: item.creditMemoId });
    else if (item.invoiceId) queueSilaInvoiceSearch({ invoiceId: item.invoiceId, status: item.status ?? "PENDING_APPROVAL" });
    onNavigate(cloudKeyForInbox(item));
    setOpen(false);
  };

  return (
    <div className="sila-notify" ref={root}>
      <button
        type="button"
        className="sila-btn sila-btn--secondary sila-btn--icon sila-notify__btn"
        aria-label={count ? `${count} notifications` : "Notifications"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {count > 0 && <span className="sila-notify__badge">{count > 9 ? "9+" : count}</span>}
      </button>
      {open && (
        <div id={menuId} className="sila-menu sila-notify__menu" role="menu">
          <p className="sila-notify__heading">Approvals and alerts</p>
          {items.length === 0 && <p className="sila-notify__empty">No items waiting for you.</p>}
          {items.map((item) => (
            <button key={item.key} type="button" className="sila-menu-item sila-notify__item" role="menuitem" onClick={() => openItem(item)}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SilaNotificationBell;
