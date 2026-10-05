import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

export interface SilaOpenPurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string | null;
  orderDate: string;
  status: string;
  plantCode?: string | null;
  currency?: string | null;
  totalAmount: number;
  lineCount: number;
  openLineCount: number;
  /** Company code (entity) of the PO. */
  entityCode?: string | null;
  deliveryDate?: string | null;
  totalOrderedQuantity?: number;
}

export interface SilaPurchaseOrderLine {
  id: string;
  lineNumber: number;
  materialCode?: string | null;
  /** null when no Item Master material has the code: received on the PO but not stocked. */
  materialId?: string | null;
  productName: string;
  uom?: string | null;
  unitPrice?: number | null;
  orderedQty: number;
  receivedQty: number;
  openQty: number;
  /** OPEN | PARTIALLY_RECEIVED | RECEIVED */
  status?: string;
  /** False for service lines and lines the ERP marks so. */
  goodsReceiptExpected?: boolean;
  /** ERP item number (00010). */
  itemNumber?: string;
  /** The material needs a batch number / expiry date on receipt. */
  batchManaged?: boolean;
  expiryManaged?: boolean;
  shelfLifeDays?: number | null;
}

export interface SilaPurchaseOrderDetail extends Omit<SilaOpenPurchaseOrder, "lineCount" | "openLineCount"> {
  companyCode?: string | null;
  /** ERP or system the PO came from. */
  sourceSystem?: string | null;
  lines: SilaPurchaseOrderLine[];
}

export interface SilaGrnLineWrite {
  purchaseOrderItemId: string;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  damagedQty: number;
  /** Required for a batch-managed material. */
  batchNumber?: string | null;
  /** yyyy-MM-dd; required for an expiry-managed material. */
  expiryDate?: string | null;
}

export interface SilaGrnWrite {
  purchaseOrderId: string;
  locationId: string;
  invoiceId?: string | null;
  deliveryNote?: string | null;
  lines: SilaGrnLineWrite[];
}

/** PENDING | POSTED | FAILED | SKIPPED | UNKNOWN (no clear ERP answer: reconcile) */
export type SilaErpPostingStatus = string;

export interface SilaErpPosting {
  id: string;
  referenceType: string;
  referenceId: string;
  referenceNumber: string;
  locationId?: string | null;
  locationName?: string | null;
  movementType: string;
  status: SilaErpPostingStatus;
  attempts: number;
  erpReference?: string | null;
  errorMessage?: string | null;
  postedOn?: string | null;
  createdOn: string;
  /** Company code the ERP API is chosen by (falls back to the ALL API). */
  companyCode?: string | null;
}

export interface SilaGoodsReceipt {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName?: string | null;
  locationId: string;
  locationName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  deliveryNote?: string | null;
  status: string;
  receivedOn: string;
  lineCount: number;
  erpStatus?: SilaErpPostingStatus | null;
  erpReference?: string | null;
}

export interface SilaGoodsReceiptItem {
  id: string;
  purchaseOrderItemId: string;
  materialId?: string | null;
  materialCode?: string | null;
  materialName: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  damagedQty: number;
  uom?: string | null;
  stocked: boolean;
  openQtyBefore?: number | null;
  invoiceQty?: number | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
}

export interface SilaGoodsReceiptDetail extends Omit<SilaGoodsReceipt, "lineCount" | "erpStatus" | "erpReference"> {
  receivedBy: string;
  erpPosting?: SilaErpPosting | null;
  items: SilaGoodsReceiptItem[];
}

/** UPLOADED | EXTRACTED | REVIEW_REQUIRED | OCR_FAILED | REVIEWED | GRN_POSTED */
export type SilaInvoiceStatus = string;

export interface SilaInvoice {
  id: string;
  invoiceNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  fileName: string;
  status: SilaInvoiceStatus;
  /** 0..1 */
  ocrConfidence?: number | null;
  uploadedOn: string;
  /** MATERIAL | SERVICE | MIXED */
  invoiceType?: string | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  supplierTaxNumber?: string | null;
  /** False for a SERVICE invoice. */
  goodsReceiptApplicable?: boolean;
}

export interface SilaInvoiceItem {
  id?: string | null;
  lineNumber: number;
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
  purchaseOrderItemId?: string | null;
  uom?: string | null;
  supplierMaterialCode?: string | null;
  /** Percent. */
  taxRate?: number | null;
  /** MATCHED | SUGGESTED | UNMATCHED (read only). */
  matchStatus?: string | null;
}

