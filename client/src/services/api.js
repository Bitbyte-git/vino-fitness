import axios from 'axios';

const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;
let refreshPromise;
let inMemoryAccessToken = null;

export const setAuthToken = (token) => {
  inMemoryAccessToken = token || null;
};

export const getAuthToken = () => inMemoryAccessToken;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    config.withCredentials = true;
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const isAuthRequest = /\/auth\/(login|register|refresh|me)/.test(originalRequest.url || '');
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
            .then((refreshResponse) => {
              const newAccessToken = refreshResponse.data?.data?.accessToken;
              if (newAccessToken) {
                setAuthToken(newAccessToken);
              }
              setTimeout(() => {
                refreshPromise = undefined;
              }, 1000);
              return refreshResponse;
            })
            .catch((refreshError) => {
              setAuthToken(null);
              refreshPromise = undefined;
              throw refreshError;
            });
        }
        await refreshPromise;
        if (inMemoryAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        setAuthToken(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        const currentPath = window.location.pathname;
        const isPublicPath = /^\/(login|register|programs|pricing|about|contact|privacy|terms|docs|api-docs)?$/.test(currentPath);
        if (!isPublicPath && !currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

