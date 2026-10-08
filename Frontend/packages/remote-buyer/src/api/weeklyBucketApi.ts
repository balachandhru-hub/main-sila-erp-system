import axiosInstance from "./axiosInstance";
import type { CatalogQuantity } from "./personalWishlistApi";
import { readError } from "./readError";

/** OPEN | PENDING_APPROVAL | APPROVED | PO_CREATED | PO_FAILED | REJECTED. Anything but OPEN is frozen. */
export type WeeklyBucketStatus = string;

export type WeeklyBucketDecision = "APPROVE" | "REJECT";

export interface WeeklyBucketListItem {
  id: string;
  bucketCode: string;
  weekNumber: number;
  year: number;
  propertyName?: string | null;
  plantCode?: string | null;
  status: WeeklyBucketStatus;
  itemCount: number;
  frozenOn?: string | null;
}

export interface WeeklyBucketItem {
  id: string;
  catalogId: string;
  sku?: string | null;
  productName: string;
  description?: string | null;
  /** The product first requested, kept when an approved recommendation replaced it. */
  originalProductName?: string | null;
  materialId?: string | null;
  materialCode?: string | null;
  supplierId: string;
  supplierName?: string | null;
  unitOfMeasure?: string | null;
  price?: number | null;
  currency?: string | null;
  discountPercent?: number | null;
  requestedQuantity: number;
  /** The final quantity set by the reviewer. */
  approvedQuantity?: number | null;
  supplierStock?: number | null;
  supplierStockRefreshedOn?: string | null;
  /** null until a stock-in-hand source is connected. */
  stockInHand?: number | null;
  /** AVAILABLE | PARTIAL | UNAVAILABLE | UNKNOWN */
  availabilityStatus: string;
  /** REQUESTED | RECOMMENDATION_PENDING | RECOMMENDATION_APPROVED | EXCLUDED */
  lineStatus: string;
  requestorUserId: string;
  requestorName?: string | null;
  outletId?: string | null;
  outletName?: string | null;
  storageLocation?: string | null;
  dateCreated?: string | null;
}

export interface WeeklyBucketRecommendation {
  id: string;
  /** "R1", "R2", ... running per bucket. */
  recommendationNumber: string;
  weeklyBucketItemId: string;
  catalogId: string;
  sku?: string | null;
  productName: string;
  supplierId: string;
  supplierName?: string | null;
  price?: number | null;
  currency?: string | null;
  availableStock?: number | null;
  quantity: number;
  /** PENDING | APPROVED | REJECTED */
  status: string;
  decidedBy?: string | null;
  decidedByName?: string | null;
  decidedOn?: string | null;
}

export interface WeeklyBucketApprovalStep {
  userId: string;
  name?: string | null;
  email?: string | null;
  order: number;
  /** PENDING | APPROVE | REJECT */
  status: string;
  comment?: string | null;
  actedOn?: string | null;
}

export interface WeeklyBucketPurchaseOrder {
  supplierId: string;
  supplierName?: string | null;
  status: string;
  documentNumber?: string | null;
  errorMessage?: string | null;
}

export interface WeeklyBucketDetail {
  /** null while the active bucket has not been created yet (nothing was added this week). */
  id: string | null;
  bucketCode: string;
  weekNumber: number;
  year: number;
  propertyId?: string | null;
  propertyName?: string | null;
  plantCode?: string | null;
  companyCode?: string | null;
  status: WeeklyBucketStatus;
  isFrozen: boolean;
  frozenBy?: string | null;
  frozenByName?: string | null;
  frozenOn?: string | null;
  finalApprovedOn?: string | null;
  approvalName?: string | null;
  lastError?: string | null;
  items: WeeklyBucketItem[];
  recommendations: WeeklyBucketRecommendation[];
  approvalSteps: WeeklyBucketApprovalStep[];
  purchaseOrders: WeeklyBucketPurchaseOrder[];
}

export interface WeeklyBucketAddResult {
  bucketId: string;
  bucketCode: string;
}

