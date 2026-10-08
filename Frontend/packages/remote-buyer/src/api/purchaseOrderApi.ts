import axiosInstance from "./axiosInstance";
import { readError } from "./readError";

/** One purchase order created in the buyer's ERP, for one supplier. */
export interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName?: string | null;
  buyerName?: string | null;
  bucketCode?: string | null;
  plantCode?: string | null;
  status: string;
  currency?: string | null;
  totalAmount: number;
  orderDate: string;
  itemCount: number;
  /** Set when the order was created from a contract. */
  contractId?: string | null;
  contractNumber?: string | null;
  /** Document number the ERP returned for an order created from a contract. The order's own number is poNumber. */
  erpPurchaseOrderId?: string | null;
  /** NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN. Only for orders created from a contract. */
  erpSyncStatus?: string | null;
  erpSyncError?: string | null;
  /** The supplier's own ERP: the sales order created for this purchase order, and how that hand-off went. */
  supplierErpSalesOrderNumber?: string | null;
  supplierErpSyncStatus?: string | null;
  supplierErpSyncError?: string | null;
}

/** A purchase order created from a contract, as returned after its ERP hand-off was retried. */
export interface ContractPurchaseOrder {
  id: string;
  poNumber: string;
  contractId: string | null;
  contractNumber: string | null;
  erpPurchaseOrderId: string | null;
  erpSyncStatus: string;
  erpSyncError: string | null;
}

/** Whose purchase orders are read: the buyer's own, or those addressed to the signed-in supplier. */
export type PurchaseOrderSide = "buyer" | "supplier";

const PATHS: Record<PurchaseOrderSide, string> = {
  buyer: "/api/v1/buyer/purchase-orders",
  supplier: "/api/v1/buyer/purchase-orders/supplier",
};

/** The newest purchase orders first. */
export const getPurchaseOrders = async (side: PurchaseOrderSide, limit = 20, index = 0): Promise<PurchaseOrderListItem[]> => {
  try {
    const response = await axiosInstance.get<PurchaseOrderListItem[]>(PATHS[side], { params: { index, limit } });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load purchase orders."));
  }
};

export interface CreatePurchaseOrderLine {
  materialCode: string;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
}

/** One purchase order for one supplier. */
export interface CreatePurchaseOrderRequest {
  supplierId: string;
  supplierCode: string;
  companyCode: string;
  plantCode: string;
  currency: string;
  purchasingOrganization: string;
  purchasingGroup: string;
  purchaseOrderType: string;
  /** yyyy-MM-dd */
  deliveryDate: string;
  lines: CreatePurchaseOrderLine[];
}

/** Creates a purchase order (POST /api/v1/buyer/purchase-orders). */
export const createPurchaseOrder = async (request: CreatePurchaseOrderRequest): Promise<void> => {
  try {
    await axiosInstance.post(PATHS.buyer, request);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the purchase order."));
  }
};

/** Sends a purchase order to the ERP again (POST .../purchase-orders/{id}/reprocess). */
export const reprocessPurchaseOrder = async (purchaseOrderId: string): Promise<void> => {
  try {
    await axiosInstance.post(`/api/v1/buyer/purchase-orders/${purchaseOrderId}/reprocess`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not reprocess the purchase order."));
  }
};

/** Sends a purchase order created from a contract to the ERP again (POST .../purchase-orders/{id}/retry-erp-sync). */
export const retryPurchaseOrderErpSync = async (purchaseOrderId: string): Promise<ContractPurchaseOrder> => {
  try {
    const response = await axiosInstance.post<ContractPurchaseOrder>(`/api/v1/buyer/purchase-orders/${purchaseOrderId}/retry-erp-sync`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not send the purchase order to the ERP again."));
  }
};
