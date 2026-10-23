import axiosInstance from "../axiosInstance";
import axios from "axios";
import { readBody, readError } from "../readError";
import { normalizeCreditMemoEligibleLine } from "./silaCreditMemoAmounts";

export {
  creditMemoAmountForQuantity,
  creditMemoAmountTextForQuantity,
  creditMemoDraftFromLine,
  creditMemoExcludeDraft,
  creditMemoIncludeDraft,
  creditMemoUnitValue,
  formatCreditAmount,
  formatCreditQuantity,
  mergeCreditMemoEligibleLines,
  normalizeCreditMemoEligibleLine,
} from "./silaCreditMemoAmounts";

export interface SilaOpenPurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string | null;
  /** ERP supplier number. A system id is not shown as the supplier. */
  supplierCode?: string | null;
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
  /** Tax code from the purchase order API. */
  taxCode?: string | null;
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
  discountPercent?: number | null;
  lineAmount?: number;
  sku?: string | null;
  storageLocation?: string | null;
  costCenter?: string | null;
  materialGroup?: string | null;
}

export interface SilaDocumentTrackNode {
  kind: string;
  id?: string | null;
  label: string;
  number?: string | null;
  status?: string | null;
  erpReference?: string | null;
  current: boolean;
}

export interface SilaDocumentTrackEvent {
  action: string;
  comment?: string | null;
  occurredOn: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface SilaDocumentTrackAttachment {
  documentType: string;
  fileName: string;
  status?: string | null;
  invoiceId?: string | null;
  goodsReceiptId?: string | null;
  url?: string | null;
}

export interface SilaDocumentTrack {
  rootKind: string;
  rootId: string;
  nodes: SilaDocumentTrackNode[];
  history: SilaDocumentTrackEvent[];
  attachments: SilaDocumentTrackAttachment[];
}

export interface SilaPurchaseOrderDetail extends Omit<SilaOpenPurchaseOrder, "lineCount" | "openLineCount"> {
  companyCode?: string | null;
  /** ERP or system the PO came from. */
  sourceSystem?: string | null;
  sourceType?: string | null;
  erpPurchaseOrderId?: string | null;
  supplierErpSalesOrderNumber?: string | null;
  bucketCode?: string | null;
  totalReceivedQuantity?: number;
  totalOpenQuantity?: number;
  lineCount?: number;
  openLineCount?: number;
  lines: SilaPurchaseOrderLine[];
  documentTrack?: SilaDocumentTrack | null;
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
  /** Named SAP API that posted the document. */
  integrationSystem?: string | null;
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
  /** Status of the invoice holding this goods receipt. */
  invoiceStatus?: string | null;
  /** ERP status of that invoice. */
  invoiceErpStatus?: string | null;
  deliveryNote?: string | null;
  status: string;
  receivedOn: string;
  lineCount: number;
  erpPostingId?: string | null;
  erpStatus?: SilaErpPostingStatus | null;
  erpReference?: string | null;
  reversalGrnNumber?: string | null;
  parentGoodsReceiptId?: string | null;
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
  materialDocument?: string | null;
  materialDocumentYear?: string | null;
  reversalMaterialDocument?: string | null;
  reversalMaterialDocumentYear?: string | null;
  reversalGrnNumber?: string | null;
  reversalGoodsReceiptId?: string | null;
  parentGoodsReceiptId?: string | null;
  reversalStatus?: string | null;
  erpPosting?: SilaErpPosting | null;
  items: SilaGoodsReceiptItem[];
  documentTrack?: SilaDocumentTrack | null;
}

export interface SilaGrnReversalLine {
  goodsReceiptItemId: string;
  materialCode?: string | null;
  materialName: string;
  poItem: number;
  purchaseOrderItem?: string | null;
  materialDocumentItem?: string | null;
  originalReceivedQty: number;
  previouslyReversedQty: number;
  remainingReversibleQty: number;
  reversalQty: number;
  uom?: string | null;
  plant?: string | null;
  storageLocation?: string | null;
}

export interface SilaGrnReversalHistory {
  erpPostingId: string;
  reversalNumber?: string | null;
  postedOn?: string | null;
  status: string;
  materialDocument?: string | null;
  materialDocumentYear?: string | null;
  reason?: string | null;
  reversedQuantity: number;
  errorMessage?: string | null;
}

export interface SilaGrnReversalPreview {
  goodsReceiptId: string;
  grnNumber: string;
  status: string;
  materialDocument?: string | null;
  materialDocumentYear?: string | null;
  reversalMaterialDocument?: string | null;
  reversalMaterialDocumentYear?: string | null;
  reversalGrnNumber?: string | null;
  reversalGoodsReceiptId?: string | null;
  reversalStatus?: string | null;
  poNumber: string;
  supplierName?: string | null;
  companyCode?: string | null;
  propertyName?: string | null;
  plant?: string | null;
  storageLocation?: string | null;
  originalPostingDate?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  invoiceGate: string;
  decision: string;
  canReverse: boolean;
  invoiceMustReverseFirst: boolean;
  localFinalizationNeeded: boolean;
  fullDocumentCancelOnly: boolean;
  integrationName?: string | null;
  message?: string | null;
  lines: SilaGrnReversalLine[];
  history?: SilaGrnReversalHistory[];
}

export interface SilaGrnReversalLineWrite {
  goodsReceiptItemId: string;
  reversalQuantity: number;
}

export interface SilaGrnReversalWrite {
  reason: string;
  remarks?: string | null;
  postingDate?: string | null;
  documentDate?: string | null;
  reverseInvoiceAndGrn?: boolean;
  localFinalizationOnly?: boolean;
  lines?: SilaGrnReversalLineWrite[];
}

export interface SilaGrnReversalResult {
  goodsReceiptId: string;
  grnNumber: string;
  status: string;
  reversalStatus?: string | null;
  materialDocument?: string | null;
  materialDocumentYear?: string | null;
  reversalMaterialDocument?: string | null;
  reversalMaterialDocumentYear?: string | null;
  reversalGrnNumber?: string | null;
  reversalGoodsReceiptId?: string | null;
  message: string;
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
  /** Every purchase order billed by this invoice. */
  purchaseOrders?: { id: string; poNumber: string }[];
  erpReference?: string | null;
  fiscalYear?: string | null;
  postingDate?: string | null;
  fileName: string;
  status: SilaInvoiceStatus;
  /** 0..1 */
  ocrConfidence?: number | null;
  uploadedOn: string;
  /** MATERIAL | SERVICE | MIXED */
  invoiceType?: string | null;
  /** PO | NON_PO */
  creationType?: string | null;
  companyCode?: string | null;
  propertyId?: string | null;
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
  purchaseOrderId?: string | null;
  poNumber?: string | null;
  uom?: string | null;
  supplierMaterialCode?: string | null;
  /** Percent. */
  taxRate?: number | null;
  /** MATCHED | SUGGESTED | UNMATCHED (read only). */
  matchStatus?: string | null;
  taxCode?: string | null;
  glAccount?: string | null;
  costCenter?: string | null;
  profitCenter?: string | null;
  internalOrder?: string | null;
  wbsElement?: string | null;
  businessArea?: string | null;
  assignmentReference?: string | null;
  debitCreditCode?: string | null;
  lineText?: string | null;
  goodsReceiptItemId?: string | null;
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
  /** Fiscal year stored from the S/4 invoice posting response. */
  fiscalYear?: string | null;
  erpMessage?: string | null;
  /** S/4 URL attachment. Independent of the invoice posting. */
  attachment?: SilaInvoiceAttachment;
  /** The reading was below the minimum confidence. */
  needsReview: boolean;
  /** "Goods receipt not applicable for a service invoice." */
  goodsReceiptNote?: string | null;
  /** Net + tax differs from gross by more than the tolerance. */
  reconciliationWarning?: string | null;
  contentHash?: string | null;
  /** The user can submit this invoice. Posting does not start until they do. */
  canSubmitInvoice?: boolean;
  paymentStatus?: string | null;
  /** NOT CONFIGURED when no payment-status API exists. */
  paymentIntegration?: string | null;
  outstandingAmount?: number | null;
  documents?: SilaInvoiceDocument[];
  timeline?: SilaInvoiceStep[];
  documentTrack?: SilaDocumentTrack | null;
  /** Stored business values for FIVE S4-INVOICE POSTING. Null until the purchase order is read. */
  postingData?: SilaInvoicePostingData | null;
  creditMemos?: SilaCreditMemoListItem[];
}

export interface SilaCreditMemoListItem {
  id: string;
  creditMemoNumber?: string | null;
  referenceInvoiceId: string;
  referenceSupplierInvoiceNumber?: string | null;
  referenceErpInvoiceId?: string | null;
  status: string;
  grossAmount?: number | null;
  currency?: string | null;
  createdOn: string;
  erpReference?: string | null;
  fiscalYear?: string | null;
  supplierName?: string | null;
  poNumber?: string | null;
}

export interface SilaCreditMemoReferenceInvoice {
  id: string;
  invoiceNumber?: string | null;
  erpInvoiceId?: string | null;
  fiscalYear?: string | null;
  supplierName?: string | null;
  poNumber?: string | null;
  companyCode?: string | null;
  currency?: string | null;
  originalGrossAmount?: number | null;
  postingDate?: string | null;
  invoiceDate?: string | null;
  status: string;
  headerText?: string | null;
}

export interface SilaCreditMemoEligibleLine {
  invoiceLineId: string;
  lineNumber: number;
  poNumber?: string | null;
  poItem?: string | null;
  material?: string | null;
  description: string;
  originalQuantity: number;
  originalAmount: number;
  previouslyCreditedQuantity: number;
  previouslyCreditedAmount: number;
  remainingQuantity: number;
  remainingAmount: number;
  uom?: string | null;
  taxCode?: string | null;
}

export interface SilaCreditMemoLineWrite {
  invoiceLineId: string;
  quantity?: number | null;
  amount?: number | null;
  reason?: string | null;
}

export interface SilaCreditMemoWrite {
  referenceInvoiceId?: string | null;
  invoiceNumber?: string | null;
  erpInvoiceId?: string | null;
  creditMemoReference?: string | null;
  documentDate?: string | null;
  postingDate?: string | null;
  taxCalculationDate?: string | null;
  reason?: string | null;
  headerText?: string | null;
  lines: SilaCreditMemoLineWrite[];
}

export interface SilaCreditMemoLine {
  id: string;
  referenceInvoiceLineId?: string | null;
  lineNumber: number;
  poNumber?: string | null;
  poItem?: string | null;
  material?: string | null;
  description: string;
  quantity?: number | null;
  uom?: string | null;
  amount?: number | null;
  taxCode?: string | null;
  reason?: string | null;
  originalQuantity: number;
  originalAmount: number;
  previouslyCreditedQuantity: number;
  previouslyCreditedAmount: number;
  remainingQuantity: number;
  remainingAmount: number;
}

export interface SilaCreditMemoDetail {
  id: string;
  creditMemoNumber?: string | null;
  creditMemoReference?: string | null;
  referenceInvoiceId: string;
  referenceSupplierInvoiceNumber?: string | null;
  referenceErpInvoiceId?: string | null;
  referenceFiscalYear?: string | null;
  supplierName?: string | null;
  poNumber?: string | null;
  companyCode?: string | null;
  currency?: string | null;
  documentDate?: string | null;
  postingDate?: string | null;
  taxCalculationDate?: string | null;
  reason?: string | null;
  headerText?: string | null;
  grossAmount?: number | null;
  status: string;
  erpPostingId?: string | null;
  erpStatus?: string | null;
  erpReference?: string | null;
  fiscalYear?: string | null;
  erpMessage?: string | null;
  integrationName?: string | null;
  postedOn?: string | null;
  canSubmit: boolean;
  canRetry: boolean;
  referenceLocked: boolean;
  lines: SilaCreditMemoLine[];
  referenceInvoice: SilaCreditMemoReferenceInvoice;
  documentTrack?: SilaDocumentTrack | null;
  history: SilaDocumentTrackEvent[];
}

export interface SilaInvoicePostingField {
  apiField: string;
  label: string;
  value?: string | null;
  source: string;
  sourceField: string;
  required: boolean;
}

export interface SilaInvoicePostingLine {
  invoiceLine: number;
  grnNumber?: string | null;
  materialDocument?: string | null;
  fields: SilaInvoicePostingField[];
}

export interface SilaInvoicePostingData {
  preparationStatus?: string | null;
  preparedAt?: string | null;
  version: number;
  purchaseOrder?: string | null;
  sourceApi?: string | null;
  /** PO | NON_PO */
  invoiceMode?: string | null;
  stale: boolean;
  header: SilaInvoicePostingField[];
  lines: SilaInvoicePostingLine[];
}

export interface SilaInvoiceDocument {
  documentType: string;
  grnNumber?: string | null;
  poNumber?: string | null;
  generatedOn?: string | null;
  fileName: string;
  goodsReceiptId?: string | null;
}

export interface SilaInvoiceStep {
  step: string;
  /** SUCCESS | FAILED | PENDING | NOT_STARTED | UNKNOWN */
  status: string;
}

export interface SilaInvoiceAttachment {
  businessObject: string;
  businessObjectType: string;
  linkedSapObjectKey?: string | null;
  fileName?: string | null;
  /** External document address prepared before CreateUrlAsAttachment is called. */
  url?: string | null;
  httpStatus?: number | null;
  /** Not started | Pending | Processing | Success | Failed | Unknown */
  status: string;
  lastAttempt?: string | null;
  message?: string | null;
  canReprocess: boolean;
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
  creditMemos: list(invoice.creditMemos),
  documents: list(invoice.documents),
  timeline: list(invoice.timeline),
  canSubmitInvoice: Boolean(invoice.canSubmitInvoice),
  postingData: invoice.postingData
    ? {
        ...invoice.postingData,
        header: list(invoice.postingData.header),
        lines: list(invoice.postingData.lines).map((line) => ({ ...line, fields: list(line.fields) })),
      }
    : null,
});

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await request()).data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

