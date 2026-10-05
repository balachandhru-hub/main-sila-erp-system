import platformInstance from './platformInstance';

// ─── DTOs ───
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
}

export interface ItemMasterSimilarityDto {
  id: string;
  materialCode: string;
  description: string;
}

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

// ─── Get Master Approval Flows ───
export const getMasterApprovalFlows = async (
  buyerId: string,
  index: number = 0,
  limit: number = 10
): Promise<MasterApprovalFlowDto[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/master-approval-flow', {
      params: { buyerId, index, limit },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to fetch approval flows.';
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

// ─── Check Item Master Similarity ───
export const checkItemMasterSimilarity = async (
  buyerId: string,
  description: string,
  materialGroup: string
): Promise<ItemMasterSimilarityDto[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/item-master/check-similarity', {
      params: { buyerId, description, materialGroup },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to check item master similarity.';
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

// ─── Get Item Master by Buyer ───
export const getItemMastersByBuyer = async (
  buyerId: string,
  { index = 0, limit = 50, searchTerm = '' }: { index?: number; limit?: number; searchTerm?: string } = {}
): Promise<ItemMasterDto[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/item-master', {
      params: { buyerId, index, limit, searchTerm },
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to fetch item masters.';
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

// ─── Create Item Master ───
export const createItemMaster = async (
  payload: CreateItemMasterRequestDto
): Promise<ItemMasterDto> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/item-master', payload);
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

// ─── Update Item Master ───
export const updateItemMaster = async (
  itemMasterId: string,
  payload: CreateItemMasterRequestDto
): Promise<ItemMasterDto> => {
  try {
    const response = await platformInstance.put(`/api/v1/buyer/item-master/${itemMasterId}`, payload);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to update item master.';
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

// ─── Delete Item Master ───
export const deleteItemMaster = async (itemMasterId: string): Promise<any> => {
  try {
    const response = await platformInstance.delete(`/api/v1/buyer/item-master/${itemMasterId}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to delete item master.';
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

// ─── Upload Item Master File (JSON body, base64 document - current backend contract) ───
export const uploadItemMasterFile = async (
  payload: UploadItemMasterFilePayload
): Promise<ItemMasterUploadResultDto> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/item-master/upload', payload);
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

// ─── Upload Item Master Excel (legacy multipart contract - kept for ItemMaster.tsx) ───
export const uploadItemMasterExcel = async (
  buyerId: string,
  file: File
): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await platformInstance.post(
      `/api/v1/buyer/item-master/upload?buyerId=${buyerId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to upload file.';
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