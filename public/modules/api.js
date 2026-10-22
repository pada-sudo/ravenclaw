export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.gaps = data?.gaps;
    this.next = data?.next;
  }
}

export async function api(path, method = 'GET', body) {
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(path, opt);
  let data = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  if (!res.ok) {
    throw new ApiError(data.error || `Kesalahan ${res.status}`, res.status, data);
  }
  return data;
}

export async function fetchJson(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Gagal memuat ${path}`);
  return res.json();
}

export function login(username, password) {
  return api('/api/auth/login', 'POST', { username, password });
}

export function logout() {
  return api('/api/auth/logout', 'POST', {});
}

export async function getSession() {
  try {
    const data = await api('/api/auth/session');
    return data.user;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}
