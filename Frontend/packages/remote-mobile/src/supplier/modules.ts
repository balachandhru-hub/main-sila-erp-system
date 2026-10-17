/** Framework-only supplier modules. Screens are real; the Cloud service is not connected yet. */

export interface FrameworkView {
  id: string;
  label: string;
}

export interface FrameworkModule {
  id: string;
  title: string;
  eyebrow: string;
  intro: string;
  views: FrameworkView[];
  filters: string[];
  fields: string[];
  actions: string[];
  timeline?: string[];
  diagram?: string[];
}

export const FRAMEWORK: Record<string, FrameworkModule> = {
  'sales-orders': {
    id: 'sales-orders',
    title: 'Sales orders',
    eyebrow: 'Orders',
    intro: 'Sales orders created from customer purchase orders. The Cloud service for this stage is not connected.',
    views: [
      { id: 'all', label: 'All' },
      { id: 'new', label: 'New' },
      { id: 'processing', label: 'Processing' },
      { id: 'ready', label: 'Ready for fulfilment' },
      { id: 'completed', label: 'Completed' },
      { id: 'exception', label: 'Exception' },
    ],
    filters: ['Customer', 'Status', 'Date'],
    fields: ['SO number', 'Customer', 'Customer PO', 'Order date', 'Requested delivery', 'Amount', 'Currency', 'Status', 'Items'],
    actions: ['Open'],
  },
  inventory: {
    id: 'inventory',
    title: 'Supplier inventory',
    eyebrow: 'Inventory',
    intro: 'On-hand, committed and available stock. Available will be on hand minus committed once a Cloud inventory service is connected.',
    views: [
      { id: 'overview', label: 'Overview' },
      { id: 'product', label: 'Stock by product' },
      { id: 'location', label: 'Stock by location' },
      { id: 'pipeline', label: 'Stock pipeline' },
      { id: 'alerts', label: 'Stock alerts' },
    ],
    filters: ['Product', 'Location', 'Status'],
    fields: ['Product', 'SKU / material', 'Description', 'Location', 'On hand', 'Committed', 'Available', 'Incoming', 'Pipeline', 'UOM', 'Stock status'],
    actions: [],
    timeline: ['Ordered', 'Confirmed', 'In production', 'Ready to ship', 'Shipped', 'In transit', 'Customs', 'Arrived', 'Received'],
  },
  vmi: {
    id: 'vmi',
    title: 'Vendor managed inventory',
    eyebrow: 'VMI',
    intro: 'Customer stock, consumption and replenishment recommendations. Nothing is calculated in this phase.',
    views: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'customers', label: 'Customer inventory' },
      { id: 'consumption', label: 'Consumption' },
      { id: 'forecast', label: 'Forecast' },
      { id: 'risk', label: 'Stock risk' },
      { id: 'replenishment', label: 'Replenishment' },
      { id: 'transit', label: 'In transit' },
      { id: 'alerts', label: 'VMI alerts' },
      { id: 'products', label: 'By product' },
    ],
    filters: ['Customer', 'Customer location', 'Product', 'Category', 'Stock status'],
    fields: [
      'Customer', 'Location', 'Product', 'On hand', 'Committed', 'Available', 'In transit', 'Open order qty',
      'Average consumption', 'Forecast', 'Minimum', 'Maximum', 'Safety stock', 'Reorder point', 'Par level',
      'Lead time', 'Projected stock', 'Recommended replenishment', 'Status',
    ],
    actions: ['Approve', 'Modify quantity', 'Reject', 'Review later'],
  },
  fulfilment: {
    id: 'fulfilment',
    title: 'Fulfilment',
    eyebrow: 'Fulfilment',
    intro: 'Goods issue and delivery orders. No fulfilment service is connected yet.',
    views: [
      { id: 'goods-issue', label: 'Goods issue' },
      { id: 'delivery', label: 'Delivery orders' },
    ],
    filters: ['Customer', 'Status', 'Date'],
    fields: ['Number', 'Sales order', 'Customer', 'Customer PO', 'Ship-to', 'Product', 'Quantity', 'Warehouse', 'Date', 'Shipment', 'Status', 'ERP reference'],
    actions: [],
  },
  logistics: {
    id: 'logistics',
    title: 'Logistics',
    eyebrow: 'Logistics',
    intro: 'Shipments, customs, partners and delivery tracking.',
    views: [
      { id: 'planned', label: 'Planned' },
      { id: 'ready', label: 'Ready' },
      { id: 'dispatched', label: 'Dispatched' },
      { id: 'transit', label: 'In transit' },
      { id: 'customs', label: 'Customs' },
      { id: 'out', label: 'Out for delivery' },
      { id: 'delivered', label: 'Delivered' },
      { id: 'delayed', label: 'Delayed' },
      { id: 'partners', label: 'Partners' },
      { id: 'tracking', label: 'Tracking' },
    ],
    filters: ['Customer', 'Carrier', 'Status'],
    fields: ['Shipment', 'Customer', 'Order', 'Carrier', 'Origin', 'Destination', 'Shipment date', 'ETA', 'Tracking reference', 'Country', 'Customs status', 'Documents', 'Partner', 'Contact', 'Service', 'Coverage', 'Performance', 'Status'],
    actions: [],
  },
  finance: {
    id: 'finance',
    title: 'Finance',
    eyebrow: 'Finance',
    intro: 'Invoices, payment status and the statement of account.',
    views: [
      { id: 'invoices', label: 'Invoices' },
      { id: 'payments', label: 'Payment status' },
      { id: 'soa', label: 'Statement of account' },
    ],
    filters: ['Customer', 'Date range', 'Company', 'Currency', 'Status'],
    fields: ['Invoice number', 'Customer', 'Customer PO', 'Sales order', 'Invoice date', 'Due date', 'Amount', 'Paid', 'Outstanding', 'Payment date', 'Payment reference', 'Opening balance', 'Credit notes', 'Adjustments', 'Closing balance', 'Status'],
    actions: [],
  },
  approvals: {
    id: 'approvals',
    title: 'Approvals',
    eyebrow: 'Approvals',
    intro: 'One inbox for catalog price, new product, order, replenishment, inventory and shipment approvals.',
    views: [
      { id: 'pending', label: 'Pending' },
      { id: 'approved', label: 'Approved' },
      { id: 'rejected', label: 'Rejected' },
      { id: 'mine', label: 'My actions' },
    ],
    filters: ['Category', 'Customer'],
    fields: ['Category', 'Reference', 'Customer', 'Requested by', 'Date', 'Status'],
    actions: ['Approve', 'Reject'],
  },
};

