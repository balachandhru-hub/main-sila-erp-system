import supplierInstance from './supplierInstance';
import type { SupplierDashboardAnalytics } from '@vosox/shared-ui';
import type {
  SupplierProfileResponse,
  UpdateRejectedSupplierPayload,
  CreateSupplierProfilePayload,
  MetadataReferenceItem,
  MetadataReferenceType,
  RFQMasterDataItem,
  RFQDetailResponse,
  SupplierContractDto,
  SubmitQuotationPayload,
  CreateSupplierCatalogPayload,
  UpdateCatalogStockPayload,
  SubmitRfqAnswersPayload,
  CurrencyListResponse,
  SupplierCatalogListItem,
  CatalogDetailResponse,
  OtpActionResponse,
  VerifyOtpPayload,
  SupplierQuotationBySupplierIdResponse,
} from '../dto/supplierDto';
import { isErrorResponse } from '@vosox/shared-ui';
import type { ErrorResponseDto } from '@vosox/shared-ui';
import type {
  ChatApiAdapter,
  ChatMessageDto,
  ChatThreadDto,
  ChatAttachmentInputDto,
  ChatAttachmentDownloadDto,
  MarkThreadReadResponseDto,
} from '@vosox/shared-ui';
export type {
  ChatMessageDto,
  ChatThreadDto,
  ChatAttachmentInputDto,
  ChatAttachmentDto,
  ChatAttachmentDownloadDto,
  MarkThreadReadResponseDto,
} from '@vosox/shared-ui';
export type {
  SupplierQuotationBySupplierIdResponse,
  SupplierQuotationByIdItem,
} from '../dto/supplierDto';
export interface SupplierAssetDto {
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
export interface UpdateInvitationStatusPayload {
  requestId: string;
  status: "accept" | "reject";
  remarks?: string | null;
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
export interface BuyerInvitationItem {
  rfqNumber: string;
  title: string;
  endDate: string;
  deliveryLocation: string;
  organizationName: string;
  rfqId: string;
  description: string;
  status: string;
  id: string;
}

export interface VerificationQuestionOption {
  id: string;
  optionText: string;
}

export interface VerificationQuestion {
  verificationTemplateQuestionId: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  answer?: string | null;
  assetId?: string | null;
  verificationTemplateQuestionOptionId?: string | null;
  options?: VerificationQuestionOption[];
}

export interface InvitationAnswersResponse {
  requestId: string;
  rfqId: string;
  rfqNumber: string;
  buyerId: string;
  supplierOrganizationId: string;
  templateId: string;
  status: string;
  remarks: string | null;
  dueDate: string;
  organizationName: string;
  snid: string;
  description: string;
  questions: VerificationQuestion[];
}

export type FetchSupplierInvitationsPayload = {
  index: number;
  limit: number;
  status?: string;
  search?: string;
};

export type { SupplierProfileResponse, RFQMasterDataItem, RFQDetailResponse, SubmitQuotationPayload } from '../dto/supplierDto';
export type {
  CatalogAssetDto,
  CatalogDetailDto,
  CatalogDetailResponseItem,
  CreateSupplierCatalogPayload,
  SubmitRfqAnswersPayload,
  RfqDocumentAssetDto,
  SupplierCatalogListItem
} from '../dto/supplierDto';
export type { ErrorResponseDto } from '../dto/supplierDto';

export const createSupplierProfile = async (
  payload: CreateSupplierProfilePayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post('/api/v1/supplier/register', payload);
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
        message: errData.message || 'Failed to create supplier profile',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating supplier profile.',
    };
  }
};

export const createSupplierCatalog = async (
  payload: CreateSupplierCatalogPayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post('/api/v1/supplier/catalog', payload);
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
        message: errData.message || 'Failed to create supplier catalog',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating supplier catalog.',
    };
  }
};

export const updateSupplierCatalogStock = async (
  catalogId: string,
  payload: UpdateCatalogStockPayload
): Promise<true | ErrorResponseDto> => {
  try {
    await supplierInstance.put(`/api/v1/supplier/catalog/${catalogId}/stock`, payload);
    return true;
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
        message: errData.message || 'Failed to update stock',
        description: errData.description || errData.title || 'Failed to update stock',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating the stock.',
    };
  }
};

