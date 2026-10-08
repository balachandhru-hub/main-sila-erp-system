import axiosInstance from './axiosInstance';
import type { AuthInfo } from '../AuthContext';
export const sendOtp = async (email: string) => {
    try {
        const response = await axiosInstance.post('/api/v1/identity/auth/send-otp', {
            email,
        }, {
            headers: {
                Accept: 'text/plain',
                'Content-Type': 'application/json',
            }
        });
        return response.data;
    } catch (error: any) {
        if (error?.response?.data) {
            const data = error.response.data;
            throw new Error(data?.message || data?.description || `Failed to send OTP (${error.response.status}).`);
        }
        throw new Error('Could not reach the server. Please check your connection and try again.');
    }
};
export const verifyOtp = async (email: string, otp: string) => {
    try {
        const response = await axiosInstance.post('/api/v1/identity/auth/verify-otp', {
            email,
            otp,
        }, {
            headers: {
                Accept: 'text/plain',
                'Content-Type': 'application/json',
            }
        });
        return response.data;
    } catch (error: any) {
        if (error?.response?.data) {
            const data = error.response.data;
            throw new Error(data?.message || data?.description || `Failed to verify OTP (${error.response.status}).`);
        }
        throw new Error('Could not reach the server. Please check your connection and try again.');
    }
};

export const login = async (userName: string, password: string) => {
    try {
        const response = await axiosInstance.post('/api/v1/identity/auth/login', {
            userName,
            password,
        }, {
        });
        return response.data;
    } catch (error: any) {
        if (error?.response?.data) {
            const data = error.response.data;
            throw new Error(data?.message || data?.description || `Failed to login (${error.response.status}).`);
        }
        throw new Error('Could not reach the server. Please check your connection and try again.');
    }
};

export const getTokenClaims = async (skipRefresh = false) => {
    try {
        const response = await axiosInstance.get('api/v1/identity/token-claim', {
            ...({ _skipRefresh: skipRefresh } as any)
        });
        return response.data;
    } catch (error: any) {
        if (error?.response?.data) {
            const data = error.response.data;
            throw new Error(data?.message || data?.description || `Failed to fetch token claims (${error.response.status}).`);
        }
        throw new Error('Could not reach the server. Please check your connection and try again.');
    }
};
export const fetchAuthInfo = async (skipRefresh = false): Promise<AuthInfo | null> => {
  try {
    const data = await getTokenClaims(skipRefresh);
    if (data && typeof data === 'object' && 'userId' in data && 'roleId' in data) {
      return data as AuthInfo;
    }
    return null;
  } catch {
    return null;
  }
};