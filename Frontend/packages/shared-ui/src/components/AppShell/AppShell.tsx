import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import defaultLogo from '../../assets/sila-logo.png';

/* ------------------------------------------------------------------ Types */

export interface AppNavLeaf {
  key: string;
  label: string;
}

/** A non-clickable label grouping several leaves inside a parent item. */
export interface AppNavGroup {
  label: string;
  items: AppNavLeaf[];
}

export type AppNavSubEntry = AppNavLeaf | AppNavGroup;

export interface AppNavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  subItems?: AppNavSubEntry[];
}

export interface AppUserMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  tone?: 'default' | 'danger';
  /** Renders a divider above this item. */
  dividerBefore?: boolean;
}

export interface AppShellProps {
  /** Defaults to the tightly cropped SILA logo shipped with shared-ui. */
  logoSrc?: string;
  logoAlt?: string;
  /** Usually navigates to the dashboard. */
  onLogoClick?: () => void;
  navItems?: AppNavItem[];
  activeNav?: string;
  onNavClick?: (key: string) => void;
  userName?: string;
  userEmail?: string;
  /** Fallback text when the user profile has not loaded yet. */
  userFallbackName?: string;
  userFallbackEmail?: string;
  userMenuItems?: AppUserMenuItem[];
  /** Extra controls rendered in the top bar before the account menu. */
  topbarActions?: React.ReactNode;
  /** Removes page padding, for screens that manage their own layout. */
  flushContent?: boolean;
  children?: React.ReactNode;
}

/* ------------------------------------------------------------------ Helpers */

export const isAppNavGroup = (entry: AppNavSubEntry): entry is AppNavGroup => 'items' in entry;

export const collectAppNavKeys = (entries: AppNavSubEntry[]): string[] =>
  entries.flatMap((entry) => (isAppNavGroup(entry) ? entry.items.map((leaf) => leaf.key) : [entry.key]));

const DRAWER_BREAKPOINT = '(max-width: 63.9375rem)';
const HOVER_CLOSE_DELAY = 160;
/** Keep in sync with .sila-submenu-menu min-width (+ gap). */
const SUBMENU_WIDTH = 228;

const isItemActive = (item: AppNavItem, activeNav?: string) =>
  activeNav !== undefined &&
  (item.key === activeNav || (item.subItems ? collectAppNavKeys(item.subItems).includes(activeNav) : false));

const initialsOf = (name: string | undefined, fallback: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/** Arrow-key movement between the items of one menu level (items of nested submenus are skipped). */
const moveMenuFocus = (event: React.KeyboardEvent<HTMLElement>) => {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  event.stopPropagation();
  const menu = event.currentTarget;
  const entries = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).filter(
    (el) => el.closest('[role="menu"]') === menu
  );
  if (entries.length === 0) return;
  const index = entries.indexOf(document.activeElement as HTMLButtonElement);
  const next = event.key === 'ArrowDown' ? (index + 1) % entries.length : (index - 1 + entries.length) % entries.length;
  entries[next]?.focus();
};

/* ------------------------------------------------------------------ Icons */

const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/* ------------------------------------------------------------------ User menu */

interface UserMenuProps {
  name: string;
  email: string;
  items: AppUserMenuItem[];
}

