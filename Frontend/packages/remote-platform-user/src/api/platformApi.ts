import platformInstance from './platformInstance';
import type {
  BuyerDto,
  SupplierDto,
  PaginationParamsDto,
  AssetDownloadResponseDto,
  ErrorResponseDto,
} from '../dto/platformDto';
export interface CreateDepartmentRequestDto {
  organizationId: string;
  department: string;
  buyerId: string;
  costCenter: string[];
}
 
export interface DepartmentResponseDto {
  id?: string;
  organizationId: string;
  department: string;
  buyerId: string;
  costCenter: string[];
  createdAt?: string;
  updatedAt?: string;
}
export interface DepartmentListItemDto {
  id: string;
  department: string;
}

export interface CostCenterListItemDto {
  id: string;
  departmentId: string;
  costCenter: string;
}

/* ---------------------------------- Bid Comparison DTOs ---------------------------------- */

export type BidValueType = 'AMOUNT' | 'PERCENTAGE';

export interface BidQuotationItemDto {
  supplierQuotationItemId: string;
  supplierRFQItemId: string;
  buyerRFQItemId: string;
  version: string;
  quotedPrice: number;
  quotedAmount: number;
  subTotal: number;
  lineNumber: number;
  deliveryCharge: number | null;
  tax: number | null;
  discount: number | null;
  deliveryType: BidValueType | null;
  discountType: BidValueType | null;
  taxType: BidValueType | null;
}

export interface BidQuotationVersionDto {
  supplierRFQId: string;
  quotationId: string;
  version: string;
  totalPrice: number;
  deliveryCharge: number;
  tax: number;
  discount: number;
  deliveryType: BidValueType;
  discountType: BidValueType;
  taxType: BidValueType;
  status: string;
  items: BidQuotationItemDto[];
}

export interface BidSupplierQuotationDto {
  supplierId: string;
  supplierName: string;
  firstVersion: BidQuotationVersionDto;
  latestVersion: BidQuotationVersionDto;
}

export interface BidRfqItemDto {
  id: string;
  description: string;
  quantity: number;
  uom: string;
  materialCode: string;
  materialGroup: string;
  costCenter: string;
  lineNumber: number;
}

export interface BidComparisonResponseDto {
  rfqId: string;
  rfqNumber: string;
  addLotOption: boolean;
  suppliers: BidSupplierQuotationDto[];
  rfqItems: BidRfqItemDto[];
}

export type {
  BuyerDto as Buyer,
  SupplierDto as Supplier,
  BusinessProfileDto as BusinessProfile,
  RegistrationDto as Registration,
  BankAccountDto as BankAccount,
  DispatchLocationDto as DispatchLocation,
  AssetDto as Asset,
  AssetDownloadResponseDto as AssetDownloadResponse,
  PaginationParamsDto as PaginationParams,
} from '../dto/platformDto';

export const getAllBuyers = async (
  { index, limit }: PaginationParamsDto = { index: 0, limit: 50 }
): Promise<BuyerDto[]> => {
  const response = await platformInstance.post('/api/v1/buyer/get-all-buyer', {
    index,
    limit,
  });
  return response.data;
};

export const getAllSuppliers = async (
  { index, limit }: PaginationParamsDto = { index: 0, limit: 50 }
): Promise<SupplierDto[]> => {
  const response = await platformInstance.post('/api/v1/supplier/get-all-supplier', {
    index,
    limit,
  });
  return response.data;
};