export const updateRejectedSupplier = async (
  payload: UpdateRejectedSupplierPayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.put(
      '/api/v1/supplier/update-rejected-supplier',
      payload
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
        message: errData.message || 'Failed to update rejected supplier',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating rejected supplier.',
    };
  }
};

export const fetchOnboardingDetails = async (): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get('/api/v1/identity/onboarding');
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
        message: errData.message || 'Failed to fetch onboarding details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching onboarding details.',
    };
  }
};

export const fetchMetadataReferenceList = async (
  types: MetadataReferenceType[]
): Promise<MetadataReferenceItem[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post<MetadataReferenceItem[]>(
      '/api/v1/masterdata/metadata/reference-list',
      types
    );
    return response.data ?? [];
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
        message: errData.message || 'Failed to fetch metadata reference list',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching metadata reference list.',
    };
  }
};

export const getSupplierProfile = async (): Promise<SupplierProfileResponse | null | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<SupplierProfileResponse>(
      'api/v1/supplier/profile'
    );

    if (response.status === 204 || !response.data || Object.keys(response.data).length === 0) {
      return null;
    }

    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 204) {
      return null;
    }

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
        message: errData.message || 'Failed to fetch supplier profile',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching supplier profile.',
    };
  }
};

export const logoutSupplier = async (): Promise<void | ErrorResponseDto> => {
  try {
    await supplierInstance.put('/api/v1/identity/auth/logout');
  } catch (error: any) {
    if (error.response?.status === 401) {
      (window as any).handleUnauthorized?.();
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to logout',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while logging out.',
    };
  }
};

export const fetchRFQMasterData = async (payload: {
  supplierId: string;
  index: number;
  limit: number;
  status?: string;
}): Promise<RFQMasterDataItem[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post('/api/v1/supplier/rfq-master-data', payload);
    return response.data ?? [];
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
        message: errData.message || 'Failed to fetch RFQ master data',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching RFQ master data.',
    };
  }
};

export const fetchSupplierContractById = async (contractId: string): Promise<SupplierContractDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get(`/api/v1/supplier/contract/${contractId}`);
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
        message: errData.message || 'Failed to fetch the contract',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: error.message || 'Failed to fetch the contract',
      description: 'Could not reach the server. Please check your connection and try again.',
    };
  }
};

export const fetchRFQById = async (rfqId: string): Promise<RFQDetailResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get('/api/v1/supplier/rfq-by-id', {
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

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
        message: errData.message || 'Failed to fetch RFQ details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching RFQ details.',
    };
  }
};

export const fetchSupplierQuotationBySupplierId = async (
  rfqId: string
): Promise<SupplierQuotationBySupplierIdResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<SupplierQuotationBySupplierIdResponse>(
      '/api/v1/supplier/quotation/by-supplier-id',
      { params: { rfqId } }
    );
    return response.data ?? { suppliers: [] };
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
        message: errData.message || 'Failed to fetch supplier quotation',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching supplier quotation.',
    };
  }
};

export const submitSupplierQuotation = async (
  payload: SubmitQuotationPayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.put('/api/v1/supplier/quotation', payload);
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
        message: errData.message || 'Failed to submit supplier quotation',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while submitting supplier quotation.',
    };
  }
};

export const fetchSegments = async (payload?: {
  pageIndex?: number;
  pageSize?: number;
  searchTerm?: string;
}): Promise<any[] | ErrorResponseDto> => {
  try {
    const res = await supplierInstance.get(`/api/v1/masterdata/unspsc/segment`, {
      params: {
        pageIndex: payload?.pageIndex ?? 1,
        pageSize: payload?.pageSize ?? 10,
        searchTerm: payload?.searchTerm || undefined,
      },
    });
    return Array.isArray(res.data) ? res.data : [];
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
        message: errData.message || 'Failed to fetch segments',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching segments.',
    };
  }
};

export const fetchClasses = async (segment: number, family: number): Promise<any[] | ErrorResponseDto> => {
  try {
    const res = await supplierInstance.get(
      `/api/v1/masterdata/unspsc/class-commodity?segment=${segment}&family=${family}&pageIndex=1&pageSize=10`
    );
    if (Array.isArray(res.data)) {
      return res.data.filter((item) => item && item.class !== null && item.title !== '');
    }
    return [];
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
        message: errData.message || 'Failed to fetch classes',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching classes.',
    };
  }
};

