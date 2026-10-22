'use strict';

const $ = sel => document.querySelector(sel);
const main = $('#main');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const GATE_LABELS = { G0: 'G0 Kualifikasi', G1: 'G1 Administratif', G2A: 'G2A Setup FR', G2B: 'G2B Kesiapan Buffer', G3: 'G3 Delivery', G4: 'G4 Acceptance', G5: 'G5 Transisi', CLOSED: 'Selesai' };
const GATE_DESC = {
  G0: 'Kebutuhan/peluang proyek masuk; tentukan jalur: proyek baru → First Responder, proyek existing → Buffer.',
  G1: 'NDE permintaan CFU tersedia, anggaran disetujui dan tersedia, onboarding/akses talent berjalan.',
  G2A: 'First Responder: WBS, BRD, SAD, Workforce Plan, Initial Data Solution, Initial Design Documentation, Project Charter.',
  G2B: 'Buffer: BRD/SAD/repository/change log/user story direview; knowledge transfer selesai.',
  G3: 'Sepakati scope, timeline, FTE, akses, weekly report, risiko, blocker, evidence dan jalur eskalasi.',
  G4: 'Validasi hasil, testing dan dokumen serah terima sesuai kontrak, SOP dan jenis proyek.',
  G5: 'Transisi ke talent definitif/operasi; isu residual, lessons learned, evaluasi load activity.',
  CLOSED: 'Penugasan ditutup; owner lanjutan, dokumen dan tindak lanjut terdokumentasi.',
};
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => {
  if (!d) return '—';
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  if (Number.isNaN(dt.getTime())) return esc(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
};
const daysLeft = d => {
  if (!d) return null;
  const a = new Date(d + 'T00:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.floor(a / 86400000);
};

const filled = v => !!(v ?? '').toString().trim();

function gateCriteria(g, p, d) {
  const out = [];
  const add = (label, ok) => out.push({ label, ok });
  if (g === 'G0') {
    add('Jalur penugasan ditetapkan (First Responder / Buffer)', !!p.track);
    add('Alasan penggunaan Shared Service tercatat', filled(p.reason_shared_service));
  } else if (g === 'G1') {
    add('NDE permintaan CFU tersedia (nomor & tanggal)', filled(p.nde_no) && filled(p.nde_date));
    add('Anggaran disetujui dan tersedia di sistem keuangan', p.budget_status === 'disetujui');
    add('Onboarding / akses talent berjalan', p.onboarding_status !== 'belum_mulai');
  } else if (g === 'G2A') {
    if (p.track !== 'first_responder') add('Tidak berlaku untuk jalur Buffer', null);
    else {
      const ok = d.deliverables.filter(x => x.status === 'disetujui').length;
      add(`${ok}/${d.deliverables.length} deliverable setup disetujui (SOP-03)`, d.deliverables.length > 0 && ok === d.deliverables.length);
    }
  } else if (g === 'G2B') {
    if (p.track !== 'buffer') add('Tidak berlaku untuk jalur First Responder', null);
    else {
      const ok = d.buffer_checks.filter(x => x.verified).length;
      add(`${ok}/${d.buffer_checks.length} prasyarat teknis Buffer terverifikasi (SOP-04)`, d.buffer_checks.length > 0 && ok === d.buffer_checks.length);
    }
  } else if (g === 'G3') {
    add('Tidak ada blocker terbuka', d.risks.every(r => !(r.kind === 'blocker' && r.status === 'open')));
    add('Weekly report (SOP-05) sudah disampaikan', d.reports.length > 0);
  } else if (g === 'G4') {
    add('Semua isu residual memiliki owner dan due date (SOP-06)', d.risks.every(r => r.status !== 'open' || (filled(r.owner) && filled(r.due_date))));
  } else if (g === 'G5') {
    add('Lessons learned / catatan penutupan terisi', filled(p.notes));
  } else if (g === 'CLOSED') {
    add('Penugasan ditutup dan status project selesai', p.status === 'closed' && p.gate === 'CLOSED');
  }
  return out;
}

function gateDetailHtml(g, p, d, gatePath) {
  const curIdx = gatePath.indexOf(p.gate);
  const idx = gatePath.indexOf(g);
  const state = g === p.gate ? (g === 'CLOSED' ? 'Gate akhir — penugasan selesai' : 'Gate saat ini')
    : idx < curIdx ? 'Sudah dilalui' : 'Belum dilalui';
  const evs = d.events.filter(e => e.gate === g).slice().reverse();
  const entered = evs.length ? evs[0].created_at : '';
  const criteria = gateCriteria(g, p, d).map(c =>
    `<li class="${c.ok === null ? 'na' : c.ok ? 'ok' : 'no'}"><span class="mk">${c.ok === null ? '–' : c.ok ? '✓' : '✗'}</span> ${esc(c.label)}</li>`).join('');
  const history = evs.map(e => `<li><span class="mono muted">${fmt(e.created_at)}</span> — <b>${esc(e.action)}</b>${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}<span class="small muted">${esc(e.actor)}</span></li>`).join('')
    || '<li class="muted small">Belum ada aktivitas tercatat pada gate ini.</li>';
  const note = (d.gate_notes || []).find(n => n.gate === g);
  return `<div class="infogrid" style="margin-bottom:12px">
      <div><b>Status gate</b><span>${esc(state)}</span></div>
      <div><b>Masuk gate</b><span>${entered ? fmt(entered) : '—'}</span></div>
      <div><b>Aktivitas tercatat</b><span>${evs.length} entri</span></div>
    </div>
    <p class="small muted">${GATE_DESC[g]}</p>
    <h3>Kriteria &amp; kesiapan</h3><ul class="criterialist">${criteria}</ul>
    <h3>Catatan proses gate</h3>
    <p class="small">${note && filled(note.note) ? esc(note.note) : '<span class="muted">Belum ada catatan.</span>'}</p>
    <h3>Jejak proses gate</h3><ul class="gatehistory">${history}</ul>`;
}

function openGateEditor(p, d, gate) {
  const note = (d.gate_notes || []).find(n => n.gate === gate);
  let fields = '';
  if (gate === 'G0') {
    fields = fSelect('project_type', 'Jenis proyek', [['new', 'Proyek baru'], ['existing', 'Proyek existing']], p.project_type)
      + fText('reason_shared_service', 'Alasan penggunaan Shared Service', p.reason_shared_service);
  } else if (gate === 'G1') {
    fields = fInput('nde_no', 'Nomor NDE', p.nde_no)
      + fInput('nde_date', 'Tanggal NDE', p.nde_date, 'date')
      + fSelect('budget_status', 'Status anggaran', BUDGET_OPTS, p.budget_status)
      + fSelect('onboarding_status', 'Status onboarding / akses', ONB_OPTS, p.onboarding_status)
      + fSelect('procurement_doc', 'Dokumen pengadaan', PROC_OPTS, p.procurement_doc)
      + fInput('procurement_target_start', 'Target mulai pekerjaan', p.procurement_target_start, 'date');
  } else if (gate === 'G2A' || gate === 'G2B') {
    fields = '<div class="full small muted" style="margin-top:8px">Item dan status gate ini diubah langsung pada tabel Deliverable / Prasyarat Buffer di bawah.</div>';
  } else if (gate === 'G3') {
    fields = fInput('start_date', 'Tanggal mulai penugasan', p.start_date, 'date')
      + fInput('end_date', 'Tanggal akhir penugasan', p.end_date, 'date')
      + fInput('fte', 'Kebutuhan FTE', p.fte);
  } else if (gate === 'G4') {
    fields = fInput('end_date', 'Target serah terima / akhir penugasan', p.end_date, 'date');
  } else if (gate === 'G5') {
    fields = fInput('bridging_end', 'Akhir masa bridging', p.bridging_end, 'date')
      + fText('definitive_plan', 'Rencana talent definitif / transisi', p.definitive_plan)
      + fText('notes', 'Lessons learned / catatan penutupan', p.notes);
  }
  fields += fText('gate_note', `Catatan proses ${gate} (keputusan, hasil review, gap)`, note ? note.note : '');
  modal(`Edit Gate ${gate === 'CLOSED' ? 'Selesai' : gate}`, `<p class="small muted">${GATE_DESC[gate]}</p><div class="form-grid">${fields}</div>`,
    async (data, ov) => {
      const proj = { ...data };
      delete proj.gate_note;
      if (Object.keys(proj).length) await api(`/api/projects/${p.id}`, 'PUT', proj);
      await api(`/api/projects/${p.id}/gate_notes/${gate}`, 'PUT', { note: data.gate_note });
      ov.remove();
      renderProject(p.id);
    }, 'Simpan perubahan');
}

async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(path, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Kesalahan server'); e.status = res.status; e.gaps = data.gaps; throw e; }
  return data;
}

function badge(cls, text) { return `<span class="badge b-${esc(cls)}">${esc(text)}</span>`; }
function gateBadge(g) { return badge(g, g); }
function trackBadge(t) { return t === 'first_responder' ? badge('first_responder', 'First Responder') : badge('buffer', 'Buffer'); }
function statusBadge(st) { return badge(st, { active: 'Aktif', pending: 'Pending', blocked: 'Blocked', closed: 'Selesai' }[st] || st); }
function kindBadge(k) { return badge('kind', k.charAt(0).toUpperCase() + k.slice(1)); }

function modal(title, bodyHtml, onSubmit, submitLabel = 'Simpan') {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${esc(title)}</h2><form id="modalForm">${bodyHtml}
    <div class="actions"><button type="button" class="btn ghost" id="mCancel">Batal</button>
    <button type="submit" class="btn">${esc(submitLabel)}</button></div></form></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#mCancel').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.querySelector('#modalForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    ov.querySelectorAll('input[type=checkbox][data-send]').forEach(cb => { data[cb.name] = cb.checked ? 1 : 0; });
    try { await onSubmit(data, ov); } catch (err) { alert(err.message); }
  };
  return ov;
}
const fInput = (name, label, val = '', type = 'text', extra = '') =>
  `<div><label>${label}</label><input name="${name}" type="${type}" value="${esc(val)}" ${extra}></div>`;
const fSelect = (name, label, opts, val = '', extra = '') =>
  `<div><label>${label}</label><select name="${name}" ${extra}>${opts.map(o =>
    `<option value="${esc(o[0])}" ${o[0] === val ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></div>`;
const fText = (name, label, val = '', extra = '') =>
  `<div class="full"><label>${label}</label><textarea name="${name}" rows="3" ${extra}>${esc(val)}</textarea></div>`;
const fCheck = (name, label, checked = false) =>
  `<div class="full" style="margin-top:10px"><label style="display:flex;gap:8px;align-items:center;color:var(--txt)">
   <input type="checkbox" name="${name}" data-send="1" ${checked ? 'checked' : ''} style="width:auto"> ${label}</label></div>`;

const PROC_OPTS = [
  ['', '— tidak ada / tidak berlaku —'],
  ['PKDF', 'PKDF (paling lambat 2 bulan)'],
  ['Justifikasi Kontrak Lumsum', 'Justifikasi Kontrak Lumsum (1,5 bulan)'],
  ['Surat Pesanan dengan new item', 'SP dengan new item (1 bulan)'],
  ['Surat Pesanan tanpa new item', 'SP tanpa new item (2 minggu)'],
];
const BUDGET_OPTS = [['belum_diajukan', 'Belum diajukan'], ['diajukan', 'Diajukan'], ['disetujui', 'Disetujui & tersedia']];
const ONB_OPTS = [['belum_mulai', 'Belum mulai'], ['berjalan', 'Sedang berjalan'], ['selesai', 'Selesai']];

function projectForm(p = {}) {
  const isEdit = !!p.id;
  return `<div class="form-grid">
    ${fInput('name', 'Nama proyek / penugasan *', p.name)}
    ${fInput('customer_cfu', 'Customer / CFU', p.customer_cfu)}
    ${fInput('tribe_unit', 'Tribe / Unit', p.tribe_unit)}
    ${fInput('business_owner', 'Business Owner', p.business_owner)}
    ${fInput('pm', 'Project Manager', p.pm)}
    ${isEdit ? '' : fSelect('track', 'Jalur Shared Service *', [['first_responder', 'First Responder — proyek baru / setup'], ['buffer', 'Buffer — proyek existing / dukungan eksekusi']], p.track)}
    ${isEdit ? '' : fSelect('project_type', 'Jenis proyek *', [['new', 'Proyek baru'], ['existing', 'Proyek existing']], p.project_type)}
    ${fInput('reason_shared_service', 'Alasan penggunaan Shared Service', p.reason_shared_service)}
    ${fInput('nde_no', 'Nomor NDE', p.nde_no)}
    ${fInput('nde_date', 'Tanggal NDE', p.nde_date, 'date')}
    ${fSelect('budget_status', 'Status anggaran', BUDGET_OPTS, p.budget_status || 'belum_diajukan')}
    ${fSelect('onboarding_status', 'Status onboarding / akses talent', ONB_OPTS, p.onboarding_status || 'belum_mulai')}
    ${fSelect('procurement_doc', 'Dokumen pengadaan', PROC_OPTS, p.procurement_doc)}
    ${fInput('procurement_target_start', 'Target mulai pekerjaan', p.procurement_target_start, 'date')}
    ${fInput('fte', 'Kebutuhan FTE', p.fte, 'text', 'placeholder="mis. 50%"')}
    ${fInput('start_date', 'Tanggal mulai penugasan', p.start_date, 'date')}
    ${fInput('end_date', 'Tanggal akhir penugasan', p.end_date, 'date')}
    <div id="bufferOnly" style="display:${p.track === 'buffer' || !isEdit ? 'contents' : 'none'}">
      ${fInput('bridging_end', 'Akhir masa bridging (Buffer)', p.bridging_end, 'date')}
      ${fCheck('bpom_case', 'Kasus khusus BPOM (SOP-07)', p.bpom_case)}
    </div>
    ${fText('definitive_plan', 'Rencana talent definitif / transisi', p.definitive_plan)}
    ${fText('notes', 'Catatan', p.notes)}
  </div>`;
}

function openIntake() {
  modal('Intake Proyek Baru — SOP-01', projectForm(), async (data, ov) => {
    const r = await api('/api/projects', 'POST', data);
    ov.remove();
    location.hash = `#/project/${r.id}`;
  }, 'Daftarkan Proyek');
}

