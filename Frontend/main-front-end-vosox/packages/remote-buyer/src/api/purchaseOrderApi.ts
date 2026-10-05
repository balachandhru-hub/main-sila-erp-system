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
