export const MENU_VIEWS = [
  { path: 'menu', title: 'Dashboard', view: 'dashboard' },
  { path: 'menu/items', title: 'Menu Items', view: 'items' },
  { path: 'menu/planning', title: 'Menu Planning', view: 'plans' },
  { path: 'menu/portions', title: 'Portion Planning', view: 'portions' },
  { path: 'menu/demand', title: 'Demand Planning', view: 'demand' },
  { path: 'menu/pos', title: 'POS Sales', view: 'pos-sales' },
  { path: 'menu/mapping', title: 'POS Mapping', view: 'pos-mappings' },
  { path: 'menu/performance', title: 'Menu Performance', view: 'performance' },
  { path: 'menu/consumption', title: 'Consumption', view: 'consumption' },
  { path: 'menu/cost', title: 'Cost & Margin', view: 'cost' },
  { path: 'menu/recommendations', title: 'Purchase Recommendations', view: 'recommendations' },
  { path: 'menu/intelligence', title: 'AI Menu Intelligence', view: 'intelligence' },
  { path: 'menu/what-if', title: 'What-If', view: 'simulate' },
] as const;

export type MenuPath = (typeof MENU_VIEWS)[number]['path'];
