const ACTOR_STORE_KEY = 'ddp_actor';

export function getActor() {
  try {
    return JSON.parse(localStorage.getItem(ACTOR_STORE_KEY)) || {};
  } catch {
    return {};
  }
}

export function setActor({ id, name }) {
  localStorage.setItem(ACTOR_STORE_KEY, JSON.stringify({ id: (id || '').trim(), name: (name || '').trim() }));
}

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
  const opt = { method, headers: {} };
  const actor = getActor();
  if (actor.id) opt.headers['x-actor-id'] = actor.id;
  if (actor.name) opt.headers['x-actor-name'] = actor.name;
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
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Gagal memuat ${path}`);
  return res.json();
}
