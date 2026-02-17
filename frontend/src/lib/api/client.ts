import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { _retryCount?: number };

    // On 401, clear auth state then redirect
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Retry on network errors or 5xx with exponential backoff
    const isRetryable =
      !error.response || (error.response.status >= 500 && error.response.status < 600);
    const retryCount = config?._retryCount ?? 0;

    if (isRetryable && config && retryCount < MAX_RETRIES) {
      config._retryCount = retryCount + 1;
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