export interface SilaReceivingDashboardKpis {
  expectedToday: number;
  pendingReceipt: number;
  partiallyReceived: number;
  receivedToday: number;
  overdue: number;
  grnPostingFailed: number;
  reversalsToday: number;
  attentionRequired: number;
}

export interface SilaReceivingAging {
  pendingUnderOneDay: number;
  pendingOneToTwoDays: number;
  pendingThreePlusDays: number;
  overdue: number;
  openPartials: number;
  unresolvedGrnFailures: number;
}

export interface SilaReceivingDashboardLocation {
  id: string;
  locationName: string;
  propertyName?: string | null;
  plantCode?: string | null;
  storageLocationCode?: string | null;
}

export interface SilaReceivingTask {
  priority: string;
  type: string;
  title: string;
  poNumber?: string | null;
  grnNumber?: string | null;
  supplierName?: string | null;
  locationName?: string | null;
  expectedDate?: string | null;
  age?: string | null;
  status?: string | null;
  action: string;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  invoiceId?: string | null;
  creditMemoId?: string | null;
  openLineCount?: number | null;
}

export interface SilaReceivingWorkbenchRow {
  purchaseOrderId: string;
  poNumber: string;
  supplierName?: string | null;
  expectedDate?: string | null;
  propertyName?: string | null;
  plantCode?: string | null;
  storageLocation?: string | null;
  lineCount: number;
  openLineCount: number;
  orderedQty: number;
  receivedQty: number;
  openQty: number;
  receiptStatus: string;
  latestGrnNumber?: string | null;
  latestGoodsReceiptId?: string | null;
  erpStatus?: string | null;
  supplierSoNumber?: string | null;
  lastActivity?: string | null;
  action: string;
}

