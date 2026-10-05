import platformInstance from './platformInstance';

// ─── DTOs ───
export interface DeleteResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}
export interface OrganizationUser {
  personId: string;
  userId: string;
  name: string;
  email: string;
  userName: string;
  roleId: string;
  roleName: string;
}
// ─── DTOs ───
export interface CreateBusinessUserDto {
  name: string;
  email: string;
  phone: string;
  country: string;
  addressLine: string;
  userName: string;
  password: string;
  roleId?: string;
}
 
export interface CreateBusinessUserResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id?: string;              // ✅ ADD THIS
  data?: { id?: string };   // ✅ keep this too
}

// ─── Delete Department ───
export const deleteDepartment = async (departmentId: string): Promise<DeleteResponseDto> => {
  try {
    const response = await platformInstance.delete(`/api/v1/buyer/department/${departmentId}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to delete department.';
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

// ─── Delete Cost Center ───
export const deleteCostCenter = async (costCenterId: string): Promise<DeleteResponseDto> => {
  try {
    const response = await platformInstance.delete(`/api/v1/buyer/costcenter/${costCenterId}`);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to delete cost center.';
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

// ─── Update Department ───
export const updateDepartment = async (
  departmentId: string,
  departmentName: string
): Promise<DeleteResponseDto> => {
  try {
    const response = await platformInstance.put(`/api/v1/buyer/department/${departmentId}`, {
      department: departmentName,
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to update department.';
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

// ─── Update Cost Center ───
export const updateCostCenter = async (
  costCenterId: string,
  costCenterName: string
): Promise<DeleteResponseDto> => {
  try {
    const response = await platformInstance.put(`/api/v1/buyer/costcenter/${costCenterId}`, {
      costCenter: costCenterName,
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to update cost center.';
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

export const createBusinessUser = async (
  userData: CreateBusinessUserDto
): Promise<CreateBusinessUserResponseDto> => {
  try {
    const roleId = userData.roleId || '5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73';

    const response = await platformInstance.post('/api/v1/identity/person', {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      country: userData.country,
      addressLine: userData.addressLine,
      userName: userData.userName,
      password: userData.password,
      roleId: roleId,
    });

    const rawData = response.data;
    const userId = typeof rawData === 'string' ? rawData : rawData?.id;

    return {
      statusCode: response.status,
      message: 'Success',
      description: 'Person created successfully',
      id: userId,
      data: { id: userId },
    };

  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to create business user.';
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


export const getOrganizationUsers = async (organizationId: string): Promise<OrganizationUser[]> => {
  try {
    const response = await platformInstance.get('/api/v1/identity/organization-users', {
      params: { organizationId }
    });
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 'unknown';
    const responseData = error.response?.data;

    let errMsg = 'Failed to fetch organization users.';
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