import platformInstance from './platformInstance';
import type {
  OrganizationUserDto,
  CreatePersonRequestDto,
  CountriesResponseDto,
} from '../dto/networkAdminDto';
import type { User } from '../types';
import type {
  NetworkAdminProfileResponse,
  NetworkAdminOnboardingResponse,
  NetworkAdminBuyerRegistrationPayload,
  NetworkAdminUpdateRejectedBuyerPayload,
  NetworkAdminSupplierRegistrationPayload,
  NetworkAdminUpdateRejectedSupplierPayload,
} from '../dto/networkAdminDto';
import type { ErrorResponseDto } from "@vosox/shared-ui";

export type NetworkAdminRole = 'BUYER_NETWORK_ADMIN' | 'SUPPLIER_NETWORK_ADMIN';

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
export interface CreateDeliveryLocationDto {
  locationName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  contactPerson: string;
  contactPhone: string;
  isDefault: boolean;
}

export interface UpdateDeliveryLocationDto extends CreateDeliveryLocationDto {
  buyerId: string;
}

export interface DeliveryLocationResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}
export interface CreateBankAccountDto {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode?: string;
  currency: string;
  isPrimary: boolean;
}
export interface CreateSupplierBankAccountDto {
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode?: string;
  iban?: string;
  currency: string;
  isPrimary: boolean;
}

export interface CreateSupplierDeliveryLocationDto {
  locationName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  contactPerson: string;
  contactEmail?: string;
  contactPhone: string;
  isDefault: boolean;
}

export interface UpdateSupplierBankAccountDto {
  supplierId: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode?: string;
  iban?: string;
  currency: string;
  isPrimary: boolean;
  isVerified: boolean;
}

export interface SupplierQuotationItem {
  supplierQuotationItemId: string;
  supplierRFQItemId: string;
  oldVersion: string;
  oldQuotedPrice: number;
  latestVersion: string;
  latestQuotedPrice: number;
  priceDifference: number;
  priceChanged: boolean;
}

export interface SupplierQuotationComparisonResponse {
  supplierQuotationId: string;
  oldVersion: string;
  latestVersion: string;
  oldTotalPrice: number;
  latestTotalPrice: number;
  totalPriceDifference: number;
  oldDiscount: number;
  latestDiscount: number;
  discountDifference: number;
  oldDiscountType: string;
  latestDiscountType: string;
  oldTax: number;
  latestTax: number;
  taxDifference: number;
  oldTaxType: string;
  latestTaxType: string;
  oldDeliveryCharge: number;
  latestDeliveryCharge: number;
  deliveryChargeDifference: number;
  oldDeliveryType: string;
  latestDeliveryType: string;
  items: SupplierQuotationItem[];
}
export interface UpdateSupplierDeliveryLocationDto {
  supplierId: string;
  locationName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  contactPerson: string;
  contactEmail?: string;
  contactPhone: string;
  isDefault: boolean;
}
export interface UpdateBankAccountDto extends CreateBankAccountDto {
  buyerId: string;
  isVerified: boolean;
}

export interface BankAccountResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

export const getOrganizationUsers = async (organizationId: string): Promise<User[]> => {
  try {
    const response = await platformInstance.get<OrganizationUserDto[]>(
      '/api/v1/identity/organization-users',
      {
        params: { organizationId },
      }
    );

    const users = response.data || [];

    return users.map((dto) => ({
      id: dto.userId,
      personId: dto.personId,
      email: dto.email,
      name: dto.name,
      userName: dto.userName,
      userRole: dto.roleName as any,
      roleId: dto.roleId,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active' as const,
      organizationId,
    }));
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to fetch users';
    throw new Error(errorMsg);
  }
};

// Used for selecting which organization users an RFQ should be sent to (e.g. supplier
// user selection during Create RFQ). Distinct endpoint from getOrganizationUsers above,
// which is used for general organization user management and must not be repointed here.
export const getOrganizationUsersForRfq = async (organizationId: string): Promise<User[]> => {
  try {
    const response = await platformInstance.get<OrganizationUserDto[]>(
      '/api/v1/identity/organization-user-rfq',
      {
        params: { organizationId },
      }
    );

    const users = response.data || [];

    return users.map((dto) => ({
      id: dto.userId,
      personId: dto.personId,
      email: dto.email,
      name: dto.name,
      userName: dto.userName,
      userRole: dto.roleName as any,
      roleId: dto.roleId,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active' as const,
      organizationId,
    }));
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to fetch users';
    throw new Error(errorMsg);
  }
};


