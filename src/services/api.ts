const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
export const API_BASE_URL = rawBase.replace(/\/$/, '');

export const PALIA_AI_WORKER_URL =
  (import.meta.env.VITE_PALIA_AI_WORKER_URL || 'https://promptpix-ai.shanpalia786.workers.dev').replace(/\/$/, '');

export function apiFetch(path: string, init?: RequestInit) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${normalized}`, init);
}

export function workerFetch(path: string, init?: RequestInit) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${PALIA_AI_WORKER_URL}${normalized}`, init);
}
