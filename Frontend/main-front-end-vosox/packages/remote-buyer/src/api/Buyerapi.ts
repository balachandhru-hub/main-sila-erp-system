import axiosInstance from "./axiosInstance";
import type { BuyerDashboardAnalytics } from '@vosox/shared-ui';
import type {
  CreateRFQPayload,
  CreateRFQResponse,
  VerifiedSupplierSearchPayload,
  VerifiedSupplierDto,
  BuyerRFQDetailResponse,
} from "../dto/rfqDto";
import type { UnspscSegmentDto, UnspscFamilyDto } from "../dto/masterDataDto";
import type {
  ChatApiAdapter,
  ChatAttachmentInputDto,
  ChatMessageDto,
  ChatThreadDto,
  MarkThreadReadResponseDto,
  ChatAttachmentDownloadDto,
} from "@vosox/shared-ui";

export interface SendBuyerMessagePayload {
  rfqId: string;
  supplierId?: string;
  externalSupplierId?: string;
  body: string;
  attachments: ChatAttachmentInputDto[];
}

export interface BuyerCatalogAssetItem {
  id: string;
  assetType: string | null;
  assetName: string;
  fileType: string | null;
  fileName: string;
}

export interface BuyerCatalogResponse {
  supplierId: string;
  catalogId: string;
  supplierName: string;
  catalogName: string;
  description: string;
  price: number;
  currency: string;
  unitOfMeasure: string;
  sku?: string | null;
  /** The supplier's stock of the product. */
  availableStock?: number | null;
  discountPercent?: number | null;
  segment: number;
  segmentTitle: string;
  family: number;
  familyTitle: string;
  commodity: number;
  commodityTitle: string;
  class: number;
  classTitle: string;
  catalogType: string;
  isPunchOut: boolean;
  punchOutUrl: string;
  hasCatalog: boolean;
  asset: BuyerCatalogAssetItem[];
}
import type { ErrorResponseDto } from "@vosox/shared-ui";

export interface BuyerProfileResponse {
  id: string;
  organizationId: string;
  businessProfile: {
    organizationName: string;
    email: string;
    phone: string;
    country: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    pinCode: string;
    industry: string;
    businessType: string;
    employeeCount: number;
    annualTurnover: number;
    currency: string;
    yearEstablished: number;
    website: string;
    description: string;
    status: string;
  };
  categories?: {
    segment: number;
    segmentTitle: string;
    family: number;
    familyTitle: string;
    class: number;
    classTitle: string;
    commodity: number;
    commodityTitle: string;
  }[];
  buyerCategories?: {
    segment: number;
    segmentTitle: string;
    family: number;
    familyTitle: string;
    class: number;
    classTitle: string;
    commodity: number;
    commodityTitle: string;
  }[];
  registrations: {
    registrationType: string;
    registrationNumber: string;
    registrationName: string;
    asset: {
      id: string;
      assetType: string;
      assetName: string;
      fileType: string;
      fileName: string;
    };
    expiryDate: string;
  }[];
  bankAccounts: {
    accountHolderName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode: string;
    currency: string;
    isPrimary: boolean;
    isVerified: boolean;
  }[];
  dispatchLocations: {
    locationName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
    contactPerson: string;
    contactPhone: string;
    isDefault: boolean;
  }[];
}