export const getCountries = async (
  index: number = 0,
  limit: number = 50,
  searchTerm?: string
): Promise<CountriesResponseDto> => {
  try {
    const response = await platformInstance.get<CountriesResponseDto>(
      '/api/v1/masterdata/countries',
      {
        params: {
          index,
          limit,
          searchTerm: searchTerm || undefined,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to fetch countries';
    throw new Error(errorMsg);
  }
};


export const createPerson = async (data: CreatePersonRequestDto): Promise<string> => {
  try {
    const response = await platformInstance.post<string>('/api/v1/identity/person', data);
    return response.data;
  } catch (error: any) {
    const responseData = error.response?.data;
    const errorMsg =
      (typeof responseData === 'string' && responseData.trim() ? responseData : null) ||
      responseData?.message ||
      responseData?.description ||
      'Failed to create person';
    throw new Error(errorMsg);
  }
};
export const deleteUser = async (personId: string): Promise<void> => {
  try {
    await platformInstance.delete('/api/v1/identity/delete-person', {
      params: {
        personId,
      },
    });
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to delete user';
    throw new Error(errorMsg);
  }
};


export const logoutNetworkAdmin = async (): Promise<void> => {
  try {
    await platformInstance.put('/api/v1/identity/auth/logout');
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;
    const errMsg = responseData?.message || responseData?.description || 'Failed to logout.';
    throw new Error(`${errMsg} (${status})`);
  }
};


export const getNetworkAdminProfile = async (
  role: NetworkAdminRole
): Promise<NetworkAdminProfileResponse | null> => {
  const endpoint = role === 'BUYER_NETWORK_ADMIN' ? '/api/v1/buyer/profile' : '/api/v1/supplier/profile';

  try {
    const response = await platformInstance.get<NetworkAdminProfileResponse>(endpoint);

    if (response.status === 204 || !response.data || Object.keys(response.data).length === 0) {
      return null;
    }

    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 204 || error?.response?.status === 404) {
      return null;
    }
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to fetch profile';
    throw new Error(errorMsg);
  }
};

export const getNetworkAdminOnboardingDetails = async (): Promise<NetworkAdminOnboardingResponse> => {
  try {
    const response = await platformInstance.get<NetworkAdminOnboardingResponse>('/api/v1/identity/onboarding');
    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to fetch onboarding details';
    throw new Error(errorMsg);
  }
};

export const createNetworkAdminBuyerProfile = async (
  payload: NetworkAdminBuyerRegistrationPayload
): Promise<any> => {
  try {
    const response = await platformInstance.post('/api/v1/buyer/register', payload);
    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to create buyer profile';
    throw new Error(errorMsg);
  }
};

export const createNetworkAdminSupplierProfile = async (
  payload: NetworkAdminSupplierRegistrationPayload
): Promise<any> => {
  try {
    const response = await platformInstance.post('/api/v1/supplier/register', payload);
    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to create supplier profile';
    throw new Error(errorMsg);
  }
};

export const updateRejectedNetworkAdminBuyer = async (
  payload: NetworkAdminUpdateRejectedBuyerPayload
): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/buyer/update-rejected-buyer', payload);
    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to update rejected buyer profile';
    throw new Error(errorMsg);
  }
};

export const updateRejectedNetworkAdminSupplier = async (
  payload: NetworkAdminUpdateRejectedSupplierPayload
): Promise<any> => {
  try {
    const response = await platformInstance.put('/api/v1/supplier/update-rejected-supplier', payload);
    return response.data;
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.description ||
      error.message ||
      'Failed to update rejected supplier profile';
    throw new Error(errorMsg);
  }
};


