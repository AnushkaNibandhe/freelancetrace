const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'freelancetrace.auth.token';

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token?: string | null) => {
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
};

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return response;
};

export const apiJson = async <T>(path: string, options: RequestInit = {}) => {
  const response = await apiFetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error ||
      data?.message ||
      response.statusText ||
      'Request failed';
    throw new Error(message);
  }

  return data as T;
};
