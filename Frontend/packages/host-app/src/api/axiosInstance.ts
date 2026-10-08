import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
const baseURL = import.meta.env.VITE_AUTH_API_BASE;
const apiKey = import.meta.env.VITE_API_KEY;

const axiosInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const isLoginOrRefresh = config.url?.includes('/login') || config.url?.includes('/refresh-token');
    if (isLoginOrRefresh && config.headers) {
      delete config.headers['X-API-Key'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401) {
      const isRefreshTokenRequest = originalRequest?.url?.includes('/refresh-token');
      if (isRefreshTokenRequest) {
        useAuthStore.getState().logout();
        window.dispatchEvent(new CustomEvent('session:expired'));
        return Promise.reject(error);
      }
    }

    // Exclude all auth endpoints (login, send-otp, verify-otp, refresh-token, etc.) from refresh logic
    const isAuthEndpoint = originalRequest?.url?.includes('/api/v1/identity/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry && !originalRequest?._skipRefresh) {
      originalRequest._retry = true;

      if (!(window as any).__vosox_refresh_promise) {
        (window as any).__vosox_refresh_promise = axiosInstance.post('/api/v1/identity/auth/refresh-token')
          .then(() => {
            (window as any).__vosox_refresh_promise = null;
          })
          .catch((err) => {
            (window as any).__vosox_refresh_promise = null;
            throw err;
          });
      }

      try {
        await (window as any).__vosox_refresh_promise;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.dispatchEvent(new CustomEvent('session:expired'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
export default axiosInstance;