export interface SilaReceivingException {
  severity: string;
  exception: string;
  document: string;
  supplierName?: string | null;
  locationName?: string | null;
  age?: string | null;
  status?: string | null;
  action: string;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  invoiceId?: string | null;
  creditMemoId?: string | null;
  message?: string | null;
}

export interface SilaReceivingActivity {
  occurredOn: string;
  document: string;
  action: string;
  status?: string | null;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  invoiceId?: string | null;
  creditMemoId?: string | null;
}

export interface SilaReceivingTeam {
  receiptsCompleted: number;
  grnsPosted: number;
  partialReceipts: number;
  reversals: number;
  failures: number;
}

export interface SilaHomeInvoiceKpis {
  readyForProcessing: number;
  inProgress: number;
  pendingApproval?: number;
  postingFailed: number;
  postedRecently: number;
}

export interface SilaHomeCreditMemoKpis {
  inProgress: number;
  pendingApproval?: number;
  postingFailed: number;
  postedRecently: number;
}

export interface SilaHomeApproval {
  type: string;
  document: string;
  supplierName?: string | null;
  amount?: number | null;
  requestedBy?: string | null;
  age?: string | null;
  status: string;
  action: string;
  purchaseOrderId?: string | null;
  goodsReceiptId?: string | null;
  invoiceId?: string | null;
  creditMemoId?: string | null;
  transferId?: string | null;
}