const BASE = "/api/v1/buyer/weekly-buckets";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalize = (bucket: WeeklyBucketDetail): WeeklyBucketDetail => ({
  ...bucket,
  items: list(bucket.items),
  recommendations: list(bucket.recommendations),
  approvalSteps: list(bucket.approvalSteps),
  purchaseOrders: list(bucket.purchaseOrders),
});

/** The active bucket of the property of the caller's outlet. `outletId` is needed only when the server cannot tell the property. */
export const getCurrentWeeklyBucket = async (outletId?: string): Promise<WeeklyBucketDetail> => {
  try {
    const response = await axiosInstance.get<WeeklyBucketDetail>(`${BASE}/current`, {
      params: outletId ? { outletId } : undefined,
    });
    return normalize(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the weekly bucket."));
  }
};

/** Buckets of the caller's organization, newest first. */
export const getWeeklyBuckets = async (index = 0, limit = 20): Promise<WeeklyBucketListItem[]> => {
  try {
    const response = await axiosInstance.get<WeeklyBucketListItem[]>(BASE, { params: { index, limit } });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load weekly buckets."));
  }
};

export const getWeeklyBucket = async (bucketId: string): Promise<WeeklyBucketDetail> => {
  try {
    const response = await axiosInstance.get<WeeklyBucketDetail>(`${BASE}/${bucketId}`);
    return normalize(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load this weekly bucket."));
  }
};

/** Adds lines to the active bucket, creating it when needed. */
export const addWeeklyBucketItems = async (
  items: CatalogQuantity[],
  outletId?: string,
): Promise<WeeklyBucketAddResult> => {
  try {
    const response = await axiosInstance.post<WeeklyBucketAddResult>(`${BASE}/items`, {
      outletId: outletId || null,
      items,
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not add the products to the weekly bucket."));
  }
};

/** The requestor changes his own requested quantity while the bucket is OPEN. */
export const setWeeklyBucketItemQuantity = async (bucketId: string, itemId: string, quantity: number): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/${bucketId}/items/${itemId}`, { quantity });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the requested quantity."));
  }
};

/** A reviewer sets the final quantity while the bucket is OPEN; the requested quantity is kept. */
export const setWeeklyBucketItemFinalQuantity = async (
  bucketId: string,
  itemId: string,
  quantity: number,
): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/${bucketId}/items/${itemId}/approved-quantity`, { quantity });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the final quantity."));
  }
};

export const deleteWeeklyBucketItem = async (bucketId: string, itemId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/${bucketId}/items/${itemId}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not remove the line."));
  }
};

/** Reads current supplier stock and price for every line and creates recommendations for lines that cannot be supplied. */
export const refreshWeeklyBucketInventory = async (bucketId: string): Promise<WeeklyBucketDetail> => {
  try {
    const response = await axiosInstance.post<WeeklyBucketDetail>(`${BASE}/${bucketId}/refresh-inventory`);
    return normalize(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not refresh supplier stock."));
  }
};

export const decideWeeklyBucketRecommendation = async (
  bucketId: string,
  recommendationId: string,
  status: WeeklyBucketDecision,
): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/${bucketId}/recommendations/${recommendationId}`, { status });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not record the decision on the recommendation."));
  }
};

/** Freezes the bucket for ever and starts its approval. */
export const freezeWeeklyBucket = async (bucketId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/${bucketId}/freeze`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not freeze the weekly bucket."));
  }
};

export const decideWeeklyBucket = async (
  bucketId: string,
  status: WeeklyBucketDecision,
  comment?: string,
): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/approval/${bucketId}`, {
      status,
      comment: comment?.trim() ? comment.trim() : null,
    });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not record the approval decision."));
  }
};

/** Only when the bucket's status is PO_FAILED. */
export const retryWeeklyBucketPurchaseOrders = async (bucketId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/${bucketId}/retry-purchase-orders`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not retry the purchase orders."));
  }
};

/** Creates quick purchase orders for an approved weekly bucket. */
export const quickCreateWeeklyBucketPurchaseOrders = async (bucketId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/${bucketId}/quick-create-purchase-orders`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create quick purchase orders."));
  }
};