export const logoutPlatformUser = async (): Promise<void> => {
  try {
    await platformInstance.put('/api/v1/identity/auth/logout');
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to logout.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const downloadBuyerAsset = async (assetId: string): Promise<AssetDownloadResponseDto> => {
  try {
    const response = await platformInstance.get(`/api/v1/buyer/asset/${assetId}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to fetch document.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const downloadSupplierAsset = async (assetId: string): Promise<AssetDownloadResponseDto> => {
  try {
    const response = await platformInstance.get(`/api/v1/supplier/asset/${assetId}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to fetch document.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const updateBuyerStatus = async (buyerId: string, status: string, comments?: string): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/status', {
      id: buyerId,
      buyerId,
      status,
      comments: comments || '',
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to update buyer status.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const updateSupplierStatus = async (supplierId: string, status: string, comments?: string): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/supplier/status', {
      id: supplierId,
      supplierId,
      status,
      comments: comments || '',
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to update supplier status.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const updateBuyerInternalStatus = async (organizationId: string, isActive: boolean): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/internal-status', {
      buyer: {
        organizationId,
        isActive,
      },
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to update buyer internal status.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const updateSupplierInternalStatus = async (organizationId: string, isActive: boolean): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/supplier/internal-status', {
      supplier: {
        organizationId,
        isActive,
      },
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to update supplier internal status.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const createBuyerDepartment = async (
  buyerId: string,
  organizationId: string,
  department: string,
  costCenter: string[]
): Promise<DepartmentResponseDto> => {
  try {
    const response = await platformInstance.post(
      `/api/v1/buyer/department?buyerId=${buyerId}`,
      {
        organizationId,
        department,
        buyerId,
        costCenter,
      }
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to create department.';
    throw new Error(`${errMsg} (${status})`);
  }
};

export const getDepartmentsByBuyer = async (
  buyerId: string,
  { index = 0, limit = 50, searchTerm = '' }: { index?: number; limit?: number; searchTerm?: string } = {}
): Promise<DepartmentListItemDto[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/all-department', {
      params: { buyerId, index, limit, searchTerm },
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to fetch departments.';
    if (typeof responseData === 'string') {
      errMsg = responseData;
    } else if (responseData?.message) {
      errMsg = responseData.message;
    } else if (responseData?.description) {
      errMsg = responseData.description;
    } else if (responseData?.error) {
      errMsg = responseData.error;
    } else if (error.message) {
      errMsg = error.message;
    }

    throw new Error(`${errMsg} (${status})`);
  }
};

export const getCostCentersByDepartment = async (
  departmentId: string,
  { index = 0, limit = 50, searchTerm = '' }: { index?: number; limit?: number; searchTerm?: string } = {}
): Promise<CostCenterListItemDto[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/all-costcenter', {
      params: { departmentId, index, limit, searchTerm },
    });
    return response.data;
  } catch (error: any) {

    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to fetch cost centers.';
    if (typeof responseData === 'string') {
      errMsg = responseData;
    } else if (responseData?.message) {
      errMsg = responseData.message;
    } else if (responseData?.description) {
      errMsg = responseData.description;
    } else if (responseData?.error) {
      errMsg = responseData.error;
    } else if (error.message) {
      errMsg = error.message;
    }

    throw new Error(`${errMsg} (${status})`);
  }
};

export const getSupplierProfileByOrgId = async (organizationId: string): Promise<SupplierDto> => {
  try {
    const response = await platformInstance.get('/api/v1/supplier/profile', {
      params: { organizationId },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 405 || error.response?.status === 400 || error.response?.status === 404) {
      const postResponse = await platformInstance.post('/api/v1/supplier/profile', { organizationId });
      return postResponse.data;
    }
    throw error;
  }
};

export const getBuyerProfileByOrgId = async (organizationId: string): Promise<BuyerDto> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/profile', {
      params: { organizationId },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 405 || error.response?.status === 400 || error.response?.status === 404) {
      const postResponse = await platformInstance.post('/api/v1/buyer/profile', { organizationId });
      return postResponse.data;
    }
    throw error;
  }
};

export const isBidComparisonError = (
  data: BidComparisonResponseDto | ErrorResponseDto
): data is ErrorResponseDto => !!data && 'status_code' in data;