export interface SilaReceivingDashboard {
  kpis: SilaReceivingDashboardKpis;
  aging: SilaReceivingAging;
  locations: SilaReceivingDashboardLocation[];
  tasks: SilaReceivingTask[];
  workbench: SilaReceivingWorkbenchRow[];
  exceptions: SilaReceivingException[];
  activity: SilaReceivingActivity[];
  team: SilaReceivingTeam;
  invoice: SilaHomeInvoiceKpis;
  creditMemo: SilaHomeCreditMemoKpis;
  approvals: SilaHomeApproval[];
}

export const getReceivingDashboard = async (filter?: {
  locationId?: string;
  propertyId?: string;
  supplier?: string;
}): Promise<SilaReceivingDashboard> => {
  const data = await call(() => axiosInstance.get<SilaReceivingDashboard>(`${BASE}/receiving/dashboard`, {
    params: {
      locationId: filter?.locationId || undefined,
      propertyId: filter?.propertyId || undefined,
      supplier: filter?.supplier?.trim() || undefined,
    },
  }), "Could not load the receiving dashboard.");
  return {
    ...data,
    kpis: data.kpis ?? {
      expectedToday: 0, pendingReceipt: 0, partiallyReceived: 0, receivedToday: 0,
      overdue: 0, grnPostingFailed: 0, reversalsToday: 0, attentionRequired: 0,
    },
    aging: data.aging ?? {
      pendingUnderOneDay: 0, pendingOneToTwoDays: 0, pendingThreePlusDays: 0,
      overdue: 0, openPartials: 0, unresolvedGrnFailures: 0,
    },
    locations: list(data.locations),
    tasks: list(data.tasks),
    workbench: list(data.workbench),
    exceptions: list(data.exceptions),
    activity: list(data.activity),
    team: data.team ?? { receiptsCompleted: 0, grnsPosted: 0, partialReceipts: 0, reversals: 0, failures: 0 },
    invoice: data.invoice ?? { readyForProcessing: 0, inProgress: 0, pendingApproval: 0, postingFailed: 0, postedRecently: 0 },
    creditMemo: data.creditMemo ?? { inProgress: 0, pendingApproval: 0, postingFailed: 0, postedRecently: 0 },
    approvals: list(data.approvals),
  };
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

/** Preview for controlled 101 → 102 Cancel (original Material Document). */
export const getGoodsReceiptReversal = async (goodsReceiptId: string): Promise<SilaGrnReversalPreview> => {
  const data = await call(
    () => axiosInstance.get<SilaGrnReversalPreview>(`${BASE}/grns/${goodsReceiptId}/reversal`),
    "Could not load the goods receipt reversal.",
  );
  return { ...data, lines: list(data.lines) };
};

/** Cancels the original SAP Material Document (102), then reverses local stock. */
export const reverseGoodsReceipt = async (
  goodsReceiptId: string,
  request: SilaGrnReversalWrite,
): Promise<SilaGrnReversalResult> => {
  return call(
    () => axiosInstance.post<SilaGrnReversalResult>(`${BASE}/grns/${goodsReceiptId}/reverse`, request),
    "Could not reverse the goods receipt.",
  );
};

export interface SilaCreateInvoiceLine {
  lineNumber: number;
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
  uom?: string | null;
  taxCode?: string | null;
  taxRate?: number | null;
  purchaseOrderItemId?: string | null;
  goodsReceiptItemId?: string | null;
  glAccount?: string | null;
  costCenter?: string | null;
  profitCenter?: string | null;
  internalOrder?: string | null;
  wbsElement?: string | null;
  businessArea?: string | null;
  assignmentReference?: string | null;
  debitCreditCode?: string | null;
  lineText?: string | null;
}

export interface SilaCreateInvoiceRequest {
  creationType: "PO" | "NON_PO";
  propertyId?: string | null;
  companyCode?: string | null;
  silaSupplierId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  postingDate?: string | null;
  taxDeterminationDate?: string | null;
  currency?: string | null;
  grossAmount?: number | null;
  netAmount?: number | null;
  taxAmount?: number | null;
  reference?: string | null;
  purchaseOrderId?: string | null;
  goodsReceiptIds?: string[];
  lines?: SilaCreateInvoiceLine[];
  fileName?: string | null;
  contentType?: string | null;
  /** Base64 file bytes when a document is attached on create. */
  content?: string | null;
}

export interface SilaCreateInvoiceMasters {
  properties: { id: string; propertyName: string; companyCode: string; plantCode?: string | null }[];
  companyCodes: { id: string; code: string; name?: string | null }[];
  glAccounts: string[];
  costCenters: string[];
  profitCenters: string[];
  taxCodes: string[];
}

export interface SilaEligiblePurchaseOrder {
  id: string;
  poNumber: string;
  orderDate?: string | null;
  companyCode?: string | null;
  currency?: string | null;
  totalAmount?: number | null;
  receivedQuantity?: number | null;
  orderedQuantity?: number | null;
  grnCount: number;
  status: string;
  supplierName?: string | null;
  supplierId?: string | null;
  silaSupplierId?: string | null;
}

export interface SilaEligibleGoodsReceiptLine {
  id: string;
  purchaseOrderItemId: string;
  purchaseOrderItemNumber?: number | null;
  description: string;
  materialCode?: string | null;
  uom?: string | null;
  receivedQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  unitPrice?: number | null;
  taxCode?: string | null;
}

export interface SilaEligibleGoodsReceipt {
  id: string;
  grnNumber: string;
  erpReference?: string | null;
  receivedOn: string;
  poNumber: string;
  supplierName?: string | null;
  receivedQuantity: number;
  invoicedQuantity: number;
  remainingQuantity: number;
  status: string;
  invoiceStatus?: string | null;
  lines: SilaEligibleGoodsReceiptLine[];
}

export const getInvoices = async (search: string, status: string, page: SilaPage): Promise<SilaInvoice[]> =>
  list(await call(() => axiosInstance.get<SilaInvoice[]>(`${BASE}/invoices`, {
    params: { search: search.trim() || undefined, status: status || undefined, ...page },
  }), "Could not load the invoices."));

export const getInvoice = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.get<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}`), "Could not load the invoice."));

export const getCreateInvoiceMasters = async (): Promise<SilaCreateInvoiceMasters> => {
  const data = await call(() => axiosInstance.get<SilaCreateInvoiceMasters>(`${BASE}/invoices/create/masters`), "Could not load Create Invoice masters.");
  return {
    properties: list(data.properties),
    companyCodes: list(data.companyCodes),
    glAccounts: list(data.glAccounts),
    costCenters: list(data.costCenters),
    profitCenters: list(data.profitCenters),
    taxCodes: list(data.taxCodes),
  };
};

export const getEligiblePurchaseOrders = async (params: {
  silaSupplierId?: string | null;
  supplierId?: string | null;
  companyCode?: string | null;
  propertyId?: string | null;
  search?: string | null;
}): Promise<SilaEligiblePurchaseOrder[]> =>
  list(await call(() => axiosInstance.get<SilaEligiblePurchaseOrder[]>(`${BASE}/invoices/create/purchase-orders`, {
    params: {
      silaSupplierId: params.silaSupplierId || undefined,
      supplierId: params.supplierId || undefined,
      companyCode: params.companyCode || undefined,
      propertyId: params.propertyId || undefined,
      search: params.search?.trim() || undefined,
    },
  }), "Could not load purchase orders."));

export const getEligibleGoodsReceipts = async (purchaseOrderId: string): Promise<SilaEligibleGoodsReceipt[]> =>
  list(await call(() => axiosInstance.get<SilaEligibleGoodsReceipt[]>(`${BASE}/invoices/create/purchase-orders/${purchaseOrderId}/goods-receipts`), "Could not load goods receipts."))
    .map((row) => ({ ...row, lines: list(row.lines) }));

export const createInvoiceDraft = async (request: SilaCreateInvoiceRequest): Promise<string> => {
  const data = await call(() => axiosInstance.post<{ id: string }>(`${BASE}/invoices/create`, request), "Could not create the invoice.");
  return data.id;
};

export const prepareCreateInvoice = async (invoiceId: string, request: SilaCreateInvoiceRequest): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/prepare-create`, request), "Could not prepare the invoice."));