export interface SilaInvoiceDetail extends SilaInvoice {
  ocrText?: string | null;
  /** Why the OCR failed, when the status is OCR_FAILED. */
  ocrMessage?: string | null;
  uploadedBy: string;
  items: SilaInvoiceItem[];
  goodsReceipts: SilaGoodsReceipt[];
  /** The Supplier Master row the invoice is matched to. */
  silaSupplierId?: string | null;
  supplierCode?: string | null;
  /** The invoice's ERP posting (POST_INVOICE), queued with its goods receipt. */
  erpPostingId?: string | null;
  erpStatus?: string | null;
  erpReference?: string | null;
  erpMessage?: string | null;
  /** The reading was below the minimum confidence. */
  needsReview: boolean;
  /** "Goods receipt not applicable for a service invoice." */
  goodsReceiptNote?: string | null;
  /** Net + tax differs from gross by more than the tolerance. */
  reconciliationWarning?: string | null;
  contentHash?: string | null;
}

export interface SilaInvoiceWrite {
  invoiceNumber?: string | null;
  supplierId?: string | null;
  /** Supplier Master row; when omitted it is kept unless the supplier name changes. */
  silaSupplierId?: string | null;
  supplierName?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  purchaseOrderId?: string | null;
  /** MATERIAL | SERVICE | MIXED; null keeps the current type. */
  invoiceType?: string | null;
  /** Null keeps the current amount. */
  netAmount?: number | null;
  taxAmount?: number | null;
  /** Null keeps the current number; "" clears it. */
  supplierTaxNumber?: string | null;
  items: SilaInvoiceItem[];
}

export interface SilaPage {
  index: number;
  limit: number;
}

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalizeInvoice = (invoice: SilaInvoiceDetail): SilaInvoiceDetail => ({
  ...invoice,
  items: list(invoice.items),
  goodsReceipts: list(invoice.goodsReceipts),
});

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await request()).data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

/** Purchase orders that still have quantity to receive, searched by PO number or supplier. */
export const getOpenPurchaseOrders = async (search: string, page: SilaPage): Promise<SilaOpenPurchaseOrder[]> =>
  list(await call(() => axiosInstance.get<SilaOpenPurchaseOrder[]>(`${BASE}/purchase-orders/open`, {
    params: { search: search.trim() || undefined, ...page },
  }), "Could not load the open purchase orders."));

export const getPurchaseOrder = async (purchaseOrderId: string): Promise<SilaPurchaseOrderDetail> => {
  const data = await call(() => axiosInstance.get<SilaPurchaseOrderDetail>(`${BASE}/purchase-orders/${purchaseOrderId}`), "Could not load the purchase order.");
  return { ...data, lines: list(data.lines) };
};

export interface SilaGrnFilter {
  search: string;
  fromDate: string;
  toDate: string;
}

export const getGoodsReceipts = async (filter: SilaGrnFilter, page: SilaPage): Promise<SilaGoodsReceipt[]> =>
  list(await call(() => axiosInstance.get<SilaGoodsReceipt[]>(`${BASE}/grns`, {
    params: {
      search: filter.search.trim() || undefined,
      fromDate: filter.fromDate || undefined,
      toDate: filter.toDate || undefined,
      ...page,
    },
  }), "Could not load the goods receipts."));

export const getGoodsReceipt = async (goodsReceiptId: string): Promise<SilaGoodsReceiptDetail> => {
  const data = await call(() => axiosInstance.get<SilaGoodsReceiptDetail>(`${BASE}/grns/${goodsReceiptId}`), "Could not load the goods receipt.");
  return { ...data, items: list(data.items) };
};

/** Posts the goods receipt; returns its id. */
export const postGoodsReceipt = async (request: SilaGrnWrite): Promise<string> => {
  const data = await call(() => axiosInstance.post<{ id: string }>(`${BASE}/grns`, request), "Could not post the goods receipt.");
  return data.id;
};

export const getInvoices = async (search: string, status: string, page: SilaPage): Promise<SilaInvoice[]> =>
  list(await call(() => axiosInstance.get<SilaInvoice[]>(`${BASE}/invoices`, {
    params: { search: search.trim() || undefined, status: status || undefined, ...page },
  }), "Could not load the invoices."));

export const getInvoice = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.get<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}`), "Could not load the invoice."));

/** Uploads a PDF, JPEG or PNG invoice (max 20 MB); returns the new invoice id. */
export const uploadInvoice = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const data = await call(() => axiosInstance.post<{ id: string }>(`${BASE}/invoices/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  }), "Could not upload the invoice.");
  return data.id;
};

/** Reads the invoice with OCR; a failed OCR comes back as status OCR_FAILED, not as an error. */
export const extractInvoice = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/extract`), "Could not read the invoice."));

export const updateInvoice = async (invoiceId: string, request: SilaInvoiceWrite): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.put<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}`, request), "Could not save the invoice."));

/** The stored invoice file, to open or download. */
export const getInvoiceFile = async (invoiceId: string): Promise<Blob> =>
  call(() => axiosInstance.get<Blob>(`${BASE}/invoices/${invoiceId}/file`, { responseType: "blob" }), "Could not open the invoice file.");

