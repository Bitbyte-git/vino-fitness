import axios from 'axios';

const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const API_BASE_URL = configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`;
let refreshPromise;

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
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const isAuthRequest = /\/auth\/(login|register|refresh)/.test(originalRequest.url || '');
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
            .then((refreshResponse) => {
              setTimeout(() => {
                refreshPromise = undefined;
              }, 1000);
              return refreshResponse;
            })
            .catch((refreshError) => {
              refreshPromise = undefined;
              throw refreshError;
            });
        }
        await refreshPromise;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
