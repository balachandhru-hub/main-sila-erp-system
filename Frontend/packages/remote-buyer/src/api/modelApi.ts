import axiosInstance from './axiosInstance';
import type { ErrorResponseDto } from '@vosox/shared-ui';

export interface ModelDto {
  id: string;
  key: string;
  modelName: string;
}

export const getMyOrganizationModels = async (): Promise<ModelDto[] | ErrorResponseDto> => {
  try {
    const response = await axiosInstance.get<ModelDto[]>('/api/v1/identity/organization-model');
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
        message: errData.message || 'Failed to fetch model access',
        description: errData.description || 'No details provided',
      };
    }
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching model access.',
    };
  }
};