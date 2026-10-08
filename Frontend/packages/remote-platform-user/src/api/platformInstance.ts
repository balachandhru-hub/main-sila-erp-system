import axios from 'axios';

const baseURL = import.meta.env.VITE_AUTH_API_BASE;
const apiKey = import.meta.env.VITE_API_KEY;

const platformInstance = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
  },
  withCredentials: true,
});

platformInstance.interceptors.request.use(
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

platformInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401) {
      const isRefreshTokenRequest = originalRequest?.url?.includes('/refresh-token');
      if (isRefreshTokenRequest) {
        sessionStorage.clear();
        window.dispatchEvent(new CustomEvent('session:expired'));
        return Promise.reject(error);
      }
    }
    const isAuthEndpoint = originalRequest?.url?.includes('/api/v1/identity/auth/');
    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry && !originalRequest?._skipRefresh) {
      originalRequest._retry = true;

      if (!(window as any).__vosox_refresh_promise) {
        (window as any).__vosox_refresh_promise = platformInstance.post('/api/v1/identity/auth/refresh-token')
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
        return platformInstance(originalRequest);
      } catch (refreshError) {
        sessionStorage.clear();
        window.dispatchEvent(new CustomEvent('session:expired'));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default platformInstance;