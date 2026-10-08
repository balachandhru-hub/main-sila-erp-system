import platformInstance from '../../api/platformInstance';

/** MANUAL = single material approval, EXCEL = bulk (Excel upload) material approval. */
export type MaterialUploadType = 'MANUAL' | 'EXCEL';

export interface MaterialBulkAsset {
  id: string;
  assetType: string;
  assetName: string;
  fileType: string | null;
  fileName: string;
}

export interface PendingMaterialApproval {
  uploadType?: MaterialUploadType;
  predefinedMaterialId: string;
  approvalId: string;
  approvalFlowPredefinedMaterialId: string;
  approvalMappingId: string;
  order: number;
  approvalStatus: string;
  status: string;
  // MANUAL (single) records
  materialCode?: string;
  productType?: string;
  description?: string;
  materialGroup?: string;
  // EXCEL (bulk) records
  title?: string;
  asset?: MaterialBulkAsset;
}

export interface MaterialApprovalUserStatus {
  userId: string;
  userName: string;
  email: string;
  order: number;
  status: string;
}

export interface MaterialApprovalDetail {
  id: string;
  buyerId: string;
  baseUnitOfMeasure: string;
  orderUnitOfMeasure: string;
  alternateUnitOfMeasure: string;
  valuationClass: string;
  unitOfMeasureMapping: string;
  subUnit: string;
  microUnit: string;
  status: string;
  // EXCEL (bulk) approvals carry a title and the uploaded file instead of material fields.
  title?: string;
  asset?: MaterialBulkAsset;
  approvalUsers: MaterialApprovalUserStatus[];
}

export interface MaterialApprovalKpi {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export const MATERIAL_APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export const MATERIAL_STATUS_FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: MATERIAL_APPROVAL_STATUS.PENDING },
  { label: 'Approved', value: MATERIAL_APPROVAL_STATUS.APPROVE },
  { label: 'Rejected', value: MATERIAL_APPROVAL_STATUS.REJECT },
];

export interface MaterialApprovalActionPayload {
  status: string;
  comment: string;
}

export interface MaterialApprovalActionResponse {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

const toError = (error: any, fallback: string): Error => {
  const data = error?.response?.data;
  if (data) {
    return new Error(data.message || data.description || `${fallback} (${error.response.status}).`);
  }
  return new Error('Could not reach the server. Please check your connection and try again.');
};

export type StatusTone = 'approved' | 'rejected' | 'pending' | 'neutral';

export const classifyStatusText = (status: string | null | undefined): StatusTone => {
  const s = (status || '').toLowerCase();
  if (s.includes('reject')) return 'rejected';
  if (s.includes('approv') || s.includes('complete')) return 'approved';
  if (s.includes('pend') || s.includes('open')) return 'pending';
  return 'neutral';
};

/** Readable labels for the status codes the API returns (APPROVE, REJECT, COMPLETE, ...). */
const STATUS_LABELS: Record<string, string> = {
  APPROVE: 'Approved',
  APPROVED: 'Approved',
  REJECT: 'Rejected',
  REJECTED: 'Rejected',
  PENDING: 'Pending',
  OPEN: 'Open',
  COMPLETE: 'Completed',
  COMPLETED: 'Completed',
};

export const formatMaterialStatus = (status: string | null | undefined): string => {
  const raw = (status || '').trim();
  if (!raw) return '—';
  const known = STATUS_LABELS[raw.toUpperCase()];
  if (known) return known;
  const words = raw.replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const fetchPendingMaterialApprovals = async (
  params: { type?: MaterialUploadType; status?: string; searchTerm?: string; index?: number; limit?: number } = {}
): Promise<PendingMaterialApproval[]> => {
  try {
    const response = await platformInstance.get<PendingMaterialApproval[]>('/api/v1/buyer/item-master/pending-approvals', {
      params: {
        type: params.type ?? 'MANUAL',
        status: params.status || undefined,
        searchTerm: params.searchTerm?.trim() || undefined,
        index: params.index,
        limit: params.limit,
      },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    throw toError(error, 'Failed to load material approvals');
  }
};

export const fetchMaterialApprovalKpi = async (): Promise<MaterialApprovalKpi> => {
  try {
    const response = await platformInstance.get<MaterialApprovalKpi>('/api/v1/buyer/item-master/approval-kpi');
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to load approval summary counts');
  }
};

export const fetchMaterialApprovalDetail = async (predefinedMaterialId: string): Promise<MaterialApprovalDetail> => {
  try {
    const response = await platformInstance.get<MaterialApprovalDetail>(
      `/api/v1/buyer/item-master/approval/${predefinedMaterialId}`
    );
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to load material approval details');
  }
};

export const submitMaterialApprovalAction = async (
  predefinedMaterialId: string,
  payload: MaterialApprovalActionPayload
): Promise<MaterialApprovalActionResponse> => {
  try {
    const response = await platformInstance.put<MaterialApprovalActionResponse>(
      `/api/v1/buyer/item-master/approval/${predefinedMaterialId}`,
      payload
    );
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to submit your decision');
  }
};
