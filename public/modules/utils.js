export const $ = sel => document.querySelector(sel);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  if (Number.isNaN(dt.getTime())) return esc(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function daysLeft(d) {
  if (!d) return null;
  const a = new Date(d + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.floor(a / 86400000);
}

export function filled(v) {
  return !!(v ?? '').toString().trim();
}

export function weekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
}

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'link-evidence:']);

function baseUrl() {
  return (typeof globalThis !== 'undefined' && globalThis.location?.href) || 'http://localhost/';
}

export function safeUrl(raw) {
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw, baseUrl());
  } catch {
    return '';
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) return '';
  return url.href;
}

export function isSafeUrl(raw) {
  if (!raw) return false;
  try {
    return ALLOWED_SCHEMES.has(new URL(raw, baseUrl()).protocol);
  } catch {
    return false;
  }
}

export function percent(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.values(obj).forEach(deepFreeze);
    Object.freeze(obj);
  }
  return obj;
}
