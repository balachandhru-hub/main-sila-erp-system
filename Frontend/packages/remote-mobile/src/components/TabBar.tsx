import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGo, useMobileBase } from '../navigation';
import { useAccess } from '../access';
import { silaHomeCapabilities } from '../../../remote-buyer/src/components/silaMe/silaHomeCapabilities';
import { MobileIcon, type MobileIconName } from './MobileIcons';

interface TabDef {
  key: string;
  label: string;
  icon: MobileIconName;
}

const TABS: (TabDef & { show?: (caps: ReturnType<typeof silaHomeCapabilities>) => boolean })[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'receive', label: 'Receive', icon: 'receive', show: (caps) => caps.viewReceiving },
  { key: 'inventory', label: 'Inventory', icon: 'inventory', show: (caps) => caps.viewInventory },
  { key: 'tasks', label: 'Tasks', icon: 'tasks' },
  { key: 'more', label: 'More', icon: 'more' },
];

/** Bottom navigation of the app. */
const TabBar: React.FC = () => {
  const go = useGo();
  const base = useMobileBase();
  const { can } = useAccess();
  const caps = silaHomeCapabilities(true, can);
  const { pathname } = useLocation();
  const current = pathname.slice(base.length).replace(/^\/+/, '').split('/')[0] || 'home';

  return (
    <nav className="sm-tabbar" aria-label="Main">
      {TABS.filter((tab) => !tab.show || tab.show(caps)).map((tab) => (
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