export const submitRfqAnswers = async (
  payload: SubmitRfqAnswersPayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.put('/api/v1/supplier/rfq-answer', payload);
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
        message: errData.message || 'Failed to submit RFQ answers',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while submitting RFQ answers.',
    };
  }
};

export const fetchCurrencies = async (payload?: {
  index?: number;
  limit?: number;
}): Promise<CurrencyListResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<CurrencyListResponse>(
      '/api/v1/masterdata/currencies',
      {
        params: {
          index: payload?.index ?? 0,
          limit: payload?.limit ?? 10,
        },
      }
    );
    return response.data ?? { items: [], totalCount: 0, index: 0, limit: 0 };
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
        message: errData.message || 'Failed to fetch currencies',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching currencies.',
    };
  }
};

export const fetchFamilies = async (
  segment: number,
  payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
  try {
    const res = await supplierInstance.get(
      `/api/v1/masterdata/unspsc/family`,
      {
        params: {
          segment,
          pageIndex: payload?.pageIndex ?? 1,
          pageSize: payload?.pageSize ?? 100,
        },
      }
    );
    if (Array.isArray(res.data)) {
      return res.data.filter((item) => item && item.family !== null && item.title !== '');
    }
    return [];
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
        message: errData.message || 'Failed to fetch families',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching families.',
    };
  }
};

export const fetchClassifications = async (
  family: number,
  payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
  try {
    const res = await supplierInstance.get(
      `/api/v1/masterdata/unspsc/class`,
      {
        params: {
          family,
          pageIndex: payload?.pageIndex ?? 1,
          pageSize: payload?.pageSize ?? 100,
        },
      }
    );
    if (Array.isArray(res.data)) {
      return res.data.filter((item) => item && item.class !== null && item.title !== '');
    }
    return [];
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
        message: errData.message || 'Failed to fetch classifications',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching classifications.',
    };
  }
};

export const fetchCommodities = async (
  classId: number,
  payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
  try {
    const res = await supplierInstance.get(
      `/api/v1/masterdata/unspsc/commodity`,
      {
        params: {
          class: classId,
          pageIndex: payload?.pageIndex ?? 1,
          pageSize: payload?.pageSize ?? 100,
        },
      }
    );
    if (Array.isArray(res.data)) {
      return res.data.filter((item) => item && item.commodity !== null && item.title !== '');
    }
    return [];
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
        message: errData.message || 'Failed to fetch commodities',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching commodities.',
    };
  }
};

export const fetchSupplierCatalog = async (): Promise<SupplierCatalogListItem[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<any>('/api/v1/supplier/catalog');
    const resData = response.data;
    if (Array.isArray(resData)) {
      return resData;
    }
    if (resData && Array.isArray(resData.data)) {
      return resData.data;
    }
    if (resData && Array.isArray(resData.catalogs)) {
      return resData.catalogs;
    }
    if (resData && Array.isArray(resData.result)) {
      return resData.result;
    }
    return [];
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
        message: errData.message || 'Failed to fetch supplier catalog',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching supplier catalog.',
    };
  }
};

