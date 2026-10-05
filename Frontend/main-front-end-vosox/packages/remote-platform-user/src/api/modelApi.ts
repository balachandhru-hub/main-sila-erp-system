import platformInstance from './platformInstance';
import type { ErrorResponseDto } from '@vosox/shared-ui';

export interface ModelDto {
  id: string;
  key: string;
  modelName: string;
}

export const getAllModels = async (): Promise<ModelDto[] | ErrorResponseDto> => {
  try {
    const response = await platformInstance.get<ModelDto[]>('/api/v1/identity/model');
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
        message: errData.message || 'Failed to fetch models',
        description: errData.description || 'No details provided',
      };
    }
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching models.',
    };
  }
};


export const updateOrganizationModels = async (payload: {
  organizationId: string;
  modelIds: string[];
}): Promise<boolean | ErrorResponseDto> => {
  try {
    const response = await platformInstance.put<boolean>('/api/v1/identity/organization-model', payload);
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
        message: errData.message || 'Failed to update organization models',
        description: errData.description || 'No details provided',
      };
    }
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while updating organization models.',
    };
  }
};