export const VMI_KPIS = [
  'Customers under VMI',
  'Products under VMI',
  'Low stock',
  'Stockout risk',
  'Replenishment required',
  'Pending approval',
  'In transit',
  'Excess stock',
  'Projected stockout',
];

export const AUTO_ORDER_STEPS = [
  'Customer demand',
  'Customer stock',
  'Available?',
  'Stock risk',
  'Incoming stock?',
  'Forecast requirement',
  'Replenishment recommendation',
  'Approval',
  'Order',
];

export const ALERT_CATEGORIES = [
  { id: 'rfq', label: 'RFQ closing', live: true },
  { id: 'auction', label: 'Auction live', live: true },
  { id: 'po', label: 'New customer PO', live: false },
  { id: 'po-action', label: 'PO requires action', live: false },
  { id: 'low', label: 'Low stock', live: false },
  { id: 'stockout', label: 'Stockout risk', live: false },
  { id: 'vmi', label: 'VMI replenishment', live: false },
  { id: 'ship', label: 'Shipment delay', live: false },
  { id: 'customs', label: 'Customs delay', live: false },
  { id: 'invoice', label: 'Invoice due', live: false },
  { id: 'payment', label: 'Payment overdue', live: false },
  { id: 'approval', label: 'Approval required', live: false },
  { id: 'integration', label: 'Integration failure', live: true },
];
