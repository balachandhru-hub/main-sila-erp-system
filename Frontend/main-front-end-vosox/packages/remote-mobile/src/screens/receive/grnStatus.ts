import { getGoodsReceipts, type SilaGoodsReceipt } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { todayIso } from '../../format';

/** ERP outcomes that need someone to look at the goods receipt (prototype: FAILED / UNKNOWN). */
export const GRN_EXCEPTION_STATUSES = ['FAILED', 'UNKNOWN'];

/** Not yet confirmed by the ERP (prototype "Pending GRN": failed, unknown, still posting). */
export const GRN_PENDING_STATUSES = ['FAILED', 'UNKNOWN', 'PENDING', 'POSTING'];

/** The ERP status of a receipt, or its own status when it was not sent to the ERP. */
export const grnErpStatus = (grn: Pick<SilaGoodsReceipt, 'erpStatus' | 'status'>): string => (grn.erpStatus ?? grn.status ?? '').toUpperCase();

export const isGrnPending = (grn: SilaGoodsReceipt): boolean => GRN_PENDING_STATUSES.includes(grnErpStatus(grn));

export const isGrnException = (grn: SilaGoodsReceipt): boolean => GRN_EXCEPTION_STATUSES.includes(grnErpStatus(grn));

/** yyyy-mm-dd of `days` days ago, local time. */
export const daysAgoIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** Goods receipts of the last `days` days (newest page), used for the pending / exception views. */
export const loadRecentGrns = (days = 30, limit = 100): Promise<SilaGoodsReceipt[]> =>
  getGoodsReceipts({ search: '', fromDate: daysAgoIso(days), toDate: todayIso() }, { index: 0, limit });
