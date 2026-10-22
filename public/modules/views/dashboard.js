import { api } from '../api.js';
import { $, esc, fmt, daysLeft } from '../utils.js';
import { stateBox, STATE, toast } from '../state.js';
import { getContent } from '../content.js';
import { gateBadge, trackBadge, kpiBar, tableScroll, safeLink } from '../components.js';

export async function renderDashboard(container) {
  container.innerHTML = stateBox({ state: STATE.loading });
  let kpis, projects;
  try {
    [kpis, { data: projects }] = await Promise.all([api('/api/kpis'), api('/api/projects')]);
  } catch (err) {
    container.innerHTML = stateBox({ state: STATE.error, error: err });
    return;
  }

  const content = getContent();
  const gateLabels = content.gates.labels;
  const gateDesc = content.gates.descriptions;
  const gateOrder = ['G0', 'G1', 'G2A', 'G2B', 'G3', 'G4', 'G5', 'CLOSED'];
  const byGate = {};
  gateOrder.forEach(g => byGate[g] = []);
  projects.forEach(p => { (byGate[p.gate] || (byGate[p.gate] = [])).push(p); });

  const bpom = projects.find(p => p.bpom_case && p.status !== 'closed' && p.bridging_end);
  const bpomContent = content.bpom;
  const bpomAlert = bpom ? renderBpomAlert(bpom, bpomContent) : '';

  const kpiCards = [
    { l: 'Kesiapan administratif', v: kpis.admin_readiness_pct + '%', d: 'penugasan dengan NDE, anggaran & onboarding tercatat', p: kpis.admin_readiness_pct },
    { l: 'FR readiness', v: kpis.fr_readiness_pct === null ? '—' : kpis.fr_readiness_pct + '%', d: 'deliverable setup lengkap sebelum eksekusi', p: kpis.fr_readiness_pct },
    { l: 'Buffer tech readiness', v: kpis.buffer_tech_readiness_pct === null ? '—' : kpis.buffer_tech_readiness_pct + '%', d: 'prasyarat teknis + knowledge transfer selesai', p: kpis.buffer_tech_readiness_pct },
    { l: 'Kepatuhan laporan mingguan', v: kpis.weekly_reporting_compliance_pct === null ? '—' : kpis.weekly_reporting_compliance_pct + '%', d: 'laporan diterima 7 hari terakhir', p: kpis.weekly_reporting_compliance_pct },
    { l: 'Blocker terbuka', v: String(kpis.blockers_open), d: `rata-rata umur ${kpis.blocker_avg_age_days} hari · max ${kpis.blocker_max_age_days} hari`, p: null },
    { l: 'Kesiapan transisi', v: kpis.transition_ready_pct === null ? '—' : kpis.transition_ready_pct + '%', d: 'talent definitif terencana sebelum bridging berakhir', p: kpis.transition_ready_pct },
  ].map(k => `<div class="kpi"><div class="l">${esc(k.l)}</div><div class="v">${esc(k.v)}</div><div class="d">${esc(k.d)}</div>${kpiBar(k.p)}</div>`).join('');

  const pipeline = gateOrder.map(g => {
    const chips = byGate[g].map(p =>
      `<div class="chip"><a href="#/project/${p.id}">${esc(p.code)}</a><br><span class="muted small">${esc(p.name)}</span></div>`).join('');
    return `<div class="pcol"><h4>${esc(gateLabels[g] || g)}</h4><div class="cnt">${byGate[g].length}</div>${chips || `<p class="small muted" style="margin-top:auto">Tidak ada penugasan</p>`}</div>`;
  }).join('<div class="arrow" aria-hidden="true">→</div>');

  const blockerRows = kpis.blocker_list.map(b => `<tr>
    <td><a class="link" href="#/project/${b.project_id}">${esc(b.project_code)}</a></td>
    <td>${esc(b.title)}</td>
    <td>${esc(b.owner) || '—'}</td>
    <td>${fmt(b.due_date)}</td>
    <td><b>${b.age_days ?? '—'}</b> hari</td>
  </tr>`).join('') || '<tr><td colspan="5" class="muted">Tidak ada blocker terbuka</td></tr>';

  container.innerHTML = `
    <h1>Dashboard</h1>
    <p class="sub">Pantauan workflow bisnis project DDP — gate G0–G5, jalur First Responder &amp; Buffer.</p>
    ${bpomAlert}
    <div class="kpis">${kpiCards}</div>
    <div class="card"><h2>Pipeline Penugasan (Gate)</h2>
      <p class="small muted">G2A dan G2B adalah cabang alternatif: G2A untuk First Responder (proyek baru), G2B untuk Buffer (proyek existing). Nama gate adalah rancangan kontrol yang diusulkan.</p>
      <div class="pipeline">${pipeline}</div></div>
    <div class="card"><h2>Blocker Terbuka &amp; Umur (Blocker Aging)</h2>
      ${tableScroll(`<table><thead><tr><th>Proyek</th><th>Judul</th><th>Owner</th><th>Due date</th><th>Umur</th></tr></thead>
      <tbody>${blockerRows}</tbody></table>`)}
    </div>`;
}

function renderBpomAlert(bpom, content) {
  const d = daysLeft(bpom.bridging_end);
  const cls = d !== null && d <= 30 ? 'red' : 'amber';
  const daysText = d !== null && d < 0 ? content.dashboard_alert.late_text : content.dashboard_alert.remaining_text.replace('{n}', String(d));
  const title = content.dashboard_alert.title.replace('{code}', bpom.code);
  const body = content.dashboard_alert.body
    .replace('{bridging_end}', fmt(bpom.bridging_end))
    .replace('{days_text}', daysText);
  return `<div class="alert ${cls}"><b>${esc(title)}</b>${esc(body)} <a href="#/project/${bpom.id}" class="link">Buka proyek</a></div>`;
}
