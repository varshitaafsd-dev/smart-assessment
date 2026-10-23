const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

export function getToken() { return localStorage.getItem('token'); }

export async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) { localStorage.removeItem('token'); localStorage.removeItem('user'); }
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}
export const get = (p) => api('GET', p);
export const post = (p, b) => api('POST', p, b || {});
export const put = (p, b) => api('PUT', p, b || {});
export const del = (p) => api('DELETE', p);