/** A new local invoice with the same file and lines. The copy is not posted and does not keep the SAP invoice id. */
export const copyInvoice = async (invoiceId: string): Promise<string> => {
  const data = await call(() => axiosInstance.post<{ id: string }>(`${BASE}/invoices/${invoiceId}/copy`), "Could not copy the invoice.");
  return data.id;
};

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

const fileType = async (blob: Blob, contentType: string): Promise<Blob> => {
  const declared = contentType.split(";")[0].trim().toLowerCase();
  if (declared.includes("json") || declared.startsWith("text/")) {
    throw new Error(readBody(await blob.text()) || "Could not open the file.");
  }
  if (declared === "application/pdf" || declared.startsWith("image/")) {
    return blob.type === declared ? blob : new Blob([blob], { type: declared });
  }
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const pdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  const png = head[0] === 0x89 && head[1] === 0x50;
  const jpeg = head[0] === 0xff && head[1] === 0xd8;
  const type = pdf ? "application/pdf" : png ? "image/png" : jpeg ? "image/jpeg" : "application/pdf";
  return new Blob([blob], { type });
};

/** A stored PDF or image. An error body is read as text instead of being opened as a file. */
const fetchFile = async (url: string, fallback: string): Promise<Blob> => {
  try {
    const response = await axiosInstance.get<Blob>(url, { responseType: "blob" });
    const contentType = String(response.headers["content-type"] ?? response.data.type ?? "");
    return await fileType(response.data, contentType);
  } catch (error: unknown) {
    if (error instanceof Error && !axios.isAxiosError(error)) throw error;
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      throw new Error(readBody(await error.response.data.text()) || fallback);
    }
    throw new Error(readError(error, fallback));
  }
};