function openEdit(p) {
  modal('Edit Data Proyek', projectForm(p), async (data, ov) => {
    await api(`/api/projects/${p.id}`, 'PUT', data);
    ov.remove();
    render();
  });
}

function kpiBar(pct) {
  if (pct === null || pct === undefined) return '<div class="bar"><i style="width:0"></i></div>';
  const cls = pct >= 80 ? '' : pct >= 50 ? 'warn' : 'bad';
  return `<div class="bar"><i class="${cls}" style="width:${pct}%"></i></div>`;
}

async function renderDashboard() {
  const [kpis, projects] = await Promise.all([api('/api/kpis'), api('/api/projects')]);
  const gates = ['G0', 'G1', 'G2A', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'];
  const byGate = {};
  gates.forEach(g => byGate[g] = []);
  projects.forEach(p => { (byGate[p.gate] || (byGate[p.gate] = [])).push(p); });

  const bpom = projects.find(p => p.bpom_case && p.status !== 'closed' && p.bridging_end);
  const bpomAlert = bpom ? (() => {
    const d = daysLeft(bpom.bridging_end);
    return `<div class="alert ${d !== null && d <= 30 ? 'red' : 'amber'}"><b>Kasus khusus BPOM (SOP-07) — ${esc(bpom.code)}</b>
      Bridging 50% FTE berakhir ${fmt(bpom.bridging_end)} (${d !== null && d < 0 ? 'SUDAH LEWAT' : `tersisa ${d} hari`}).
      Dukungan Buffer tidak boleh menjadi pemenuhan permanen; talent definitif oleh Tribe harus berjalan paralel.
      <a href="#/project/${bpom.id}" class="link">Buka proyek</a></div>`;
  })() : '';

  const kpiCards = [
    { l: 'Kesiapan administratif', v: kpis.admin_readiness_pct + '%', d: 'penugasan dengan NDE, anggaran & onboarding tercatat', p: kpis.admin_readiness_pct },
    { l: 'FR readiness', v: kpis.fr_readiness_pct === null ? '—' : kpis.fr_readiness_pct + '%', d: 'deliverable setup lengkap sebelum eksekusi', p: kpis.fr_readiness_pct },
    { l: 'Buffer tech readiness', v: kpis.buffer_tech_readiness_pct === null ? '—' : kpis.buffer_tech_readiness_pct + '%', d: 'prasyarat teknis + knowledge transfer selesai', p: kpis.buffer_tech_readiness_pct },
    { l: 'Kepatuhan laporan mingguan', v: kpis.weekly_reporting_compliance_pct === null ? '—' : kpis.weekly_reporting_compliance_pct + '%', d: 'laporan diterima 7 hari terakhir', p: kpis.weekly_reporting_compliance_pct },
    { l: 'Blocker terbuka', v: String(kpis.blockers_open), d: `rata-rata umur ${kpis.blocker_avg_age_days} hari · max ${kpis.blocker_max_age_days} hari`, p: null },
    { l: 'Kesiapan transisi', v: kpis.transition_ready_pct === null ? '—' : kpis.transition_ready_pct + '%', d: 'talent definitif terencana sebelum bridging berakhir', p: kpis.transition_ready_pct },
  ].map(k => `<div class="kpi"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="d">${k.d}</div>${kpiBar(k.p)}</div>`).join('');

  const pipeline = gates.map(g => {
    const chips = byGate[g].map(p =>
      `<div class="chip"><a href="#/project/${p.id}">${esc(p.code)}</a><br><span class="muted small">${esc(p.name)}</span></div>`).join('');
    return `<div class="pcol"><h4>${GATE_LABELS[g]}</h4><div class="cnt">${byGate[g].length}</div>${chips}</div>`;
  }).join('<div class="arrow">→</div>');

  const blockerRows = kpis.blocker_list.map(b => `<tr>
    <td><a class="link" href="#/project/${b.project_id}">${esc(b.project_code)}</a></td>
    <td>${esc(b.title)}</td><td>${esc(b.owner) || '—'}</td><td>${fmt(b.due_date)}</td>
    <td><b>${b.age_days}</b> hari</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Tidak ada blocker terbuka</td></tr>';

  main.innerHTML = `
    <h1>Dashboard</h1>
    <p class="sub">Pantauan workflow bisnis project DDP — gate G0–G5, jalur First Responder &amp; Buffer.</p>
    ${bpomAlert}
    <div class="kpis">${kpiCards}</div>
    <div class="card"><h2>Pipeline Penugasan (Gate)</h2>
      <p class="small muted">G2A dan G2B adalah cabang alternatif: G2A untuk First Responder (proyek baru), G2B untuk Buffer (proyek existing). Nama gate adalah rancangan kontrol yang diusulkan.</p>
      <div class="pipeline">${pipeline}</div></div>
    <div class="card"><h2>Blocker Terbuka &amp; Umur (Blocker Aging)</h2>
      <table><thead><tr><th>Proyek</th><th>Judul</th><th>Owner</th><th>Due date</th><th>Umur</th></tr></thead>
      <tbody>${blockerRows}</tbody></table></div>`;
}

let filters = { track: '', gate: '', status: '' };

async function renderProjects() {
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const projects = await api('/api/projects' + (q ? '?' + q : ''));
  const rows = projects.map(p => {
    const warn = p.procurement && p.procurement.warning;
    return `<tr>
      <td><a class="link" href="#/project/${p.id}">${esc(p.code)}</a></td>
      <td><b>${esc(p.name)}</b>${p.bpom_case ? ' ' + badge('kind', 'BPOM') : ''}${warn ? `<div class="small" style="color:var(--red)">⚠ ${esc(warn)}</div>` : ''}</td>
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

  main.innerHTML = `
    <h1>Proyek &amp; Penugasan</h1>
    <p class="sub">Register proyek / resource request Shared Service DDP.</p>
    <div class="toolbar">
      <select id="fTrack"><option value="">Semua jalur</option>
        <option value="first_responder" ${filters.track === 'first_responder' ? 'selected' : ''}>First Responder</option>
        <option value="buffer" ${filters.track === 'buffer' ? 'selected' : ''}>Buffer</option></select>
      <select id="fGate"><option value="">Semua gate</option>
        ${Object.keys(GATE_LABELS).map(g => `<option value="${g}" ${filters.gate === g ? 'selected' : ''}>${GATE_LABELS[g]}</option>`).join('')}</select>
      <select id="fStatus"><option value="">Semua status</option>
        ${['active', 'pending', 'blocked', 'closed'].map(s2 => `<option value="${s2}" ${filters.status === s2 ? 'selected' : ''}>${{ active: 'Aktif', pending: 'Pending', blocked: 'Blocked', closed: 'Selesai' }[s2]}</option>`).join('')}</select>
      <div class="spacer"></div>
      <button class="btn" id="btnIntake">+ Intake Proyek (SOP-01)</button>
    </div>
    <div class="card" style="padding:6px 12px">
      <table><thead><tr><th>Kode</th><th>Nama</th><th>Customer/CFU</th><th>Jalur</th><th>Gate</th><th>Status</th><th>PM</th><th>Mulai</th><th>Akhir bridging</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  $('#fTrack').onchange = e => { filters.track = e.target.value; renderProjects(); };
  $('#fGate').onchange = e => { filters.gate = e.target.value; renderProjects(); };
  $('#fStatus').onchange = e => { filters.status = e.target.value; renderProjects(); };
  $('#btnIntake').onclick = openIntake;
  main.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = async () => {
    try { const r = await api(`/api/projects/${btn.dataset.edit}`); openEdit(r.project); }
    catch (err) { alert(err.message); }
  });
  main.querySelectorAll('[data-finish]').forEach(btn => btn.onclick = () => finishProject(btn.dataset.finish, btn.dataset.code));
  main.querySelectorAll('[data-reopen]').forEach(btn => btn.onclick = async () => {
    try { await api(`/api/projects/${btn.dataset.reopen}/reopen`, 'POST', {}); renderProjects(); }
    catch (err) { alert(err.message); }
  });
  main.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => deleteProject(btn.dataset.delete, btn.dataset.code));
}

function finishProject(id, code) {
  if (!confirm(`Tandai proyek ${code} sebagai SELESAI? Proyek akan keluar dari pipeline aktif dan masuk ke arsip selesai.`)) return;
  api(`/api/projects/${id}/close`, 'POST', {})
    .then(() => { location.hash = '#/dashboard'; })
    .catch(err => alert(err.message));
}

function deleteProject(id, code) {
  if (!confirm(`Hapus permanen proyek ${code} beserta seluruh deliverable, laporan mingguan, RAID dan log aktivitasnya?`)) return;
  api(`/api/projects/${id}`, 'DELETE')
    .then(() => { location.hash = '#/dashboard'; })
    .catch(err => alert(err.message));
}

async function renderProject(id) {
  const d = await api(`/api/projects/${id}`);
  const p = d.project;
  const gatePath = p.track === 'first_responder' ? ['G0', 'G1', 'G2A', 'G3', 'G4', 'G5', 'CLOSED'] : ['G0', 'G1', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'];
  const stepper = gatePath.map(g => {
    const ci = gatePath.indexOf(p.gate);
    const cls = gatePath.indexOf(g) < ci ? 'done' : g === p.gate ? 'current' : '';
    return `<span class="step ${cls}" data-gate="${g}" role="button" tabindex="0" title="${esc(GATE_DESC[g])}">${g === 'CLOSED' ? 'SELESAI' : g}</span>`;
  }).join('<span class="arrow">→</span>');

  const proc = d.procurement || {};
  const procWarn = proc.warning ? `<div class="alert red"><b>Pengingat tenggat pengadaan</b>${esc(proc.warning)}</div>` : '';
  const procInfo = proc.doc ? `<div class="alert blue"><b>Pengadaan: ${esc(proc.doc)}</b>
    Batas pengajuan paling lambat <b>${fmt(proc.submit_by)}</b> (${proc.lead_days} hari sebelum mulai) — target mulai ${fmt(p.procurement_target_start)}.
    <span class="small">Rujukan: Pedoman Pelaksanaan Pengadaan Pasal 8 ayat (11) via Nota Dinas Shared Service.</span></div>` : '';

  const bridging = p.bridging_end ? (() => {
    const dl = daysLeft(p.bridging_end);
    const cls = dl < 0 ? 'late' : dl <= 21 ? 'soon' : '';
    return `<div class="infogrid" style="margin-top:8px"><div><b>Sisa masa bridging</b><span class="countdown ${cls}">${dl < 0 ? 'Berakhir' : dl + ' hari'}</span></div></div>`;
  })() : '';

  const bpomPanel = p.bpom_case ? `<div class="card" style="border-left:4px solid var(--red)">
    <h2>Kasus Khusus BPOM — SOP-07</h2>
    <div class="infogrid">
      <div><b>Kebutuhan (Nota Dinas 7 Okt 2026)</b><span>70% FTE Delivery selama 3 bulan + 30% FTE fase Manage Service</span></div>
      <div><b>Dukungan DPS</b><span>50% FTE melalui Tim Buffer (dukungan sementara)</span></div>
      <div><b>Periode bridging</b><span>${fmt(p.start_date)} – ${fmt(p.bridging_end)} · maksimal 4 minggu</span></div>
      <div><b>Pemenuhan definitif</b><span>${esc(p.definitive_plan) || 'Belum dicatat'}</span></div>
    </div>${bridging}
    <div class="alert amber" style="margin-top:12px"><b>Titik kontrol kritis</b>
      Dukungan Buffer 50% FTE <u>tidak boleh</u> menjadi pemenuhan permanen atas kebutuhan PM. Rencana pemenuhan definitif oleh Tribe
      harus berjalan paralel; status pengganti, tanggal efektif, handover dan risiko dibahas sebelum masa bridging berakhir.
      Evaluasi minimal setelah 1 bulan (load activity talent/Tribe/Unit dan dokumen standar Chapter).</div></div>` : '';

  const gateGaps = d.gate_info;
  const nextGate = gateGaps.next;
  const advanceBox = nextGate ? `<div class="card">
    <h2>Kontrol Gate — ${GATE_LABELS[p.gate]}</h2>
    <p class="small muted">${GATE_DESC[p.gate]}</p>
    ${gateGaps.gaps.length ? `<div class="alert amber"><b>Syarat menuju ${nextGate} belum terpenuhi</b><ul class="gaplist">${gateGaps.gaps.map(g2 => `<li>${esc(g2)}</li>`).join('')}</ul>
      <div style="margin-top:10px"><button class="btn sm ghost" id="btnForce">Eskalasi &amp; tetap naik gate (catat gap)</button></div></div>`
      : `<div class="alert" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534"><b>Semua syarat menuju ${nextGate} terpenuhi</b></div>`}
    <button class="btn" id="btnAdvance">Naik ke ${nextGate} »</button>
  </div>` : '';

  const deliverables = (d.deliverables.length || p.track === 'first_responder') ? `<div class="card"><h2>Deliverable Setup — SOP-03 (First Responder)</h2>
    <p class="small muted">Deliverable wajib tersedia sebelum eksekusi proyek dimulai; gap dicatat dan dieskalasikan. Penyusun merujuk Nota Dinas Shared Service butir 5.a. Daftar bisa disesuaikan dengan kebutuhan proyek.</p>
    <button class="btn sm" id="btnAddDeliv">+ Tambah deliverable</button>
    <table style="margin-top:10px"><thead><tr><th>Deliverable</th><th>Penyusun</th><th>Status</th><th>Evidence / link</th><th>Reviewer</th><th>Due</th><th></th></tr></thead><tbody>
    ${d.deliverables.map(dl => `<tr data-del="${dl.id}">
      <td><input data-k="name" value="${esc(dl.name)}" style="width:190px"></td>
      <td><input data-k="owner_role" value="${esc(dl.owner_role)}" style="width:160px"></td>
      <td><select data-k="status">${['belum_mulai', 'dalam_proses', 'review', 'disetujui'].map(s2 => `<option value="${s2}" ${dl.status === s2 ? 'selected' : ''}>${{ belum_mulai: 'Belum mulai', dalam_proses: 'Dalam proses', review: 'Review', disetujui: 'Disetujui' }[s2]}</option>`).join('')}</select></td>
      <td><input data-k="evidence_url" value="${esc(dl.evidence_url)}" placeholder="link evidence" style="width:170px"></td>
      <td><input data-k="reviewed_by" value="${esc(dl.reviewed_by)}" placeholder="reviewer" style="width:120px"></td>
      <td><input data-k="due_date" type="date" value="${esc(dl.due_date)}" style="width:140px"></td>
      <td><button class="btn sm ghost" data-save="${dl.id}">Simpan</button>
        <button class="btn sm ghost danger" data-del-deliv="${dl.id}" data-name="${esc(dl.name)}">Hapus</button></td></tr>`).join('')
      || '<tr><td colspan="7" class="muted small">Belum ada deliverable.</td></tr>'}
    </tbody></table></div>` : '';

  const bufferChecks = (d.buffer_checks.length || p.track === 'buffer') ? `<div class="card"><h2>Prasyarat Teknis Buffer — SOP-04 (Gate B1–B3)</h2>
    <p class="small muted">Buffer hanya dimobilisasi dengan prasyarat administratif dan teknis yang jelas serta handover knowledge. Daftar bisa disesuaikan dengan kebutuhan proyek.</p>
    <button class="btn sm" id="btnAddBuffer">+ Tambah prasyarat</button>
    <table class="checklist" style="margin-top:10px"><thead><tr><th></th><th>Prasyarat</th><th>Evidence</th><th>Verifikator</th><th></th></tr></thead><tbody>
    ${d.buffer_checks.map(c => `<tr>
      <td><input type="checkbox" data-verify="${c.id}" ${c.verified ? 'checked' : ''}></td>
      <td><input data-bk="item" data-id="${c.id}" value="${esc(c.item)}" style="width:300px">${c.verified_at ? `<div class="small muted">Diverifikasi ${fmt(c.verified_at)}</div>` : ''}</td>
      <td><input data-bk="evidence" data-id="${c.id}" value="${esc(c.evidence)}" placeholder="bukti" style="width:170px"></td>
      <td><input data-bk="verified_by" data-id="${c.id}" value="${esc(c.verified_by)}" style="width:120px"></td>
      <td><button class="btn sm ghost" data-bsave="${c.id}">Simpan</button>
        <button class="btn sm ghost danger" data-del-buffer="${c.id}" data-name="${esc(c.item)}">Hapus</button></td></tr>`).join('')
      || '<tr><td colspan="5" class="muted small">Belum ada prasyarat.</td></tr>'}
    </tbody></table></div>` : '';

  const reportRows = d.reports.map(r => `<tr>
    <td><b>${esc(r.period)}</b><div class="small muted">${fmt(r.submitted_at)} · ${esc(r.submitted_by)}</div></td>
    <td>${esc(r.talent_info) || '—'}</td>
    <td class="small">${esc(r.planned) || '—'}</td>
    <td class="small">${esc(r.actual) || '—'}</td>
    <td class="small">${esc(r.blockers) || '—'}</td>
    <td>${r.evidence_url ? `<a class="link" href="${esc(r.evidence_url)}" target="_blank" rel="noopener">bukti</a>` : '—'}</td>
    <td>${r.pm_confirmed ? badge('disetujui', `OK · ${esc(r.pm_confirmed_by)}`) : `<button class="btn sm green" data-confirm="${r.id}">Konfirmasi PM</button>`}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Belum ada laporan mingguan.</td></tr>';

  const raidRows = d.risks.map(r => `<tr>
    <td>${kindBadge(r.kind)}</td>
    <td><b>${esc(r.title)}</b>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ''}</td>
    <td class="small">${esc(r.impact) || '—'}</td>
    <td>${esc(r.owner) || '<span class="muted">—</span>'}</td>
    <td>${fmt(r.due_date)}</td>
    <td>${r.escalated ? badge('open', 'eskalasi') : ''} ${badge(r.status === 'open' ? 'open' : 'closed', r.status === 'open' ? 'terbuka' : 'selesai')}</td>
    <td>${r.status === 'open' ? `<button class="btn sm ghost" data-close="${r.id}">Tutup</button>` : fmt(r.closed_at)}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Tidak ada item RAID.</td></tr>';

  const crRows = d.changes.map(c => `<tr>
    <td><b>${esc(c.title)}</b>${c.description ? `<div class="small muted">${esc(c.description)}</div>` : ''}</td>
    <td class="small">${esc(c.impact_assessment) || '—'}</td>
    <td>${esc(c.approver) || '—'}</td>
    <td>${badge(c.status === 'disetujui' ? 'disetujui' : c.status === 'ditolak' ? 'ditolak' : 'diajukan', c.status)}</td>
    <td>${c.status === 'diajukan' ? `<button class="btn sm green" data-cr="${c.id}" data-st="disetujui">Setujui</button>
      <button class="btn sm ghost" data-cr="${c.id}" data-st="ditolak">Tolak</button>` : fmt(c.decided_at)}</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Tidak ada change request.</td></tr>';

  const eventRows = d.events.map(e => `<tr><td class="small muted mono">${fmt(e.created_at)}</td><td>${e.gate ? gateBadge(e.gate) : ''}</td>
    <td><b>${esc(e.action)}</b>${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td><td class="small muted">${esc(e.actor)}</td></tr>`).join('');

  main.innerHTML = `
    <div class="toolbar"><a class="btn ghost sm" href="#/projects">← Daftar proyek</a></div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><h1>${esc(p.code)} — ${esc(p.name)} ${p.bpom_case ? badge('kind', 'BPOM') : ''}</h1>
      <p class="sub">${trackBadge(p.track)} ${gateBadge(p.gate)} ${statusBadge(p.status)} &nbsp; ${esc(p.customer_cfu)}</p></div>
      <div class="head-actions">
        <button class="btn ghost" id="btnEdit">Edit data</button>
        ${p.status === 'closed'
          ? '<button class="btn ghost" id="btnReopen">Buka kembali</button>'
          : '<button class="btn green" id="btnFinish">Tandai selesai</button>'}
        <button class="btn ghost danger" id="btnDelete">Hapus proyek</button>
      </div></div>
    ${procWarn}${procInfo}
    <div class="card"><h2>Posisi Gate</h2><div class="stepper">${stepper}</div>
      <p class="small muted" style="margin-top:10px">${GATE_DESC[p.gate]}</p>
      <div class="infogrid" style="margin-top:12px">
        <div><b>Business Owner</b><span>${esc(p.business_owner) || '—'}</span></div>
        <div><b>PM</b><span>${esc(p.pm) || '—'}</span></div>
        <div><b>Tribe / Unit</b><span>${esc(p.tribe_unit) || '—'}</span></div>
        <div><b>NDE</b><span>${esc(p.nde_no) || '—'} ${p.nde_date ? '· ' + fmt(p.nde_date) : ''}</span></div>
        <div><b>Anggaran</b><span>${esc(BUDGET_OPTS.find(o => o[0] === p.budget_status)?.[1] || p.budget_status)}</span></div>
        <div><b>Onboarding / akses</b><span>${esc(ONB_OPTS.find(o => o[0] === p.onboarding_status)?.[1] || p.onboarding_status)}</span></div>
        <div><b>FTE</b><span>${esc(p.fte) || '—'}</span></div>
        <div><b>Periode penugasan</b><span>${fmt(p.start_date)} – ${fmt(p.end_date)}</span></div>
      </div>
      ${p.reason_shared_service ? `<p class="small" style="margin-top:12px"><b>Alasan Shared Service:</b> ${esc(p.reason_shared_service)}</p>` : ''}
      ${p.definitive_plan ? `<p class="small" style="margin-top:4px"><b>Rencana definitif/transisi:</b> ${esc(p.definitive_plan)}</p>` : ''}
    </div>
    <div class="card"><h2>Riwayat Proses per Gate</h2>
      <p class="small muted">Klik salah satu gate pada bagan di atas untuk melihat kriteria, kesiapan dan jejak aktivitasnya. Data tiap gate bisa diubah sesuai kebutuhan proyek.</p>
      <button class="btn sm" id="btnGateEdit">Edit gate</button>
      <div id="gateDetail" style="margin-top:12px"></div></div>
    ${bpomPanel}
    ${advanceBox}
    ${deliverables}${bufferChecks}
    <div class="tabs">
      <div class="tab active" data-tab="report">Laporan Mingguan (${d.reports.length})</div>
      <div class="tab" data-tab="raid">RAID / Risiko &amp; Blocker (${d.risks.length})</div>
      <div class="tab" data-tab="cr">Change Request (${d.changes.length})</div>
      <div class="tab" data-tab="log">Log Aktivitas</div>
    </div>
    <div id="tabPanel"></div>`;

  const tabs = { report: renderTabReport, raid: renderTabRaid, cr: renderTabCR, log: renderTabLog };
  const panel = $('#tabPanel');
  function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    tabs[name](panel, d);
    bindRowActions();
  }
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
  showTab('report');

  const gateDetail = $('#gateDetail');
  let shownGate = p.gate;
  const btnGateEdit = $('#btnGateEdit');
  const showGate = g => {
    shownGate = g;
    document.querySelectorAll('.step').forEach(s2 => s2.classList.toggle('sel', s2.dataset.gate === g));
    gateDetail.innerHTML = gateDetailHtml(g, p, d, gatePath);
    btnGateEdit.textContent = `Edit gate ${g === 'CLOSED' ? 'Selesai' : g}`;
  };
  document.querySelectorAll('.step').forEach(s2 => {
    s2.onclick = () => showGate(s2.dataset.gate);
    s2.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showGate(s2.dataset.gate); } };
  });
  showGate(p.gate);
  if (btnGateEdit) btnGateEdit.onclick = () => openGateEditor(p, d, shownGate);

  if (advanceBox) {
    $('#btnAdvance').onclick = async () => {
      try { await api(`/api/projects/${p.id}/advance`, 'POST', { force: 0 }); renderProject(id); }
      catch (err) { if (err.gaps) { alert('Syarat gate belum terpenuhi:\n- ' + err.gaps.join('\n- ')); } else alert(err.message); }
    };
    const bf = $('#btnForce');
    if (bf) bf.onclick = async () => {
      if (!confirm('Naikkan gate dengan eskalasi? Gap akan dicatat pada log aktivitas.')) return;
      try { await api(`/api/projects/${p.id}/advance`, 'POST', { force: 1, note: 'eskalasi operator' }); renderProject(id); }
      catch (err) { alert(err.message); }
    };
  }
  const be = $('#btnEdit');
  if (be) be.onclick = () => openEdit(p);
  const bfin = $('#btnFinish');
  if (bfin) bfin.onclick = () => finishProject(p.id, p.code);
  const breopen = $('#btnReopen');
  if (breopen) breopen.onclick = async () => {
    try { await api(`/api/projects/${p.id}/reopen`, 'POST', {}); renderProject(id); }
    catch (err) { alert(err.message); }
  };
  const bdel = $('#btnDelete');
  if (bdel) bdel.onclick = () => deleteProject(p.id, p.code);

  main.querySelectorAll('[data-save]').forEach(btn => btn.onclick = async () => {
    const tr = btn.closest('tr');
    const body = {};
    tr.querySelectorAll('[data-k]').forEach(i => body[i.dataset.k] = i.value);
    await api(`/api/projects/${p.id}/deliverables/${btn.dataset.save}`, 'PUT', body);
    renderProject(id);
  });
  main.querySelectorAll('[data-bsave]').forEach(btn => btn.onclick = async () => {
    const cid = btn.dataset.bsave;
    const body = {};
    main.querySelectorAll(`[data-bk][data-id="${cid}"]`).forEach(i => body[i.dataset.bk] = i.value);
    body.verified = main.querySelector(`[data-verify="${cid}"]`).checked ? 1 : 0;
    await api(`/api/projects/${p.id}/buffer_checks/${cid}`, 'PUT', body);
    renderProject(id);
  });
  const addDeliv = $('#btnAddDeliv');
  if (addDeliv) addDeliv.onclick = () => modal('Tambah Deliverable', `<div class="form-grid">
      ${fInput('name', 'Nama deliverable *')}
      ${fInput('owner_role', 'Penyusun / role')}
      ${fInput('due_date', 'Due date', '', 'date')}
    </div>`, async (data, ov) => {
      await api(`/api/projects/${p.id}/deliverables`, 'POST', data);
      ov.remove(); renderProject(id);
    }, 'Tambah');
  main.querySelectorAll('[data-del-deliv]').forEach(btn => btn.onclick = async () => {
    if (!confirm(`Hapus deliverable "${btn.dataset.name}"?`)) return;
    await api(`/api/projects/${p.id}/deliverables/${btn.dataset.delDeliv}`, 'DELETE');
    renderProject(id);
  });
  const addBuffer = $('#btnAddBuffer');
  if (addBuffer) addBuffer.onclick = () => modal('Tambah Prasyarat Buffer', `<div class="form-grid">
      ${fInput('item', 'Nama prasyarat *')}
    </div>`, async (data, ov) => {
      await api(`/api/projects/${p.id}/buffer_checks`, 'POST', data);
      ov.remove(); renderProject(id);
    }, 'Tambah');
  main.querySelectorAll('[data-del-buffer]').forEach(btn => btn.onclick = async () => {
    if (!confirm(`Hapus prasyarat "${btn.dataset.name}"?`)) return;
    await api(`/api/projects/${p.id}/buffer_checks/${btn.dataset.delBuffer}`, 'DELETE');
    renderProject(id);
  });
  function bindRowActions() {
    main.querySelectorAll('[data-confirm]').forEach(btn => btn.onclick = async () => {
      const who = prompt('Nama PM yang mengonfirmasi:', p.pm || 'PM');
      if (who === null) return;
      await api(`/api/reports/${btn.dataset.confirm}/confirm`, 'PUT', { pm_confirmed_by: who });
      renderProject(id);
    });
    main.querySelectorAll('[data-close]').forEach(btn => btn.onclick = async () => {
      await api(`/api/risks/${btn.dataset.close}`, 'PUT', { status: 'closed' });
      renderProject(id);
    });
    main.querySelectorAll('[data-cr]').forEach(btn => btn.onclick = async () => {
      await api(`/api/changes/${btn.dataset.cr}`, 'PUT', { status: btn.dataset.st });
      renderProject(id);
    });
  }

  function renderTabReport(panelEl, data) {
    panelEl.innerHTML = `<div class="card"><h2>Weekly Report — SOP-05</h2>
      <p class="small muted">Format minimum: periode · talent/Chapter/role/FTE · aktivitas/WBS · rencana · realisasi · evidence · blocker/risiko · keputusan dibutuhkan · status akses · konfirmasi PM.</p>
      <button class="btn" id="btnAddReport">+ Laporan Mingguan</button>
      <table style="margin-top:12px"><thead><tr><th>Periode</th><th>Talent/FTE</th><th>Rencana</th><th>Realisasi</th><th>Blocker</th><th>Evidence</th><th>Konfirmasi PM</th></tr></thead>
      <tbody>${reportRows}</tbody></table></div>`;
    $('#btnAddReport').onclick = () => modal('Laporan Mingguan Baru — SOP-05', `<div class="form-grid">
      ${fInput('period', 'Periode * (mis. 2026-W43)', `2026-W${weekNumber()}`)}
      ${fInput('talent_info', 'Talent / Chapter / role / FTE', '')}
      ${fText('planned', 'Rencana (aktivitas/WBS)', '')}
      ${fText('actual', 'Realisasi / progres berbasis bukti', '')}
      ${fInput('evidence_url', 'Evidence / link', '')}
      ${fText('next_steps', 'Next steps', '')}
      ${fText('blockers', 'Blocker / risiko (owner, due date)', '')}
      ${fText('decisions_needed', 'Keputusan yang dibutuhkan', '')}
      ${fInput('access_status', 'Status akses / dokumen', '')}
      ${fInput('submitted_by', 'Disampaikan oleh', '')}
      </div>`, async (data, ov) => {
      await api(`/api/projects/${p.id}/reports`, 'POST', data);
      ov.remove(); renderProject(id);
    }, 'Kirim Laporan');
  }

  function renderTabRaid(panelEl, data) {
    panelEl.innerHTML = `<div class="card"><h2>Risk / Issue / Blocker / Dependency — SOP-05</h2>
      <p class="small muted">Setiap item memiliki deskripsi, dampak, owner, due date, mitigasi dan jalur eskalasi. Blocker yang mengancam milestone segera dieskalasikan ke PM dan pihak berwenang.</p>
      <button class="btn" id="btnAddRisk">+ Item RAID</button>
      <table style="margin-top:12px"><thead><tr><th>Jenis</th><th>Judul</th><th>Dampak</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead>
      <tbody>${raidRows}</tbody></table></div>`;
    $('#btnAddRisk').onclick = () => modal('Tambah Item RAID', `<div class="form-grid">
      ${fSelect('kind', 'Jenis *', [['risiko', 'Risiko'], ['isu', 'Isu'], ['blocker', 'Blocker'], ['dependensi', 'Dependensi']])}
      ${fInput('title', 'Judul *')}
      ${fText('description', 'Deskripsi')}
      ${fInput('impact', 'Dampak')}
      ${fInput('owner', 'Owner')}
      ${fInput('due_date', 'Due date', '', 'date')}
      ${fText('mitigation', 'Mitigasi')}
      ${fCheck('escalated', 'Segera dieskalasikan ke PM / pihak berwenang')}
      </div>`, async (data, ov) => {
      await api(`/api/projects/${p.id}/risks`, 'POST', data);
      ov.remove(); renderProject(id);
    });
  }

  function renderTabCR(panelEl, data) {
    panelEl.innerHTML = `<div class="card"><h2>Change Control — SOP-05</h2>
      <p class="small muted">Perubahan scope, timeline, biaya, resource atau komitmen dicatat; dampak dinilai; approval mengikuti kewenangan resmi sebelum baseline diperbarui.</p>
      <button class="btn" id="btnAddCR">+ Change Request</button>
      <table style="margin-top:12px"><thead><tr><th>Judul</th><th>Impact assessment</th><th>Approver</th><th>Status</th><th>Keputusan</th></tr></thead>
      <tbody>${crRows}</tbody></table></div>`;
    $('#btnAddCR').onclick = () => modal('Change Request Baru', `<div class="form-grid">
      ${fInput('title', 'Judul *')}
      ${fText('description', 'Deskripsi perubahan')}
      ${fText('impact_assessment', 'Penilaian dampak (scope/timeline/biaya/resource)')}
      ${fInput('approver', 'Approver sesuai kewenangan')}
      </div>`, async (data, ov) => {
      await api(`/api/projects/${p.id}/changes`, 'POST', data);
      ov.remove(); renderProject(id);
    });
  }

  function renderTabLog(panelEl, data) {
    panelEl.innerHTML = `<div class="card"><h2>Log Aktivitas &amp; Gate</h2>
      <table><thead><tr><th>Waktu</th><th>Gate</th><th>Aktivitas</th><th>Aktor</th></tr></thead><tbody>${eventRows}</tbody></table></div>`;
  }
}

