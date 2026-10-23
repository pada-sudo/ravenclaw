import { esc } from '../utils.js';
import { tableScroll } from '../components.js';
import { getContent } from '../content.js';

export function renderReference(container) {
  const content = getContent();
  const sop = content.sop;
  const raci = content.raci;
  const kpi = content.kpi;
 const gateDesc = content.gates.descriptions;

  const gateRows = Object.entries(gateDesc).map(([g, d]) => `<tr><td><b>${g === 'CLOSED' ? 'END' : g}</b></td><td>${esc(d)}</td></tr>`).join('');

  const sop01proc = sop.sop_01.procurement_lead_times.map(r => `<tr><td>${esc(r.doc)}</td><td>${esc(r.note)}</td></tr>`).join('');

  const sop03rows = sop.sop_03.deliverables.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.owner_role)}</td></tr>`).join('');

  const raciRows = raci.rows.map(r => `<tr><td>${esc(r.activity)}</td><td>${esc(r.responsible)}</td><td>${esc(r.accountable)}</td><td>${esc(r.consulted_informed)}</td></tr>`).join('');

  const kpiItems = kpi.items.map(i => `<li><b>${esc(i.name)}</b> — ${esc(i.description)}</li>`).join('');

  function listItems(items) {
    return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }

  container.innerHTML = `<div class="ref">
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
      ${tableScroll(`<table><thead><tr><th>Gate</th><th>Isi / kriteria</th></tr></thead><tbody>${gateRows}</tbody></table>`, 'Tabel gate G0–G5')}
      <p class="small muted">Nama gate G0–G5 dan B1–B4 adalah rancangan kontrol yang diusulkan, bukan nama gate resmi dalam Nota Dinas.</p></div>

    <div class="card"><h2>${esc(sop.sop_01.title)}</h2>
      <ol>${sop.sop_01.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <h3>Kontrol waktu pengadaan (sebelum pekerjaan dimulai)</h3>
      ${tableScroll(`<table><thead><tr><th>Dokumen</th><th>Batas waktu</th></tr></thead><tbody>${sop01proc}</tbody></table>`, 'Tabel kontrol waktu pengadaan')}</div>

    <div class="card"><h2>${esc(sop.sop_02.title)}</h2>${listItems(sop.sop_02.items)}
      <p class="small muted">${esc(sop.sop_02.note)}</p></div>

    <div class="card"><h2>${esc(sop.sop_03.title)}</h2>
      <p class="small muted">${esc(sop.sop_03.description)}</p>
      ${tableScroll(`<table><thead><tr><th>Deliverable</th><th>Penyusun</th></tr></thead><tbody>${sop03rows}</tbody></table>`, 'Tabel deliverable SOP-03')}</div>

    <div class="card"><h2>${esc(sop.sop_04.title)}</h2>${listItems(sop.sop_04.items)}
      <p class="small muted">${esc(sop.sop_04.note)}</p></div>

    <div class="card"><h2>${esc(sop.sop_05.title)}</h2>${listItems(sop.sop_05.items)}</div>

    <div class="card"><h2>${esc(sop.sop_06.title)}</h2>${listItems(sop.sop_06.items)}</div>

    <div class="card"><h2>${esc(sop.sop_07.title)}</h2>${listItems(sop.sop_07.items)}
      <div class="alert amber"><b>${esc(sop.sop_07.critical_control)}</b>${sop.sop_07.critical_control_html}</div></div>

    <div class="card"><h2>${esc(raci.title)}</h2>
      ${tableScroll(`<table><thead><tr><th>Aktivitas</th><th>R</th><th>A / approval</th><th>C / I</th></tr></thead><tbody>${raciRows}</tbody></table>`, 'Tabel RACI')}
      <p class="small muted">${esc(raci.note)}</p></div>

    <div class="card"><h2>${esc(kpi.title)}</h2><ul>${kpiItems}</ul></div>

    <div class="card"><h2>Sumber</h2>
      <ul>${sop.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="small muted">${esc(sop.disclaimer)}</p></div>
  </div>`;
}