export const fetchBuyerAsset = async (
  assetId: string
): Promise<SupplierAssetDto | ErrorResponseDto> => {
  try {
    try {
      const response = await supplierInstance.get<SupplierAssetDto>(
        `/api/v1/buyer/asset/${assetId}`
      );
      if (response.data) return response.data;
    } catch {
      // fallback to supplier asset endpoint
    }
    const response = await supplierInstance.get<SupplierAssetDto>(
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
    return {
      statusCode: error.response?.status || 500,
      message: error.response?.data?.message || 'Failed to fetch asset',
      description: error.response?.data?.description || 'No details provided',
    };
  }
};

export const fetchSupplierAsset = async (
  assetId: string
): Promise<SupplierAssetDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<SupplierAssetDto>(
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

export const getPersonDetail = async (): Promise<PersonDetailDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<PersonDetailDto>(
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
    const response = await supplierInstance.put<PersonDetailDto>(
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



export interface UnitItem {
  id: string;
  key: string;
  type: string;
  description: string;
}

export interface UnitListResponse {
  items: UnitItem[];
  totalCount: number;
  index: number;
  limit: number;
}

export const fetchUnits = async (payload?: {
  index?: number;
  limit?: number;
  searchTerm?: string;
}): Promise<UnitListResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<UnitListResponse>(
      '/api/v1/masterdata/units',
      {
        params: {
          index: payload?.index ?? 0,
          limit: payload?.limit ?? 100,
          searchTerm: payload?.searchTerm || undefined,
        },
      }
    );
    return response.data ?? { items: [], totalCount: 0, index: 0, limit: 0 };
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
        message: errData.message || 'Failed to fetch units',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching units.',
    };
  }
};

export interface InvitationSummaryResponse {
  all: number;
  submitted: number;
  pending: number;
  accepted: number;
  declined: number;
}

export const fetchInvitationSummary = async (): Promise<InvitationSummaryResponse | any> => {
  const response = await supplierInstance.get(
      "/api/v1/buyer/invitation-summary"
  );

  return response.data;
};

export const fetchBuyerInvitations = async (payload: FetchSupplierInvitationsPayload): Promise<BuyerInvitationItem[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<BuyerInvitationItem[]>(
      '/api/v1/buyer/buyer-invitation',
      {
        params: {
          index: payload.index,
          limit: payload.limit,
          ...(payload.status ? { status: payload.status } : {}),
          ...(payload.search ? { search: payload.search } : {}),
        },
      }
    );
    return response.data ?? [];
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
        message: errData.message || 'Failed to fetch buyer invitations',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching buyer invitations.',
    };
  }
};

export const fetchSupplierInvitations = async (payload: FetchSupplierInvitationsPayload): Promise<BuyerInvitationItem[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<BuyerInvitationItem[]>(
      '/api/v1/buyer/supplier-invitation',
      {
        params: {
          index: payload.index,
          limit: payload.limit,
          ...(payload.status ? { status: payload.status } : {}),
          ...(payload.search ? { search: payload.search } : {}),
        },
      }
    );
    return response.data ?? [];
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
        message: errData.message || 'Failed to fetch supplier invitations',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching supplier invitations.',
    };
  }
};

export const updateSupplierInvitationStatus = async (
  payload: UpdateInvitationStatusPayload
): Promise<any | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.put('/api/v1/buyer/supplier-invitation-status', payload);
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
        message: errData.message || 'Failed to update invitation status',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating invitation status.',
    };
  }
};

export const fetchInvitationAnswers = async (
  requestId: string
): Promise<InvitationAnswersResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<InvitationAnswersResponse>(
      '/api/v1/buyer/answers',
      { params: { requestId } }
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
        message: errData.message || 'Failed to fetch invitation details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching invitation details.',
    };
  }
};

export interface VerificationAnswerPayload {
  verificationTemplateQuestionId: string;
  templateId: string;
  answer: string | null;
  verificationTemplateQuestionOptionId: string | null;
  attachment?: {
    entityType: string;
    entityId: string;
    assetType: string;
    fileBytes: string;
    fileName: string;
    contentType: string;
    isSingletonAsset: boolean;
  } | null;
}
 
export interface SubmitVerificationPayload {
  verificationRequestId: string;
  supplierId: string;
  answers: VerificationAnswerPayload[] | null;
  status: "SUBMITTED" | "DRAFT";
}
 
export const submitVerificationAnswers = async (
  payload: SubmitVerificationPayload
): Promise<boolean | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.put(
      '/api/v1/supplier/submit-verification',
      payload
    );
    return response.data === true || response.status === 200;
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
        message: errData.message || 'Failed to submit verification answers',
        description: errData.description || 'No details provided',
      };
    }
 
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while submitting verification answers.',
    };
  }
};
 
export const getSupplierProfileByOrgId = async (
  organizationId: string
): Promise<SupplierProfileResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<SupplierProfileResponse>(
      '/api/v1/supplier/profile',
      { params: { organizationId } }
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
        message: errData.message || 'Failed to fetch supplier profile',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching supplier profile.',
    };
  }
};
// Add after the fetchSupplierCatalog function

export const fetchSupplierCatalogDetail = async (
  catalogId: string
): Promise<CatalogDetailResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<any>(
      `/api/v1/supplier/catalog/${catalogId}`
    );
    const resData = response.data;
    if (Array.isArray(resData)) {
      return resData;
    }
    if (resData && Array.isArray(resData.data)) {
      return resData.data;
    }
    if (resData && typeof resData === 'object' && (resData.catalogId || resData.id)) {
      return [resData];
    }
    return [];
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
        message: errData.message || 'Failed to fetch catalog details',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching catalog details.',
    };
  }
};

