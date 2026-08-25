const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE_URL = rawBase.replace(/\/$/, '');

export function apiFetch(path: string, init?: RequestInit) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalized}`, init);
}
