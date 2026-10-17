import React from 'react';
import { useLocation } from 'react-router-dom';
import { useGo, useMobileBase } from '../navigation';
import { visibleSupplierModules } from './nav';

const primaryOf = (path: string): string => {
  if (path.startsWith('supplier/sales')) return 'sales';
  if (path.startsWith('supplier/orders')) return 'orders';
  if (path.startsWith('supplier/inventory')) return 'inventory';
  if (path === 'supplier' || path === 'supplier/') return 'home';
  return 'more';
};

/** Sidebar on a wide screen, five-item bar on a phone. */
const SupplierShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const go = useGo();
  const base = useMobileBase();
  const { pathname } = useLocation();
  const relative = pathname.slice(base.length).replace(/^\/+/, '');
  const current = primaryOf(relative);
  const primary = visibleSupplierModules('primary');
  const more = visibleSupplierModules('more');

  return (
    <div className="sp-shell">
      <aside className="sp-side" aria-label="Supplier">
        <strong className="sp-mark">SILA Supplier</strong>
        {primary.map((item) => (
          <button key={item.id} type="button" aria-current={current === item.id ? 'page' : undefined} onClick={() => go(item.to)}>
            {item.label}
          </button>
        ))}
        <h2>Workspace</h2>
        {more.map((item) => (
          <button key={item.id} type="button" aria-current={relative.startsWith(item.to) ? 'page' : undefined} onClick={() => go(item.to)}>
            {item.label}
          </button>
        ))}
        <h2>App</h2>
        <button type="button" onClick={() => go('home')}>
          SILA Store
        </button>
      </aside>
      <div className="sp-main">
        {children}
        <nav className="sp-tabbar" aria-label="Supplier">
          {primary.map((item) => (
            <button key={item.id} type="button" className="sp-tab" aria-current={current === item.id ? 'page' : undefined} onClick={() => go(item.to)}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default SupplierShell;