export const sendOtp = async (): Promise<OtpActionResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post('/api/v1/supplier/send-otp');
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
        message: errData.message || 'Failed to send OTP',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while sending the OTP.',
    };
  }
};

export const verifyOtp = async (
  payload: VerifyOtpPayload
): Promise<OtpActionResponse | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post('/api/v1/supplier/verify-otp', payload);
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
        message: errData.message || 'Failed to verify OTP',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while verifying the OTP.',
    };
  }
};

/* ---------------------------------- RFQ Chat ---------------------------------- */

export interface SendSupplierMessagePayload {
  rfqId: string;
  supplierId: string;
  body: string;
  attachments: ChatAttachmentInputDto[];
}

export const sendSupplierMessage = async (
  payload: SendSupplierMessagePayload
): Promise<ChatMessageDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post<ChatMessageDto>('/api/v1/supplier/message', payload);
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
        message: errData.message || 'Failed to send message',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while sending the message.',
    };
  }
};

export const fetchSupplierMessageThreads = async (
  rfqId: string
): Promise<ChatThreadDto[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<ChatThreadDto[]>('/api/v1/supplier/message/threads', {
      params: { rfqId },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    // "No conversations found" for this RFQ is an expected empty state, not a
    // real failure — treat it as zero threads whether the backend reports it
    // via the HTTP status or via a status_code/statusCode field in the body
    // (this API has been seen to return the latter even on a non-404 transport status).
    const bodyStatus = error.response?.data?.status_code ?? error.response?.data?.statusCode;
    if (error.response?.status === 404 || bodyStatus === 404) {
      return [];
    }

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
        message: errData.message || 'Failed to fetch chat threads',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching chat threads.',
    };
  }
};

export const fetchSupplierMessageHistory = async (
  threadId: string,
  index = 0,
  limit = 20
): Promise<ChatMessageDto[] | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<ChatMessageDto[]>(
      `/api/v1/supplier/message/thread/${threadId}/history`,
      { params: { index, limit } }
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
        message: errData.message || 'Failed to fetch chat history',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching chat history.',
    };
  }
};

export const markSupplierThreadAsRead = async (
  threadId: string
): Promise<MarkThreadReadResponseDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.post<MarkThreadReadResponseDto>(
      `/api/v1/supplier/message/thread/${threadId}/read`
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
        message: errData.message || 'Failed to mark conversation as read',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while marking the conversation as read.',
    };
  }
};

export const downloadSupplierMessageAttachment = async (
  attachmentId: string
): Promise<ChatAttachmentDownloadDto | ErrorResponseDto> => {
  try {
    const response = await supplierInstance.get<ChatAttachmentDownloadDto>(
      `/api/v1/supplier/message/attachment/${attachmentId}`
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
        message: errData.message || 'Failed to download attachment',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while downloading the attachment.',
    };
  }
};

/**
 * Builds the ChatPanel API adapter for the supplier side of a given RFQ — see ChatApiAdapter in @vosox/shared-ui.
 * Normalizes this API's ErrorResponseDto-return style into thrown Errors (same fallback text as before) so
 * ChatPanel only ever deals with resolve-or-throw promises, matching the buyer adapter's contract.
 */
export const createSupplierChatApi = (rfqId: string, supplierId: string): ChatApiAdapter => ({
  fetchThreads: async () => {
    const result = await fetchSupplierMessageThreads(rfqId);
    if (isErrorResponse(result)) {
      throw new Error(result.description || result.message || 'Failed to load conversation.');
    }
    return result;
  },
  fetchHistory: async (threadId, index, limit) => {
    const result = await fetchSupplierMessageHistory(threadId, index, limit);
    if (isErrorResponse(result)) {
      throw new Error(result.description || result.message || 'Failed to load conversation history.');
    }
    return result;
  },
  markThreadRead: async (threadId) => {
    const result = await markSupplierThreadAsRead(threadId);
    if (isErrorResponse(result)) {
      throw new Error(result.description || result.message || 'Failed to mark conversation as read.');
    }
  },
  sendMessage: async (_target, body, attachments) => {
    const result = await sendSupplierMessage({ rfqId, supplierId, body, attachments });
    if (isErrorResponse(result)) {
      throw new Error(result.description || result.message || 'Failed to send message.');
    }
    return result;
  },
  downloadAttachment: async (attachmentId) => {
    const result = await downloadSupplierMessageAttachment(attachmentId);
    if (isErrorResponse(result)) {
      throw new Error(result.description || result.message || 'Failed to download attachment.');
    }
    return result;
  },
});