export const getBidComparisonData = async (
  rfqId: string
): Promise<BidComparisonResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.get<BidComparisonResponseDto>('/api/v1/buyer/bid-compare', {
      params: { rfqId },
    });
    return {
      ...response.data,
      suppliers: response.data?.suppliers || [],
      rfqItems: response.data?.rfqItems || [],
    };
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        status_code: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        status_code: errData.status_code || errData.statusCode || error.response.status || 500,
        message: errData.message || 'Failed to fetch bid comparison data',
        description: errData.description || 'No details provided',
      };
    }

    return {
      status_code: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching bid comparison data.',
    };
  }
};

export const getTokenClaims = async (skipRefresh = false) => {
  const response = await platformInstance.get('/api/v1/identity/token-claim', {
    ...({ _skipRefresh: skipRefresh } as any),
  });
  return response.data;
};

export interface BuyerAssetDto {
  fileName?: string;
  fileType?: string;
  contentType?: string;
  fileBytes?: string;
  url?: string;
  fileUrl?: string;
}

export interface AssetErrorDto {
  statusCode: number;
  message: string;
  description: string;
}

export const fetchBuyerAsset = async (
  assetId: string
): Promise<BuyerAssetDto | AssetErrorDto> => {
  try {
    try {
      const response = await platformInstance.get<BuyerAssetDto>(
        `/api/v1/buyer/asset/${assetId}`
      );
      if (response.data) return response.data;
    } catch (e) {
      // fallback to supplier asset endpoint
    }

    const response = await platformInstance.get<BuyerAssetDto>(
      `/api/v1/supplier/asset/${assetId}`
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch asset',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching the asset.',
    };
  }
};

/**
 * Files a supplier uploaded as answers to RFQ questions are stored against the supplier,
 * so they are read from the supplier asset endpoint rather than the buyer one.
 */