/** The stored invoice file, to view in the invoice screen. */
export const getInvoiceFile = async (invoiceId: string): Promise<Blob> =>
  fetchFile(`${BASE}/invoices/${invoiceId}/file`, "Could not open the invoice file.");

/** The GRN PDF stored against the invoice. */
export const getInvoiceGrnPdf = async (invoiceId: string, goodsReceiptId: string): Promise<Blob> =>
  fetchFile(`${BASE}/invoices/${invoiceId}/grn-pdf/${goodsReceiptId}`, "Could not open the GRN PDF.");

/** Attaches goods receipts of the matched purchase order. An empty list clears the match. */
export const linkInvoiceGoodsReceipts = async (invoiceId: string, goodsReceiptIds: string[]): Promise<SilaInvoiceDetail> => {
  try {
    const response = await axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/goods-receipts`, { goodsReceiptIds });
    return normalizeInvoice(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && !readError(error, "")) {
      throw new Error("This server cannot save the goods receipt match yet. Choose the receipts again after the update is deployed.");
    }
    throw new Error(readError(error, "Could not match the goods receipts."));
  }
};

/** Validates, then approves or posts. A 404 is an error: it must not fall through to another post. */
export const submitInvoice = async (invoiceId: string): Promise<SilaInvoiceDetail> => {
  try {
    const response = await axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/submit`);
    return normalizeInvoice(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && !readError(error, "")) {
      throw new Error("The invoice was not sent. Restart the local screen and submit again.");
    }
    throw new Error(readError(error, "Could not submit the invoice."));
  }
};

