import React from 'react';
import { useLocation } from 'react-router-dom';
import { PoweredFooter } from '../components/StateViews';
import { useGo, useMobileBase } from '../navigation';
import { visibleSupplierModules } from './nav';

const ICONS: Record<string, string> = {
  home: '⌂',
  sales: '⚑',
  orders: '▤',
  inventory: '▦',
  more: '☰',
};

const primaryOf = (path: string): string => {
  if (path.startsWith('supplier/sales')) return 'sales';
  if (path.startsWith('supplier/orders')) return 'orders';
  if (path.startsWith('supplier/inventory')) return 'inventory';
  if (path === 'supplier' || path === 'supplier/') return 'home';
  return 'more';
};

/** Same phone column and bottom bar as SILA Store. Supplier activities stay in the tabs. */
const SupplierShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const go = useGo();
  const base = useMobileBase();
  const { pathname } = useLocation();
  const relative = pathname.slice(base.length).replace(/^\/+/, '');
  const current = primaryOf(relative);
  const primary = visibleSupplierModules('primary');

  return (
    <div className="sm-root">
      <div className="sm-app">
        {children}
        <PoweredFooter />
        <nav className="sm-tabbar" aria-label="Main">
          {primary.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sm-tabbar__item"
              aria-current={current === item.id ? 'page' : undefined}
              onClick={() => go(item.to)}
            >
              <span className="sm-tabbar__icon" aria-hidden="true">
                {ICONS[item.id] ?? '•'}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default SupplierShell;
