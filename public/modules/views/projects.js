import { api } from '../api.js';
import { $, $$, esc, fmt } from '../utils.js';
import { stateBox, STATE, toast } from '../state.js';
import { getContent } from '../content.js';
import { gateBadge, trackBadge, statusBadge, tableScroll, modal, confirmDialog, projectForm } from '../components.js';
import { navigate } from '../router.js';

const filters = { track: '', gate: '', status: '' };

export async function renderProjects(container) {
  container.innerHTML = stateBox({ state: STATE.loading });
  const content = getContent();
  const gateLabels = content.gates.labels;

  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  let data;
  try {
    data = await api('/api/projects' + (q ? '?' + q : ''));
  } catch (err) {
    container.innerHTML = stateBox({ state: STATE.error, error: err });
    return;
  }
  const projects = data.data || [];

  const rows = projects.map(p => {
    const warn = p.procurement && p.procurement.warning;
    return `<tr>
      <td><a class="link" href="#/project/${p.id}">${esc(p.code)}</a></td>
      <td><b>${esc(p.name)}</b>${p.bpom_case ? ' ' + gateBadge('kind', 'BPOM') : ''}${warn ? `<div class="small" style="color:var(--red)">⚠ ${esc(warn)}</div>` : ''}</td>
      <td>${esc(p.customer_cfu) || '—'}</td>
      <td>${trackBadge(p.track)}</td>
      <td>${gateBadge(p.gate)}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${esc(p.pm) || '—'}</td>
      <td>${fmt(p.start_date)}</td>
      <td>${fmt(p.bridging_end)}</td>
      <td class="row-actions">
        <button class="btn sm ghost" data-edit="${p.id}">Edit</button>
        ${p.status === 'closed'
          ? `<button class="btn sm ghost" data-reopen="${p.id}" data-code="${esc(p.code)}">Buka kembali</button>`
          : `<button class="btn sm green" data-finish="${p.id}" data-code="${esc(p.code)}">Selesai</button>`}
        <button class="btn sm ghost danger" data-delete="${p.id}" data-code="${esc(p.code)}">Hapus</button>
      </td></tr>`;
  }).join('') || '<tr><td colspan="10" class="muted">Tidak ada proyek.</td></tr>';

  container.innerHTML = `
    <h1>Proyek &amp; Penugasan</h1>
    <p class="sub">Register proyek / resource request Shared Service DDP.</p>
    <div class="toolbar">
      <label class="sr-only" for="fTrack">Filter jalur</label>
      <select id="fTrack"><option value="">Semua jalur</option>
        <option value="first_responder" ${filters.track === 'first_responder' ? 'selected' : ''}>First Responder</option>
        <option value="buffer" ${filters.track === 'buffer' ? 'selected' : ''}>Buffer</option></select>
      <label class="sr-only" for="fGate">Filter gate</label>
      <select id="fGate"><option value="">Semua gate</option>
        ${Object.keys(gateLabels).map(g => `<option value="${g}" ${filters.gate === g ? 'selected' : ''}>${esc(gateLabels[g])}</option>`).join('')}</select>
      <label class="sr-only" for="fStatus">Filter status</label>
      <select id="fStatus"><option value="">Semua status</option>
        ${['active', 'pending', 'blocked', 'closed'].map(s2 => `<option value="${s2}" ${filters.status === s2 ? 'selected' : ''}>${{ active: 'Aktif', pending: 'Pending', blocked: 'Blocked', closed: 'Selesai' }[s2]}</option>`).join('')}</select>
      <div class="spacer"></div>
      <button class="btn" id="btnIntake">+ Intake Proyek (SOP-01)</button>
    </div>
    <div class="card" style="padding:6px 12px">
      ${tableScroll(`<table><thead><tr><th>Kode</th><th>Nama</th><th>Customer/CFU</th><th>Jalur</th><th>Gate</th><th>Status</th><th>PM</th><th>Mulai</th><th>Akhir bridging</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody></table>`)}
    </div>`;

  $('#fTrack').onchange = e => { filters.track = e.target.value; renderProjects(container); };
  $('#fGate').onchange = e => { filters.gate = e.target.value; renderProjects(container); };
  $('#fStatus').onchange = e => { filters.status = e.target.value; renderProjects(container); };
  $('#btnIntake').onclick = () => openIntake();
  $$('[data-edit]').forEach(btn => btn.onclick = async () => {
    try { const r = await api(`/api/projects/${btn.dataset.edit}`); openEdit(r.project); }
    catch (err) { toast(err.message, 'error'); }
  });
  $$('[data-finish]').forEach(btn => btn.onclick = () => finishProject(btn.dataset.finish, btn.dataset.code));
  $$('[data-reopen]').forEach(btn => btn.onclick = async () => {
    try { await api(`/api/projects/${btn.dataset.reopen}/reopen`, 'POST', {}); renderProjects(container); toast('Proyek dibuka kembali.'); }
    catch (err) { toast(err.message, 'error'); }
  });
  $$('[data-delete]').forEach(btn => btn.onclick = () => deleteProject(btn.dataset.delete, btn.dataset.code));
}

function openIntake() {
  modal({
    title: 'Intake Proyek Baru — SOP-01',
    body: projectForm(),
    onSubmit: async (data, close) => {
      const r = await api('/api/projects', 'POST', data);
      close();
      navigate(`/project/${r.id}`);
      toast(`Proyek ${r.code} berhasil dibuat.`);
    }
  });
}

export function openEdit(p) {
  modal({
    title: 'Edit Data Proyek',
    body: projectForm(p),
    onSubmit: async (data, close) => {
      await api(`/api/projects/${p.id}`, 'PUT', data);
      close();
      renderProjects($('#main'));
      toast('Data proyek disimpan.');
    }
  });
}

function finishProject(id, code) {
  confirmDialog({
    title: 'Tandai selesai',
    message: `Tandai proyek ${code} sebagai SELESAI? Proyek akan keluar dari pipeline aktif dan masuk ke arsip selesai.`,
    onConfirm: async () => {
      await api(`/api/projects/${id}/close`, 'POST', {});
      navigate('/dashboard');
      toast('Proyek ditandai selesai.');
    }
  });
}

function deleteProject(id, code) {
  confirmDialog({
    title: 'Hapus proyek',
    message: `Hapus proyek ${code}? Proyek beserta seluruh deliverable, laporan mingguan, RAID dan log aktivitasnya akan dihapus secara logis (soft-delete) dan tetap dapat diaudit.`,
    onConfirm: async () => {
      await api(`/api/projects/${id}`, 'DELETE');
      navigate('/dashboard');
      toast('Proyek dihapus.');
    },
    danger: true
  });
}
