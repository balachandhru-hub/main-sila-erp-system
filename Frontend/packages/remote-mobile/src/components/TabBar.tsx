import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGo, useMobileBase } from '../navigation';
import { MobileIcon, type MobileIconName } from './MobileIcons';

interface TabDef {
  key: string;
  label: string;
  icon: MobileIconName;
}

const TABS: TabDef[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'receive', label: 'Receive', icon: 'receive' },
  { key: 'inventory', label: 'Inventory', icon: 'inventory' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'more', label: 'More', icon: 'more' },
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
            <MobileIcon name={tab.icon} />
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
};

export default TabBar;
