import { $, esc, safeUrl } from './utils.js';

let focusTrapElement = null;
let lastFocusedElement = null;

function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  first.focus();
  modalEl._trapHandler = e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  };
  modalEl.addEventListener('keydown', modalEl._trapHandler);
}

export function modal({ title, body, onSubmit, submitLabel = 'Simpan', onClose, submitClass = 'btn' }) {
  if ($('.overlay')) return;
  lastFocusedElement = document.activeElement;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'modal-title');
  ov.innerHTML = `<div class="modal"><h2 id="modal-title">${esc(title)}</h2><form id="modalForm">${body}
    <div class="actions"><button type="button" class="btn ghost" id="mCancel">Batal</button>
    <button type="submit" class="${esc(submitClass)}">${esc(submitLabel)}</button></div></form></div>`;
  document.body.appendChild(ov);
  document.body.classList.add('modal-open');
  focusTrapElement = ov.querySelector('.modal');
  trapFocus(focusTrapElement);

  const submitBtn = ov.querySelector('button[type="submit"]');

  function close() {
    ov.removeEventListener('keydown', ov._keyHandler);
    if (focusTrapElement && focusTrapElement._trapHandler) {
      focusTrapElement.removeEventListener('keydown', focusTrapElement._trapHandler);
    }
    ov.remove();
    document.body.classList.remove('modal-open');
    focusTrapElement = null;
    if (lastFocusedElement) lastFocusedElement.focus();
    if (onClose) onClose();
  }

  ov.querySelector('#mCancel').onclick = close;
  ov._keyHandler = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('keydown', ov._keyHandler);
  ov.onclick = e => { if (e.target === ov) close(); };
  ov.querySelector('#modalForm').onsubmit = async e => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    e.target.querySelectorAll('input[type=checkbox][data-send]').forEach(cb => { data[cb.name] = cb.checked ? 1 : 0; });
    try {
      await onSubmit(data, close);
    } catch (err) {
      submitBtn.disabled = false;
      showModalError(ov, err.message);
    }
  };
  return ov;
}

function showModalError(ov, message) {
  let errBox = ov.querySelector('.modal-error');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.className = 'alert red modal-error';
    errBox.setAttribute('role', 'alert');
    errBox.tabIndex = -1;
    const form = ov.querySelector('#modalForm');
    form.insertBefore(errBox, form.querySelector('.actions'));
  }
  errBox.textContent = message || 'Terjadi kesalahan';
  errBox.focus();
}

export function confirmDialog({ title, message, onConfirm, confirmLabel = 'Ya, lanjutkan', danger = false }) {
  modal({
    title,
    body: `<p class="small">${esc(message)}</p>`,
    submitLabel: confirmLabel,
    submitClass: danger ? 'btn danger-solid' : 'btn',
    onSubmit: async (_, close) => { await onConfirm(); close(); },
    onClose: () => {}
  });
}

export function badge(cls, text) {
  return `<span class="badge b-${esc(cls)}">${esc(text)}</span>`;
}

export function gateBadge(g) { return badge(g, g); }
export function trackBadge(t) {
  return t === 'first_responder' ? badge('first_responder', 'First Responder') : badge('buffer', 'Buffer');
}
export function statusBadge(st) {
  const labels = { active: 'Aktif', pending: 'Pending', blocked: 'Blocked', closed: 'Selesai' };
  return badge(st, labels[st] || st);
}
export function kindBadge(k) {
  return badge('kind', k.charAt(0).toUpperCase() + k.slice(1));
}

const BUDGET_OPTS = [['belum_diajukan', 'Belum diajukan'], ['diajukan', 'Diajukan'], ['disetujui', 'Disetujui & tersedia']];
const ONB_OPTS = [['belum_mulai', 'Belum mulai'], ['berjalan', 'Sedang berjalan'], ['selesai', 'Selesai']];
const PROC_OPTS = [
  ['', '— tidak ada / tidak berlaku —'],
  ['PKDF', 'PKDF (paling lambat 2 bulan)'],
  ['Justifikasi Kontrak Lumsum', 'Justifikasi Kontrak Lumsum (1,5 bulan)'],
  ['Surat Pesanan dengan new item', 'SP dengan new item (1 bulan)'],
  ['Surat Pesanan tanpa new item', 'SP tanpa new item (2 minggu)'],
];

export function fInput({ name, label, val = '', type = 'text', required = false, placeholder = '', extra = '' }) {
  return `<div><label for="${name}">${esc(label)}${required ? ' *' : ''}</label><input id="${name}" name="${name}" type="${type}" value="${esc(val)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${extra}></div>`;
}