/** Aggregated bidding figures for the supplier dashboard (GET /api/v1/supplier/dashboard-analytics). */
export const fetchSupplierDashboardAnalytics = async (): Promise<SupplierDashboardAnalytics> => {
  // Users only ever see a neutral message; the technical reason goes to the console.
  const unavailable = (detail: string, cause?: unknown): Error => {
    console.warn(`[dashboard-analytics] /api/v1/supplier/dashboard-analytics: ${detail}`, cause ?? '');
    return new Error('Dashboard figures are temporarily unavailable.');
  };

  let response;
  try {
    response = await supplierInstance.get<SupplierDashboardAnalytics>('/api/v1/supplier/dashboard-analytics');
  } catch (error: any) {
    if (error?.response?.status === 401) {
      (window as any).handleUnauthorized?.();
    }
    if (!error?.response) throw unavailable('server unreachable', error);
    if (error.response.status === 404) {
      throw unavailable('endpoint not found (404) - deploy the latest Supplier API', error.response.data);
    }
    throw unavailable(`request failed (${error.response.status})`, error.response.data);
  }

  // An older server returns a different response shape; treat it as unavailable rather than crash.
  if (!Array.isArray(response.data?.quotationsByBuyer)) {
    throw unavailable('unexpected response shape - deploy the latest Supplier API', response.data);
  }
  return response.data;
};

export const uploadSupplierTermsAndCondition = async (payload: {
  rfqId: string;
  termsAndCondition: boolean;
  documents?: any[];
  assetUpload?: any;
} | any) => {
  try {
    const rfqId = typeof payload === 'object' && payload.rfqId ? payload.rfqId : payload;
    const termsAndCondition = typeof payload === 'object' && payload.termsAndCondition !== undefined ? payload.termsAndCondition : true;
    // rfqId/termsAndCondition are already in the query string above; the body is only for the document, when
    // there is one (the "Yes, upload supplier terms" path) - the "No" (Proceed with Buyer T&C) path sends no
    // body at all, not an empty object.
    const assetData = (payload && typeof payload === 'object')
      ? (payload.assetUpload || (Array.isArray(payload.documents) ? payload.documents[0] : payload.documents) || undefined)
      : undefined;

    const url = `/api/v1/supplier/supplier-terms-condition?rfqId=${encodeURIComponent(rfqId)}&termsAndCondition=${Boolean(termsAndCondition)}`;
    let response;
    try {
      response = await supplierInstance.post(url, assetData);
    } catch (err: any) {
      if (err.response?.status === 404) {
        const altUrl = `/api/v1/supplier/supplier-terms-conditions?rfqId=${encodeURIComponent(rfqId)}&termsAndCondition=${Boolean(termsAndCondition)}`;
        response = await supplierInstance.post(altUrl, assetData);
      } else {
        throw err;
      }
    }
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
      return error.response.data;
    }
    return {
      statusCode: 500,
      message: error.message || 'Failed to upload supplier terms & conditions',
    };
  }
};

export const uploadSupplierEsign = async (
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
) => {
  try {
    const url = `/api/v1/supplier/supplier-esign?rfqId=${encodeURIComponent(rfqId)}`;
    const response = await supplierInstance.post(url, payload);
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
      return error.response.data;
    }
    return {
      statusCode: 500,
      message: error.message || 'Failed to upload supplier e-signature',
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

export interface RfqTermsConditionStatusDto {
  termsAndCondition: boolean;
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachmentDto[];
}


/**
 * Supplier's acceptance/rejection status of the buyer's terms & conditions.
 */
export const updateBuyerTermsConditionStatus = async (rfqId: string, status: string) => {
  try {
    const url = `/api/v1/supplier/buyer-terms-condition-status?rfqId=${encodeURIComponent(rfqId)}&status=${encodeURIComponent(status)}`;
    const response = await supplierInstance.put(url);
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
      return error.response.data;
    }
    return {
      statusCode: 500,
      message: error.message || 'Failed to update buyer terms & conditions status.',
    };
  }
};


