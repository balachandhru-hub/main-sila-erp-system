import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

/* ---------- Internal transfer orders (ITO) ---------- */

/** STANDARD | QUICK */
export type SilaTransferMode = string;
/** PENDING_APPROVAL | APPROVED | DISPATCHED | RECEIVED | DISCREPANCY | REJECTED | CANCELLED */
export type SilaTransferStatus = string;
/** APPROVE | REJECT | DISPATCH | RECEIVE | CANCEL */
export type SilaTransferAction = string;

export type SilaTransferTab = "mine" | "to-approve" | "in-transit" | "completed";

/** One material line of a new transfer, goods issue or adjustment. */
export interface SilaMovementLineWrite {
  materialId: string;
  quantity: number;
  /** Empty means the base unit of the material. */
  uom: string | null;
}

export interface SilaTransferWrite {
  fromLocationId: string;
  toLocationId: string;
  reason: string | null;
  /** yyyy-mm-dd */
  requiredBy: string | null;
  items: SilaMovementLineWrite[];
  /** Quick transfers only: the stock was already taken from the source, which confirms or disputes the handover. */
  alreadyCollected?: boolean;
  /** Standard transfers: assign the line materials to the destination when it does not stock them yet. */
  addToLocation?: boolean;
}

/** Approved or received quantity (base unit) of a transfer line. */
export interface SilaTransferLineQuantity {
  itemId: string;
  quantity: number;
}

export interface SilaTransferListItem {
  id: string;
  itoNumber: string;
  mode: SilaTransferMode;
  status: SilaTransferStatus;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId: string;
  toLocationName?: string | null;
  requestedBy: string;
  requestedByName?: string | null;
  requestedOn: string;
  requiredBy?: string | null;
  lineCount: number;
  fromLocationType?: string | null;
  toLocationType?: string | null;
  /** e.g. STORE_TO_OUTLET */
  transferRelationship?: string | null;
  totalValue?: number | null;
  currency?: string | null;
}

/** Optional filters and paging of the transfer list. */
export interface SilaTransferFilters {
  mode?: string;
  fromLocationId?: string;
  toLocationId?: string;
  propertyId?: string;
  /** yyyy-mm-dd */
  fromDate?: string;
  /** yyyy-mm-dd */
  toDate?: string;
  index?: number;
  limit?: number;
}

/** One side of a transfer: SOURCE approves or rejects, DESTINATION receives. */
export interface SilaTransferApproval {
  side: "SOURCE" | "DESTINATION" | string;
  /** PENDING | APPROVED | REJECTED | RECEIVED | DISCREPANCY | CANCELLED */
  status: string;
  /** Quantities are only filled for single-line transfers. */
  availableQty?: number | null;
  requestedQty?: number | null;
  approvedQty?: number | null;
  stockAfter?: number | null;
  comment?: string | null;
  actorName?: string | null;
  on?: string | null;
}

/** Quantities are in the base unit of the material. */
export interface SilaTransferItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  requestedQty: number;
  approvedQty: number;
  dispatchedQty: number;
  receivedQty: number;
  uom: string;
  unitCost?: number | null;
  transferValue?: number | null;
  /** On hand at the source now. */
  sourceAvailable?: number;
  /** Source stock once the transfer leaves. */
  sourceAfter?: number;
  /** Received minus dispatched, once received. */
  varianceQty?: number | null;
}

export interface SilaTransferEvent {
  action: string;
  comment?: string | null;
  actorUserId: string;
  /** Display name, or the user id when it cannot be resolved. */
  actorName: string;
  on: string;
}

export interface SilaTransferDetail {
  id: string;
  itoNumber: string;
  mode: SilaTransferMode;
  status: SilaTransferStatus;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId: string;
  toLocationName?: string | null;
  reason?: string | null;
  comment?: string | null;
  requiredBy?: string | null;
  requestedBy: string;
  requestedByName?: string | null;
  requestedOn: string;
  approvedOn?: string | null;
  dispatchedOn?: string | null;
  receivedOn?: string | null;
  /** Quick transfer of stock the requester already took. */
  alreadyCollected?: boolean;
  /** Why the source disputed the handover. */
  disputeReason?: string | null;
  items: SilaTransferItem[];
  events: SilaTransferEvent[];
  fromLocationType?: string | null;
  toLocationType?: string | null;
  transferRelationship?: string | null;
  totalValue?: number | null;
  currency?: string | null;
  approvals?: SilaTransferApproval[];
  /** What the signed-in user may do now. */
  allowedActions: SilaTransferAction[];
}