export function fSelect({ name, label, opts, val = '', required = false, extra = '' }) {
  return `<div><label for="${name}">${esc(label)}${required ? ' *' : ''}</label><select id="${name}" name="${name}" ${required ? 'required' : ''} ${extra}>${opts.map(o =>
    `<option value="${esc(o[0])}" ${o[0] === val ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
}

export function fText({ name, label, val = '', required = false, rows = 3, extra = '' }) {
  return `<div class="full"><label for="${name}">${esc(label)}${required ? ' *' : ''}</label><textarea id="${name}" name="${name}" rows="${rows}" ${required ? 'required' : ''} ${extra}>${esc(val)}</textarea></div>`;
}

export function fCheck({ name, label, checked = false }) {
  return `<div class="full check-row"><input type="checkbox" id="${name}" name="${name}" data-send="1" ${checked ? 'checked' : ''}><label for="${name}">${esc(label)}</label></div>`;
}

export function safeLink(href, text, cls = 'link') {
  const url = safeUrl(href);
  if (!url) return `<span class="muted">${esc(text || '—')}</span>`;
  return `<a class="${esc(cls)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url)}</a>`;
}

export function kpiBar(pct, label) {
  if (pct === null || pct === undefined) return '';
  const cls = pct >= 80 ? '' : pct >= 50 ? 'warn' : 'bad';
  const ariaLabel = label ? ` aria-label="${esc(label)}"` : '';
  return `<div class="bar" role="progressbar"${ariaLabel} aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i class="${cls}" style="width:${pct}%"></i></div>`;
}

export function tableScroll(htmlTable, label = 'Tabel data') {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${esc(label)}">${htmlTable}</div>`;
}

export function projectForm(p = {}, meta) {
  const isEdit = !!p.id;
  const gateLabels = meta?.gateLabels || {};
  return `<div class="form-grid">
    ${fInput({ name: 'name', label: 'Nama proyek / penugasan', val: p.name, required: !isEdit })}
    ${fInput({ name: 'customer_cfu', label: 'Customer / CFU', val: p.customer_cfu })}
    ${fInput({ name: 'tribe_unit', label: 'Tribe / Unit', val: p.tribe_unit })}
    ${fInput({ name: 'business_owner', label: 'Business Owner', val: p.business_owner })}
    ${fInput({ name: 'pm', label: 'Project Manager', val: p.pm })}
    ${isEdit ? '' : fSelect({ name: 'track', label: 'Jalur Shared Service', required: true, opts: [['first_responder', 'First Responder — proyek baru / setup'], ['buffer', 'Buffer — proyek existing / dukungan eksekusi']], val: p.track })}
    ${isEdit ? '' : fSelect({ name: 'project_type', label: 'Jenis proyek', required: true, opts: [['new', 'Proyek baru'], ['existing', 'Proyek existing']], val: p.project_type })}
    ${fInput({ name: 'reason_shared_service', label: 'Alasan penggunaan Shared Service', val: p.reason_shared_service })}
    ${fInput({ name: 'nde_no', label: 'Nomor NDE', val: p.nde_no })}
    ${fInput({ name: 'nde_date', label: 'Tanggal NDE', val: p.nde_date, type: 'date' })}
    ${fSelect({ name: 'budget_status', label: 'Status anggaran', opts: BUDGET_OPTS, val: p.budget_status || 'belum_diajukan' })}
    ${fSelect({ name: 'onboarding_status', label: 'Status onboarding / akses talent', opts: ONB_OPTS, val: p.onboarding_status || 'belum_mulai' })}
    ${fSelect({ name: 'procurement_doc', label: 'Dokumen pengadaan', opts: PROC_OPTS, val: p.procurement_doc })}
    ${fInput({ name: 'procurement_target_start', label: 'Target mulai pekerjaan', val: p.procurement_target_start, type: 'date' })}
    ${fInput({ name: 'fte', label: 'Kebutuhan FTE', val: p.fte, placeholder: 'mis. 50%' })}
    ${fInput({ name: 'start_date', label: 'Tanggal mulai penugasan', val: p.start_date, type: 'date' })}
    ${fInput({ name: 'end_date', label: 'Tanggal akhir penugasan', val: p.end_date, type: 'date' })}
    <div id="bufferOnly" style="display:${p.track === 'buffer' || !isEdit ? 'contents' : 'none'}">
      ${fInput({ name: 'bridging_end', label: 'Akhir masa bridging (Buffer)', val: p.bridging_end, type: 'date' })}
      ${fCheck({ name: 'bpom_case', label: 'Kasus khusus BPOM (SOP-07)', checked: p.bpom_case })}
    </div>
    ${fText({ name: 'definitive_plan', label: 'Rencana talent definitif / transisi', val: p.definitive_plan })}
    ${fText({ name: 'notes', label: 'Catatan', val: p.notes })}
  </div>`;
}

export function stepper({ gates, current, selected, onSelect, labels, descriptions }) {
  const curIdx = gates.indexOf(current);
  return `<div class="stepper" role="tablist" aria-label="Bagan gate">${gates.map((g, i) => {
    const cls = i < curIdx ? 'done' : g === current ? 'current' : '';
    const sel = g === selected ? 'sel' : '';
    const label = labels?.[g] || g;
    const desc = descriptions?.[g] || '';
    return `<button type="button" class="step ${cls} ${sel}" id="gate-tab-${esc(g)}" data-gate="${esc(g)}" role="tab" aria-controls="gateDetail" aria-selected="${g === selected ? 'true' : 'false'}" tabindex="${g === selected ? 0 : -1}" aria-label="${esc(label)}: ${esc(desc)}" title="${esc(desc)}">${g === 'CLOSED' ? 'SELESAI' : g}</button>${i < gates.length - 1 ? '<span class="arrow" aria-hidden="true">→</span>' : ''}`;
  }).join('')}</div>`;
}

// WAI-ARIA tabs keyboard pattern: arrows move between tabs, Home/End jump to
// the first/last tab, and activation follows focus.
export function bindTablist(tablist) {
  if (!tablist) return;
  tablist.addEventListener('keydown', event => {
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    let next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
}
