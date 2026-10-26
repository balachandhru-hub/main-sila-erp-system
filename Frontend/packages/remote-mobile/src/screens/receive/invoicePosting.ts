import type { SilaInvoiceDetail } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';

const LOCKED = new Set([
  'POSTING',
  'POSTING_UNKNOWN',
  'POSTED',
  'AWAITING_PAYMENT',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'PENDING_APPROVAL',
  'GRN_IN_PROGRESS',
]);

const CORRECTABLE = new Set(['VALIDATION_FAILED', 'GET_PO_FAILED', 'EXTRACTED', 'REVIEWED', 'READY_FOR_INVOICE_SUBMISSION', 'OCR_FAILED']);

export const invoiceEditLocked = (status?: string | null): boolean => LOCKED.has((status || '').toUpperCase());

export const invoiceFormVisible = (invoice: SilaInvoiceDetail): boolean => {
  const status = (invoice.status || '').toUpperCase();
  if (status === 'GRN_POSTED' || status === 'POSTED' || status === 'ERP_POSTING_FAILED') return false;
  if (invoiceEditLocked(status)) return false;
  return CORRECTABLE.has(status) || status === '';
};

export const invoicePostingFailed = (invoice: SilaInvoiceDetail): boolean => {
  const status = (invoice.status || '').toUpperCase();
  const erp = (invoice.erpStatus || '').toUpperCase();
  return status === 'ERP_POSTING_FAILED' || erp === 'FAILED' || erp === 'SKIPPED';
};

export const invoicePosted = (invoice: SilaInvoiceDetail): boolean => {
  const status = (invoice.status || '').toUpperCase();
  return status === 'POSTED' || status === 'AWAITING_PAYMENT' || status === 'PARTIALLY_PAID' || status === 'PAID' || status === 'OVERDUE';
};

/** End-user ERP text: keep SAP business errors, hide key-ring / path / secret detail. */
export const safeErpMessage = (message?: string | null): string | null => {
  if (!message || !message.trim()) return null;
  const text = message.trim();
  if (/key ring|dataprotection|data protection|unprotect|decrypt|protected_password|connection string|stack trace|\/tmp\/|\/workspace\//i.test(text)) {
    return 'ERP integration credentials could not be decrypted. Re-save the FIVE S4-INVOICE POSTING credentials and retry.';
  }
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{27}/i.test(text) && /key/i.test(text)) {
    return 'ERP integration credentials could not be decrypted. Re-save the FIVE S4-INVOICE POSTING credentials and retry.';
  }
  return text;
};
