import { api } from '../api.js';
import { $, $$, esc, fmt, daysLeft, filled, weekNumber, safeUrl, isSafeUrl } from '../utils.js';
import { stateBox, STATE, toast } from '../state.js';
import { getContent } from '../content.js';
import { getRoute, setParams, navigate } from '../router.js';
import { gateBadge, trackBadge, statusBadge, kindBadge, badge, modal, confirmDialog, projectForm, safeLink, stepper, tableScroll, bindTablist } from '../components.js';
import { openEdit } from './projects.js';

const TABS = ['report', 'raid', 'cr', 'log'];
const DELIV_STATUS_LABELS = { belum_mulai: 'Belum mulai', dalam_proses: 'Dalam proses', review: 'Review', disetujui: 'Disetujui' };
const BUDGET_LABELS = { belum_diajukan: 'Belum diajukan', diajukan: 'Diajukan', disetujui: 'Disetujui & tersedia' };
const ONB_LABELS = { belum_mulai: 'Belum mulai', berjalan: 'Sedang berjalan', selesai: 'Selesai' };

export async function renderProject(container) {
  const { parts, params } = getRoute();
  const id = parts[1];
  if (!id || !/^[0-9]+$/.test(id)) {
    container.innerHTML = stateBox({ state: STATE.error, error: { message: 'ID proyek tidak valid.' } });
    return;
  }

  container.innerHTML = stateBox({ state: STATE.loading });

  let data;
  try {
    data = await api(`/api/projects/${id}`);
  } catch (err) {
    container.innerHTML = stateBox({ state: STATE.error, error: err });
    return;
  }

  const content = getContent();
  const p = data.project;
  const gatePath = content.gates.gates?.[p.track] || [];
  const gateLabels = content.gates.labels;
  const gateDesc = content.gates.descriptions;
  const shownGate = gatePath.includes(params.get('gate')) ? params.get('gate') : p.gate;
  const shownTab = TABS.includes(params.get('tab')) ? params.get('tab') : 'report';

  const proc = data.procurement || {};
  const procWarn = proc.warning ? `<div class="alert red" role="alert"><b>Pengingat tenggat pengadaan</b>${esc(proc.warning)}</div>` : '';
  const procInfo = proc.doc ? `<div class="alert blue"><b>Pengadaan: ${esc(proc.doc)}</b>
    Batas pengajuan paling lambat <b>${fmt(proc.submit_by)}</b> (${proc.lead_days} hari sebelum mulai) — target mulai ${fmt(p.procurement_target_start)}.
    <span class="small">Rujukan: Pedoman Pelaksanaan Pengadaan Pasal 8 ayat (11) via Nota Dinas Shared Service.</span></div>` : '';

  const bpomPanel = p.bpom_case ? renderBpomPanel(p, content.bpom) : '';
  const advanceBox = renderAdvanceBox(p, data.gate_info);
  const deliverables = renderDeliverables(data, p, id);
  const bufferChecks = renderBufferChecks(data, p, id);

  container.innerHTML = `
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
    <div class="card"><h2>Posisi Gate</h2>
      <div id="stepperWrap">${stepper({ gates: gatePath, current: p.gate, selected: shownGate, labels: gateLabels, descriptions: gateDesc })}</div>
      <p class="small muted" style="margin-top:10px">${esc(gateDesc[p.gate] || '')}</p>
      <div class="infogrid" style="margin-top:12px">
        <div><b>Business Owner</b><span>${esc(p.business_owner) || '—'}</span></div>
        <div><b>PM</b><span>${esc(p.pm) || '—'}</span></div>
        <div><b>Tribe / Unit</b><span>${esc(p.tribe_unit) || '—'}</span></div>
        <div><b>NDE</b><span>${esc(p.nde_no) || '—'} ${p.nde_date ? '· ' + fmt(p.nde_date) : ''}</span></div>
        <div><b>Anggaran</b><span>${esc(BUDGET_LABELS[p.budget_status] || p.budget_status)}</span></div>
        <div><b>Onboarding / akses</b><span>${esc(ONB_LABELS[p.onboarding_status] || p.onboarding_status)}</span></div>
        <div><b>FTE</b><span>${esc(p.fte) || '—'}</span></div>
        <div><b>Periode penugasan</b><span>${fmt(p.start_date)} – ${fmt(p.end_date)}</span></div>
      </div>
      ${p.reason_shared_service ? `<p class="small" style="margin-top:12px"><b>Alasan Shared Service:</b> ${esc(p.reason_shared_service)}</p>` : ''}
      ${p.definitive_plan ? `<p class="small" style="margin-top:4px"><b>Rencana definitif/transisi:</b> ${esc(p.definitive_plan)}</p>` : ''}
    </div>
    <div class="card"><h2>Riwayat Proses per Gate</h2>
      <p class="small muted">Pilih gate pada bagan di atas untuk melihat kriteria, kesiapan dan jejak aktivitasnya. Data tiap gate bisa diubah sesuai kebutuhan proyek.</p>
      <button class="btn sm" id="btnGateEdit">Edit gate ${shownGate === 'CLOSED' ? 'Selesai' : shownGate}</button>
      <div id="gateDetail" role="tabpanel" aria-labelledby="gate-tab-${esc(shownGate)}" style="margin-top:12px"></div></div>
    ${bpomPanel}
    ${advanceBox}
    ${deliverables}${bufferChecks}
    <div class="tabs" role="tablist" aria-label="Tab detail proyek">
      <button type="button" class="tab ${shownTab === 'report' ? 'active' : ''}" id="tab-report" data-tab="report" role="tab" aria-controls="tabPanel" aria-selected="${shownTab === 'report' ? 'true' : 'false'}" tabindex="${shownTab === 'report' ? 0 : -1}">Laporan Mingguan (${data.reports.length})</button>
      <button type="button" class="tab ${shownTab === 'raid' ? 'active' : ''}" id="tab-raid" data-tab="raid" role="tab" aria-controls="tabPanel" aria-selected="${shownTab === 'raid' ? 'true' : 'false'}" tabindex="${shownTab === 'raid' ? 0 : -1}">RAID / Risiko &amp; Blocker (${data.risks.length})</button>
      <button type="button" class="tab ${shownTab === 'cr' ? 'active' : ''}" id="tab-cr" data-tab="cr" role="tab" aria-controls="tabPanel" aria-selected="${shownTab === 'cr' ? 'true' : 'false'}" tabindex="${shownTab === 'cr' ? 0 : -1}">Change Request (${data.changes.length})</button>
      <button type="button" class="tab ${shownTab === 'log' ? 'active' : ''}" id="tab-log" data-tab="log" role="tab" aria-controls="tabPanel" aria-selected="${shownTab === 'log' ? 'true' : 'false'}" tabindex="${shownTab === 'log' ? 0 : -1}">Log Aktivitas</button>
    </div>
    <div id="tabPanel" role="tabpanel" aria-labelledby="tab-${esc(shownTab)}"></div>`;

  const tabs = { report: renderTabReport, raid: renderTabRaid, cr: renderTabCR, log: renderTabLog };
  const panel = $('#tabPanel');
  let currentGate = shownGate;
  let currentTab = shownTab;

  function showTab(name) {
    currentTab = name;
    $$('.tab').forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      t.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `tab-${name}`);
    tabs[name](panel, data, id);
    bindRowActions(id, p);
    updateParams({ gate: currentGate, tab: name });
  }
  $$('.tab').forEach(t => t.onclick = () => showTab(t.dataset.tab));
  bindTablist($('.tabs'));

  function updateParams(base) {
    setParams(base);
  }

  const gateDetail = $('#gateDetail');
  function showGate(g) {
    currentGate = g;
    updateParams({ gate: g, tab: currentTab });
    gateDetail.innerHTML = renderGateDetail({ g, p, data, gatePath, gateLabels, gateDesc, content });
    gateDetail.setAttribute('aria-labelledby', `gate-tab-${g}`);
    $$('.step').forEach(s2 => {
      const on = s2.dataset.gate === g;
      s2.classList.toggle('sel', on);
      s2.setAttribute('aria-selected', on ? 'true' : 'false');
      s2.tabIndex = on ? 0 : -1;
    });
    const editBtn = $('#btnGateEdit');
    if (editBtn) {
      editBtn.textContent = `Edit gate ${g === 'CLOSED' ? 'Selesai' : g}`;
      editBtn.onclick = () => openGateEditor(p, data, g, content, () => showGate(g));
    }
  }
  $$('.step').forEach(s2 => s2.onclick = () => showGate(s2.dataset.gate));
  bindTablist($('.stepper'));
  showGate(shownGate);

  $('#btnEdit').onclick = () => { openEdit(p, refreshProject); };
  const finishBtn = $('#btnFinish');
  if (finishBtn) finishBtn.onclick = () => {
    modal({
      title: `Tutup proyek ${p.code}`,
      submitLabel: 'Tandai selesai',
      body: `<div class="form-grid">
        <div><label for="c_bast">Nomor BAST *</label><input id="c_bast" name="bast_no" required></div>
        <div><label for="c_bast_date">Tanggal BAST</label><input id="c_bast_date" name="bast_date" type="date"></div>
        <div class="full"><label for="c_ev">Evidence acceptance (URL) *</label><input id="c_ev" name="acceptance_evidence" required></div>
        <div class="full"><label for="c_eval">Evaluasi penutupan</label><textarea id="c_eval" name="closure_evaluation" rows="2"></textarea></div>
      </div>`,
      onSubmit: async (data, close) => {
        await api(`/api/projects/${id}/close`, 'POST', data);
        close();
        navigate('/dashboard');
        toast('Proyek ditutup dengan BAST.');
      }
    });
  };
  const reopenBtn = $('#btnReopen');
  if (reopenBtn) reopenBtn.onclick = async () => {
    await api(`/api/projects/${id}/reopen`, 'POST', {});
    refreshProject();
    toast('Proyek dibuka kembali.');
  };
  $('#btnDelete').onclick = () => {
    confirmDialog({
      title: 'Hapus proyek',
      message: `Hapus proyek ${p.code}? Data akan dihapus secara logis dan tetap dapat diaudit.`,
      danger: true,
      onConfirm: async () => { await api(`/api/projects/${id}`, 'DELETE'); navigate('/dashboard'); toast('Proyek dihapus.'); }
    });
  };

  bindAdvanceActions(id, data.gate_info);
  bindDeliverableActions(id, () => renderProject(container));
  bindBufferActions(id, p, () => renderProject(container));
  showTab(shownTab);
}

