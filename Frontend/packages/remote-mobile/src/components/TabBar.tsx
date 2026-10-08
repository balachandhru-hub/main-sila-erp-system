import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGo, useMobileBase } from '../navigation';

interface TabDef {
  key: string;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'receive', label: 'Receive', icon: '⇩' },
  { key: 'inventory', label: 'Inventory', icon: '▦' },
  { key: 'tasks', label: 'Tasks', icon: '✓' },
  { key: 'more', label: 'More', icon: '☰' },
];

/** Bottom navigation of the app. */
const TabBar: React.FC = () => {
  const go = useGo();
  const base = useMobileBase();
  const { pathname } = useLocation();
  const current = pathname.slice(base.length).replace(/^\/+/, '').split('/')[0] || 'home';

  return (
    <nav className="sm-tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className="sm-tabbar__item"
          aria-current={current === tab.key ? 'page' : undefined}
          onClick={() => go(tab.key)}
        >
          <span className="sm-tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default TabBar;