export interface OnboardingResponse {
  id: string;
  organizationName: string;
  organizationType: string;
  email: string;
  phone: string;
  country: string;
  emailVerified: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface BuyerRegistrationPayload {
  organizationId: string;
  organizationName: string;
  email: string;
  phone: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  industry: string;
  businessType: string;
  employeeCount: number;
  annualTurnover: number;
  currency: string;
  yearEstablished: number;
  website: string;
  description: string;
  status: string;
  buyerCategories: {
    segment: number;
    segmentTitle: string;
    family: number;
    familyTitle: string;
    class: number;
    classTitle: string;
    commodity: number;
    commodityTitle: string;
  }[];
  buyerBankAccounts: {
    accountHolderName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode: string;
    currency: string;
    isPrimary: boolean;
  }[];
  buyerDocumentRegistrations: {
    registrationNumber: string;
    registrationName: string;
    expiryDate: string | null;
    registrationType: string;
    registrationDocument: {
      entityType: string;
      entityId: string;
      assetType: string;
      fileBytes: string;
      fileName: string;
      contentType: string;
      isSingletonAsset: boolean;
      id?: string;
    };
  }[];
  buyerDeliveryLocations: {
    locationName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
    contactPerson: string;
    contactPhone: string;
    isDefault: boolean;
  }[];
}

export interface PersonDetailDto {
  personId: string;
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  userName: string;
  addressLine: string;
  country: string;
  roleId: string;
  roleName: string;
  organizationName: string;
  organizationEmail: string;
}

export interface UpdateRejectedBuyerPayload {
  buyer: {
    buyerId: string;
    businessProfile: {
      organizationId: string;
      organizationName: string;
      email: string;
      phone: string;
      country: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pinCode: string;
      industry: string;
      businessType: string;
      employeeCount: number;
      annualTurnover: number;
      currency: string;
      yearEstablished: number;
      website: string;
      description: string;
      status: string;
    };
    buyerCategories: (BuyerRegistrationPayload['buyerCategories'][0] & { id?: string })[];
    buyerBankAccounts: (BuyerRegistrationPayload['buyerBankAccounts'][0] & { id?: string })[];
    buyerDocumentRegistrations: (BuyerRegistrationPayload['buyerDocumentRegistrations'][0] & { id?: string })[];
    buyerDeliveryLocations: (BuyerRegistrationPayload['buyerDeliveryLocations'][0] & { id?: string })[];
  };
}

export interface VerificationTemplate {
  templateId: string;
  templateCode: string;
  templateName: string;
  templateType: string;
  questions: TemplateQuestion[];
}

export interface TemplateQuestion {
  questionId: string;
  question: string;
  questionKey: string;
  questionType: string;
  displayOrder: number;
  answer: string;
  options: string[];
  isRequired: boolean;
}

export interface CreateVerificationTemplatePayload {
  templateName: string;
  description: string;
}


export interface VerificationTemplateQuestionDto {
  verificationTemplateId: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  displayOrder: number;
  options: string[];
}

export interface CreateVerificationTemplateQuestionPayload {
  verificationTemplateQuestionDto: VerificationTemplateQuestionDto;
}


export interface UpdateVerificationTemplateQuestionOptionDto {
  id?: string;
  optionText: string;
  displayOrder: number;
}

export interface UpdateVerificationTemplateQuestionDto {
  id: string;
  verificationTemplateId: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  displayOrder: number;
  isDeleted?: boolean;
  options: UpdateVerificationTemplateQuestionOptionDto[];
}

export interface UpdateVerificationTemplateQuestionPayload {
  verificationTemplateQuestionDto: UpdateVerificationTemplateQuestionDto;
}

export interface ItemMasterDto {
  id: string;
  buyerId: string;
  description: string;
  materialCode: string;
  materialGroup: string;
  productType?: string;
  baseUnitOfMeasure?: string;
  orderUnitOfMeasure?: string;
  alternateUnitOfMeasure?: string;
  valuationClass?: string;
  unitOfMeasureMapping?: string;
  subUnit?: string;
  microUnit?: string;
  approvalFlowId?: string;
  comment?: string;
}

export interface CreateItemMasterRequestDto {
  buyerId: string;
  description: string;
  materialCode: string;
  materialGroup: string;
  productType?: string;
  baseUnitOfMeasure?: string;
  orderUnitOfMeasure?: string;
  alternateUnitOfMeasure?: string;
  valuationClass?: string;
  unitOfMeasureMapping?: string;
  subUnit?: string;
  microUnit?: string;
  approvalFlowId?: string;
  comment?: string;
}

export interface MasterApprovalFlowDto {
  id: string;
  approvalCode: string;
  approvalName: string;
  buyerId: string;
  type?: string | null;
}

export interface ItemMasterSimilarityDto {
  id: string;
  materialCode: string;
  description: string;
}

export interface ItemMasterDetailDto extends ItemMasterDto {}

export interface UploadItemMasterDocumentDto {
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  id?: string;
}

export interface UploadItemMasterFilePayload {
  document: UploadItemMasterDocumentDto;
  organizationId: string;
  buyerId: string;
  title: string;
  approvalFlowId: string;
  comment: string;
}

export interface ItemMasterUploadResultDto {
  totalRows: number;
  successfulUploads: number;
  failedUploads: number;
  errors: string[];
  excelMaterialMasterId: string;
}

export const getBuyerProfile = async (): Promise<BuyerProfileResponse | null> => {
  try {
    const response = await axiosInstance.get<BuyerProfileResponse>('/api/v1/buyer/profile');

    if (response.status === 204 || !response.data || Object.keys(response.data).length === 0) {
      return null;
    }

    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 204) {
      return null;
    }

    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch buyer profile (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getOnboardingDetails = async (): Promise<OnboardingResponse> => {
  try {
    const response = await axiosInstance.get<OnboardingResponse>('/api/v1/identity/onboarding');
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch onboarding details (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const createBuyerProfile = async (payload: BuyerRegistrationPayload): Promise<any> => {
  try {
    const response = await axiosInstance.post('/api/v1/buyer/register', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to create buyer profile (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const updateBuyerProfile = async (payload: BuyerRegistrationPayload): Promise<any> => {
  try {
    const response = await axiosInstance.put('/api/v1/buyer/profile', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to update buyer profile (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const updateRejectedBuyer = async (payload: UpdateRejectedBuyerPayload): Promise<any> => {
  try {
    const response = await axiosInstance.put('/api/v1/buyer/update-rejected-buyer', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to update rejected buyer profile (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const logoutBuyer = async (): Promise<void> => {
  try {
    await axiosInstance.put('/api/v1/identity/auth/logout');
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to logout.';
    throw new Error(`${errMsg} (${status})`);
  }
};


export const getAllDepartments = async (buyerId: string, index = 0, limit = 10, searchTerm?: string): Promise<any> => {
  try {
    let url = `/api/v1/buyer/all-department?buyerId=${buyerId}&index=${index}&limit=${limit}`;
    if (searchTerm) {
      url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    }
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch departments (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getAllCostCenters = async (departmentId: string, index = 0, limit = 10, searchTerm?: string): Promise<any> => {
  try {
    let url = `/api/v1/buyer/all-costcenter?departmentId=${departmentId}&index=${index}&limit=${limit}`;
    if (searchTerm) {
      url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    }
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch cost centers (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};
 

export const getAllItemMasters = async (buyerId: string, index = 0, limit = 10, searchTerm?: string): Promise<any> => {
  try {
    let url = `/api/v1/buyer/item-master?buyerId=${buyerId}&index=${index}&limit=${limit}`;
    if (searchTerm) {
      url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    }
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch item masters (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getMasterApprovalFlows = async (
  buyerId: string,
  index: number = 0,
  limit: number = 10
): Promise<MasterApprovalFlowDto[]> => {
  try {
    const response = await axiosInstance.get<MasterApprovalFlowDto[]>(
      '/api/v1/buyer/master-approval-flow',
      { params: { buyerId, index, limit } }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch approval flows (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const checkItemMasterSimilarity = async (
  buyerId: string,
  description: string,
  materialGroup: string
): Promise<ItemMasterSimilarityDto[]> => {
  try {
    const response = await axiosInstance.get<ItemMasterSimilarityDto[]>(
      '/api/v1/buyer/item-master/check-similarity',
      { params: { buyerId, description, materialGroup } }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to check item master similarity (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getItemMasterById = async (
  id: string
): Promise<ItemMasterDetailDto | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<ItemMasterDetailDto>(`/api/v1/buyer/item-master/${id}`);
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
        message: errData.message || 'Failed to fetch item master details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching item master details.',
    };
  }
};


export const createRFQ = async (payload: CreateRFQPayload): Promise<CreateRFQResponse> => {
  try {
    const response = await axiosInstance.post<CreateRFQResponse>('/api/v1/buyer/createrfq', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to create RFQ (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export interface ContractTemplateAttachmentDto {
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  id?: string;
}

export interface CreateContractTemplatePayload {
  segmentId: number;
  templateName: string;
  attachment: ContractTemplateAttachmentDto;
}

export const createContractTemplate = async (payload: CreateContractTemplatePayload): Promise<unknown> => {
  try {
    const response = await axiosInstance.post('/api/v1/buyer/contract-template', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to create contract template (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

/** Actual GET /api/v1/buyer/contract-template response shape - flat, not nested under "attachment".
 * segmentTitle currently always comes back null (segment title isn't resolved server-side yet), and there's
 * no fileBytes/contentType here - only assetId, so the PDF itself is fetched separately via fetchBuyerAsset. */
export interface ContractTemplateListItemDto {
  id: string;
  templateName: string;
  segmentId?: number;
  segmentTitle?: string | null;
  buyerId?: string;
  assetId?: string;
  fileName?: string;
  dateCreated?: string;
}

export const getContractTemplates = async (index = 0, limit = 10): Promise<ContractTemplateListItemDto[]> => {
  try {
    const response = await axiosInstance.get<ContractTemplateListItemDto[]>('/api/v1/buyer/contract-template', {
      params: { index, limit },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch contract templates (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export interface UpdateContractTemplatePayload {
  templateName: string;
  attachment: ContractTemplateAttachmentDto;
}

export const updateContractTemplate = async (
  contractTemplateId: string,
  payload: UpdateContractTemplatePayload
): Promise<unknown> => {
  try {
    const response = await axiosInstance.put(`/api/v1/buyer/contract-template/${contractTemplateId}`, payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to update contract template (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getVerifiedSuppliers = async (
  payload: VerifiedSupplierSearchPayload
): Promise<VerifiedSupplierDto[]> => {
  try {
    const response = await axiosInstance.post<VerifiedSupplierDto[]>(
      '/api/v1/supplier/rfq-supplier',
      payload
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch suppliers (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const getUnspscSegments = async (
  pageIndex = 1,
  pageSize = 100,
  searchTerm?: string
): Promise<UnspscSegmentDto[]> => {
  try {
    let url = `/api/v1/masterdata/unspsc/segment?pageIndex=${pageIndex}&pageSize=${pageSize}`;
    if (searchTerm) {
      url += `&searchTerm=${encodeURIComponent(searchTerm)}`;
    }
    const response = await axiosInstance.get<UnspscSegmentDto[]>(url);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch segments (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const getUnspscFamilies = async (
  segment: number,
  pageIndex = 1,
  pageSize = 100
): Promise<UnspscFamilyDto[]> => {
  try {
    const url = `/api/v1/masterdata/unspsc/family?segment=${segment}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
    const response = await axiosInstance.get<UnspscFamilyDto[]>(url);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch families (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};


export const fetchBuyerRFQs = async (payload: { buyerId: string; index: number; limit: number }): Promise<any[]> => {
  try {
    const response = await axiosInstance.post<any[]>('/api/v1/buyer/rfq-master-data', payload);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch RFQs (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const fetchBuyerRFQById = async (rfqId: string): Promise<BuyerRFQDetailResponse> => {
  try {
    const response = await axiosInstance.get<BuyerRFQDetailResponse>('/api/v1/buyer/rfq-by-id', {
      params: { rfqId },
    });
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch RFQ details (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export interface UpdateRfqStatusPayload {
  rfqId: string;
  status: string;
}

export const updateRfqStatus = async (payload: UpdateRfqStatusPayload): Promise<any> => {
  try {
    const response = await axiosInstance.put('/api/v1/buyer/rfq-status', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to update RFQ status (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const fetchBuyerCatalog = async (payload: {
  segment?: number;
  family?: number;
  class?: number;
  commodity?: number;
  search?: string;
  /** Part of a supplier name or of its SNID. */
  supplier?: string;
  /** Offset of the first product. */
  index?: number;
  limit?: number;
  /** name | name_desc | price | price_desc (default name). */
  sort?: string;
}): Promise<BuyerCatalogResponse[] | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<BuyerCatalogResponse[]>(
      '/api/v1/supplier/buyer-catalog',
      {
        params: {
          segment: payload.segment || undefined,
          family: payload.family || undefined,
          class: payload.class || undefined,
          commodity: payload.commodity || undefined,
          search: payload.search || undefined,
          supplier: payload.supplier || undefined,
          index: payload.index ?? 0,
          limit: payload.limit ?? 20,
          sort: payload.sort || undefined,
        },
      }
    );
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

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch buyer catalog',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching buyer catalog.',
    };
  }
};

export const getPersonDetail = async (): Promise<PersonDetailDto | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<PersonDetailDto>(
      '/api/v1/identity/person-detail'
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
        message: errData.message || 'Failed to fetch person details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching person details.',
    };
  }
};


export const updatePersonDetail = async (
  data: Partial<PersonDetailDto>
): Promise<PersonDetailDto | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.put<PersonDetailDto>(
      '/api/v1/identity/person-detail',
      data
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to update person details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating person details.',
    };
  }
};


export interface BuyerAssetDownloadResponse {
  assetId: string;
  fileName: string;
  contentType: string;
  fileBytes: string;
}

export const downloadBuyerAsset = async (
  assetId: string
): Promise<BuyerAssetDownloadResponse | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<BuyerAssetDownloadResponse>(
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
        statusCode:
          errData.statusCode ||
          errData.status_code ||
          error.response.status ||
          500,
        message: errData.message || 'Failed to download document',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while downloading the document.',
    };
  }
};

export interface BuyerAssetDto {
  id: string;
  assetName?: string;
  fileName?: string;
  assetType?: string | null;
  fileType?: string | null;
  contentType?: string;
  fileBytes?: string;
  url?: string;
  fileUrl?: string;
}

export const fetchBuyerAsset = async (
  assetId: string
): Promise<BuyerAssetDto | ErrorResponseDto> => {
  try {
    try {
      const response = await axiosInstance.get<BuyerAssetDto>(
        `/api/v1/buyer/asset/${assetId}`
      );
      if (response.data) return response.data;
    } catch (e) {
      // fallback to supplier asset endpoint
    }

    const response = await axiosInstance.get<BuyerAssetDto>(
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


export const fetchBuyerVerificationTemplates = async (
  index: number = 0,
  limit: number = 10,
  organizationId?: string
): Promise<VerificationTemplate[] | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<VerificationTemplate[]>(
      '/api/v1/buyer/get-verification-template',
      { params: { index, limit, organizationId: organizationId || undefined } }
    );
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

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch verification templates',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching verification templates.',
    };
  }
};

export const createBuyerVerificationTemplate = async (
  payload: CreateVerificationTemplatePayload,
  organizationId?: string
): Promise<string | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.post<string>(
      '/api/v1/buyer/verification-template',
      payload,
      { params: { organizationId: organizationId || undefined } }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to create verification template',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating the verification template.',
    };
  }
};

export const createVerificationTemplateQuestion = async (
  payload: CreateVerificationTemplateQuestionPayload
): Promise<string | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.post<string>(
      '/api/v1/buyer/verification-template-question',
      payload
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to create verification template question',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating the verification template question.',
    };
  }
};

export const fetchBuyerVerificationTemplateById = async (
  templateId: string
): Promise<VerificationTemplate | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<VerificationTemplate>(
      `/api/v1/buyer/verification-template/${templateId}`
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
        message: errData.message || 'Failed to fetch verification template',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching the verification template.',
    };
  }
};


export const updateVerificationTemplateQuestion = async (
  payload: UpdateVerificationTemplateQuestionPayload
): Promise<string | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.put<string>(
      '/api/v1/buyer/update-verification-template-question',
      payload
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: "Failed to update template question",
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating the verification template question.',
    };
  }
};

export const deleteVerificationTemplate = async (
  templateId: string
): Promise<boolean | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.delete<boolean>(
      `/api/v1/buyer/verification-template/${templateId}`
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
      return {
        statusCode: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to perform this action. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message:'Failed to delete template',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while deleting the verification template.',
    };
  }
};
export const fetchBuyerCatalogDetail = async (
  catalogId: string
): Promise<BuyerCatalogResponse | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<BuyerCatalogResponse[]>(
      `/api/v1/supplier/buyer-catalog/${catalogId}`
    );
    
    // Handle array response - get first item
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
 
    return {
      statusCode: 404,
      message: 'Product Not Found',
      description: 'The requested catalog could not be found.',
    };
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
        message: errData.message || 'Failed to fetch product details',
        description: errData.description || 'No details provided',
      };
    }
 
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching product details.',
    };
  }
};

export const sendBuyerMessage = async (
  payload: SendBuyerMessagePayload
): Promise<ChatMessageDto> => {
  try {
    const response = await axiosInstance.post<ChatMessageDto>('/api/v1/buyer/message', payload);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to send message (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const fetchBuyerMessageThreads = async (rfqId: string): Promise<ChatThreadDto[]> => {
  try {
    const response = await axiosInstance.get<ChatThreadDto[]>('/api/v1/buyer/message/threads', {
      params: { rfqId },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    // A 404 here means the RFQ has no chat threads yet, not a real failure.
    if (error?.response?.status === 404) {
      return [];
    }
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch chat threads (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const fetchBuyerMessageHistory = async (
  threadId: string,
  index = 0,
  limit = 20
): Promise<ChatMessageDto[]> => {
  try {
    const response = await axiosInstance.get<ChatMessageDto[]>(
      `/api/v1/buyer/message/thread/${threadId}/history`,
      { params: { index, limit } }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to fetch chat history (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const markBuyerThreadAsRead = async (threadId: string): Promise<MarkThreadReadResponseDto> => {
  try {
    const response = await axiosInstance.post<MarkThreadReadResponseDto>(
      `/api/v1/buyer/message/thread/${threadId}/read`
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to mark conversation as read (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

export const downloadBuyerMessageAttachment = async (
  attachmentId: string
): Promise<ChatAttachmentDownloadDto> => {
  try {
    const response = await axiosInstance.get<ChatAttachmentDownloadDto>(
      `/api/v1/buyer/message/attachment/${attachmentId}`
    );
    return response.data;
  } catch (error: any) {
    if (error?.response?.data) {
      const data = error.response.data;
      throw new Error(data?.message || data?.description || `Failed to download attachment (${error.response.status}).`);
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
};

/** Builds the ChatPanel API adapter for the buyer side of a given RFQ — see ChatApiAdapter in @vosox/shared-ui. */
export const createBuyerChatApi = (rfqId: string): ChatApiAdapter => ({
  fetchThreads: () => fetchBuyerMessageThreads(rfqId),
  fetchHistory: (threadId, index, limit) => fetchBuyerMessageHistory(threadId, index, limit),
  markThreadRead: (threadId) => markBuyerThreadAsRead(threadId).then(() => undefined),
  sendMessage: (target, body, attachments) =>
    sendBuyerMessage({
      rfqId,
      ...(target.isExternal ? { externalSupplierId: target.id } : { supplierId: target.id }),
      body,
      attachments,
    }),
  downloadAttachment: (attachmentId) => downloadBuyerMessageAttachment(attachmentId),
});

export const createItemMaster = async (
  payload: CreateItemMasterRequestDto
): Promise<ItemMasterDto> => {
  try {
    const response = await axiosInstance.post('/api/v1/buyer/item-master', payload);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to create item master.';
    if (typeof responseData === 'string') {
      errMsg = responseData;
    } else if (responseData?.message) {
      errMsg = responseData.message;
    } else if (responseData?.description) {
      errMsg = responseData.description;
    } else if (error.message) {
      errMsg = error.message;
    }

    throw new Error(`${errMsg} (${status})`);
  }
};

export const uploadItemMasterFile = async (
  payload: UploadItemMasterFilePayload
): Promise<ItemMasterUploadResultDto> => {
  try {
    const response = await axiosInstance.post<ItemMasterUploadResultDto>(
      '/api/v1/buyer/item-master/upload',
      payload
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to upload item master file.';
    if (typeof responseData === 'string') {
      errMsg = responseData;
    } else if (responseData?.message) {
      errMsg = responseData.message;
    } else if (responseData?.description) {
      errMsg = responseData.description;
    } else if (error.message) {
      errMsg = error.message;
    }

    throw new Error(`${errMsg} (${status})`);
  }
};

/** Aggregated sourcing figures for the buyer dashboard (GET /api/v1/buyer/dashboard-analytics). */
export const fetchBuyerDashboardAnalytics = async (): Promise<BuyerDashboardAnalytics> => {
  // Users only ever see a neutral message; the technical reason goes to the console.
  const unavailable = (detail: string, cause?: unknown): Error => {
    console.warn(`[dashboard-analytics] /api/v1/buyer/dashboard-analytics: ${detail}`, cause ?? '');
    return new Error('Dashboard figures are temporarily unavailable.');
  };

  let response;
  try {
    response = await axiosInstance.get<BuyerDashboardAnalytics>('/api/v1/buyer/dashboard-analytics');
  } catch (error: any) {
    if (!error?.response) throw unavailable('server unreachable', error);
    if (error.response.status === 404) {
      throw unavailable('endpoint not found (404) - deploy the latest Buyer API', error.response.data);
    }
    throw unavailable(`request failed (${error.response.status})`, error.response.data);
  }

  // An older server returns a different response shape; treat it as unavailable rather than crash.
  if (!Array.isArray(response.data?.rfqsByDepartment)) {
    throw unavailable('unexpected response shape - deploy the latest Buyer API', response.data);
  }
  return response.data;
};
