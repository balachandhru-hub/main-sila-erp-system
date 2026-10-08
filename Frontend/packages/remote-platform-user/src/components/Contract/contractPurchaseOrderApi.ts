import axios from 'axios';
import platformInstance from '../../api/platformInstance';
import type {
  ContractErpSyncDto,
  ContractPurchaseOrderDraftDto,
  ContractPurchaseOrderDto,
  ContractPurchaseOrderSummaryDto,
  CreateContractPurchaseOrderRequest,
} from '../../api/platformApi';

export type {
  ContractErpSyncDto,
  ContractPurchaseOrderDraftDto,
  ContractPurchaseOrderDto,
  ContractPurchaseOrderSummaryDto,
  CreateContractPurchaseOrderRequest,
};

/** User-facing text of a failed call; a 401 also hands over to the app's sign-in handling. */
const readApiError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      (window as unknown as { handleUnauthorized?: () => void }).handleUnauthorized?.();
      return new Error('You are not authorized to access this resource. Please login again.');
    }
    const data = error.response?.data as { message?: string; description?: string } | undefined;
    return new Error(data?.description || data?.message || fallback);
  }
  return new Error(error instanceof Error && error.message ? error.message : fallback);
};

/**
 * Creates a purchase order from an approved contract (POST /api/v1/buyer/predefined-contract/{contractId}/purchase-orders).
 * The order exists even when the ERP does not accept it: check erpSyncStatus of the result.
 */
export const createContractPurchaseOrder = async (
  contractId: string,
  details?: CreateContractPurchaseOrderRequest
): Promise<ContractPurchaseOrderDto> => {
  try {
    const response = await platformInstance.post<ContractPurchaseOrderDto>(
      `/api/v1/buyer/predefined-contract/${contractId}/purchase-orders`,
      details ?? {}
    );
    return response.data;
  } catch (error: unknown) {
    throw readApiError(error, 'Failed to create the purchase order.');
  }
};

/**
 * What a purchase order from this contract needs: whether an ERP will be called (then its details must be entered),
 * and the values already known (GET .../predefined-contract/{contractId}/purchase-order-draft).
 */
export const fetchContractPurchaseOrderDraft = async (contractId: string): Promise<ContractPurchaseOrderDraftDto> => {
  try {
    const response = await platformInstance.get<ContractPurchaseOrderDraftDto>(
      `/api/v1/buyer/predefined-contract/${contractId}/purchase-order-draft`
    );
    return response.data;
  } catch (error: unknown) {
    throw readApiError(error, 'Failed to prepare the purchase order.');
  }
};

/** Sends the executed contract to the buyer's ERP again (POST .../predefined-contract/{contractId}/erp-sync). */
export const retryContractErpSync = async (contractId: string): Promise<ContractErpSyncDto> => {
  try {
    const response = await platformInstance.post<ContractErpSyncDto>(
      `/api/v1/buyer/predefined-contract/${contractId}/erp-sync`
    );
    return response.data;
  } catch (error: unknown) {
    throw readApiError(error, 'Failed to send the contract to the ERP.');
  }
};

/** Sends a purchase order whose ERP call failed to the buyer's ERP again (POST .../purchase-orders/{purchaseOrderId}/retry-erp-sync). */
export const retryPurchaseOrderErpSync = async (purchaseOrderId: string): Promise<ContractPurchaseOrderDto> => {
  try {
    const response = await platformInstance.post<ContractPurchaseOrderDto>(
      `/api/v1/buyer/purchase-orders/${purchaseOrderId}/retry-erp-sync`
    );
    return response.data;
  } catch (error: unknown) {
    throw readApiError(error, 'Failed to send the purchase order to the ERP.');
  }
};

/** The purchase orders created from a contract, newest first (GET .../predefined-contract/{contractId}/purchase-orders). */
export const fetchContractPurchaseOrders = async (contractId: string): Promise<ContractPurchaseOrderDto[]> => {
  try {
    const response = await platformInstance.get<ContractPurchaseOrderDto[]>(
      `/api/v1/buyer/predefined-contract/${contractId}/purchase-orders`
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw readApiError(error, 'Failed to load the purchase orders of this contract.');
  }
};

/** The toast for a purchase order that was just created, by how the ERP hand-off went. */
export const purchaseOrderCreatedToast = (
  order: Pick<ContractPurchaseOrderDto, 'erpSyncStatus'>
): { kind: 'success' | 'warning'; message: string } => {
  switch (order.erpSyncStatus) {
    case 'SYNCED':
      return { kind: 'success', message: 'Purchase Order created and synchronized with ERP.' };
    case 'NOT_CONFIGURED':
      return { kind: 'success', message: 'Purchase Order created. ERP integration is not configured.' };
    case 'FAILED':
    case 'UNKNOWN':
      return { kind: 'warning', message: 'Purchase Order created, but ERP synchronization failed.' };
    default:
      return { kind: 'success', message: 'Purchase Order created successfully.' };
  }
};
