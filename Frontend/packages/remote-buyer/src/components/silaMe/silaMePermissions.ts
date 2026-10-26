import type { SilaMeRole } from "./silaMeNav";

/**
 * What the SILA ME screens offer. Live flags come from Identity permission codes.
 * Role templates are a fetch-fail fallback only. They never imply Invoice or Credit Memo from POST_SILA_GRN.
 */
export interface SilaMePermissions {
  manageLocation: boolean;
  manageMasterData: boolean;
  manageTransfer: boolean;
  approveTransfer: boolean;
  postGoodsIssue: boolean;
  postAdjustment: boolean;
  manageCount: boolean;
  /** Start a stock count for a chosen location. Outlet and store managers count, they do not start one. */
  initiateCount: boolean;
  approveCount: boolean;
  requestPurchase: boolean;
  manageRecipe: boolean;
  approveRecipe: boolean;
  approvePrice: boolean;
  managePos: boolean;
  /** VIEW_SILA_RECEIVING — Home / workbench visibility. */
  viewReceiving: boolean;
  /** VIEW_SILA_INVENTORY — inventory Home visibility. */
  viewInventory: boolean;
  postGrn: boolean;
  manageErpPosting: boolean;
  viewAudit: boolean;
  viewInvoice: boolean;
  processInvoice: boolean;
  approveInvoice: boolean;
  viewCreditMemo: boolean;
  processCreditMemo: boolean;
  approveCreditMemo: boolean;
}

const NONE: SilaMePermissions = {
  manageLocation: false, manageMasterData: false, manageTransfer: false, approveTransfer: false, postGoodsIssue: false,
  postAdjustment: false, manageCount: false, initiateCount: false, approveCount: false, requestPurchase: false, manageRecipe: false,
  approveRecipe: false, approvePrice: false, managePos: false, viewReceiving: false, viewInventory: false, postGrn: false,
  manageErpPosting: false, viewAudit: false, viewInvoice: false, processInvoice: false, approveInvoice: false,
  viewCreditMemo: false, processCreditMemo: false, approveCreditMemo: false,
};

const allTrue = (): SilaMePermissions =>
  Object.fromEntries(Object.keys(NONE).map((key) => [key, true])) as unknown as SilaMePermissions;

const invoiceProcess = { viewInvoice: true, processInvoice: true, viewCreditMemo: true, processCreditMemo: true };
const invoiceApprove = { viewInvoice: true, approveInvoice: true, viewCreditMemo: true, approveCreditMemo: true };
const invoiceAll = { ...invoiceProcess, approveInvoice: true, approveCreditMemo: true };

const BY_ROLE: Record<SilaMeRole, SilaMePermissions> = {
  admin: allTrue(),
  "store-manager": {
    ...NONE, manageTransfer: true, approveTransfer: true, postGoodsIssue: true, postAdjustment: true, manageCount: true,
    approveCount: true, requestPurchase: true, manageRecipe: true, approveRecipe: true, approvePrice: true,
    viewReceiving: true, viewInventory: true, postGrn: true, manageErpPosting: true, ...invoiceAll,
  },
  "outlet-manager": {
    ...NONE, manageTransfer: true, approveTransfer: true, postAdjustment: true, manageCount: true, requestPurchase: true,
    manageRecipe: true, approveRecipe: true, approvePrice: true, viewInventory: true, viewReceiving: true,
    viewInvoice: true, viewCreditMemo: true, approveInvoice: true, approveCreditMemo: true,
  },
  "buyer-user": {
    ...NONE, manageTransfer: true, manageCount: true, approveRecipe: true, approvePrice: true,
    viewReceiving: true, viewInventory: true, postGrn: true, ...invoiceAll,
  },
  "cost-controller": {
    ...NONE, manageTransfer: true, initiateCount: true, manageCount: true, approveCount: true, approveRecipe: true, approvePrice: true,
    viewReceiving: true, viewInventory: true, postGrn: true, viewAudit: true, ...invoiceAll,
  },
  "fnb-director": {
    ...NONE, manageTransfer: true, manageCount: true, initiateCount: true, approveRecipe: true, approvePrice: true,
    viewReceiving: true, viewInventory: true, ...invoiceProcess,
  },
  "finance-manager": {
    ...NONE, viewAudit: true, ...invoiceApprove,
  },
  "ap-processor": {
    ...NONE, ...invoiceProcess,
  },
};

const CODE_FLAGS: [keyof SilaMePermissions, string[]][] = [
  ["manageLocation", ["MANAGE_SILA_LOCATION"]],
  ["manageMasterData", ["MANAGE_SILA_MASTER_DATA"]],
  ["manageTransfer", ["MANAGE_SILA_TRANSFER"]],
  ["approveTransfer", ["APPROVE_SILA_TRANSFER"]],
  ["postGoodsIssue", ["POST_SILA_GOODS_ISSUE"]],
  ["postAdjustment", ["POST_SILA_ADJUSTMENT"]],
  ["manageCount", ["MANAGE_SILA_STOCK_COUNT"]],
  ["initiateCount", ["MANAGE_SILA_STOCK_COUNT"]],
  ["approveCount", ["APPROVE_SILA_STOCK_COUNT"]],
  ["requestPurchase", ["REQUEST_SILA_PURCHASE"]],
  ["manageRecipe", ["MANAGE_SILA_RECIPE", "VIEW_SILA_RECIPE"]],
  ["approveRecipe", ["APPROVE_SILA_RECIPE"]],
  ["approvePrice", ["APPROVE_SILA_PRICE"]],
  ["managePos", ["MANAGE_SILA_POS"]],
  ["viewReceiving", ["VIEW_SILA_RECEIVING"]],
  ["viewInventory", ["VIEW_SILA_INVENTORY"]],
  ["postGrn", ["POST_SILA_GRN"]],
  ["manageErpPosting", ["MANAGE_SILA_ERP_POSTING"]],
  ["viewAudit", ["VIEW_SILA_AUDIT"]],
  ["viewInvoice", ["VIEW_SILA_INVOICE"]],
  ["processInvoice", ["PROCESS_SILA_INVOICE"]],
  ["approveInvoice", ["APPROVE_SILA_INVOICE"]],
  ["viewCreditMemo", ["VIEW_SILA_CREDIT_MEMO"]],
  ["processCreditMemo", ["PROCESS_SILA_CREDIT_MEMO"]],
  ["approveCreditMemo", ["APPROVE_SILA_CREDIT_MEMO"]],
];

export const silaMePermissions = (role: SilaMeRole): SilaMePermissions => BY_ROLE[role] ?? NONE;

/** Map Identity feature keys. Unknown codes are ignored. POST_SILA_GRN does not grant invoice or credit memo. */
export const silaMePermissionsFromCodes = (codes: string[], fallback: SilaMePermissions = NONE): SilaMePermissions => {
  const set = new Set(codes.map((code) => code.toUpperCase()));
  const next = { ...NONE };
  for (const [flag, keys] of CODE_FLAGS) {
    next[flag] = keys.some((key) => set.has(key));
  }
  if (codes.length === 0) return fallback;
  return next;
};