/** Sends only FIVE S4 - INVOICE ATTACHMENT. It does not post the invoice again. */
export const reprocessInvoiceAttachment = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/attachment/reprocess`), "Could not reprocess the attachment."));

/** Reads FIVE S4 - GET PO again and stores the posting values. It does not post the invoice. */
export const refreshInvoicePosting = async (invoiceId: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/refresh-posting`), "Could not refresh the posting data."));

export const decideInvoice = async (invoiceId: string, approve: boolean, comment: string): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/approval`, { approve, comment: comment.trim() || null }), "Could not record the approval."));

export const getErpPostings = async (status: string, search: string, page: SilaPage): Promise<SilaErpPosting[]> =>
  list(await call(() => axiosInstance.get<SilaErpPosting[]>(`${BASE}/erp-postings`, {
    params: { status: status || undefined, search: search.trim() || undefined, ...page },
  }), "Could not load the ERP postings."));

/** The JSON stored on the posting. Empty when the send never kept a body. */
export const getErpPostingPayload = async (postingId: string): Promise<{ technicalDetail: string | null; erpMessage: string | null; erpHttpStatus: number | null } | null> => {
  try {
    const response = await axiosInstance.get<{ technicalDetail?: string | null; erpMessage?: string | null; erpHttpStatus?: number | null }>(`${BASE}/erp-postings/${postingId}/payload`);
    const text = response.data?.technicalDetail?.trim() ? response.data.technicalDetail : null;
    const message = response.data?.erpMessage?.trim() ? response.data.erpMessage : null;
    if (!text && !message && response.data?.erpHttpStatus == null) return null;
    return { technicalDetail: text, erpMessage: message, erpHttpStatus: response.data?.erpHttpStatus ?? null };
  } catch {
    return null;
  }
};

/** FAILED or SKIPPED → send to S4 again immediately (stock was already updated on the GRN). */
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
  poNumber?: string | null;
  grnNumber?: string | null;
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

/** Keeps the purchase orders already on the invoice and adds another. Unmatched lines are matched to it. */
export const addInvoicePurchaseOrder = async (invoiceId: string, purchaseOrderId: string): Promise<SilaInvoiceDetail> => {
  try {
    const response = await axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/match-po/add`, { purchaseOrderId });
    return normalizeInvoice(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && !readError(error, "")) {
      throw new Error("This server cannot add another purchase order to the invoice yet.");
    }
    throw new Error(readError(error, "Could not add the purchase order."));
  }
};

export const matchInvoiceLines = async (invoiceId: string, lines: { invoiceItemId: string; purchaseOrderItemId: string | null }[]): Promise<SilaInvoiceDetail> =>
  normalizeInvoice(await call(() => axiosInstance.post<SilaInvoiceDetail>(`${BASE}/invoices/${invoiceId}/match-lines`, { lines }), "Could not match the invoice lines."));