/* ---------- Goods issues ---------- */

export interface SilaGoodsIssueWrite {
  /** Store location. */
  fromLocationId: string;
  /** Outlet location. */
  toLocationId: string;
  weeklyBucketId: string | null;
  comment: string | null;
  items: SilaMovementLineWrite[];
}

export interface SilaGoodsIssueListItem {
  id: string;
  issueNumber: string;
  fromLocationId: string;
  fromLocationName?: string | null;
  toLocationId: string;
  toLocationName?: string | null;
  weeklyBucketId?: string | null;
  bucketCode?: string | null;
  issuedBy: string;
  issuedByName?: string | null;
  issuedOn: string;
  lineCount: number;
}

export interface SilaGoodsIssueItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  uom: string;
  baseQuantity: number;
}

export interface SilaGoodsIssueDetail extends Omit<SilaGoodsIssueListItem, "lineCount"> {
  comment?: string | null;
  items: SilaGoodsIssueItem[];
}

/** Approved weekly bucket quantity of a material not yet issued (base unit). */
export interface SilaGoodsIssueBucketLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  approvedQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
  uom: string;
}

/** Empty (no weeklyBucketId) when the outlet has no frozen weekly bucket. */
export interface SilaGoodsIssueBucket {
  weeklyBucketId?: string | null;
  bucketCode?: string | null;
  status?: string | null;
  lines: SilaGoodsIssueBucketLine[];
}

/* ---------- Stock adjustments ---------- */

export const SILA_ADJUSTMENT_TYPES = [
  "OPENING_STOCK",
  "WASTE",
  "DAMAGE",
  "BREAKAGE",
  "SPOILAGE",
  "EXPIRED",
  "MANUAL_ADJUSTMENT",
] as const;

export type SilaAdjustmentType = (typeof SILA_ADJUSTMENT_TYPES)[number];

export interface SilaAdjustmentLineWrite extends SilaMovementLineWrite {
  /** Per base unit. */
  unitCost: number | null;
}

export interface SilaAdjustmentWrite {
  locationId: string;
  adjustmentType: string;
  /** Required except for opening stock. */
  reason: string | null;
  items: SilaAdjustmentLineWrite[];
}

export interface SilaAdjustmentListItem {
  id: string;
  adjustmentNumber: string;
  locationId: string;
  locationName?: string | null;
  adjustmentType: string;
  reason?: string | null;
  postedBy: string;
  postedByName?: string | null;
  postedOn: string;
  lineCount: number;
}

export interface SilaAdjustmentItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Signed for manual adjustments. */
  quantity: number;
  uom: string;
  baseQuantity: number;
  unitCost?: number | null;
}

export interface SilaAdjustmentDetail extends Omit<SilaAdjustmentListItem, "lineCount"> {
  items: SilaAdjustmentItem[];
}

interface CreatedResponse {
  id: string;
}

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

/* ---------- Transfer calls ---------- */

export const getTransfers = async (tab: SilaTransferTab, filters: SilaTransferFilters = {}): Promise<SilaTransferListItem[]> => {
  try {
    const params: Record<string, string | number> = { tab, index: filters.index ?? 0, limit: filters.limit ?? 200 };
    (["mode", "fromLocationId", "toLocationId", "propertyId", "fromDate", "toDate"] as const).forEach((key) => {
      const value = filters[key];
      if (value) params[key] = value;
    });
    const response = await axiosInstance.get<SilaTransferListItem[]>(`${BASE}/transfers`, { params });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the transfers."));
  }
};

export const getTransfer = async (transferId: string): Promise<SilaTransferDetail> => {
  try {
    const response = await axiosInstance.get<SilaTransferDetail>(`${BASE}/transfers/${transferId}`);
    return {
      ...response.data,
      items: list(response.data?.items),
      approvals: list(response.data?.approvals),
      events: list(response.data?.events),
      allowedActions: list(response.data?.allowedActions),
    };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the transfer."));
  }
};