export const fetchSupplierAnswerAsset = async (
  assetId: string
): Promise<BuyerAssetDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.get<BuyerAssetDto>(`/api/v1/supplier/asset/${assetId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch asset',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching the asset.',
    };
  }
};

export interface RfqAwardSelectionDto {
  rfqItemId: string;
  supplierId: string;
}

export interface RfqAwardRequestDto {
  rfqId: string;
  // selectionMode?: string;
  remarks?: string;
  selections: RfqAwardSelectionDto[];
}

export interface RfqAwardResponseDto {
  success?: boolean;
  message?: string;
  [key: string]: any;
}

export interface RfqAwardErrorDto {
  statusCode?: number;
  status_code?: number;
  message: string;
  description?: string;
}

export const awardRfq = async (
  payload: RfqAwardRequestDto
): Promise<RfqAwardResponseDto | RfqAwardErrorDto> => {
  try {
    const response = await platformInstance.post<RfqAwardResponseDto>(
      '/api/v1/buyer/rfq-award',
      payload
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to award RFQ.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Unexpected error while awarding RFQ.',
    };
  }
};

/**
 * Reverts an awarded RFQ's status from "AWARDED" back to "FREEZING" so the
 * buyer can select and award a different supplier.
 */
export const unawardRfq = async (
  rfqId: string
): Promise<StatusUpdateResponseDto | RfqAwardErrorDto> => {
  try {
    const response = await platformInstance.put<StatusUpdateResponseDto>(
      '/api/v1/buyer/rfq-award/unaward',
      { rfqId }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to unaward RFQ.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Unexpected error while unawarding RFQ.',
    };
  }
};

export interface RfqAssetAttachmentDto {
  id: string;
  assetType?: string;
  assetName?: string;
  fileType?: string;
  fileName?: string;
}

export interface SupplierEsignStatusDto {
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachmentDto[];
}

export interface StatusUpdateResponseDto {
  statusCode: number;
  message: string;
  description?: string;
  id?: string;
}

/**
 * Buyer's acceptance/rejection status of the supplier's terms & conditions.
 */
export const updateSupplierTermsConditionStatus = async (
  rfqId: string,
  supplierId: string,
  status: string,
  comment?: string
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/supplier-terms-condition-status', {
      rfqId,
      supplierId,
      status,
      comment: comment ?? "",
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to update supplier terms & conditions status.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to update supplier terms & conditions status.',
      description: '',
    };
  }
};

/**
 * The parts of the buyer's rfq-by-id that the contract screen needs: each supplier's terms & conditions and
 * e-signature status, and whether the buyer has accepted each supplier's terms.
 */
export interface BuyerRfqContractStatusDto {
  supplierTermsConditions?: {
    termsAndCondition: boolean;
    supplierId: string;
    supplierName: string;
    attachments: RfqAssetAttachmentDto[];
  }[];
  supplierESigns?: SupplierEsignStatusDto[];
  buyerTermsAndConditionStatuses?: {
    supplierId: string;
    supplierName: string;
    buyerTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING';
    isSupplierInvitedForContract?: boolean;
  }[];
  /** Whether the buyer has already accepted each supplier's terms & conditions. */
  supplierTermsAndConditionAccepted?: {
    supplierId: string;
    supplierName: string;
    supplierTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  }[];
  /** Contracts already created for this RFQ, one per supplier. Only present once a contract has been created. */
  contracts?: BuyerRfqContractRefDto[];
}

export interface BuyerRfqContractRefDto {
  contractId: string;
  contractNumber: string;
  supplierId: string;
  status?: string;
  approvalUsers?: BuyerContractApprovalUserStatusDto[];
}

export interface BuyerContractApprovalFlowDto {
  id: string;
  approvalCode: string;
  approvalName: string;
  contractId: string;
  type: string;
  totalAmount: number;
  currency: string;
}

/** Shape returned for each entry of a contract's `attachments` (GET /api/v1/buyer/contract[/{id}]). */
export interface BuyerContractAttachmentDto {
  id: string;
  assetId: string;
  type: string;
  fileName: string;
}

/** One approver's position and decision in the contract's approval chain. */
export interface BuyerContractApprovalUserStatusDto {
  userId: string;
  userName: string;
  email: string;
  order: number;
  status: string;
}

/** ERP hand-off of a purchase order: NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN. */
export type PurchaseOrderErpSyncStatus = 'NOT_CONFIGURED' | 'PENDING' | 'SYNCED' | 'FAILED' | 'UNKNOWN';

/** A purchase order created from a contract (POST/GET .../predefined-contract/{id}/purchase-orders). */
export interface ContractPurchaseOrderDto {
  id: string;
  /** This system's own PO number. The ERP's document number is erpPurchaseOrderId. */
  poNumber: string;
  contractId: string | null;
  contractNumber: string | null;
  supplierId: string;
  supplierName: string | null;
  status: string;
  currency: string | null;
  totalAmount: number;
  orderDate: string;
  itemCount: number;
  /** Document number the ERP returned. Null until the ERP accepted the order, or when no ERP is configured. */
  erpPurchaseOrderId: string | null;
  erpSyncStatus: PurchaseOrderErpSyncStatus;
  erpSyncError: string | null;
}

/**
 * The ERP details a purchase order from a contract needs and the contract does not hold. Only required (see
 * ContractPurchaseOrderDraftDto.requiredFields) when the buyer has a purchase order API.
 */
export interface CreateContractPurchaseOrderRequest {
  /** SAP document type. Defaults to NB. */
  purchaseOrderType?: string | null;
  purchasingOrganization?: string | null;
  purchasingGroup?: string | null;
  companyCode?: string | null;
  /** The supplier's vendor number in the ERP. */
  supplierCode?: string | null;
  /** yyyy-MM-dd. Defaults to today. */
  purchaseOrderDate?: string | null;
  plant?: string | null;
  storageLocation?: string | null;
  /** SAP account assignment category. Defaults to U. */
  accountAssignmentCategory?: string | null;
  glAccount?: string | null;
}

/** What the screen needs before creating a purchase order: whether an ERP will be called, and the values already known. */
export interface ContractPurchaseOrderDraftDto {
  erpConfigured: boolean;
  /** Names of CreateContractPurchaseOrderRequest that must be filled when the ERP is configured. */
  requiredFields: string[];
  values: CreateContractPurchaseOrderRequest;
}

/** One line of a contract: what was awarded to the supplier, priced from the supplier's quotation. */
export interface ContractItemDto {
  lineNumber: number;
  materialCode: string | null;
  materialGroup: string | null;
  costCenter: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string | null;
  /** Null for a lot-wise award, or when the quotation could not be read. */
  unitPrice: number | null;
  lineAmount: number | null;
}

/** The purchase order figures of a contract; the backend decides whether another order may be created. */
export interface ContractPurchaseOrderSummaryDto {
  purchaseOrderCount: number;
  purchaseOrderTotal: number;
  remainingAmount: number;
  canCreatePurchaseOrder: boolean;
  createBlockedReason: string | null;
  latestPurchaseOrder: ContractPurchaseOrderDto | null;
}

export interface BuyerContractDto {
  id: string;
  contractNumber: string;
  contractName: string;
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  startDate: string;
  endDate: string;
  amount: number;
  dateCreated: string;
  status: string;
  supplierId?: string;
  supplierName?: string | null;
  /** Id the ERP returned for the executed contract. */
  erpContractId?: string | null;
  erpSyncStatus?: PurchaseOrderErpSyncStatus | null;
  erpSyncError?: string | null;
  /** What was awarded to the supplier, with prices. Only in the single-contract response. */
  items?: ContractItemDto[];
  purchaseOrderSummary?: ContractPurchaseOrderSummaryDto;
  attachments: BuyerContractAttachmentDto[];
  approvalFlows: BuyerContractApprovalFlowDto[];
  approvalUsers: BuyerContractApprovalUserStatusDto[];
}

export interface CreateBuyerContractPayload {
  /** Set when this call creates the contract with its fully-signed document: it is then sent to the buyer's ERP. */
  syncWithErp?: boolean;
  contractName: string;
  rfqId: string;
  supplierId: string;
  startDate: string;
  endDate: string;
  amount: number;
  attachments: {
    entityType: string;
    entityId: string;
    assetType: string;
    fileBytes: string;
    fileName: string;
    contentType: string;
    isSingletonAsset: boolean;
    id?: string;
  }[];
}

/**
 * Creates the contract for an awarded RFQ and sends it to the supplier.
 */
export const createBuyerContract = async (
  payload: CreateBuyerContractPayload
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/predefined-contract', payload);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to send the contract.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to send the contract.',
      description: '',
    };
  }
};

/** How the hand-off of an executed contract to the buyer's ERP went (POST .../predefined-contract/{id}/erp-sync). */
export interface ContractErpSyncDto {
  contractId: string;
  contractNumber: string | null;
  /** Id the ERP returned. Null until the ERP accepted the contract, or when no contract API is configured. */
  erpContractId: string | null;
  erpSyncStatus: PurchaseOrderErpSyncStatus;
  erpSyncError: string | null;
}

/**
 * Sends the executed contract to the buyer's ERP when the buyer has a contract API. Safe to call again: a contract
 * the ERP already accepted is not sent twice.
 */
export const syncBuyerContractErp = async (
  contractId: string
): Promise<ContractErpSyncDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.post(`/api/v1/buyer/predefined-contract/${contractId}/erp-sync`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to send the contract to the ERP.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to send the contract to the ERP.',
      description: '',
    };
  }
};

export interface FinalizeBuyerContractPayload {
  predefinedContractId: string;
  attachment: {
    asset: CreateBuyerContractPayload['attachments'][number];
  };
}

/**
 * Executes/finalizes an existing (OPEN) predefined contract with the fully-signed contract PDF.
 */
export const finalizeBuyerContract = async (
  payload: FinalizeBuyerContractPayload
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/contract-detail', payload);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to execute the contract.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to execute the contract.',
      description: '',
    };
  }
};

export interface InviteForContractPayload {
  rfqId: string;
  supplierId: string;
}

/**
 * Invites a supplier to review and negotiate a contract's Terms & Conditions for an awarded RFQ.
 * The contract itself (createBuyerContract) is created later, once both parties have signed.
 */
export const inviteSupplierForContract = async (
  payload: InviteForContractPayload
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/rfq/invite-for-contract', payload);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to invite the supplier for contract.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to invite the supplier for contract.',
      description: '',
    };
  }
};

export const fetchBuyerRfqContractStatus = async (
  rfqId: string
): Promise<BuyerRfqContractStatusDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/rfq-by-id', { params: { rfqId } });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to load the RFQ contract details.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to load the RFQ contract details.',
      description: '',
    };
  }
};

/**
 * Paginated list of contracts the buyer has created.
 */
export const fetchBuyerContracts = async (
  index = 0,
  limit = 10
): Promise<BuyerContractDto[] | AssetErrorDto> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/predefined-contract', { params: { index, limit } });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to load contracts.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to load contracts.',
      description: '',
    };
  }
};

export const fetchBuyerContractById = async (
  contractId: string
): Promise<BuyerContractDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.get(`/api/v1/buyer/predefined-contract/${contractId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to load the contract.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to load the contract.',
      description: '',
    };
  }
};