export const getErpPostings = async (status: string, search: string, page: SilaPage): Promise<SilaErpPosting[]> =>
  list(await call(() => axiosInstance.get<SilaErpPosting[]>(`${BASE}/erp-postings`, {
    params: { status: status || undefined, search: search.trim() || undefined, ...page },
  }), "Could not load the ERP postings."));

/** FAILED or SKIPPED back to PENDING; the job sends it within a minute. */
export const reprocessErpPosting = async (postingId: string): Promise<void> => {
  await call(() => axiosInstance.post(`${BASE}/erp-postings/${postingId}/reprocess`), "Could not reprocess the posting.");
};

export interface SilaGrnValidationLine {
  purchaseOrderItemId: string;
  lineNumber: number;
  productName: string;
  uom?: string | null;
  orderedQty: number;
  openQty: number;
  receivedQty: number;
  acceptedQty: number;
  remainingQty: number;
  invoiceQty?: number | null;
  value?: number | null;
  stocked: boolean;
  messages: string[];
}

export interface SilaGrnValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  lines: SilaGrnValidationLine[];
  totalReceived: number;
  totalAccepted: number;
  totalValue?: number | null;
  currency?: string | null;
}

export interface SilaSupplierCandidate {
  silaSupplierId?: string | null;
  supplierId?: string | null;
  supplierCode?: string | null;
  name: string;
  taxNumber?: string | null;
  /** MASTER | PURCHASE_ORDER */
  source: string;
  score: number;
  reason: string;
}

export interface SilaInvoiceOcrFields {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  supplierName?: string | null;
  supplierTaxNumber?: string | null;
  poNumber?: string | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  invoiceType?: string | null;
}

export interface SilaInvoiceExtraction {
  id: string;
  attempt: number;
  /** UPLOAD | MANUAL | REREAD */
  trigger: string;
  /** PDF_TEXT | OCR | EXTERNAL */
  method: string;
  /** COMPLETED | FAILED */
  status: string;
  confidence?: number | null;
  message?: string | null;
  fields?: SilaInvoiceOcrFields | null;
  lineCount: number;
  createdOn: string;
  /** BUILT_IN | EXTERNAL | CACHED */
  provider?: string | null;
  durationMs?: number | null;
  contentHash?: string | null;
}

/** Checks a goods receipt without posting it: errors block, warnings need a confirmation. */
export const validateGoodsReceipt = async (request: SilaGrnWrite): Promise<SilaGrnValidation> => {
  const data = await call(() => axiosInstance.post<SilaGrnValidation>(`${BASE}/grns/validate`, request), "Could not check the goods receipt.");
  return { ...data, errors: list(data.errors), warnings: list(data.warnings), lines: list(data.lines) };
};

/** Reads the invoice again; fields the user corrected are kept. */
export const rereadInvoice = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/reread`), "Could not read the invoice again."));

export const getSupplierCandidates = async (invoiceId: string, search: string): Promise<SilaSupplierCandidate[]> =>
  list(await call(() => axiosInstance.get<SilaSupplierCandidate[]>(`${BASE}/invoices/${invoiceId}/supplier-candidates`, {
    params: { search: search.trim() || undefined },
  }), "Could not load the supplier candidates."));

export const matchInvoiceSupplier = async (invoiceId: string, candidate: { silaSupplierId?: string | null; supplierId?: string | null }): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/match-supplier`, candidate), "Could not match the supplier."));

export const getPoCandidates = async (invoiceId: string, search: string, page: SilaPage): Promise<SilaOpenPurchaseOrder[]> =>
  list(await call(() => axiosInstance.get<SilaOpenPurchaseOrder[]>(`${BASE}/invoices/${invoiceId}/po-candidates`, {
    params: { search: search.trim() || undefined, ...page },
  }), "Could not load the purchase orders of the supplier."));

/** Links the invoice to an open purchase order of its supplier; the lines are matched again. */
export const matchInvoicePurchaseOrder = async (invoiceId: string, purchaseOrderId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/match-po`, { purchaseOrderId }), "Could not match the purchase order."));

export const matchInvoiceLines = async (invoiceId: string, lines: { invoiceItemId: string; purchaseOrderItemId: string | null }[]): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/match-lines`, { lines }), "Could not match the invoice lines."));

export const getInvoiceExtractions = async (invoiceId: string): Promise<SilaInvoiceExtraction[]> =>
  list(await call(() => axiosInstance.get<SilaInvoiceExtraction[]>(`${BASE}/invoices/${invoiceId}/extractions`), "Could not load the reading history."));

/** Settles an UNKNOWN posting: posted (with the ERP number) or not posted (sent again). */
export const reconcileErpPosting = async (postingId: string, posted: boolean, erpReference: string): Promise<void> => {
  await call(() => axiosInstance.post(`${BASE}/erp-postings/${postingId}/reconcile`, { posted, erpReference: erpReference.trim() || null }), "Could not reconcile the posting.");
};