/** Standard transfer: waits for the approval of the source location. Returns the new transfer id. */
export const createTransfer = async (payload: SilaTransferWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<CreatedResponse>(`${BASE}/transfers`, payload);
    return response.data?.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not request the transfer."));
  }
};

/** Quick transfer, within the quick-transfer policy. Returns the new transfer id. */
export const createQuickTransfer = async (payload: SilaTransferWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<CreatedResponse>(`${BASE}/transfers/quick`, payload);
    return response.data?.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not send the quick transfer."));
  }
};

/** Approves with the approved quantity of each line (at most the requested quantity). */
export const approveTransfer = async (
  transferId: string,
  items: SilaTransferLineQuantity[],
  comment: string | null,
): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/approve`, { items, comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not approve the transfer."));
  }
};

export const rejectTransfer = async (transferId: string, comment: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/reject`, { comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not reject the transfer."));
  }
};

export const dispatchTransfer = async (transferId: string, comment: string | null): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/dispatch`, { comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not dispatch the transfer."));
  }
};

/** Confirms the received quantity of each line (at most the dispatched quantity). */
export const receiveTransfer = async (
  transferId: string,
  items: SilaTransferLineQuantity[],
  comment: string | null,
): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/receive`, { items, comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not receive the transfer."));
  }
};

export const cancelTransfer = async (transferId: string, comment: string | null): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/cancel`, { comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not cancel the transfer."));
  }
};

/** The source confirms that already-collected stock was handed over: the stock moves and the transfer is received. */
export const confirmTransferHandover = async (transferId: string, comment: string | null): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/handover`, { comment });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not confirm the handover."));
  }
};

/** The source disputes already-collected stock: no stock moves, the transfer becomes a discrepancy. */
export const disputeTransfer = async (transferId: string, reason: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/transfers/${transferId}/dispute`, { comment: reason });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not dispute the handover."));
  }
};

/* ---------- Goods issue calls ---------- */

export const getGoodsIssues = async (locationId?: string): Promise<SilaGoodsIssueListItem[]> => {
  try {
    const response = await axiosInstance.get<SilaGoodsIssueListItem[]>(`${BASE}/goods-issues`, {
      params: locationId ? { locationId } : undefined,
    });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the goods issues."));
  }
};

export const getGoodsIssue = async (goodsIssueId: string): Promise<SilaGoodsIssueDetail> => {
  try {
    const response = await axiosInstance.get<SilaGoodsIssueDetail>(`${BASE}/goods-issues/${goodsIssueId}`);
    return { ...response.data, items: list(response.data?.items) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the goods issue."));
  }
};

/** Lines still to issue from the outlet's latest frozen weekly bucket. */
export const getGoodsIssueFromBucket = async (outletLocationId: string): Promise<SilaGoodsIssueBucket> => {
  try {
    const response = await axiosInstance.get<SilaGoodsIssueBucket>(`${BASE}/goods-issues/from-bucket`, {
      params: { outletLocationId },
    });
    return { ...response.data, lines: list(response.data?.lines) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the weekly bucket lines."));
  }
};

export const createGoodsIssue = async (payload: SilaGoodsIssueWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<CreatedResponse>(`${BASE}/goods-issues`, payload);
    return response.data?.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not post the goods issue."));
  }
};

/* ---------- Adjustment calls ---------- */

export const getAdjustments = async (filter: { locationId?: string; type?: string }): Promise<SilaAdjustmentListItem[]> => {
  try {
    const response = await axiosInstance.get<SilaAdjustmentListItem[]>(`${BASE}/adjustments`, {
      params: { locationId: filter.locationId || undefined, type: filter.type || undefined },
    });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stock adjustments."));
  }
};

export const getAdjustment = async (adjustmentId: string): Promise<SilaAdjustmentDetail> => {
  try {
    const response = await axiosInstance.get<SilaAdjustmentDetail>(`${BASE}/adjustments/${adjustmentId}`);
    return { ...response.data, items: list(response.data?.items) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stock adjustment."));
  }
};

export const createAdjustment = async (payload: SilaAdjustmentWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<CreatedResponse>(`${BASE}/adjustments`, payload);
    return response.data?.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not post the stock adjustment."));
  }
};
