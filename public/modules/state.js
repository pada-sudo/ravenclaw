import { esc } from './utils.js';

export const STATE = {
  idle: 'idle',
  loading: 'loading',
  empty: 'empty',
  error: 'error',
};

export function stateBox({ state, error, emptyText, children }) {
  if (state === STATE.loading) {
    return `<div class="state-box loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span> Memuat…</div>`;
  }
  if (state === STATE.error) {
    return `<div class="alert red" role="alert"><b>Gagal memuat</b>${esc(error?.message || 'Terjadi kesalahan.')}</div>`;
  }
  if (state === STATE.empty) {
    return `<div class="empty-state" role="status"><div class="empty-icon" aria-hidden="true">⊘</div><p>${esc(emptyText || 'Tidak ada data.')}</p>${children || ''}</div>`;
  }
  return children || '';
}

const toastRegion = () => document.getElementById('toast-region');
let toastTimer;

export function toast(message, type = 'info') {
  const region = toastRegion();
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = message;
  region.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    region.innerHTML = '';
  }, 5000);
}

export function showError(message) {
  toast(message, 'error');
}
