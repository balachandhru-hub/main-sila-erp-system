import axios from 'axios';
const baseURL = import.meta.env.VITE_AUTH_API_BASE;

const axiosInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
        window.dispatchEvent(new CustomEvent('session:expired'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
export default axiosInstance;
