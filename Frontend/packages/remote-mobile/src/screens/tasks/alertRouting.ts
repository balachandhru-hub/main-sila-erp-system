import type { SilaAlert } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';

/**
 * Screen an alert opens: its reference when the app has a screen for it, otherwise the recommended action
 * (prototype: REVIEW_TRANSFER → transfers, QUICK_TRANSFER → quick transfer, else live stock).
 */
export const alertTarget = (alert: SilaAlert): string | null => {
  const type = (alert.referenceType ?? '').toUpperCase();
  if (alert.referenceId) {
    if (type === 'SUBSTITUTION') return `tasks/substitutions/${alert.referenceId}`;
    if (type.includes('TRANSFER') || type === 'ITO') return `inventory/transfers/${alert.referenceId}`;
    if (type.includes('STOCK_COUNT') || type === 'COUNT') return `inventory/counts/${alert.referenceId}`;
    if (type.includes('ENQUIRY')) return `tasks/enquiries/${alert.referenceId}`;
  }
  const action = (alert.recommendedAction ?? '').toUpperCase();
  if (action === 'REVIEW_TRANSFER') return 'inventory/transfers';
  if (action === 'QUICK_TRANSFER') return 'inventory/transfers/new?mode=quick';
  if (alert.materialId) return `inventory/stock/${alert.materialId}`;
  if (action) return 'inventory/stock';
  return null;
};