export const getPersonDetail = async (): Promise<PersonDetailDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.get<PersonDetailDto>(
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
    const response = await platformInstance.put<PersonDetailDto>(
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


export const createDeliveryLocation = async (
  payload: CreateDeliveryLocationDto
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.post<DeliveryLocationResponseDto>(
      '/api/v1/buyer/delivery-location',
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
        message: errData.message || 'Failed to create delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating delivery location.',
    };
  }
};

export const updateDeliveryLocation = async (
  id: string,
  payload: UpdateDeliveryLocationDto
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.put<DeliveryLocationResponseDto>(
      `/api/v1/buyer/delivery-location/${id}`,
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
        message: errData.message || 'Failed to update delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating delivery location.',
    };
  }
};

export const deleteDeliveryLocation = async (
  id: string
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.delete<DeliveryLocationResponseDto>(
      `/api/v1/buyer/delivery-location/${id}`
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
        message: errData.message || 'Failed to delete delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while deleting delivery location.',
    };
  }
};

export const createBankAccount = async (
  payload: CreateBankAccountDto
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.post<BankAccountResponseDto>(
      '/api/v1/buyer/bank-account',
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
        message: errData.message || 'Failed to create bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating bank account.',
    };
  }
};

export const updateBankAccount = async (
  id: string,
  payload: UpdateBankAccountDto
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.put<BankAccountResponseDto>(
      `/api/v1/buyer/bank-account/${id}`,
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
        message: errData.message || 'Failed to update bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating bank account.',
    };
  }
};

export const deleteBankAccount = async (
  id: string
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.delete<BankAccountResponseDto>(
      `/api/v1/buyer/bank-account/${id}`
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
        message: errData.message || 'Failed to delete bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while deleting bank account.',
    };
  }
};

export const createSupplierBankAccount = async (
  payload: CreateSupplierBankAccountDto
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.post<BankAccountResponseDto>(
      '/api/v1/supplier/bank-account',
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
        message: errData.message || 'Failed to create bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating bank account.',
    };
  }
};

export const createSupplierDeliveryLocation = async (
  payload: CreateSupplierDeliveryLocationDto
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.post<DeliveryLocationResponseDto>(
      '/api/v1/supplier/dispatch-location',
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
        message: errData.message || 'Failed to create delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while creating delivery location.',
    };
  }
};

export const updateSupplierBankAccount = async (
  id: string,
  payload: UpdateSupplierBankAccountDto
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.put<BankAccountResponseDto>(
      `/api/v1/supplier/bank-account/${id}`,
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
        message: errData.message || 'Failed to update bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating bank account.',
    };
  }
};

export const updateSupplierDeliveryLocation = async (
  id: string,
  payload: UpdateSupplierDeliveryLocationDto
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.put<DeliveryLocationResponseDto>(
      `/api/v1/supplier/dispatch-location/${id}`,
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
        message: errData.message || 'Failed to update delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating delivery location.',
    };
  }
};

// ============================================
// SUPPLIER DELETE API FUNCTIONS
// ============================================

export const deleteSupplierBankAccount = async (
  id: string
): Promise<BankAccountResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.delete<BankAccountResponseDto>(
      `/api/v1/supplier/bank-account/${id}`
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
        message: errData.message || 'Failed to delete bank account',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while deleting bank account.',
    };
  }
};

export const deleteSupplierDeliveryLocation = async (
  id: string
): Promise<DeliveryLocationResponseDto | ErrorResponseDto> => {
  try {
    const response = await platformInstance.delete<DeliveryLocationResponseDto>(
      `/api/v1/supplier/dispatch-location/${id}`
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
        message: errData.message || 'Failed to delete delivery location',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while deleting delivery location.',
    };
  }
};

export const fetchSupplierQuotationComparison = async (
  supplierQuotationId: string
): Promise<SupplierQuotationComparisonResponse | ErrorResponseDto> => {
  try {
    const response = await platformInstance.get<SupplierQuotationComparisonResponse>(
      `/api/v1/supplier/quotation/history-comparison/${supplierQuotationId}`
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
        message: errData.message || 'Failed to fetch quotation comparison',
        description: errData.description || 'No details provided',
      };
    }

    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching quotation comparison.',
    };
  }
};
