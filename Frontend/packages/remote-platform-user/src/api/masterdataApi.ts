import platformInstance from './platformInstance';
import type { ErrorResponseDto } from '../dto/platformDto';

export interface SelectedProduct {
  segment: number;
  family: number;
  title: string;
}

export interface SelectedSubProduct {
  class: number;
  commodity: number;
  title: string;
  parentSegment?: number;
  parentFamily?: number;
  parentTitle?: string;
}

// ============================================================================
// API: Fetch Segments
// ============================================================================
export async function fetchSegments(): Promise<any[] | ErrorResponseDto> {
  try {
    const res = await platformInstance.get(`/api/v1/masterdata/unspsc?pageIndex=1&pageSize=10`);
    return Array.isArray(res.data) ? res.data : [];
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
        message: errData.message || 'Failed to fetch segments',
        description: errData.description || 'No details provided',
      };
    }

    return {
      status_code: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching segments.',
    };
  }
}

// ============================================================================
// API: Fetch Classes
// ============================================================================
export async function fetchClasses(segment: number, family: number): Promise<any[] | ErrorResponseDto> {
  try {
    const res = await platformInstance.get(
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
        status_code: 401,
        message: 'Unauthorized',
        description: 'You are not authorized to access this resource. Please login again.',
      };
    }

    if (error.response && error.response.data) {
      const errData = error.response.data;
      return {
        status_code: errData.status_code || errData.statusCode || error.response.status || 500,
        message: errData.message || 'Failed to fetch classes',
        description: errData.description || 'No details provided',
      };
    }

    return {
      status_code: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching classes.',
    };
  }
}

// ============================================================================
// API: Fetch Reference List
// ============================================================================
export async function fetchReferenceList(keys: string[]): Promise<any[] | ErrorResponseDto> {
  try {
    const res = await platformInstance.post(`/api/v1/masterdata/metadata/reference-list`, keys);
    return Array.isArray(res.data) ? res.data : [];
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
        message: errData.message || 'Failed to fetch reference list',
        description: errData.description || 'No details provided',
      };
    }

    return {
      status_code: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching reference list.',
    };
  }
}