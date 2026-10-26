/** Supplier workspace navigation. A later Cloud entitlement can hide a module by id. */

export interface SupplierModule {
  id: string;
  label: string;
  /** Path under the PWA root, without a leading slash. */
  to: string;
  group: 'primary' | 'more';
  /** True when this phase reads an existing Cloud API. */
  live: boolean;
  area: 'home' | 'sales' | 'orders' | 'inventory' | 'catalog' | 'vmi' | 'fulfilment' | 'logistics' | 'o2c' | 'finance' | 'customers' | 'approvals' | 'alerts' | 'sync';
}

export const SUPPLIER_MODULES: SupplierModule[] = [
  { id: 'home', label: 'Home', to: 'supplier', group: 'primary', live: true, area: 'home' },
  { id: 'sales', label: 'Sales', to: 'supplier/sales', group: 'primary', live: true, area: 'sales' },
  { id: 'orders', label: 'Orders', to: 'supplier/orders', group: 'primary', live: true, area: 'orders' },
  { id: 'inventory', label: 'Inventory', to: 'supplier/inventory', group: 'primary', live: false, area: 'inventory' },
  { id: 'more', label: 'More', to: 'supplier/more', group: 'primary', live: false, area: 'home' },
  { id: 'catalog', label: 'Catalog', to: 'supplier/catalog', group: 'more', live: true, area: 'catalog' },
  { id: 'vmi', label: 'VMI', to: 'supplier/vmi', group: 'more', live: false, area: 'vmi' },
  { id: 'fulfilment', label: 'Fulfilment', to: 'supplier/fulfilment', group: 'more', live: false, area: 'fulfilment' },
  { id: 'logistics', label: 'Logistics', to: 'supplier/logistics', group: 'more', live: false, area: 'logistics' },
  { id: 'o2c', label: 'SILA O2C', to: 'supplier/o2c', group: 'more', live: true, area: 'o2c' },
  { id: 'finance', label: 'Finance', to: 'supplier/finance', group: 'more', live: false, area: 'finance' },
  { id: 'customers', label: 'Customers', to: 'supplier/customers', group: 'more', live: true, area: 'customers' },
  { id: 'approvals', label: 'Approvals', to: 'supplier/approvals', group: 'more', live: false, area: 'approvals' },
  { id: 'alerts', label: 'Alerts & Actions', to: 'supplier/alerts', group: 'more', live: true, area: 'alerts' },
  { id: 'sync', label: 'Sync', to: 'supplier/sync', group: 'more', live: true, area: 'sync' },
];

/**
 * This phase does not decide entitlements. The signed-in session sees the supplier workspace.
 * Replace this with the Cloud workspace/module grant when that control exists.
 */
export const supplierModuleVisible = (_moduleId: string): boolean => true;

export const visibleSupplierModules = (group?: SupplierModule['group']): SupplierModule[] =>
  SUPPLIER_MODULES.filter((item) => supplierModuleVisible(item.id) && (!group || item.group === group));
