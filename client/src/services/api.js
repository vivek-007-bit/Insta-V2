import axios from 'axios';

const PROD_RENDER_ORIGIN = 'https://instav2-server.onrender.com';

const rawEnvBase =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '';

export const API_BASE_URL = (
  rawEnvBase ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:8000/api')
).replace(/\/+$/, '');

export const getSocketOrigin = () => {
  const explicitSocket = (import.meta.env.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '');
  if (explicitSocket) return explicitSocket;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }

  return import.meta.env.PROD ? PROD_RENDER_ORIGIN : 'http://localhost:8000';
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send and receive HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
});

const AUTH_PUBLIC_PATHS = ['/auth/login', '/auth/signup', '/auth/logout', '/auth/me'];

// Response interceptor for extracting response data and classifying API errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status || 0;
    const isNetworkError = !error.response;
    const rawData = error.response?.data;
    const isHtmlResponse = typeof rawData === 'string' && rawData.trim().startsWith('<');

    let message =
      (!isHtmlResponse && rawData?.message) ||
      error.message ||
      'An unexpected network error occurred';

    if (isNetworkError) {
      message = 'Unable to connect to the server. Please check your network connection.';
    } else if (isHtmlResponse) {
      message = `API endpoint returned an unexpected HTML page (HTTP ${status}). Verify VITE_API_BASE_URL and server routing.`;
    }

    const enrichedError = new Error(message);
    enrichedError.status = status;
    enrichedError.code = error.code || null;
    enrichedError.data = !isHtmlResponse ? rawData : null;
    enrichedError.isNetworkError = isNetworkError;
    enrichedError.isAuthError = status === 401;
    enrichedError.isForbidden = status === 403;
    enrichedError.isNotFound = status === 404;
    enrichedError.isServerError = status >= 500;

    // Notify AppContext when a protected request fails with 401 (expired/invalid session)
    const requestUrl = error.config?.url || '';
    const isAuthLifecycleEndpoint = AUTH_PUBLIC_PATHS.some((p) => requestUrl.includes(p));
    if (status === 401 && !isAuthLifecycleEndpoint && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('insta:unauthorized', {
          detail: { message, url: requestUrl }
        })
      );
    }

    return Promise.reject(enrichedError);
  }
);

export default api;
