import platformInstance from '../../api/platformInstance';
import type { OrganizationUserDto } from '../../dto/networkAdminDto';

export interface MasterApprovalFlow {
  id: string;
  approvalCode: string;
  approvalName: string;
  buyerId: string;
  type?: string;
  totalAmount?: number;
  currency?: string;
  order?: number;
  orderNumber?: number;
  /** ALL | PROPERTY | OUTLET | STORE | COMPANY_CODE (SILA ME approval types); empty means ALL. */
  scopeKind?: string | null;
  scopeId?: string | null;
  scopeCode?: string | null;
  /** Name of the scoped property or location, or the company code. */
  scopeName?: string | null;
}

export interface CreateMasterApprovalFlowPayload {
  approvalCode: string;
  approvalName: string;
  type: string;
  totalAmount: number;
  currency: string;
  scopeKind?: string | null;
  scopeId?: string | null;
  scopeCode?: string | null;
  users: { userId: string; order: number }[];
}

/** Approval types resolved per scope by SILA ME (most specific flow wins: store/outlet, property, company code, all). */
export const SCOPED_APPROVAL_TYPES = ['RECIPE', 'MATERIAL_PRICE'];

export const APPROVAL_SCOPE_KINDS = ['ALL', 'PROPERTY', 'OUTLET', 'STORE', 'COMPANY_CODE'] as const;

export interface ScopeOption {
  value: string;
  label: string;
}

/** Properties (PROPERTY), SILA outlet / store locations (OUTLET / STORE) or company codes of the properties (COMPANY_CODE). */
export const fetchScopeOptions = async (scopeKind: string): Promise<ScopeOption[]> => {
  try {
    if (scopeKind === 'OUTLET' || scopeKind === 'STORE') {
      const response = await platformInstance.get('/api/v1/buyer/sila/locations', { params: { type: scopeKind } });
      const rows: { id: string; locationCode: string; locationName: string }[] = Array.isArray(response.data) ? response.data : [];
      return rows.map((row) => ({ value: row.id, label: `${row.locationCode} - ${row.locationName}` }));
    }
    const response = await platformInstance.get('/api/v1/buyer/properties');
    const properties: { id: string; propertyName: string; companyCode: string }[] = Array.isArray(response.data) ? response.data : [];
    if (scopeKind === 'COMPANY_CODE') {
      const codes = Array.from(new Set(properties.map((row) => (row.companyCode || '').trim().toUpperCase()).filter(Boolean)));
      return codes.map((code) => ({ value: code, label: code }));
    }
    return properties.map((row) => ({ value: row.id, label: `${row.propertyName} (${row.companyCode})` }));
  } catch (error: any) {
    throw toError(error, 'Failed to fetch the scope options');
  }
};

export interface ApprovalTypeOption {
  id: string;
  key: string;
  type: string;
  description: string;
}

export interface CurrencyOption {
  id: string;
  currencyName: string;
  sortNumber: number;
}

const toError = (error: any, fallback: string): Error => {
  const data = error?.response?.data;
  if (data) {
    return new Error(data.message || data.description || `${fallback} (${error.response.status}).`);
  }
  return new Error('Could not reach the server. Please check your connection and try again.');
};

export const fetchMasterApprovalFlows = async (params: {
  buyerId: string;
  index: number;
  limit: number;
}): Promise<MasterApprovalFlow[]> => {
  try {
    const response = await platformInstance.get('/api/v1/buyer/master-approval-flow', { params });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return data && typeof data === 'object' && data.id ? [data] : [];
  } catch (error: any) {
    throw toError(error, 'Failed to fetch approval flows');
  }
};

export interface ApprovalFlowUser {
  id?: string;
  userId: string;
  order: number;
  name?: string;
  email?: string;
}

// Returns the approvers of an approval flow, sorted by approval order.
// The API may return plain IDs or { userId, order } objects.
export const fetchApprovalFlowUsers = async (approvalId: string): Promise<ApprovalFlowUser[]> => {
  try {
    const response = await platformInstance.get(`/api/v1/buyer/master-approval-flow/${approvalId}`);
    const data: unknown[] = Array.isArray(response.data) ? response.data : [];
    return data
      .map((item: any, index): ApprovalFlowUser =>
        typeof item === 'string'
          ? { userId: item, order: index + 1 }
          : {
              id: typeof item?.id === 'string' ? item.id : undefined,
              userId: item?.userId,
              order: typeof item?.order === 'number' ? item.order : index + 1,
              name: item?.name,
              email: item?.email,
            }
      )
      .filter((item) => typeof item.userId === 'string' && !!item.userId)
      .sort((a, b) => a.order - b.order);
  } catch (error: any) {
    throw toError(error, 'Failed to fetch approval flow users');
  }
};

export interface UpdateApprovalFlowPayload {
  approvalCode: string;
  approvalName: string;
  order: number;
}

export const updateApprovalFlow = async (
  approvalFlowUserMappingId: string,
  payload: UpdateApprovalFlowPayload
): Promise<void> => {
  try {
    await platformInstance.put(`/api/v1/buyer/approval-flow-user-mapping/${approvalFlowUserMappingId}`, payload);
  } catch (error: any) {
    throw toError(error, 'Failed to update approval flow');
  }
};

export const createMasterApprovalFlow =async (payload: CreateMasterApprovalFlowPayload): Promise<void> => {
  try {
    await platformInstance.post('/api/v1/buyer/master-approval-flow', payload);
  } catch (error: any) {
    throw toError(error, 'Failed to create approval flow');
  }
};

export const fetchApprovalTypes = async (): Promise<ApprovalTypeOption[]> => {
  try {
    const response = await platformInstance.post('/api/v1/masterdata/metadata/reference-list', ['APPROVAL_TYPE']);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    throw toError(error, 'Failed to fetch approval types');
  }
};

export const fetchCurrencies = async (index: number = 0, limit: number = 100): Promise<CurrencyOption[]> => {
  try {
    const response = await platformInstance.get('/api/v1/masterdata/currencies', {
      params: { index, limit },
    });
    const items: CurrencyOption[] = Array.isArray(response.data?.items) ? response.data.items : [];
    return [...items].sort((a, b) => a.sortNumber - b.sortNumber);
  } catch (error: any) {
    throw toError(error, 'Failed to fetch currencies');
  }
};

export const fetchApprovalUsers = async (organizationId: string): Promise<OrganizationUserDto[]> => {
  try {
    const response = await platformInstance.get<OrganizationUserDto[]>('/api/v1/identity/organization-user-rfq', {
      params: { organizationId },
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    throw toError(error, 'Failed to fetch users');
  }
};