export interface BuyerContractApprovalActionPayload {
  status: string;
  comment: string;
}

/**
 * Submits the signed-in approver's decision for a contract's approval chain.
 */
export const submitBuyerContractApprovalAction = async (
  contractId: string,
  payload: BuyerContractApprovalActionPayload
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.put(`/api/v1/buyer/predefined-contract/approval/${contractId}`, payload);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to submit your decision.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to submit your decision.',
      description: '',
    };
  }
};

export const fetchBuyerRfqEsign = async (
  rfqId: string
): Promise<SupplierEsignStatusDto[] | AssetErrorDto> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/rfq-esign', { params: { rfqId } });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch e-signature status.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to fetch e-signature status.',
      description: '',
    };
  }
};

export const uploadBuyerRfqEsign = async (
  rfqId: string,
  payload: {
    entityType?: string;
    entityId?: string;
    assetType?: string;
    fileBytes?: string;
    fileName?: string;
    contentType?: string;
    isSingletonAsset?: boolean;
    id?: string;
  }
): Promise<any> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/rfq-esign', payload, {
      params: { rfqId },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      return error.response.data;
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to upload buyer e-signature.',
    };
  }
};

/**
 * Supplier's acceptance/rejection status of the buyer's terms & conditions.
 */
export const updateBuyerTermsConditionStatus = async (
  rfqId: string,
  status: string,
  comment?: string
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.put(
      '/api/v1/supplier/buyer-terms-condition-status',
      { comment: comment ?? "" },
      { params: { rfqId, status } }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to update buyer terms & conditions status.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to update buyer terms & conditions status.',
      description: '',
    };
  }
};

export interface UpdateBuyerRfqTermsConditionPayload {
  rfqId: string;
  buyerId: string;
  isSingletonAsset?: boolean;
  document: {
    entityType?: string;
    entityId?: string;
    assetType?: string;
    fileBytes?: string;
    fileName?: string;
    contentType?: string;
    isSingletonAsset?: boolean;
    id?: string;
  };
}

/**
 * Re-uploads the buyer's Terms & Conditions document, e.g. after the supplier rejects it via "Proposed Edits".
 */
export const updateBuyerRfqTermsCondition = async (
  payload: UpdateBuyerRfqTermsConditionPayload
): Promise<StatusUpdateResponseDto | AssetErrorDto> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/rfq-terms-condition', payload);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }
    if (error.response?.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to upload the Terms & Conditions document.',
        description: errData.description || '',
      };
    }
    return {
      statusCode: 500,
      message: error?.message || 'Failed to upload the Terms & Conditions document.',
      description: '',
    };
  }
};