const UserMenu: React.FC<UserMenuProps> = ({ name, email, items }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="sila-user" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="sila-user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="sila-avatar" aria-hidden="true">{initialsOf(name, name)}</span>
        <span className="sila-user-text">
          <span className="sila-user-name" title={name}>{name}</span>
          <span className="sila-user-email" title={email}>{email}</span>
        </span>
        <span className="sila-user-chevron"><IconChevronDown /></span>
      </button>

      {open && (
        <div id={menuId} className="sila-menu" role="menu" aria-label="Account" onKeyDown={moveMenuFocus}>
          <div className="sila-menu-header">
            <span className="sila-user-name">{name}</span>
            <span className="sila-user-email">{email}</span>
          </div>
          {items.map((item) => (
            <React.Fragment key={item.key}>
              {item.dividerBefore && <div className="sila-menu-divider" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={`sila-menu-item${item.tone === 'danger' ? ' sila-menu-item--danger' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Nested submenu */

interface NavSubmenuProps {
  group: AppNavGroup;
  activeNav?: string;
  renderLeaf: (leaf: AppNavLeaf) => React.ReactNode;
}

/**
 * A group inside a dropdown shown as its own parent item ("Approval ›") whose children open
 * in a flyout to the right, on hover, click, Enter or →; Esc or ← returns to the parent.
 */
const NavSubmenu: React.FC<NavSubmenuProps> = ({ group, activeNav, renderLeaf }) => {
  const [open, setOpen] = useState(false);
  // Flip to the left when the flyout would run off the right edge of the viewport.
  const [openLeft, setOpenLeft] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submenuId = useId();
  const childActive = activeNav !== undefined && group.items.some((leaf) => leaf.key === activeNav);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  };
  useEffect(() => cancelClose, []);

  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setOpenLeft(Boolean(rect && rect.right + SUBMENU_WIDTH > window.innerWidth));
    setOpen(true);
  };

  const openAndFocusFirst = () => {
    show();
    requestAnimationFrame(() => submenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
  };

  const closeToParent = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className="sila-submenu"
      onMouseEnter={() => {
        cancelClose();
        show();
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? submenuId : undefined}
        className={`sila-menu-item sila-submenu-trigger${childActive ? ' sila-menu-item--parent-active' : ''}`}
        onClick={() => (open ? setOpen(false) : openAndFocusFirst())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openAndFocusFirst();
          }
        }}
      >
        <span>{group.label}</span>
        <span className="sila-submenu-chevron"><IconChevronRight /></span>
      </button>
      {open && (
        <div
          ref={submenuRef}
          id={submenuId}
          className={`sila-menu sila-submenu-menu${openLeft ? ' sila-submenu-menu--left' : ''}`}
          role="menu"
          aria-label={group.label}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'Escape') {
              event.preventDefault();
              // Keep the parent dropdown open: only this level closes.
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              closeToParent();
              return;
            }
            moveMenuFocus(event);
          }}
        >
          {group.items.map(renderLeaf)}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ Top navigation */

interface TopNavDropdownProps {
  item: AppNavItem & { subItems: AppNavSubEntry[] };
  activeNav?: string;
  onSelect: (key: string) => void;
}

/** A top-bar item with children: opens on hover or click, keyboard operable. */
const TopNavDropdown: React.FC<TopNavDropdownProps> = ({ item, activeNav, onSelect }) => {
  const [open, setOpen] = useState(false);
  // The nav strip may scroll horizontally, so the menu is fixed-positioned from the trigger.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuId = useId();
  const active = isItemActive(item, activeNav);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const openMenu = () => {
    cancelClose();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom, left: rect.left });
    setOpen(true);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onViewportChange = () => setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open]);

  const select = (key: string) => {
    setOpen(false);
    onSelect(key);
  };

  const renderLeaf = (leaf: AppNavLeaf) => (
    <button
      key={leaf.key}
      type="button"
      role="menuitem"
      className={`sila-menu-item${leaf.key === activeNav ? ' sila-menu-item--active' : ''}`}
      aria-current={leaf.key === activeNav ? 'page' : undefined}
      onClick={() => select(leaf.key)}
    >
      <span>{leaf.label}</span>
    </button>
  );

  return (
    <li className="sila-topnav-entry" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <button
        ref={triggerRef}
        type="button"
        className={`sila-topnav-item${active ? ' sila-topnav-item--active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
            requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
          }
        }}
      >
        <span>{item.label}</span>
        <span className="sila-topnav-chevron"><IconChevronDown /></span>
      </button>
      {open && position && (
        <div
          ref={menuRef}
          id={menuId}
          className="sila-menu sila-topnav-menu"
          role="menu"
          aria-label={item.label}
          style={{ '--sila-menu-top': `${position.top}px`, '--sila-menu-left': `${position.left}px` } as React.CSSProperties}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onKeyDown={moveMenuFocus}
        >
          {item.subItems.map((entry, index) =>
            isAppNavGroup(entry) ? (
              <NavSubmenu key={`${item.key}-group-${index}`} group={entry} activeNav={activeNav} renderLeaf={renderLeaf} />
            ) : (
              renderLeaf(entry)
            )
          )}
        </div>
      )}
    </li>
  );
};

/* ------------------------------------------------------------------ Drawer (small screens) */

interface DrawerItemProps {
  item: AppNavItem;
  activeNav?: string;
  onSelect: (key: string) => void;
}

interface DrawerGroupProps {
  group: AppNavGroup;
  activeNav?: string;
  renderLeaf: (leaf: AppNavLeaf) => React.ReactNode;
}

/** A group inside a drawer parent ("Approval") — its own expandable item, mirroring the desktop flyout. */
const DrawerGroup: React.FC<DrawerGroupProps> = ({ group, activeNav, renderLeaf }) => {
  const subId = useId();
  const childActive = activeNav !== undefined && group.items.some((leaf) => leaf.key === activeNav);
  const [expanded, setExpanded] = useState(childActive);

  return (
    <li>
      <button
        type="button"
        className={`sila-nav-item${childActive ? ' sila-nav-item--parent-active' : ''}`}
        aria-expanded={expanded}
        aria-controls={subId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="sila-nav-label">{group.label}</span>
        <span className="sila-nav-chevron"><IconChevronRight /></span>
      </button>
      {expanded && (
        <ul id={subId} className="sila-nav-sub">
          {group.items.map(renderLeaf)}
        </ul>
      )}
    </li>
  );
};

const DrawerItem: React.FC<DrawerItemProps> = ({ item, activeNav, onSelect }) => {
  const subId = useId();
  const [expanded, setExpanded] = useState(() => isItemActive(item, activeNav));

  if (!item.subItems || item.subItems.length === 0) {
    const active = item.key === activeNav;
    return (
      <li>
        <button type="button" className="sila-nav-item" aria-current={active ? 'page' : undefined} onClick={() => onSelect(item.key)}>
          {item.icon && <span className="sila-nav-icon" aria-hidden="true">{item.icon}</span>}
          <span className="sila-nav-label">{item.label}</span>
          {item.badge ? <span className="sila-count" aria-label={`${item.badge} new`}>{item.badge}</span> : null}
        </button>
      </li>
    );
  }

  const renderLeaf = (leaf: AppNavLeaf) => (
    <li key={leaf.key}>
      <button type="button" className="sila-nav-item" aria-current={leaf.key === activeNav ? 'page' : undefined} onClick={() => onSelect(leaf.key)}>
        <span className="sila-nav-label">{leaf.label}</span>
      </button>
    </li>
  );

  return (
    <li>
      <button
        type="button"
        className={`sila-nav-item${isItemActive(item, activeNav) ? ' sila-nav-item--parent-active' : ''}`}
        aria-expanded={expanded}
        aria-controls={subId}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {item.icon && <span className="sila-nav-icon" aria-hidden="true">{item.icon}</span>}
        <span className="sila-nav-label">{item.label}</span>
        <span className="sila-nav-chevron"><IconChevronRight /></span>
      </button>
      {expanded && (
        <ul id={subId} className="sila-nav-sub">
          {item.subItems.map((entry, index) =>
            isAppNavGroup(entry) ? (
              <DrawerGroup key={`${item.key}-group-${index}`} group={entry} activeNav={activeNav} renderLeaf={renderLeaf} />
            ) : (
              renderLeaf(entry)
            )
          )}
        </ul>
      )}
    </li>
  );
};

/* ------------------------------------------------------------------ Shell */

/**
 * Application chrome shared by every portal: a full-width top bar with the logo,
 * horizontal primary navigation (dropdowns for grouped items) and the account menu.
 * Below 64rem the navigation moves into an off-canvas drawer.
 */
export const AppShell: React.FC<AppShellProps> = ({
  logoSrc = defaultLogo,
  logoAlt = 'SILA',
  onLogoClick,
  navItems,
  activeNav,
  onNavClick,
  userName,
  userEmail,
  userFallbackName = 'My account',
  userFallbackEmail = '',
  userMenuItems = [],
  topbarActions,
  flushContent = false,
  children,
}) => {
  const hasNav = Boolean(navItems && navItems.length > 0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerId = useId();

  const handleSelect = useCallback(
    (key: string) => {
      setDrawerOpen(false);
      onNavClick?.(key);
    },
    [onNavClick]
  );

  // Close the drawer with Escape, and whenever the viewport grows back to desktop.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    const query = window.matchMedia(DRAWER_BREAKPOINT);
    const onChange = () => {
      if (!query.matches) setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    query.addEventListener('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      query.removeEventListener('change', onChange);
    };
  }, [drawerOpen]);

  const shellClass = ['sila-root', 'sila-shell', drawerOpen && 'sila-shell--drawer-open'].filter(Boolean).join(' ');
  const displayName = userName || userFallbackName;
  const displayEmail = userEmail || userFallbackEmail;

  return (
    <div className={shellClass}>
      <header className="sila-topbar">
        {hasNav && (
          <button
            type="button"
            className="sila-icon-btn sila-topbar-menu-btn"
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            <IconMenu />
          </button>
        )}

        <button type="button" className="sila-topbar-logo-btn" onClick={() => {
            setDrawerOpen(false);
            onLogoClick?.();
            window.scrollTo({ top: 0 });
          }}
          aria-label="Go to dashboard" title="Dashboard">
          <img src={logoSrc} alt={logoAlt} className="sila-topbar-logo" />
        </button>

        {hasNav && (
          <nav className="sila-topnav" aria-label="Primary">
            <ul className="sila-topnav-list">
              {navItems!.map((item) =>
                item.subItems && item.subItems.length > 0 ? (
                  <TopNavDropdown
                    key={item.key}
                    item={item as AppNavItem & { subItems: AppNavSubEntry[] }}
                    activeNav={activeNav}
                    onSelect={handleSelect}
                  />
                ) : (
                  <li key={item.key} className="sila-topnav-entry">
                    <button
                      type="button"
                      className={`sila-topnav-item${item.key === activeNav ? ' sila-topnav-item--active' : ''}`}
                      aria-current={item.key === activeNav ? 'page' : undefined}
                      onClick={() => handleSelect(item.key)}
                    >
                      <span>{item.label}</span>
                      {item.badge ? <span className="sila-count" aria-label={`${item.badge} new`}>{item.badge}</span> : null}
                    </button>
                  </li>
                )
              )}
            </ul>
          </nav>
        )}

        <div className="sila-topbar-actions">
          {topbarActions}
          <UserMenu name={displayName} email={displayEmail} items={userMenuItems} />
        </div>
      </header>

      {hasNav && (
        <>
          <aside id={drawerId} className="sila-drawer" aria-label="Primary navigation" inert={!drawerOpen}>
            <nav className="sila-sidebar-nav">
              <ul className="sila-nav-section">
                {navItems!.map((item) => (
                  <DrawerItem key={item.key} item={item} activeNav={activeNav} onSelect={handleSelect} />
                ))}
              </ul>
            </nav>
          </aside>
          <div className="sila-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
        </>
      )}

      <main className="sila-main">
        <div className={`sila-content${flushContent ? ' sila-content--flush' : ''}`}>{children}</div>
      </main>
    </div>
  );
};

export default AppShell;