function renderGateDetail({ g, p, data, gatePath, gateLabels, gateDesc }) {
  const evs = (data.events || []).filter(e => e.gate === g).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const curIdx = gatePath.indexOf(p.gate);
  const idx = gatePath.indexOf(g);
  let state;
  if (g === p.gate) state = g === 'CLOSED' ? 'Gate akhir — penugasan selesai' : 'Gate saat ini';
  else if (idx < curIdx) state = 'Sudah dilalui';
  else state = 'Belum dilalui';

  const entered = evs.length ? evs[0].created_at : '';
  const note = (data.gate_notes || []).find(n => n.gate === g);
  const gateInfo = data.gate_info || {};

  let criteriaHtml = '';
  if (g === p.gate && gateInfo.gaps) {
    if (gateInfo.gaps.length) {
      criteriaHtml = `<ul class="criterialist">${gateInfo.gaps.map(gap => `<li class="no"><span class="mk">✗</span> ${esc(gap)}</li>`).join('')}</ul>`;
    } else if (gateInfo.next) {
      criteriaHtml = `<div class="alert" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534" role="status"><b>Semua syarat menuju ${gateInfo.next} terpenuhi</b></div>`;
    } else {
      criteriaHtml = `<div class="alert" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534" role="status"><b>Gate akhir</b></div>`;
    }
  } else {
    criteriaHtml = `<p class="muted small">Gate ini ${idx < curIdx ? 'sudah dilewati' : 'belum dilalui'}. Detail gap hanya ditampilkan untuk gate saat ini.</p>`;
  }

  const history = evs.map(e => `<li><span class="mono muted">${fmt(e.created_at)}</span> — <b>${esc(e.action)}</b>${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}<span class="small muted">${esc(e.actor)}</span></li>`).join('')
    || '<li class="muted small">Belum ada aktivitas tercatat pada gate ini.</li>';

  return `<div class="infogrid" style="margin-bottom:12px">
      <div><b>Status gate</b><span>${esc(state)}</span></div>
      <div><b>Masuk gate</b><span>${entered ? fmt(entered) : '—'}</span></div>
      <div><b>Aktivitas tercatat</b><span>${evs.length} entri</span></div>
    </div>
    <p class="small muted">${esc(gateDesc[g] || '')}</p>
    <h3>Kriteria &amp; kesiapan</h3>${criteriaHtml}
    <h3>Catatan proses gate</h3>
    <p class="small">${note && filled(note.note) ? esc(note.note) : '<span class="muted">Belum ada catatan.</span>'}</p>
    <h3>Jejak proses gate</h3><ul class="gatehistory">${history}</ul>`;
}

