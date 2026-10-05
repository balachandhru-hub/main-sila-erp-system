//src/api/masterdataApi.ts
import axiosInstance from "./axiosInstance";
import type { ErrorResponseDto } from "@vosox/shared-ui";

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

export interface ReferenceListItemDto {
  id: string;
  key: string;      
  type: string;       
  description: string;  
}

export async function fetchSegments(
    pageIndex: number = 1,
    pageSize: number = 40,
    searchTerm?: string
): Promise<any[] | ErrorResponseDto> {
    try {
        const params: Record<string, any> = { pageIndex, pageSize };
        if (searchTerm) params.searchTerm = searchTerm;
        const res = await axiosInstance.get(
            `/api/v1/masterdata/unspsc/segment`,
            { params }
        );
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
}

export async function fetchClasses(segment: number, family: number): Promise<any[] | ErrorResponseDto> {
    try {
        const res = await axiosInstance.get(
            `/api/v1/masterdata/unspsc/class-commodity?segment=${segment}&family=${family}&pageIndex=1&pageSize=40`
        );
        if (Array.isArray(res.data)) {
            return res.data.filter(item => item && item.class !== null && item.title !== "");
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
}

export async function fetchReferenceList(keys: string[]): Promise<any[] | ErrorResponseDto> {
    try {
        const res = await axiosInstance.post(`/api/v1/masterdata/metadata/reference-list`, keys);
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
                message: errData.message || 'Failed to fetch reference list',
                description: errData.description || 'No details provided',
            };
        }

        return {
            statusCode: 500,
            message: 'Unexpected Error',
            description: 'Something went wrong while fetching reference list.',
        };
    }
}


export async function fetchDropdownReferenceList(
  keys: string[]
): Promise<ReferenceListItemDto[] | ErrorResponseDto> {
  try {
    const res = await axiosInstance.post<ReferenceListItemDto[]>(
      `/api/v1/masterdata/metadata/reference-list`,
      keys
    );
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
        message: errData.message || 'Failed to fetch reference list',
        description: errData.description || 'No details provided',
      };
    }
    return {
      statusCode: 500,
      message: 'Unexpected Error',
      description: 'Something went wrong while fetching reference list.',
    };
  }
}
/* ---------------------------------- Countries ---------------------------------- */

export interface CountryDto {
    id: string;
    countryName: string;
    countryCode: string;
    mobileCountryCode: string;
}

export interface CountryListResponseDto {
    items: CountryDto[];
    totalCount: number;
    index: number;
    limit: number;
}

export async function getCountries(
    index: number,
    limit: number,
    searchTerm?: string
): Promise<CountryListResponseDto | ErrorResponseDto> {
    try {
        const params: Record<string, any> = { index, limit };
        if (searchTerm) params.searchTerm = searchTerm;
        const res = await axiosInstance.get(`/api/v1/masterdata/countries`, { params });
        return res.data;
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
                message: errData.message || 'Failed to fetch countries',
                description: errData.description || 'No details provided',
            };
        }

        return {
            statusCode: 500,
            message: 'Unexpected Error',
            description: 'Something went wrong while fetching countries.',
        };
    }
}

/* ---------------------------------- Units ---------------------------------- */

export interface UnitDto {
    id: string;
    key: string;
    type: string;
    description: string;
}

export interface UnitListResponseDto {
    items: UnitDto[];
    totalCount: number;
    index: number;
    limit: number;
}

export async function getUnits(
    index: number,
    limit: number,
    searchTerm?: string
): Promise<UnitListResponseDto | ErrorResponseDto> {
    try {
        const params: Record<string, any> = { index, limit };
        if (searchTerm) params.searchTerm = searchTerm;
        const res = await axiosInstance.get(`/api/v1/masterdata/units`, { params });
        return res.data;
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
}

/* ---------------------------------- Currencies ---------------------------------- */

export interface CurrencyDto {
    id: string;
    currencyName: string;
    sortNumber: number;
}

export interface CurrencyListResponseDto {
    items: CurrencyDto[];
    totalCount: number;
    index: number;
    limit: number;
}

export async function getCurrencies(
    index: number,
    limit: number): Promise<CurrencyListResponseDto | ErrorResponseDto> {
    try {
        const params: Record<string, any> = { index, limit };
        const res = await axiosInstance.get(`/api/v1/masterdata/currencies`, { params });
        return res.data;
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
}

// Fetch Families for a selected Segment
export const fetchFamilies = async (
    segment: number,
    payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
    try {
        const res = await axiosInstance.get(
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

// Fetch Classes for a selected Family
export const fetchClassifications = async (
    family: number,
    payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
    try {
        const res = await axiosInstance.get(
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

// Fetch Commodities for a selected Class
export const fetchCommodities = async (
    classId: number,
    payload?: { pageIndex?: number; pageSize?: number }
): Promise<any[] | ErrorResponseDto> => {
    try {
        const res = await axiosInstance.get(
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