export const getInvoiceExtractions = async (invoiceId: string): Promise<SilaInvoiceExtraction[]> =>
  list(await call(() => axiosInstance.get<SilaInvoiceExtraction[]>(`${BASE}/invoices/${invoiceId}/extractions`), "Could not load the reading history."));

/** Settles an UNKNOWN posting: posted (with the ERP number) or not posted (sent again). */
export const reconcileErpPosting = async (postingId: string, posted: boolean, erpReference: string): Promise<void> => {
  await call(() => axiosInstance.post(`${BASE}/erp-postings/${postingId}/reconcile`, { posted, erpReference: erpReference.trim() || null }), "Could not reconcile the posting.");
};

export const creditMemoHeaderText = (invoiceNumber?: string | null): string => {
  const number = invoiceNumber?.trim();
  return number ? `Return of ${number}` : 'Return of invoice';
};

export const lookupCreditMemoInvoice = async (params: {
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  erpInvoiceId?: string | null;
}): Promise<SilaCreditMemoReferenceInvoice[]> =>
  list(await call(() => axiosInstance.get<SilaCreditMemoReferenceInvoice[]>(`${BASE}/credit-memos/reference-invoices`, {
    params: {
      invoiceId: params.invoiceId || undefined,
      invoiceNumber: params.invoiceNumber?.trim() || undefined,
      erpInvoiceId: params.erpInvoiceId?.trim() || undefined,
    },
  }), "Could not look up the reference invoice."));

export const getCreditMemos = async (search: string, status: string, page: SilaPage): Promise<SilaCreditMemoListItem[]> =>
  list(await call(() => axiosInstance.get<SilaCreditMemoListItem[]>(`${BASE}/credit-memos`, {
    params: { search: search.trim() || undefined, status: status || undefined, ...page },
  }), "Could not load the credit memos."));

export const getCreditMemoLines = async (invoiceId: string): Promise<SilaCreditMemoEligibleLine[]> =>
  list(await call(() => axiosInstance.get<SilaCreditMemoEligibleLine[]>(`${BASE}/invoices/${invoiceId}/credit-memo-lines`), "Could not load credit memo lines."))
    .map((line) => normalizeCreditMemoEligibleLine(line));

const normalizeCreditMemo = (memo: SilaCreditMemoDetail): SilaCreditMemoDetail => ({
  ...memo,
  lines: list(memo.lines).map((line) => ({
    ...line,
    ...normalizeCreditMemoEligibleLine({
      invoiceLineId: line.referenceInvoiceLineId || line.id,
      lineNumber: line.lineNumber,
      poNumber: line.poNumber,
      poItem: line.poItem,
      material: line.material,
      description: line.description,
      originalQuantity: line.originalQuantity,
      originalAmount: line.originalAmount,
      previouslyCreditedQuantity: line.previouslyCreditedQuantity,
      previouslyCreditedAmount: line.previouslyCreditedAmount,
      remainingQuantity: line.remainingQuantity,
      remainingAmount: line.remainingAmount,
      uom: line.uom,
      taxCode: line.taxCode,
    }),
  })),
  history: list(memo.history),
  canSubmit: Boolean(memo.canSubmit),
  canRetry: Boolean(memo.canRetry),
});

export const createCreditMemo = async (request: SilaCreditMemoWrite): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.post<SilaCreditMemoDetail>(`${BASE}/credit-memos`, request), "Could not create the credit memo."));

export const getCreditMemo = async (creditMemoId: string): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.get<SilaCreditMemoDetail>(`${BASE}/credit-memos/${creditMemoId}`), "Could not load the credit memo."));

export const updateCreditMemo = async (creditMemoId: string, request: SilaCreditMemoWrite): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.put<SilaCreditMemoDetail>(`${BASE}/credit-memos/${creditMemoId}`, request), "Could not save the credit memo."));

export const submitCreditMemo = async (creditMemoId: string): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.post<SilaCreditMemoDetail>(`${BASE}/credit-memos/${creditMemoId}/submit`), "Could not submit the credit memo."));

export const retryCreditMemo = async (creditMemoId: string): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.post<SilaCreditMemoDetail>(`${BASE}/credit-memos/${creditMemoId}/retry`), "Could not retry credit memo posting."));

export const decideCreditMemo = async (creditMemoId: string, approve: boolean, comment: string): Promise<SilaCreditMemoDetail> =>
  normalizeCreditMemo(await call(() => axiosInstance.post<SilaCreditMemoDetail>(`${BASE}/credit-memos/${creditMemoId}/approval`, { approve, comment: comment.trim() || null }), "Could not record the credit memo approval."));