function weekNumber() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
}

function renderReference() {
  main.innerHTML = `<div class="ref">
    <h1>Referensi SOP &amp; Workflow</h1>
    <p class="sub">Ringkasan Workflow Bisnis Project DDP Telkom — Revisi 3.0 (21 Oktober 2026), draft untuk validasi internal.</p>

    <div class="card"><h2>Dasar Aturan</h2>
      <ul>
        <li><b>Source-based</b> — ketentuan eksplisit Nota Dinas tidak diubah; rekomendasi proses diberi label usulan.</li>
        <li><b>Separate paths</b> — First Responder untuk setup proyek baru; Buffer untuk proyek existing/eksekusi yang membutuhkan dukungan sementara.</li>
        <li><b>Gate-based</b> — pekerjaan berpindah tahap setelah output wajib diperiksa dan evidence dicatat.</li>
        <li><b>Accountability</b> — setiap aktivitas memiliki owner, reviewer/approver, due date dan jalur eskalasi.</li>
        <li><b>Resource governance</b> — FTE, masa penugasan, onboarding, kapasitas Chapter dan rencana talent definitif dipantau.</li>
      </ul></div>

    <div class="card"><h2>Gate G0–G5</h2>
      <table><thead><tr><th>Gate</th><th>Isi / kriteria</th></tr></thead><tbody>
        ${Object.entries(GATE_DESC).map(([g, d]) => `<tr><td><b>${g === 'CLOSED' ? 'END' : g}</b></td><td>${d}</td></tr>`).join('')}
      </tbody></table>
      <p class="small muted">Nama gate G0–G5 dan B1–B4 adalah rancangan kontrol yang diusulkan, bukan nama gate resmi dalam Nota Dinas.</p></div>

    <div class="card"><h2>SOP-01 — Intake, Klasifikasi, dan Permintaan Shared Service</h2>
      <ol>
        <li>Catat project/customer, tujuan, target mulai, jenis kontrak, status procurement, scope awal dan kebutuhan role/FTE.</li>
        <li>Tentukan jalur: <b>First Responder</b> (presales-support / project setup / transisi awal pascakontrak) atau <b>Buffer</b> (eksekusi proyek berjalan dengan kontrak jelas).</li>
        <li>Susun kebutuhan talent, durasi, output, kapasitas dan risiko keterlambatan resource.</li>
        <li>Ajukan permintaan CFU melalui NDE.</li>
      </ol>
      <h3>Kontrol waktu pengadaan (sebelum pekerjaan dimulai)</h3>
      <table><thead><tr><th>Dokumen</th><th>Batas waktu</th></tr></thead><tbody>
        <tr><td>PKDF</td><td>Paling lambat 2 bulan</td></tr>
        <tr><td>Justifikasi kebutuhan — Kontrak Lumsum</td><td>Paling lambat 1,5 bulan</td></tr>
        <tr><td>Justifikasi — Surat Pesanan dengan new item</td><td>Paling lambat 1 bulan</td></tr>
        <tr><td>Justifikasi — Surat Pesanan tanpa new item</td><td>Paling lambat 2 minggu</td></tr>
      </tbody></table></div>

    <div class="card"><h2>SOP-02 — Verifikasi Administratif dan Mobilisasi Talent</h2>
      <ul>
        <li>Verifikasi NDE permintaan CFU (nomor, tanggal, ruang lingkup).</li>
        <li>Verifikasi anggaran disetujui dan tersedia di sistem keuangan.</li>
        <li>Pastikan onboarding talent berjalan: akses sistem, orientasi, hak akses.</li>
        <li>Chapter menilai kebutuhan vs kapasitas; tetapkan role, FTE, periode, scope, pelaporan.</li>
        <li>Koordinasikan talent dengan PM; catat gap administrasi dan eskalasi.</li>
      </ul>
      <p class="small muted">Kriteria G1: lanjut jika NDE tersedia, anggaran disetujui/tersedia, onboarding/akses berjalan; bila belum, status Pending/Blocked dan gap dieskalasikan.</p></div>

    <div class="card"><h2>SOP-03 — First Responder: Setup Proyek Baru</h2>
      <table><thead><tr><th>Deliverable</th><th>Penyusun</th></tr></thead><tbody>
        <tr><td>WBS</td><td>Project Manager</td></tr>
        <tr><td>BRD</td><td>PM dan/atau Business Analyst</td></tr>
        <tr><td>SAD</td><td>Solution Architect</td></tr>
        <tr><td>Workforce Plan</td><td>Solution Architect</td></tr>
        <tr><td>Initial Data Solution</td><td>Data Team</td></tr>
        <tr><td>Initial Design Documentation</td><td>Design Team</td></tr>
        <tr><td>Project Charter</td><td>Ditandatangani seluruh pemangku kepentingan</td></tr>
      </tbody></table></div>

    <div class="card"><h2>SOP-04 — Buffer: Dukungan Proyek Existing</h2>
      <ul>
        <li>BRD existing, SAD existing, repository/change log/user story: tersedia dan telah direview.</li>
        <li>Knowledge transfer dari tim sebelumnya selesai (MoM/handover checklist).</li>
        <li>Scope/timeline/kapasitas (role, FTE, periode, task) disepakati; akses dokumentasi diperoleh.</li>
        <li>Weekly progress ke PM setiap minggu; risiko/blocker dilaporkan sedini mungkin (RAID log).</li>
        <li>Sebelum masa penugasan berakhir: serah terima hasil, isu residual, transisi ke tim definitif/operasi.</li>
      </ul>
      <p class="small muted">Gate Buffer usulan: B1 administratif; B2 teknis/knowledge transfer; B3 mobilisasi; B4 exit/transition.</p></div>

    <div class="card"><h2>SOP-05 — Delivery Control, QA, Perubahan, dan Eskalasi</h2>
      <ul>
        <li><b>Rencana kerja</b> — WBS, milestone, planned/actual, owner, dependency, baseline.</li>
        <li><b>Weekly progress</b> — selesai vs rencana, next-week plan, evidence, blocker, risiko, keputusan.</li>
        <li><b>QA dan kualitas</b> — Chapter menyiapkan evidence; QA/reviewer memeriksa sesuai standar.</li>
        <li><b>Change control</b> — perubahan dicatat, dampak dinilai, approval sesuai kewenangan sebelum baseline berubah.</li>
        <li><b>RAID</b> — deskripsi, dampak, owner, due date, mitigasi, jalur eskalasi.</li>
        <li><b>Security/kerahasiaan</b> — akses berbasis kebutuhan; patuhi aturan keamanan, kerahasiaan dan PDP.</li>
        <li><b>Eskalasi</b> — blocker yang mengancam milestone/akses/kualitas/komitmen segera ke PM dan pihak berwenang.</li>
      </ul></div>

    <div class="card"><h2>SOP-06 — Acceptance, Handover, dan Penutupan</h2>
      <ul>
        <li>Inventarisasi deliverable selesai/belum; testing/QA/acceptance sesuai kontrak, scope, standar dan risiko.</li>
        <li>Isu residual: owner, due date dan keputusan formal.</li>
        <li>Handover dokumentasi, akses, konfigurasi/as-built/manual bila diwajibkan; BAPP/BAST sesuai kontrak.</li>
        <li>Tutup penugasan; pastikan talent definitif/operasional ditangani; evaluasi load activity dan lessons learned.</li>
      </ul></div>

    <div class="card"><h2>SOP-07 — Kasus Penugasan Buffer PM BPOM</h2>
      <ul>
        <li>Kebutuhan: 70% FTE Delivery selama 3 bulan + 30% FTE fase Manage Service.</li>
        <li>Dukungan DPS: 50% FTE melalui Tim Buffer sebagai dukungan sementara.</li>
        <li>Periode: 7 Oktober – 6 November 2026; maksimal 4 minggu bridging.</li>
        <li>Pemenuhan definitif oleh Tribe berjalan paralel; penugasan dapat disesuaikan sesuai kewenangan Chapter.</li>
        <li>Evaluasi minimal setelah 1 bulan: load activity talent/Tribe/Unit dan dokumen standar Chapter.</li>
        <li><b>Titik kontrol:</b> Buffer 50% FTE bukan pemenuhan permanen.</li>
      </ul></div>

    <div class="card"><h2>RACI Ringkas (usulan)</h2>
      <table><thead><tr><th>Aktivitas</th><th>R</th><th>A / approval</th><th>C / I</th></tr></thead><tbody>
        <tr><td>NDE &amp; kebutuhan resource</td><td>Pemohon/CFU dan Tribe</td><td>Pihak berwenang sesuai SOP</td><td>Chapter, PM, Finance/Procurement</td></tr>
        <tr><td>Deliverable First Responder</td><td>PM/BA/SA/Data/Design</td><td>Reviewer/approver sesuai governance</td><td>Stakeholder dan Chapter</td></tr>
        <tr><td>Prasyarat Buffer</td><td>PM/SA/tim sebelumnya dan talent Buffer</td><td>Chapter/PM sesuai kewenangan</td><td>Tribe, reviewer teknis</td></tr>
        <tr><td>Weekly report &amp; blocker</td><td>Talent Buffer; PM konsolidasi</td><td>PM/Chapter</td><td>Tribe/Chapter terkait</td></tr>
        <tr><td>Acceptance/closure</td><td>Chapter pelaksana dan PM</td><td>Pihak berwenang/customer sesuai kontrak</td><td>QA/SME/operasi</td></tr>
        <tr><td>Evaluasi talent/dokumen</td><td>Chapter Management</td><td>Pimpinan Chapter</td><td>Tribe/PM/talent</td></tr>
      </tbody></table>
      <p class="small muted">Accountable/approver wajib dikonfirmasi dengan matriks kewenangan resmi.</p></div>

    <div class="card"><h2>KPI Pilot</h2>
      <ul>
        <li><b>Readiness administratif</b> — % penugasan dengan NDE, anggaran dan onboarding tercatat.</li>
        <li><b>Buffer technical readiness</b> — % Buffer dengan BRD/SAD/repo/change log/user story direview dan KT selesai.</li>
        <li><b>Weekly reporting compliance</b> — % laporan mingguan diterima sesuai jadwal.</li>
        <li><b>Blocker aging</b> — jumlah blocker terbuka dan umur penyelesaian.</li>
        <li><b>First Responder readiness</b> — % proyek dengan deliverable setup lengkap sebelum eksekusi.</li>
        <li><b>Transition readiness</b> — status pemenuhan talent definitif sebelum bridging berakhir.</li>
        <li><b>Chapter document review</b> — status review load activity dan dokumen standar Chapter.</li>
      </ul></div>

    <div class="card"><h2>Sumber</h2>
      <ul>
        <li>Nota Dinas C.Tel.28/YN 000/DDP-B0000000/2026, 30 April 2026 — Pembentukan dan Implementasi Tim Shared Service.</li>
        <li>Nota Dinas C.Tel.87/PS 000/DDP-B0200000/2026, 7 Oktober 2026 — Penugasan Buffer Chapter DPS untuk BPOM.</li>
      </ul>
      <p class="small muted">Draft untuk validasi internal; tidak menggantikan ketentuan resmi perusahaan, SOP pengadaan, kontrak, atau matriks kewenangan.</p></div>
  </div>`;
}

async function render() {
  document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active',
    (location.hash.startsWith('#/dashboard') || location.hash === '' || location.hash === '#') && a.hash === '#/dashboard' ||
    location.hash.startsWith('#/projects') && a.hash === '#/projects' ||
    location.hash.startsWith('#/reference') && a.hash === '#/reference'));
  const h = location.hash || '#/dashboard';
  try {
    if (h.startsWith('#/project/')) await renderProject(h.split('/')[2]);
    else if (h.startsWith('#/projects')) await renderProjects();
    else if (h.startsWith('#/reference')) renderReference();
    else await renderDashboard();
  } catch (err) {
    main.innerHTML = `<div class="alert red"><b>Gagal memuat</b>${esc(err.message)}</div>`;
  }
}

window.addEventListener('hashchange', render);
render();