function renderAdvanceBox(p, gateInfo) {
  if (!gateInfo || !gateInfo.next) return '';
  const next = gateInfo.next;
  const hasGaps = (gateInfo.gaps || []).length > 0;
  return `<div class="card">
    <h2>Kontrol Gate</h2>
    ${hasGaps
      ? `<div class="alert amber"><b>Syarat menuju ${next} belum terpenuhi</b><ul class="gaplist">${gateInfo.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul>
        <div style="margin-top:10px"><button class="btn sm ghost" id="btnForce" aria-describedby="force-desc">Eskalasi &amp; tetap naik gate</button>
        <p id="force-desc" class="small muted">Force advance mencatat semua gap yang ada saat ini di log audit.</p></div></div>`
      : `<div class="alert" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534" role="status"><b>Semua syarat menuju ${next} terpenuhi</b></div>`}
    <button class="btn" id="btnAdvance" aria-disabled="${hasGaps ? 'true' : 'false'}" ${hasGaps ? 'disabled' : ''}>Naik ke ${next} »</button>
  </div>`;
}

function bindAdvanceActions(id, gateInfo) {
  const advance = $('#btnAdvance');
  if (advance && !advance.disabled) {
    advance.onclick = async () => {
      await api(`/api/projects/${id}/advance`, 'POST', {});
      refreshProject();
      toast('Gate naik.');
    };
  }
  const force = $('#btnForce');
  if (force) {
    force.onclick = () => {
      confirmDialog({
        title: 'Force advance gate',
        message: `Naikkan gate meski ${(gateInfo.gaps || []).length} syarat belum terpenuhi? Aksi ini akan tercatat di log audit.`,
        danger: true,
        onConfirm: async () => {
          await api(`/api/projects/${id}/advance`, 'POST', { force: 1 });
          refreshProject();
          toast('Gate dinaikkan dengan eskalasi.');
        }
      });
    };
  }
}

function renderBpomPanel(p, bpomContent) {
  const dl = daysLeft(p.bridging_end);
  const cls = dl === null ? '' : dl < 0 ? 'late' : dl <= 21 ? 'soon' : '';
  const bridging = p.bridging_end ? `<div class="infogrid" style="margin-top:8px"><div><b>Sisa masa bridging</b><span class="countdown ${cls}">${dl !== null && dl < 0 ? 'Berakhir' : dl + ' hari'}</span></div></div>` : '';
  const period = bpomContent.period_template
    .replace('{start_date}', fmt(p.start_date))
    .replace('{bridging_end}', fmt(p.bridging_end));

  return `<div class="card" style="border-left:4px solid var(--red)">
    <h2>${esc(bpomContent.title)}</h2>
    <div class="infogrid">
      <div><b>${esc(bpomContent.requirement_label)}</b><span>${esc(bpomContent.requirement_value)}</span></div>
      <div><b>${esc(bpomContent.dps_support_label)}</b><span>${esc(bpomContent.dps_support_value)}</span></div>
      <div><b>${esc(bpomContent.period_label)}</b><span>${esc(period)}</span></div>
      <div><b>${esc(bpomContent.definitive_plan_label)}</b><span>${esc(p.definitive_plan) || 'Belum dicatat'}</span></div>
    </div>${bridging}
    <div class="alert amber" style="margin-top:12px"><b>${esc(bpomContent.critical_control)}</b>
      ${bpomContent.critical_control_html}</div></div>`;
}

function renderDeliverables(data, p, id) {
  if (p.track !== 'first_responder' && !data.deliverables.length) return '';
  const rows = data.deliverables.map(dl => `<tr data-del="${dl.id}">
      <td><input data-k="name" value="${esc(dl.name)}" aria-label="Nama deliverable" style="width:190px"></td>
      <td><input data-k="owner_role" value="${esc(dl.owner_role)}" aria-label="Penyusun" style="width:160px"></td>
      <td><select data-k="status" aria-label="Status deliverable">${Object.entries(DELIV_STATUS_LABELS).map(([s2, label]) => `<option value="${s2}" ${dl.status === s2 ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></td>
      <td><input data-k="evidence_url" value="${esc(dl.evidence_url)}" placeholder="link evidence" aria-label="Link evidence" style="width:170px"></td>
      <td><input data-k="reviewed_by" value="${esc(dl.reviewed_by)}" placeholder="reviewer" aria-label="Reviewer" style="width:120px"></td>
      <td><input data-k="due_date" type="date" value="${esc(dl.due_date)}" aria-label="Due date" style="width:140px"></td>
      <td><button class="btn sm ghost" data-save="${dl.id}">Simpan</button>
        <button class="btn sm ghost danger" data-del-deliv="${dl.id}" data-name="${esc(dl.name)}">Hapus</button></td></tr>`).join('')
    || '<tr><td colspan="7" class="muted small">Belum ada deliverable.</td></tr>';

  return `<div class="card"><h2>Deliverable Setup — SOP-03 (First Responder)</h2>
    <p class="small muted">Deliverable wajib tersedia sebelum eksekusi proyek dimulai; gap dicatat dan dieskalasikan. Item baru yang ditambahkan bersifat opsional kecuali berasal dari kontrak.</p>
    <button class="btn sm" id="btnAddDeliv">+ Tambah deliverable</button>
    ${tableScroll(`<table style="margin-top:10px"><thead><tr><th>Deliverable</th><th>Penyusun</th><th>Status</th><th>Evidence / link</th><th>Reviewer</th><th>Due</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`)}
    </div>`;
}

function renderBufferChecks(data, p, id) {
  if (p.track !== 'buffer' && !data.buffer_checks.length) return '';
  const rows = data.buffer_checks.map(c => `<tr>
    <td><input type="checkbox" data-verify="${c.id}" ${c.verified ? 'checked' : ''} aria-label="Terverifikasi"></td>
    <td><input data-bk="item" data-id="${c.id}" value="${esc(c.item)}" style="width:300px" aria-label="Nama prasyarat">${c.verified_at ? `<div class="small muted">Diverifikasi ${fmt(c.verified_at)}</div>` : ''}</td>
    <td><input data-bk="evidence" data-id="${c.id}" value="${esc(c.evidence)}" placeholder="bukti" style="width:170px" aria-label="Evidence"></td>
    <td><input data-bk="verified_by" data-id="${c.id}" value="${esc(c.verified_by)}" style="width:120px" aria-label="Verifikator"></td>
    <td><button class="btn sm ghost" data-bsave="${c.id}">Simpan</button>
      <button class="btn sm ghost danger" data-del-buffer="${c.id}" data-name="${esc(c.item)}">Hapus</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="muted small">Belum ada prasyarat.</td></tr>';

  return `<div class="card"><h2>Prasyarat Teknis Buffer — SOP-04 (Gate B1–B3)</h2>
    <p class="small muted">Buffer hanya dimobilisasi dengan prasyarat administratif dan teknis yang jelas serta handover knowledge.</p>
    <button class="btn sm" id="btnAddBuffer">+ Tambah prasyarat</button>
    ${tableScroll(`<table class="checklist" style="margin-top:10px"><thead><tr><th></th><th>Prasyarat</th><th>Evidence</th><th>Verifikator</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`)}
    </div>`;
}

function bindDeliverableActions(id, refresh) {
  $$('[data-save]').forEach(btn => btn.onclick = async () => {
    const tr = btn.closest('tr');
    const body = {};
    for (const i of tr.querySelectorAll('[data-k]')) {
      const key = i.dataset.k;
      body[key] = i.value;
      if (key === 'evidence_url' && !isSafeUrl(i.value)) {
        showError(`Skema URL tidak diizinkan: ${i.value || 'kosong'}. Gunakan http, https, atau link-evidence.`);
        return;
      }
    }
    await api(`/api/projects/${id}/deliverables/${btn.dataset.save}`, 'PUT', body);
    toast('Deliverable disimpan.');
    refresh();
  });
  $$('[data-del-deliv]').forEach(btn => btn.onclick = () => {
    confirmDialog({
      title: 'Hapus deliverable',
      message: `Hapus deliverable "${btn.dataset.name}"?`,
      danger: true,
      onConfirm: async () => { await api(`/api/projects/${id}/deliverables/${btn.dataset.delDeliv}`, 'DELETE'); refresh(); toast('Deliverable dihapus.'); }
    });
  });
  const addDeliv = $('#btnAddDeliv');
  if (addDeliv) addDeliv.onclick = () => modal({
    title: 'Tambah Deliverable',
    body: `<div class="form-grid">
      <div><label for="d_name">Nama deliverable *</label><input id="d_name" name="name" required></div>
      <div><label for="d_owner">Penyusun / role</label><input id="d_owner" name="owner_role"></div>
      <div><label for="d_due">Due date</label><input id="d_due" name="due_date" type="date"></div>
    </div>`,
    onSubmit: async (data, close) => {
      await api(`/api/projects/${id}/deliverables`, 'POST', data);
      close();
      refresh();
      toast('Deliverable ditambahkan.');
    }
  });
}

function bindBufferActions(id, p, refresh) {
  $$('[data-bsave]').forEach(btn => btn.onclick = async () => {
    const cid = btn.dataset.bsave;
    const body = {};
    document.querySelectorAll(`[data-bk][data-id="${cid}"]`).forEach(i => body[i.dataset.bk] = i.value);
    body.verified = document.querySelector(`[data-verify="${cid}"]`).checked ? 1 : 0;
    await api(`/api/projects/${id}/buffer_checks/${cid}`, 'PUT', body);
    toast('Prasyarat disimpan.');
    refresh();
  });
  $$('[data-del-buffer]').forEach(btn => btn.onclick = () => {
    confirmDialog({
      title: 'Hapus prasyarat',
      message: `Hapus prasyarat "${btn.dataset.name}"?`,
      danger: true,
      onConfirm: async () => { await api(`/api/projects/${id}/buffer_checks/${btn.dataset.delBuffer}`, 'DELETE'); refresh(); toast('Prasyarat dihapus.'); }
    });
  });
  const addBuffer = $('#btnAddBuffer');
  if (addBuffer) addBuffer.onclick = () => modal({
    title: 'Tambah Prasyarat Buffer',
    body: `<div class="form-grid"><div><label for="b_item">Nama prasyarat *</label><input id="b_item" name="item" required></div></div>`,
    onSubmit: async (data, close) => {
      await api(`/api/projects/${id}/buffer_checks`, 'POST', data);
      close();
      refresh();
      toast('Prasyarat ditambahkan.');
    }
  });
}

function bindRowActions(id, p) {
  $$('[data-confirm]').forEach(btn => btn.onclick = () => modal({
    title: 'Konfirmasi PM',
    body: `<div class="form-grid"><div><label for="pm_name">Nama PM yang mengonfirmasi</label><input id="pm_name" name="pm_confirmed_by" value="${esc(p.pm || 'PM')}"></div></div>`,
    onSubmit: async (data, close) => {
      await api(`/api/reports/${btn.dataset.confirm}/confirm`, 'PUT', data);
      close();
      refreshProject();
      toast('Laporan dikonfirmasi.');
    }
  }));
  $$('[data-close]').forEach(btn => btn.onclick = async () => {
    await api(`/api/risks/${btn.dataset.close}`, 'PUT', { status: 'closed' });
    refreshProject();
    toast('Item RAID ditutup.');
  });
  $$('[data-cr]').forEach(btn => btn.onclick = async () => {
    await api(`/api/changes/${btn.dataset.cr}`, 'PUT', { status: btn.dataset.st });
    refreshProject();
    toast(`Change request ${btn.dataset.st}.`);
  });
}

async function refreshProject() {
  const main = $('#main');
  if (!main) return;
  const scrollY = window.scrollY;
  await renderProject(main);
  // Re-rendering replaces the whole view; keep the reader where they were.
  window.scrollTo(0, scrollY);
}

function renderTabReport(panelEl, data, id) {
  const p = data.project;
  const rows = data.reports.map(r => `<tr>
    <td><b>${esc(r.period)}</b><div class="small muted">${fmt(r.submitted_at)} · ${esc(r.submitted_by)}</div></td>
    <td>${esc(r.talent_info) || '—'}</td>
    <td class="small">${esc(r.planned) || '—'}</td>
    <td class="small">${esc(r.actual) || '—'}</td>
    <td class="small">${esc(r.blockers) || '—'}</td>
    <td>${r.evidence_url ? safeLink(r.evidence_url, 'bukti') : '—'}</td>
    <td>${r.pm_confirmed ? badge('disetujui', `OK · ${esc(r.pm_confirmed_by)}`) : `<button class="btn sm green" data-confirm="${r.id}">Konfirmasi PM</button>`}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Belum ada laporan mingguan.</td></tr>';

  panelEl.innerHTML = `<div class="card"><h2>Weekly Report — SOP-05</h2>
    <p class="small muted">Format minimum: periode · talent/Chapter/role/FTE · aktivitas/WBS · rencana · realisasi · evidence · blocker/risiko · keputusan dibutuhkan · status akses · konfirmasi PM.</p>
    <button class="btn" id="btnAddReport">+ Laporan Mingguan</button>
    ${tableScroll(`<table style="margin-top:12px"><thead><tr><th>Periode</th><th>Talent/FTE</th><th>Rencana</th><th>Realisasi</th><th>Blocker</th><th>Evidence</th><th>Konfirmasi PM</th></tr></thead>
    <tbody>${rows}</tbody></table>`)}
    </div>`;
  $('#btnAddReport').onclick = () => {
    const year = new Date().getFullYear();
    modal({
      title: 'Laporan Mingguan Baru — SOP-05',
      body: `<div class="form-grid">
        <div><label for="r_period">Periode *</label><input id="r_period" name="period" required value="${year}-W${weekNumber()}"></div>
        <div><label for="r_talent">Talent / Chapter / role / FTE</label><input id="r_talent" name="talent_info"></div>
        <div class="full"><label for="r_planned">Rencana (aktivitas/WBS)</label><textarea id="r_planned" name="planned" rows="3"></textarea></div>
        <div class="full"><label for="r_actual">Realisasi / progres berbasis bukti</label><textarea id="r_actual" name="actual" rows="3"></textarea></div>
        <div><label for="r_evidence">Evidence / link</label><input id="r_evidence" name="evidence_url"></div>
        <div class="full"><label for="r_next">Next steps</label><textarea id="r_next" name="next_steps" rows="2"></textarea></div>
        <div class="full"><label for="r_blockers">Blocker / risiko (owner, due date)</label><textarea id="r_blockers" name="blockers" rows="2"></textarea></div>
        <div class="full"><label for="r_decisions">Keputusan yang dibutuhkan</label><textarea id="r_decisions" name="decisions_needed" rows="2"></textarea></div>
        <div><label for="r_access">Status akses / dokumen</label><input id="r_access" name="access_status"></div>
        <div><label for="r_by">Disampaikan oleh</label><input id="r_by" name="submitted_by"></div>
      </div>`,
      onSubmit: async (formData, close) => {
        await api(`/api/projects/${id}/reports`, 'POST', formData);
        close();
        refreshProject();
        toast('Laporan mingguan disimpan.');
      }
    });
  };
}

function renderTabRaid(panelEl, data, id) {
  const rows = data.risks.map(r => `<tr>
    <td>${kindBadge(r.kind)}</td>
    <td><b>${esc(r.title)}</b>${r.description ? `<div class="small muted">${esc(r.description)}</div>` : ''}</td>
    <td class="small">${esc(r.impact) || '—'}</td>
    <td>${esc(r.owner) || '<span class="muted">—</span>'}</td>
    <td>${fmt(r.due_date)}</td>
    <td>${r.escalated ? badge('open', 'eskalasi') : ''} ${badge(r.status === 'open' ? 'open' : 'closed', r.status === 'open' ? 'terbuka' : 'selesai')}</td>
    <td>${r.status === 'open' ? `<button class="btn sm ghost" data-close="${r.id}">Tutup</button>` : fmt(r.closed_at)}</td></tr>`).join('')
    || '<tr><td colspan="7" class="muted">Tidak ada item RAID.</td></tr>';

  panelEl.innerHTML = `<div class="card"><h2>Risk / Issue / Blocker / Dependency — SOP-05</h2>
    <p class="small muted">Setiap item memiliki deskripsi, dampak, owner, due date, mitigasi dan jalur eskalasi. Blocker yang mengancam milestone segera dieskalasikan ke PM dan pihak berwenang.</p>
    <button class="btn" id="btnAddRisk">+ Item RAID</button>
    ${tableScroll(`<table style="margin-top:12px"><thead><tr><th>Jenis</th><th>Judul</th><th>Dampak</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`)}
    </div>`;
  $('#btnAddRisk').onclick = () => modal({
    title: 'Tambah Item RAID',
    body: `<div class="form-grid">
      <div><label for="rk_kind">Jenis *</label><select id="rk_kind" name="kind" required><option value="risiko">Risiko</option><option value="isu">Isu</option><option value="blocker">Blocker</option><option value="dependensi">Dependensi</option></select></div>
      <div><label for="rk_title">Judul *</label><input id="rk_title" name="title" required></div>
      <div class="full"><label for="rk_desc">Deskripsi</label><textarea id="rk_desc" name="description" rows="3"></textarea></div>
      <div><label for="rk_impact">Dampak</label><input id="rk_impact" name="impact"></div>
      <div><label for="rk_owner">Owner</label><input id="rk_owner" name="owner"></div>
      <div><label for="rk_due">Due date</label><input id="rk_due" name="due_date" type="date"></div>
      <div class="full"><label for="rk_mitigation">Mitigasi</label><textarea id="rk_mitigation" name="mitigation" rows="2"></textarea></div>
      <div class="full check-row"><input type="checkbox" id="rk_escalated" name="escalated" data-send="1"><label for="rk_escalated">Segera dieskalasikan ke PM / pihak berwenang</label></div>
    </div>`,
    onSubmit: async (formData, close) => {
      await api(`/api/projects/${id}/risks`, 'POST', formData);
      close();
      refreshProject();
      toast('Item RAID ditambahkan.');
    }
  });
}

function renderTabCR(panelEl, data, id) {
  const rows = data.changes.map(c => `<tr>
    <td><b>${esc(c.title)}</b>${c.description ? `<div class="small muted">${esc(c.description)}</div>` : ''}</td>
    <td class="small">${esc(c.impact_assessment) || '—'}</td>
    <td>${esc(c.approver) || '—'}</td>
    <td>${badge(c.status === 'disetujui' ? 'disetujui' : c.status === 'ditolak' ? 'ditolak' : 'diajukan', c.status)}</td>
    <td>${c.status === 'diajukan' ? `<button class="btn sm green" data-cr="${c.id}" data-st="disetujui">Setujui</button>
      <button class="btn sm ghost" data-cr="${c.id}" data-st="ditolak">Tolak</button>` : fmt(c.decided_at)}</td></tr>`).join('')
    || '<tr><td colspan="5" class="muted">Tidak ada change request.</td></tr>';

  panelEl.innerHTML = `<div class="card"><h2>Change Control — SOP-05</h2>
    <p class="small muted">Perubahan scope, timeline, biaya, resource atau komitmen dicatat; dampak dinilai; approval mengikuti kewenangan resmi sebelum baseline diperbarui.</p>
    <button class="btn" id="btnAddCR">+ Change Request</button>
    ${tableScroll(`<table style="margin-top:12px"><thead><tr><th>Judul</th><th>Impact assessment</th><th>Approver</th><th>Status</th><th>Keputusan</th></tr></thead>
    <tbody>${rows}</tbody></table>`)}
    </div>`;
  $('#btnAddCR').onclick = () => modal({
    title: 'Change Request Baru',
    body: `<div class="form-grid">
      <div><label for="cr_title">Judul *</label><input id="cr_title" name="title" required></div>
      <div class="full"><label for="cr_desc">Deskripsi perubahan</label><textarea id="cr_desc" name="description" rows="3"></textarea></div>
      <div class="full"><label for="cr_impact">Penilaian dampak (scope/timeline/biaya/resource)</label><textarea id="cr_impact" name="impact_assessment" rows="3"></textarea></div>
      <div><label for="cr_approver">Approver sesuai kewenangan</label><input id="cr_approver" name="approver"></div>
    </div>`,
    onSubmit: async (formData, close) => {
      await api(`/api/projects/${id}/changes`, 'POST', formData);
      close();
      refreshProject();
      toast('Change request ditambahkan.');
    }
  });
}

function renderTabLog(panelEl, data) {
  const rows = (data.events || []).map(e => `<tr><td class="small muted mono">${fmt(e.created_at)}</td><td>${e.gate ? gateBadge(e.gate) : ''}</td>
    <td><b>${esc(e.action)}</b>${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td><td class="small muted">${esc(e.actor)}</td></tr>`).join('')
    || '<tr><td colspan="4" class="muted">Belum ada aktivitas.</td></tr>';

  panelEl.innerHTML = `<div class="card"><h2>Log Aktivitas &amp; Gate</h2>
    ${tableScroll(`<table><thead><tr><th>Waktu</th><th>Gate</th><th>Aktivitas</th><th>Aktor</th></tr></thead><tbody>${rows}</tbody></table>`)}
    </div>`;
}

function openGateEditor(p, d, gate, content, refreshDetail) {
  const note = (d.gate_notes || []).find(n => n.gate === gate);
  let fields = '';
  if (gate === 'G0') {
    fields = `<div><label for="g_project_type">Jenis proyek</label><select id="g_project_type" name="project_type"><option value="new" ${p.project_type === 'new' ? 'selected' : ''}>Proyek baru</option><option value="existing" ${p.project_type === 'existing' ? 'selected' : ''}>Proyek existing</option></select></div>`
      + `<div class="full"><label for="g_reason">Alasan penggunaan Shared Service</label><textarea id="g_reason" name="reason_shared_service" rows="3">${esc(p.reason_shared_service)}</textarea></div>`;
  } else if (gate === 'G1') {
    fields = `<div><label for="g_nde_no">Nomor NDE</label><input id="g_nde_no" name="nde_no" value="${esc(p.nde_no)}"></div>`
      + `<div><label for="g_nde_date">Tanggal NDE</label><input id="g_nde_date" name="nde_date" type="date" value="${esc(p.nde_date)}"></div>`
      + `<div><label for="g_budget">Status anggaran</label><select id="g_budget" name="budget_status">${Object.entries(BUDGET_LABELS).map(([v, l]) => `<option value="${v}" ${p.budget_status === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`
      + `<div><label for="g_onb">Status onboarding / akses</label><select id="g_onb" name="onboarding_status">${Object.entries(ONB_LABELS).map(([v, l]) => `<option value="${v}" ${p.onboarding_status === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`
      + `<div><label for="g_proc">Dokumen pengadaan</label><select id="g_proc" name="procurement_doc"><option value="">— tidak ada / tidak berlaku —</option>${Object.entries({ PKDF: 'PKDF', 'Justifikasi Kontrak Lumsum': 'Justifikasi Kontrak Lumsum', 'Surat Pesanan dengan new item': 'SP dengan new item', 'Surat Pesanan tanpa new item': 'SP tanpa new item' }).map(([v, l]) => `<option value="${esc(v)}" ${p.procurement_doc === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`
      + `<div><label for="g_target">Target mulai pekerjaan</label><input id="g_target" name="procurement_target_start" type="date" value="${esc(p.procurement_target_start)}"></div>`;
  } else if (gate === 'G2A' || gate === 'G2B') {
    fields = '<div class="full small muted" style="margin-top:8px">Item dan status gate ini diubah langsung pada tabel Deliverable / Prasyarat Buffer.</div>';
  } else if (gate === 'G3') {
    fields = `<div><label for="g_start">Tanggal mulai penugasan</label><input id="g_start" name="start_date" type="date" value="${esc(p.start_date)}"></div>`
      + `<div><label for="g_end">Tanggal akhir penugasan</label><input id="g_end" name="end_date" type="date" value="${esc(p.end_date)}"></div>`
      + `<div><label for="g_fte">Kebutuhan FTE</label><input id="g_fte" name="fte" value="${esc(p.fte)}"></div>`;
  } else if (gate === 'G4') {
    fields = `<div><label for="g_end">Target serah terima / akhir penugasan</label><input id="g_end" name="end_date" type="date" value="${esc(p.end_date)}"></div>`;
  } else if (gate === 'G5') {
    fields = `<div><label for="g_bridging">Akhir masa bridging</label><input id="g_bridging" name="bridging_end" type="date" value="${esc(p.bridging_end)}"></div>`
      + `<div class="full"><label for="g_def">Rencana talent definitif / transisi</label><textarea id="g_def" name="definitive_plan" rows="3">${esc(p.definitive_plan)}</textarea></div>`
      + `<div class="full"><label for="g_notes">Lessons learned / catatan penutupan</label><textarea id="g_notes" name="notes" rows="3">${esc(p.notes)}</textarea></div>`;
  }
  fields += `<div class="full"><label for="g_gate_note">Catatan proses ${gate} (keputusan, hasil review, gap)</label><textarea id="g_gate_note" name="gate_note" rows="3">${esc(note ? note.note : '')}</textarea></div>`;

  modal({
    title: `Edit Gate ${gate === 'CLOSED' ? 'Selesai' : gate}`,
    body: `<p class="small muted">${esc(content.gates.descriptions[gate] || '')}</p><div class="form-grid">${fields}</div>`,
    onSubmit: async (data, close) => {
      const proj = { ...data };
      delete proj.gate_note;
      if (Object.keys(proj).length) await api(`/api/projects/${p.id}`, 'PUT', proj);
      await api(`/api/projects/${p.id}/gate_notes/${gate}`, 'PUT', { note: data.gate_note });
      close();
      refreshProject();
      toast('Gate disimpan.');
    }
  });
}

function showError(message) {
  toast(message, 'error');
}
