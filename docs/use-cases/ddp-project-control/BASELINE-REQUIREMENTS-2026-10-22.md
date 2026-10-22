# Baseline Requirement & Kriteria Penerimaan — DDP Project Control

- **Tanggal:** 22 Oktober 2026
- **Penyusun:** George (PM/PO), atas penugasan THEOFILUS JIMMY
- **Issue:** DEEP-219 — bagian dari DEEP-218 (Web Apps)
- **Baseline yang dinilai:** `apps/ddp-project-control/` pada commit `af65560` (server.js 787 baris, public/app.js 833 baris)
- **Rujukan audit:** `docs/use-cases/ddp-project-control/AUDIT-2026-10-22-baseline.md` (temuan A1–A12, B1–B7, C1–C8, E1–E8)
- **Sifat dokumen:** baseline *apa yang harus benar menurut bisnis*. Bukan design spec (Rico), bukan definisi angka KPI (Adit, DEEP-220), bukan rencana implementasi (Bagas/Fajar).

---

## 0. Metode & sumber

**Sumber aturan bisnis.** Ringkasan SOP-01 s/d SOP-07 dan gate G0–G5 yang dinilai adalah halaman
*Referensi SOP & Workflow* di aplikasi (`public/app.js:690` — "Revisi 3.0 (21 Oktober 2026), draft untuk
validasi internal"), ditambah Nota Dinas yang dikutip di dalamnya (C.Tel.28/YN 000/DDP-B0000000/2026 dan
C.Tel.87/PS 000/DDP-B0200000/2026). Dokumen NDE resminya **tidak ada di repositori**, sehingga matriks ini
adalah kesesuaian terhadap ringkasan SOP di aplikasi — bukan terhadap dokumen resmi. Lihat pertanyaan Q5.

**Cara verifikasi.** Semua verdict di bawah diuji dengan **menjalankan aplikasi**, bukan membaca kode saja:

```bash
cd apps/ddp-project-control && rm -rf data && PORT=3312 node server.js   # Node v24.18.1
```

Database bersih (seed 3 proyek: PRJ-2026-001 Buffer/BPOM di G3, PRJ-2026-002 First Responder di G2A,
PRJ-2026-003 Buffer di G1). Setiap klaim menyebut field, endpoint, atau layar yang bisa dicek ulang;
perintah reproduksi ada di §7.

**Arti verdict.**

| Verdict | Arti |
| --- | --- |
| **Terpenuhi** | Aturan SOP dimodelkan dan **tidak bisa dilewati** pada kondisi normal. |
| **Sebagian** | Datanya ada / sebagian diperiksa, tetapi ada celah yang membuat aturan tidak bisa diandalkan sebagai kontrol. |
| **Belum ada** | Aturan SOP tidak dimodelkan sama sekali (tidak ada field, entitas, endpoint, atau layar). |

**Di luar lingkup:** angka/target KPI (Adit), design spec & WCAG (Rico), kontrak API (Bagas), test plan
(Sofia), kode aplikasi. Dokumen ini tidak mengubah `server.js`/`app.js`.

---

## 1. Ringkasan verdict

66 butir dinilai: **10 terpenuhi**, **30 terpenuhi sebagian**, **26 belum ada**.

| Area | Butir | Terpenuhi | Sebagian | Belum ada | Temuan audit |
| --- | ---: | ---: | ---: | ---: | --- |
| Gate & jalur (G0–G5, G2A/G2B, CLOSED, FR/Buffer) | 10 | 1 | 6 | 3 | A1, A2, A4, B1, E3 |
| SOP-01 Intake & klasifikasi | 10 | 3 | 3 | 4 | E1 |
| SOP-02 Verifikasi administratif & mobilisasi | 6 | 0 | 4 | 2 | E1, E2, A12 |
| SOP-03 First Responder setup | 6 | 3 | 0 | 3 | E3, A1, A7 |
| SOP-04 Buffer & prasyarat B1–B4 | 6 | 1 | 3 | 2 | E4, A1 |
| SOP-05 Delivery, QA, change, eskalasi | 10 | 2 | 3 | 5 | E5, B1 |
| SOP-06 Acceptance, handover, closure | 6 | 0 | 3 | 3 | E6, A4 |
| SOP-07 Kasus BPOM | 6 | 0 | 4 | 2 | E7 |
| Lintas-potong (audit trail, resource governance, KPI, validitas data) | 6 | 0 | 4 | 2 | A3, A6, A8, A12, B7, E8 |
| **Total** | **66** | **10** | **30** | **26** | |

**Kesimpulan.** Aplikasi menangkap **kerangka** proses DDP dengan benar — dua jalur, gate bercabang
G2A/G2B, daftar deliverable/checklist yang persis sesuai SOP, kontrol lead time pengadaan, RAID, weekly
report, dan penanda kasus BPOM. Yang belum ada adalah **sifat mengikat** dari kerangka itu: gate dapat
dinaikkan tanpa data (checklist kosong, hapus item, `force:1`, atau `/close` dari gate mana pun), tidak ada
identitas pelaku maupun otorisasi, dan tidak ada satu pun entitas untuk acceptance/handover (SOP-06) atau
parameter BPOM sebagai data (SOP-07). Sebagai **prototipe model proses** ini sudah tepat; sebagai **alat
kontrol kepatuhan** belum bisa dipakai — dan itu yang harus diperbaiki sebelum pilot.

---

## 2. Matriks kesesuaian SOP ↔ fitur

### 2.1 Gate & jalur

| ID | Butir aturan | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| G0 | Kebutuhan masuk; jalur FR/Buffer ditentukan; alasan Shared Service dicatat | Sebagian | `gateGaps()` server.js:220 memeriksa `track` + `reason_shared_service`; `POST /advance` dari G0 dengan kedua field terisi → `{"next":"G1","gaps":[]}`. Tetapi `PUT /api/projects/:id` menerima `track` baru tanpa efek samping (A2). | Jalur harus **immutable** setelah G0, atau perubahan = aksi ber-approval yang me-reset gate & membuat ulang checklist. |
| G1 | NDE tersedia, anggaran disetujui, onboarding/akses berjalan | Sebagian | Tiga gap terverifikasi: `NDE permintaan CFU belum tersedia (nomor/tanggal)`, `Anggaran belum disetujui...`, `Onboarding/akses talent belum berjalan`. Tetapi ketiganya **self-declared** (tanpa bukti/verifikator) dan bisa dilewati `force:1` atau `/close`. | Setiap butir G1 butuh bukti + verifikator + waktu; eskalasi hanya oleh approver berwenang. |
| G2A | First Responder: 7 deliverable wajib **disetujui** | Belum ada (kontrol tidak efektif) | Dengan 3/7 disetujui → gap `4 deliverable setup belum berstatus disetujui (SOP-03)`. Tetapi setelah **ketujuh deliverable dihapus**, `gate_info` = `{"next":"G2A","gaps":[]}` dan dua kali `POST /advance` menaikkan gate ke G2A lalu **G3 dengan 0 deliverable** (A1, E3). | Gate wajib menolak daftar kosong dan menuntut 7 item wajib hadir; hapus item wajib harus ditolak. |
| G2B | Buffer: semua prasyarat teknis terverifikasi | Belum ada (kontrol tidak efektif) | 7/8 terverifikasi → gap `1 prasyarat teknis Buffer belum terverifikasi`. Setelah **kedelapan prasyarat dihapus** → `{"next":"G3","gaps":[]}` dan gate naik ke G3 dengan 0 checklist (A1). | Sama seperti G2A, plus pemetaan B1–B4 (lihat §2.5). |
| G3 | Scope/timeline/FTE/akses/weekly/risiko/blocker/evidence/eskalasi disepakati | Sebagian | `gateGaps()` hanya memeriksa `blocker` terbuka dan **keberadaan** ≥1 weekly report. `start_date`, `end_date`, `fte`, `access_status` tidak diperiksa meski disebut di `GATE_DESC.G3` (app.js:14). | Tambahkan butir G3 yang bisa diuji: periode & FTE terisi, akses terkonfirmasi, laporan terbaru ≤7 hari. |
| G4 | Validasi hasil, testing, dokumen serah terima sesuai kontrak | Sebagian | Satu-satunya syarat: setiap risk terbuka punya `owner` + `due_date`. Terverifikasi: dari G4, `POST /advance` → `{"next":"G5","gaps":[]}` tanpa satu pun catatan acceptance/QA/handover (E6). | G4 harus menuntut bukti acceptance (BAPP/BAST/no. dokumen) dan hasil QA sebelum boleh naik. |
| G5 | Transisi ke talent definitif/operasi, isu residual, lessons learned, evaluasi load activity | Sebagian | Satu-satunya syarat: `notes` tidak kosong. `definitive_plan`, `bridging_end`, evaluasi tidak diperiksa. | Wajibkan `definitive_plan` + tanggal efektif + evaluasi sebelum CLOSED. |
| CLOSED | Penugasan ditutup; owner lanjutan & tindak lanjut terdokumentasi | Belum ada (bisa dilewati) | `POST /api/projects/:id/close` dari **G0** → `{"ok":true,"gate":"CLOSED","status":"closed"}` (`prev_gate: G0`), tanpa memeriksa gateGaps sama sekali (server.js:449). | Penutupan hanya dari G5 dan hanya bila seluruh gate terlewati dengan bukti. |
| Jalur FR | 7 deliverable spesifik FR | Terpenuhi | `FR_DELIVERABLES` (server.js:132) = WBS, BRD, SAD, Workforce Plan, Initial Data Solution, Initial Design Documentation, Project Charter — nama & penyusun sama dengan tabel SOP-03; dibuat otomatis saat intake FR (diverifikasi 7 baris, 0 buffer_checks). `GATE_NEXT.first_responder` = G0→G1→G2A→G3→G4→G5→CLOSED. | Pertahankan; tambahkan penanda "wajib" per item. |
| Jalur Buffer | 8 prasyarat Buffer + gate B1–B4 | Sebagian | `BUFFER_CHECKS` (server.js:141) 8 item, dibuat otomatis (diverifikasi 8 baris). `GATE_NEXT.buffer` = G0→G1→G2B→G3→G4→G5→CLOSED. Checklist **datar** — tidak ada pemetaan B1/B2/B3/B4 (E4). | Petakan tiap prasyarat ke B1–B4 dan tambahkan checklist B4 (exit). |

### 2.2 SOP-01 — Intake, klasifikasi, permintaan Shared Service

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S01-1 | Catat project/customer, **tujuan**, target mulai, scope awal | Sebagian | Kolom `name`, `customer_cfu`, `tribe_unit`, `business_owner`, `pm` ada; **tidak ada field tujuan/outcome** — hanya `notes` & `reason_shared_service`. | Tambah field tujuan/outcome yang terukur. |
| S01-2 | Jenis kontrak | Belum ada | `POST /api/projects` dengan `contract_type:"lumsum"` → 200 tetapi field dibuang (tidak ada di respons `GET /api/projects/:id`; `validateProjectInput` server.js:302 hanya mengenal whitelist tetap). `project_type` hanya `new` atau `existing`. (E1) | Modelkan jenis kontrak (enum + nomor/tanggal kontrak). |
| S01-3 | Status tahapan procurement | Belum ada | Hanya `procurement_doc` (4 nilai + kosong) dan `procurement_target_start`; tidak ada status proses (belum diajukan → diajukan → SP terbit → selesai). `budget_status` hanya untuk anggaran. (E1) | Tambah status tahapan + tanggal tiap tahap. |
| S01-4 | Kontrol waktu pengadaan: PKDF 60h, Lumsum 45h, SP-new 30h, SP 14h | Terpenuhi | `PROC_LEAD_DAYS` (server.js:158) + `procurementInfo()` (server.js:340). Terverifikasi: PRJ-2026-002 PKDF target 2026-12-15 → `submit_by: 2026-10-16`, warning `terlambat 6 hari`; PRJ-2026-003 SP-new → `submit_by: 2026-10-11`, `terlambat 11 hari`. | Pertahankan (jangan dirusak). Tambahkan pengingat dan jalur dispensasi tercatat. |
| S01-5 | Target mulai pekerjaan | Terpenuhi | `procurement_target_start` + `start_date`, input `type=date` di form Intake. | Validasi format tanggal (A6) — lihat X-5. |
| S01-6 | Kebutuhan **role/FTE per role** & durasi | Belum ada | `fte` hanya string bebas (`"50%"`, placeholder "mis. 50%"); `POST` dengan `role_fte:[{role:"PM",fte:0.5}]` → 200 tapi dibuang. Tidak ada tabel assignment. (E1) | Modelkan peran → FTE → periode → output; prasyarat KPI kapasitas. |
| S01-7 | Klasifikasi jalur FR vs Buffer | Terpenuhi | `track` wajib: `POST` tanpa `track` atau `track:"lainnya"` → `422 Jalur (track) wajib first_responder atau buffer`. Intake langsung membuat checklist sesuai jalur. | Pertahankan; kunci setelah G0 (lihat S01-8). |
| S01-8 | Jalur tidak boleh berubah tanpa kontrol | Belum ada | `PUT {"track":"buffer"}` → 200. Efek terverifikasi: proyek FR di **G2A** menjadi `gate_info {"next":null}` → `POST /advance` = `422 "Project sudah berada pada gate akhir"` (**proyek macet**); proyek di **G3** yang diubah ke Buffer langsung `next: G4` — **G2B dilewati** dengan 0 prasyarat. (A2) | Larang perubahan jalur; bila harus, wajibkan approval + reset gate + regenerasi checklist + jejak. |
| S01-9 | Permintaan CFU melalui **NDE** (nomor, tanggal, ruang lingkup) | Sebagian | `nde_no` + `nde_date` diperiksa di G1; **ruang lingkup tidak diperiksa** dan tidak ada referensi dokumen (hanya teks nomor). | Tambah ruang lingkup + lampiran/referensi dokumen NDE. |
| S01-10 | Scope awal & risiko keterlambatan resource | Sebagian | Scope hanya `notes` bebas; risiko baru bisa dicatat setelah proyek ada (RAID butuh `project_id`). | Scope awal sebagai daftar; risiko resource boleh dicatat di intake. |

### 2.3 SOP-02 — Verifikasi administratif & mobilisasi talent

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S02-1 | Verifikasi NDE (nomor, tanggal, ruang lingkup) | Sebagian | Gap G1 `NDE permintaan CFU belum tersedia (nomor/tanggal)` terverifikasi; ruang lingkup tidak diperiksa; tidak ada verifikator/bukti verifikasi. (E2) | Tambah butir "ruang lingkup sesuai permintaan" + verifikator + waktu. |
| S02-2 | Verifikasi anggaran disetujui & tersedia di sistem keuangan | Sebagian | `budget_status` enum tiga nilai: `belum_diajukan`, `diajukan`, `disetujui`; nilai `disetujui` cukup diketik operator — tanpa referensi sistem keuangan, nomor dokumen, atau verifikator. (E2) | Wajibkan referensi bukti (no. dokumen/tanggal) + verifikator. |
| S02-3 | Onboarding talent berjalan: akses sistem, orientasi, hak akses | Sebagian | `onboarding_status` enum 3 nilai; tidak ada daftar akses, tanggal mulai akses, atau PIC. (E2) | Checklist akses per sistem + tanggal efektif. |
| S02-4 | Chapter menilai kebutuhan vs kapasitas; tetapkan role, FTE, periode, scope, pelaporan | Belum ada | Tidak ada entitas assignment/kapasitas Chapter; `fte` string bebas; angka 70/30/50 hanya teks di `notes` seed. (E1) | Model peran-FTE-periode; kapasitas Chapter sebagai data rujukan. |
| S02-5 | Catat gap administrasi; status Pending/Blocked + eskalasi | Sebagian | `status` hanya bisa diubah manual; gap tampil sebagai teks di layar gate, tidak tersimpan sebagai register gap maupun eskalasi. Terverifikasi: `PUT {"status":"closed"}` pada gate G5 diterima → state mustahil (A5). | Gap administrasi sebagai entitas (status, owner, due, eskalasi); transisi `pending/blocked` otomatis dari gap. |
| S02-6 | Accountability: siapa memverifikasi & kapan | Belum ada | Tabel `projects` tidak punya kolom verifikator/approver (cek kolom: tidak ada `verif*`/`approv*`); `logEvent()` menulis `actor='operator web'` untuk semua aksi (A12, E2). | Kolom `verified_by`/`verified_at` per butir verifikasi + identitas pelaku nyata. |

### 2.4 SOP-03 — First Responder: setup proyek baru

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S03-1 | 7 deliverable wajib dibuat otomatis dengan penyusun sesuai SOP | Terpenuhi | `FR_DELIVERABLES` (server.js:132) — nama & `owner_role` identik dengan tabel SOP-03; dibuat saat intake (diverifikasi 7 baris untuk PRJ-2026-004). | Pertahankan. |
| S03-2 | Deliverable wajib bertanda "wajib" dan tidak boleh hilang | Belum ada | `GET /api/meta` mengirim pasangan `["WBS","Project Manager"]` — tanpa flag wajib; `DELETE /api/projects/:id/deliverables/:did` → 200 untuk semua item (diverifikasi 7 → 0). (E3) | Tandai item wajib; larang hapus (atau wajibkan approval + jejak). |
| S03-3 | Status, evidence, reviewer, due date per deliverable | Terpenuhi | `deliverables.status` (belum_mulai/dalam_proses/review/disetujui), `evidence_url`, `reviewed_by`, `due_date`; layar "Deliverable Setup — SOP-03" (app.js:404). | Pertahankan. |
| S03-4 | "Disetujui" hanya sah bila ada evidence + reviewer | Belum ada | `PUT /api/projects/2/deliverables/:id {"status":"disetujui"}` pada deliverable baru → 200 dengan `evidence_url:""` dan `reviewed_by:""`. | Tolak `disetujui` tanpa bukti + reviewer (dan verifikator ≠ penyusun). |
| S03-5 | Data salah bisa dikoreksi (termasuk mengosongkan) | Belum ada | `PUT evidence_url:"https://bukti"` lalu `PUT evidence_url:""` → nilai lama tetap `"https://bukti"` (pola `s(x)` lalu fallback `row.x`, A7). | Izinkan pengosongan eksplisit + catat koreksi di jejak audit. |
| S03-6 | Gate G2A memeriksa status seluruh deliverable | Terpenuhi | 3/7 disetujui → gap `4 deliverable setup belum berstatus disetujui (SOP-03)`. | Pemeriksaan benar; masalahnya ada pada daftar kosong — lihat G2A. |

### 2.5 SOP-04 — Buffer: dukungan proyek existing (termasuk B1–B4)

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S04-1 | 8 prasyarat Buffer dibuat otomatis | Terpenuhi | `BUFFER_CHECKS` (server.js:141) 8 item sesuai SOP-04; dibuat saat intake Buffer (diverifikasi 8 baris, 0 deliverable). | Pertahankan. |
| S04-2 | Gate Buffer dipetakan **B1 administratif / B2 teknis & KT / B3 mobilisasi / B4 exit-transition** | Belum ada | `buffer_checks` datar (`item, verified, evidence, verified_by, verified_at, notes`) tanpa klasifikasi; judul layar hanya "Gate B1–B3" (app.js:420) sedangkan SOP menyebut B1–B4; pengecekan G2B hanya `COUNT(verified=0)`. (E4) | Tambah kolom klasifikasi B1–B4 + checklist B4 terpisah. |
| S04-3 | Verifikasi prasyarat dengan bukti + verifikator + waktu | Sebagian | Kolom tersedia (`verified`, `verified_by`, `evidence`, `verified_at`), tetapi `PUT {"verified":1}` diterima dengan `verified_by:""` dan `evidence:""` (diverifikasi); `verified_at` terisi otomatis. | Tolak verifikasi tanpa verifikator + bukti. |
| S04-4 | G2B hanya lolos bila semua prasyarat terverifikasi | Sebagian | 7/8 → gap `1 prasyarat teknis Buffer belum terverifikasi`; tetapi 0 prasyarat → `{"next":"G3","gaps":[]}` (diverifikasi). | Lihat G2B (P0). |
| S04-5 | Sebelum penugasan berakhir: serah terima hasil, isu residual, transisi ke tim definitif | Belum ada | Hanya `bridging_end` + `definitive_plan` (teks) dan syarat isu residual di G4; tidak ada checklist exit/transition (B4). | Checklist B4 wajib sebelum G5/CLOSED. |
| S04-6 | KT dari tim sebelumnya selesai dengan bukti (MoM/handover checklist) | Sebagian | Item checklist + kolom `evidence` teks bebas; tidak ada unggahan/lampiran MoM maupun daftar hadir. | Lampiran dokumen KT atau referensi MoM yang bisa diuji keberadaannya. |

### 2.6 SOP-05 — Delivery control, QA, perubahan, eskalasi

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S05-1 | Rencana kerja: WBS, milestone, planned/actual, dependency, baseline | Belum ada | Tidak ada entitas WBS/milestone/dependency; `planned`/`actual` hanya teks di weekly report; tidak ada konsep baseline/versi. | WBS/milestone + baseline yang bisa dibandingkan dengan change request. |
| S05-2 | Weekly progress: selesai vs rencana, next plan, evidence, blocker, risiko, keputusan | Terpenuhi | `weekly_reports`: `planned`, `actual`, `next_steps`, `blockers`, `decisions_needed`, `evidence_url`, `access_status`, `talent_info`; layar "Weekly Report — SOP-05" (app.js:618). | Pertahankan. |
| S05-3 | Format minimum laporan divalidasi | Belum ada | `POST /api/projects/:id/reports {"period":"minggu lalu"}` → 200; seluruh field isi boleh kosong (diverifikasi). (E5) | Validasi periode (ISO week/tanggal) + field minimum wajib. |
| S05-4 | Tenggat & pengingat laporan mingguan | Belum ada | Tidak ada `due_date`/reminder; `computeKpis()` hanya menghitung laporan dengan `submitted_at >= hari-7`. (E5) | Tenggat per periode + status terlambat + pengingat. |
| S05-5 | Konfirmasi PM (siapa & kapan) | Sebagian | `pm_confirmed`, `pm_confirmed_by` ada; **tidak ada** `pm_confirmed_at`; `pm_confirmed:1` bisa dikirim sejak pembuatan laporan (diverifikasi: `pm_confirmed_by:"siapa saja"`). (E5) | Tambah waktu konfirmasi; konfirmasi hanya lewat endpoint terpisah oleh PM. |
| S05-6 | QA & kualitas: evidence disiapkan, reviewer memeriksa sesuai standar | Belum ada | Hanya `deliverables.status='review'` + `reviewed_by`; tidak ada checklist QA, hasil uji, atau kriteria lulus. | Checklist QA/review per deliverable + hasil. |
| S05-7 | Change control: dicatat, dampak dinilai, approval sesuai kewenangan sebelum baseline berubah | Sebagian | `change_requests` (title, description, `impact_assessment`, `approver`, status, `decided_at`) ada; tetapi `PUT /api/changes/:id {"status":"disetujui"}` → 200 tanpa kredensial, `approver:"Siapa Saja"` diterima, `impact_assessment` boleh kosong (diverifikasi). | Wajibkan dampak + approver berwenang (RBAC) + jejak keputusan. |
| S05-8 | RAID: deskripsi, dampak, owner, due date, mitigasi | Terpenuhi | Tabel `risks` (kind risiko/isu/blocker/dependensi, `description`, `impact`, `owner`, `due_date`, `mitigation`, `status`, `closed_at`); layar RAID (app.js:641). | Pertahankan; lihat S05-9 untuk eskalasi. |
| S05-9 | Jalur & SLA eskalasi blocker | Sebagian | Hanya flag `escalated` (0/1) dan catatan teks; tidak ada tujuan eskalasi, level, waktu, atau bukti notifikasi. | Eskalasi sebagai entitas: ke siapa, kapan, level, bukti. |
| S05-10 | Security/kerahasiaan: akses berbasis kebutuhan, patuh PDP | Belum ada | Tidak ada autentikasi; seluruh endpoint terbuka (B1). Terverifikasi: `POST /api/projects` tanpa kredensial → 200. | AuthN + RBAC per peran (operator/PM/approver/auditor). |

### 2.7 SOP-06 — Acceptance, handover & penutupan

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S06-1 | Inventarisasi deliverable selesai/belum | Sebagian | Untuk jalur FR ada daftar `deliverables` + status; proyek Buffer **tidak punya daftar deliverable** (hanya prasyarat), sehingga acceptance berbasis deliverable tidak mungkin untuk Buffer. | Inventaris deliverable/exit-item untuk kedua jalur. |
| S06-2 | Testing/QA/acceptance sesuai kontrak, scope, standar | Belum ada | Tidak ada entitas acceptance: `GET /api/projects/4/acceptance`, `/handover`, `/bapp` → **404**. Terverifikasi: dari G4 `POST /advance` → G5 dengan 0 catatan acceptance. (E6) | Entitas acceptance (BAPP/BAST: nomor, tanggal, penandatangan, hasil uji). |
| S06-3 | Isu residual: owner, due date, keputusan formal | Sebagian | G4 memeriksa `owner`+`due_date` untuk risk terbuka; tidak ada keputusan formal (hanya `risks.status`/`closed_at`). | Tambah keputusan formal (terima/tunda/tolak) + approver. |
| S06-4 | Handover dokumentasi, akses, konfigurasi/as-built, BAPP/BAST | Belum ada | Tidak ada entitas/lampiran handover; hanya catatan gate teks (`gate_notes`). (E6) | Checklist handover + lampiran dokumen. |
| S06-5 | Tutup penugasan; talent definitif/operasional ditangani | Sebagian | `POST /close` menutup; `definitive_plan` teks; **`/close` dari G0 langsung CLOSED** tanpa pemeriksaan gate (diverifikasi). | Penutupan hanya dari G5; wajibkan rencana definitif untuk jalur Buffer/BPOM. |
| S06-6 | Evaluasi load activity & lessons learned | Belum ada | Hanya `notes` bebas di G5 (`gateGaps`: `Lessons learned / catatan penutupan belum diisi`); tidak ada entitas evaluasi, tanggal, penilai. (E6) | Entitas evaluasi (tanggal, penilai, hasil, tindak lanjut). |

### 2.8 SOP-07 — Kasus penugasan Buffer PM BPOM

| ID | Butir SOP | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| S07-1 | Kebutuhan 70% FTE Delivery (3 bulan) + 30% FTE Manage Service sebagai data | Belum ada | Hardcoded di UI (app.js:383) dan di `notes` seed PRJ-2026-001; tidak ada field. (E7) | Parameter BPOM sebagai data proyek (angka, durasi, dasar Nota Dinas). |
| S07-2 | Dukungan DPS 50% FTE sebagai dukungan **sementara** | Sebagian | `bpom_case` (0/1) + `fte` teks `"50%"`; tidak ada validasi batas 50% maupun penanda "sementara". | Field FTE dukungan + batas + penanda sementara. |
| S07-3 | Periode bridging 7 Okt–6 Nov 2026, maksimal 4 minggu | Sebagian | `start_date`/`bridging_end` ada; dashboard menghitung sisa hari (`daysLeft`, app.js:246); batas 4 minggu **tidak divalidasi** (tanggal bebas, A6). | Validasi durasi ≤4 minggu + periode dasar Nota Dinas. |
| S07-4 | Pemenuhan definitif oleh Tribe berjalan paralel | Sebagian | `definitive_plan` (teks) + KPI `transition_ready_pct` (buffer dengan `bridging_end` & `definitive_plan` & belum lewat). | Tambah status & tanggal efektif pemenuhan definitif. |
| S07-5 | Titik kontrol: Buffer 50% bukan pemenuhan permanen | Sebagian | Banner peringatan (app.js:381–390) + alert dashboard bila `bridging_end` ≤30 hari; tidak ada aturan yang memblokir perpanjangan/permanen. | Blokir/approval wajib saat perpanjangan atau penugasan melewati batas. |
| S07-6 | Evaluasi minimal 1 bulan: load activity talent/Tribe/Unit + dokumen standar Chapter | Belum ada | Tidak ada entitas/jadwal evaluasi; hanya teks banner. | Entitas evaluasi bulanan + hasil + tindak lanjut. |

### 2.9 Lintas-potong

| ID | Butir aturan | Verdict | Bukti (terverifikasi) | Rekomendasi |
| --- | --- | --- | --- | --- |
| X-1 | Setiap aktivitas punya pelaku yang bisa dipertanggungjawabkan | Belum ada | `logEvent()` menulis `actor='operator web'` (server.js:201); seluruh event seed & hasil uji ber-actor `operator web`/`seed`. Tidak ada cara mengisi aktor dari API. (A12) | Identitas pelaku dari sesi; simpan role & approver. |
| X-2 | Riwayat gate immutable, dapat diaudit, tersimpan | Belum ada | `DELETE /api/projects/:id` menghapus `events` lewat `ON DELETE CASCADE` (B7); tidak ada export/retensi; `events` tanpa index/batas. | Soft delete + retensi + export audit. |
| X-3 | Resource governance: FTE, masa penugasan, onboarding, kapasitas Chapter, rencana definitif | Sebagian | `fte` teks, `start_date`/`end_date`/`bridging_end`, `onboarding_status`, `definitive_plan` ada; kapasitas Chapter & assignment per peran tidak dimodelkan. | Lihat S01-6/S02-4. |
| X-4 | KPI dihitung dari data, definisi disetujui PO | Sebagian | `GET /api/kpis` (baseline seed) = `admin 67%, fr 0%, buffer_tech 50%, weekly 100%, blockers 1 (age 3 hari), transition 100%`; `transition_ready_pct` 100% dari **1** proyek eligible (E8). Definisi menunggu DEEP-220. | Definisikan populasi & ambang minimum sampel sebelum angka dipublikasikan. |
| X-5 | Kontrol validitas data (tanggal, enum, referensi) | Sebagian | Enum divalidasi (`oneOf` → 422); tanggal tidak: `PUT {"start_date":"2026-13-45","end_date":"bukan-tanggal"}` → 200 dan tersimpan apa adanya (A6). | Validasi tanggal ISO + konsistensi zona waktu (A8). |
| X-6 | Identitas proyek unik & stabil | Sebagian | `nextProjectCode()` = `COUNT(*)` (server.js:205). Terverifikasi: hapus satu proyek lalu intake → `500 {"error":"UNIQUE constraint failed: projects.code"}`; pada skenario lain kode terpakai ulang (PRJ-2026-005 dua kali). (A3) | Sequence/`AUTOINCREMENT` terpisah; kode tidak pernah didaur ulang. |

---

## 3. Kriteria penerimaan per alur utama

Format Gherkin ringkas + **hasil baseline** pada aplikasi berjalan (22 Okt 2026). Kolom *Baseline*
menunjukkan apa yang terjadi **sekarang** — jadi Sofia tahu mana yang harus merah hari ini dan hijau
setelah perbaikan. Prasyarat semua paket: database bersih (`rm -rf data`), seed 3 proyek, `PORT` bebas.

Penanda **[MUST]** = wajib lulus sebelum pilot; **[SHOULD]** = wajib lulus sebelum produksi.

### AC-01 — Intake proyek (SOP-01)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-01.1 **[MUST]** | Given operator membuka form Intake · When submit tanpa memilih jalur · Then permintaan ditolak dan tidak ada proyek terbuat | `422`, pesan menyebut jalur wajib; daftar proyek tidak bertambah | **LULUS** — `422 Jalur (track) wajib first_responder atau buffer`; `track:"lainnya"` juga 422 |
| AC-01.2 **[MUST]** | Given intake dengan jalur First Responder · When proyek dibuat · Then terbentuk tepat 7 deliverable SOP-03 dengan penyusun sesuai SOP dan 0 prasyarat Buffer | 7 deliverable (WBS…Project Charter) + 0 `buffer_checks` | **LULUS** — terverifikasi 7/0 |
| AC-01.3 **[MUST]** | Given intake dengan jalur Buffer · When proyek dibuat · Then terbentuk tepat 8 prasyarat SOP-04 dan 0 deliverable | 8 `buffer_checks` + 0 `deliverables` | **LULUS** — terverifikasi 8/0 |
| AC-01.4 **[MUST]** | Given seorang proyek dihapus · When operator melakukan intake baru · Then proyek baru berhasil dibuat dengan kode unik yang belum pernah dipakai | `200` + kode baru; tidak ada `500`; kode lama tidak didaur ulang | **GAGAL** — `500 {"error":"UNIQUE constraint failed: projects.code"}`; kode `PRJ-2026-005` pernah terpakai dua kali |
| AC-01.5 **[MUST]** | Given intake dengan jenis kontrak, target mulai, dan kebutuhan role/FTE per peran · When proyek disimpan · Then seluruh nilai tersimpan dan terbaca kembali | Field baru ada di respons `GET` dan di layar | **GAGAL** — `contract_type` & `role_fte` dibuang diam-diam (200 tanpa field) |
| AC-01.6 **[MUST]** | Given dokumen pengadaan PKDF dengan target mulai 2026-12-15 · When proyek disimpan · Then `submit_by` = 2026-10-16 dan peringatan keterlambatan muncul bila lewat | `submit_by` dihitung `target − 60 hari`; warning tampil di daftar proyek | **LULUS** — `submit_by: 2026-10-16`, warning "terlambat 6 hari" |
| AC-01.7 **[MUST]** | Given proyek First Responder sudah intake · When jalur diubah menjadi Buffer · Then perubahan ditolak, atau bila diizinkan: gate di-reset, checklist Buffer dibuat, approval + jejak tercatat | `422` (default) atau reset+approval+event; proyek tidak macet | **GAGAL** — `PUT track` → 200; proyek G2A menjadi macet (`422 Project sudah berada pada gate akhir`), proyek G3 melewati G2B dengan 0 prasyarat |
| AC-01.8 **[MUST]** | Given intake oleh operator bernama A · When proyek dibuat · Then event intake mencatat A sebagai pelaku | `events.actor = "A"`, bukan `operator web` | **GAGAL** — semua event ber-actor `operator web` |

### AC-02 — Verifikasi administratif & mobilisasi (SOP-02)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-02.1 **[MUST]** | Given proyek di G0 dengan NDE kosong · When `POST /advance` · Then ditolak dengan daftar gap yang menyebut NDE | `422` + gap NDE (nomor/tanggal) | **LULUS** — gap `NDE permintaan CFU belum tersedia (nomor/tanggal)` |
| AC-02.2 **[MUST]** | Given NDE terisi, anggaran belum disetujui · When `POST /advance` · Then ditolak dengan gap anggaran; begitu `budget_status=disetujui` dan onboarding berjalan, gate boleh naik | `422` lalu `200 {"next":"G2A"\|"G2B"}` | **LULUS** — tiga gap muncul berurutan lalu hilang |
| AC-02.3 **[MUST]** | Given anggaran ditandai "disetujui" · When gate G1 dinilai · Then sistem menuntut referensi bukti (nomor/tanggal dokumen anggaran) dan mencatat verifikator + waktu | Gap/bukti wajib; `verified_by` & `verified_at` terisi | **GAGAL** — `budget_status` cukup diketik; tidak ada kolom verifikator di tabel `projects` |
| AC-02.4 **[MUST]** | Given verifikasi NDE/anggaran/onboarding dilakukan oleh B · When disimpan · Then riwayat menampilkan B dan waktunya | `verified_by="B"`, `verified_at` terisi, tampil di jejak gate | **GAGAL** — tidak ada field; `actor` tetap `operator web` |
| AC-02.5 **[MUST]** | Given gap administrasi membuat proyek belum bisa mobilisasi · When operator mencatat gap · Then status proyek menjadi `pending`/`blocked` dengan owner, due date, dan tercatat di jejak | Status berubah otomatis; gap tercatat bukan hanya teks layar | **GAGAL** — status hanya diubah manual; `PUT {"status":"closed"}` pada gate G5 diterima (state mustahil) |
| AC-02.6 **[MUST]** | Given kebutuhan proyek 70% Delivery + 30% Manage Service · When FTE ditetapkan · Then tersimpan per peran beserta periode dan totalnya bisa dihitung | Assignment per peran; total FTE ≤ kapasitas | **GAGAL** — hanya `fte:"50%"` teks bebas |

### AC-03 — Setup First Responder (SOP-03)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-03.1 **[MUST]** | Given proyek FR di G2A dengan 3 dari 7 deliverable disetujui · When `POST /advance` · Then ditolak dan gap menyebut jumlah yang belum disetujui | `422` + `4 deliverable setup belum berstatus disetujui` | **LULUS** — sesuai |
| AC-03.2 **[MUST]** | Given proyek FR di G2A dengan **daftar deliverable kosong** · When `POST /advance` · Then ditolak | `422`, tidak boleh naik gate | **GAGAL** — `gaps: []` lalu gate naik ke G3 dengan 0 deliverable |
| AC-03.3 **[MUST]** | Given deliverable wajib (mis. WBS) · When operator menghapusnya · Then ditolak, atau wajib approval + alasan + jejak | `422`/butuh approval; item wajib tetap ada | **GAGAL** — `DELETE` → 200 untuk semua item; daftar bisa dikosongkan |
| AC-03.4 **[MUST]** | Given deliverable tanpa evidence dan tanpa reviewer · When status diubah ke `disetujui` · Then ditolak | `422` menyebut evidence & reviewer wajib | **GAGAL** — 200 dengan `evidence_url:""`, `reviewed_by:""` |
| AC-03.5 **[MUST]** | Given evidence berisi URL yang salah · When operator mengosongkan field · Then nilai kosong tersimpan dan koreksi tercatat | `evidence_url:""`; event "koreksi evidence" | **GAGAL** — nilai lama tetap (`s(x)` lalu fallback `row.x`, A7) |
| AC-03.6 **[SHOULD]** | Given evidence berisi `javascript:alert(...)` · When disimpan · Then ditolak (hanya http/https) | `422` skema URL tidak diizinkan | **GAGAL** — tersimpan apa adanya dan dirender ke `href` (B4) |
| AC-03.7 **[MUST]** | Given Project Charter · When status disetujui · Then sistem menuntut bukti tanda tangan seluruh pemangku kepentingan | Daftar penandatangan / referensi dokumen wajib | **GAGAL** — `owner_role` hanya teks "Ditandatangani seluruh pemangku kepentingan" |

### AC-04 — Kesiapan Buffer (SOP-04, gate B1–B4)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-04.1 **[MUST]** | Given proyek Buffer di G1 lengkap administrasinya · When `POST /advance` · Then gate naik ke G2B dan daftar 8 prasyarat tampil | `{"next":"G2B"}`, 8 item | **LULUS** |
| AC-04.2 **[MUST]** | Given 7 dari 8 prasyarat terverifikasi · When `POST /advance` · Then ditolak dan gap menyebut 1 prasyarat | `422` + `1 prasyarat teknis Buffer belum terverifikasi` | **LULUS** |
| AC-04.3 **[MUST]** | Given daftar prasyarat kosong (semua dihapus) · When `POST /advance` · Then ditolak | `422`; gate tidak naik | **GAGAL** — `gaps: []` lalu gate naik ke G3 dengan 0 prasyarat |
| AC-04.4 **[MUST]** | Given prasyarat ditandai terverifikasi · When disimpan tanpa verifikator/bukti · Then ditolak | `422`; `verified_by` + `evidence` wajib | **GAGAL** — 200 dengan `verified_by:""`, `evidence:""` |
| AC-04.5 **[MUST]** | Given setiap prasyarat · When ditampilkan · Then terklasifikasi B1/B2/B3/B4 dan daftar B4 (exit/transition) terpisah | Kolom `band` + checklist B4 | **GAGAL** — checklist datar; layar hanya menyebut "B1–B3" (SOP: B1–B4) |
| AC-04.6 **[MUST]** | Given proyek Buffer akan menutup penugasan · When menuju G5/CLOSED · Then checklist exit (serah terima hasil, isu residual, transisi ke tim definitif) wajib lengkap | Gate ditolak bila checklist B4 belum lengkap | **GAGAL** — tidak ada checklist exit; `/close` bisa menutup dari gate mana pun |

### AC-05 — Delivery control, QA, change, eskalasi (SOP-05)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-05.1 **[MUST]** | Given laporan mingguan dengan periode "minggu lalu" · When disimpan · Then ditolak karena periode tidak berformat | `422` (ISO week atau rentang tanggal) | **GAGAL** — 200, periode teks bebas diterima |
| AC-05.2 **[MUST]** | Given laporan mingguan tanpa planned/actual · When disimpan · Then ditolak karena field minimum wajib kosong | `422` menyebut field wajib | **GAGAL** — semua isi boleh kosong |
| AC-05.3 **[MUST]** | Given laporan mingguan disetujui PM C · When dikonfirmasi · Then tersimpan siapa **dan kapan** konfirmasinya | `pm_confirmed_by="C"`, `pm_confirmed_at` terisi | **GAGAL** — ada `pm_confirmed_by`, **tidak ada** `pm_confirmed_at`; `pm_confirmed:1` bisa dikirim sejak pembuatan |
| AC-05.4 **[MUST]** | Given periode laporan lewat tenggat · When daftar laporan dibuka · Then status "terlambat" terlihat dan pengingat tercatat | Status terlambat per periode; reminder tercatat | **GAGAL** — tidak ada tenggat/reminder; KPI hanya menghitung laporan 7 hari terakhir |
| AC-05.5 **[MUST]** | Given change request tanpa penilaian dampak · When disetujui · Then ditolak | `422` dampak wajib | **GAGAL** — `PUT /api/changes/:id {"status":"disetujui"}` → 200 dengan `impact_assessment:""` |
| AC-05.6 **[MUST]** | Given change request disetujui · When keputusan disimpan · Then approver adalah pihak berwenang, tercatat identitas & waktunya, dan baseline diperbarui | Approver dari daftar peran; `decided_by`, `decided_at`; baseline berubah | **GAGAL** — approver teks bebas (`"Siapa Saja"`), approval tanpa kredensial |
| AC-05.7 **[SHOULD]** | Given blocker terbuka · When dieskalasi · Then tercatat ke siapa, level, dan waktu eskalasi | Entitas eskalasi | **GAGAL** — hanya flag `escalated` (0/1) |
| AC-05.8 **[MUST]** | Given proyek di G2B/G2A · When menuju G3 · Then scope, periode, FTE, akses, dan laporan terbaru sudah disepakati — bukan hanya "ada 1 laporan" | Gap untuk setiap butir yang belum | **GAGAL** — G3 hanya memeriksa blocker terbuka + keberadaan 1 laporan |
| AC-05.9 **[MUST]** | Given pengguna tanpa peran aprover · When menyetujui change request · Then ditolak `403` | RBAC | **GAGAL** — tanpa autentikasi (B1) |

### AC-06 — Acceptance, handover & penutupan (SOP-06)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-06.1 **[MUST]** | Given proyek di G4 tanpa satu pun bukti acceptance · When `POST /advance` · Then ditolak dan gap menyebut BAPP/BAST atau hasil uji yang belum ada | `422` + gap acceptance | **GAGAL** — `{"next":"G5","gaps":[]}` tanpa catatan acceptance |
| AC-06.2 **[MUST]** | Given BAPP/BAST dicatat · When disimpan · Then nomor, tanggal, penandatangan, dan lampiran tersimpan dan tampil | Entitas acceptance lengkap | **GAGAL** — endpoint acceptance/handover/BAPP → 404 |
| AC-06.3 **[MUST]** | Given isu residual yang belum ditutup · When menuju G5 · Then wajib ada keputusan formal (terima/tunda/tolak) + approver | Keputusan formal tercatat | **GAGAL** — hanya `owner` + `due_date` |
| AC-06.4 **[MUST]** | Given handover dokumentasi/akses/as-built · When dicatat · Then inventaris handover tersimpan sebagai checklist, bukan catatan bebas | Checklist handover + lampiran | **GAGAL** — hanya `gate_notes` teks |
| AC-06.5 **[MUST]** | Given proyek di G0 · When `POST /close` · Then ditolak karena gate belum terlewati | `422`; CLOSED hanya dari G5 | **GAGAL** — 200, langsung `CLOSED/closed` (`prev_gate: G0`) |
| AC-06.6 **[MUST]** | Given evaluasi pasca-penugasan · When dicatat · Then ada tanggal evaluasi, penilai, hasil load activity, dan lessons learned terstruktur | Entitas evaluasi | **GAGAL** — hanya `notes` bebas |
| AC-06.7 **[SHOULD]** | Given proyek ditutup lalu dibuka kembali · When reopen · Then alasan & approver tercatat | Event reopen dengan alasan + approver | **GAGAL** — reopen tanpa alasan/approver |

### AC-07 — Kasus BPOM (SOP-07)

| # | Given / When / Then | Ekspektasi | Baseline |
| --- | --- | --- | --- |
| AC-07.1 **[MUST]** | Given proyek BPOM baru · When parameternya diisi · Then 70% Delivery/3 bulan, 30% Manage Service, 50% dukungan DPS, dan periode bridging tersimpan sebagai **data proyek** | Field numerik + periode, bukan teks UI | **GAGAL** — angka hardcoded di `app.js:383` & `notes` seed |
| AC-07.2 **[MUST]** | Given dukungan DPS diisi > 50% FTE · When disimpan · Then ditolak atau wajib approval dengan alasan | Validasi batas + approval | **GAGAL** — `fte` teks bebas tanpa batas |
| AC-07.3 **[MUST]** | Given `bridging_end` ≤ 30 hari dari hari ini · When dashboard dibuka · Then muncul peringatan merah dengan sisa hari | Alert merah + angka sisa hari | **LULUS** — alert dashboard (`daysLeft`, app.js:246); banner proyek (app.js:381) |
| AC-07.4 **[MUST]** | Given periode bridging > 4 minggu · When disimpan · Then ditolak atau wajib approval perpanjangan | Validasi 4 minggu + approval | **GAGAL** — tanggal bebas, tanpa validasi durasi |
| AC-07.5 **[MUST]** | Given talent definitif belum dikonfirmasi saat bridging berakhir · When menuju penutupan · Then gate menolak dan menampilkan status definitif | Gate ditolak / status definitif wajib | **GAGAL** — hanya `definitive_plan` teks |
| AC-07.6 **[SHOULD]** | Given 1 bulan berjalan · When evaluasi dijadwalkan · Then evaluasi load activity + dokumen Chapter tercatat lengkap dengan penilai | Entitas evaluasi + tanggal | **GAGAL** — tidak ada |
| AC-07.7 **[MUST]** | Given KPI transition readiness dipublikasikan · When hanya ada 1 proyek eligible · Then angka diberi penanda sampel tidak memadai (bukan 100% polos) | Penanda `n = 1` atau sembunyikan angka | **GAGAL** — `transition_ready_pct: 100` dari 1 proyek |

**Rekap baseline:** 50 skenario (46 `[MUST]`, 4 `[SHOULD]`) — **10 LULUS**, **40 GAGAL**. Semua yang GAGAL berakar pada satu dari empat
sebab: (1) gate tidak menolak daftar kosong, (2) tidak ada identitas/otorisasi, (3) aturan SOP yang tidak
dimodelkan (kontrak, FTE per peran, B1–B4, acceptance, BPOM), (4) validasi & integritas data.

---

## 4. Gap register berprioritas

Prioritas mengikuti definisi issue: **P0** gate bisa dilewati tanpa data · **P1** kehilangan jejak audit ·
**P2** kelengkapan proses · **P3** kosmetik. Pemilik adalah **usulan** berdasarkan peta temuan di audit,
bukan penugasan final (itu kewenangan THEOFILUS/Pedro).

### P0 — Gate bisa dilewati tanpa data

| ID | Gap | Dampak bisnis | Pemilik usulan | Rujukan |
| --- | --- | --- | --- | --- |
| P0-01 | G2A lolos bila daftar deliverable kosong (vacuous truth): 7 deliverable dihapus → gate naik ke G3 dengan 0 deliverable | Proyek bisa masuk eksekusi tanpa WBS/BRD/SAD/Workforce Plan — risiko proyek tanpa dasar perencanaan, dan kontrol inti SOP-03 kehilangan makna | Bagas | G2A, S03-2, A1, E3 |
| P0-02 | G2B lolos bila daftar prasyarat Buffer kosong | Buffer dimobilisasi tanpa BRD/SAD/KT — talent masuk tanpa konteks; risiko rework & salah scope | Bagas | G2B, S04-4, A1 |
| P0-03 | `POST /close` menutup proyek dari gate mana pun (diverifikasi dari G0) | Penugasan bisa "selesai" tanpa acceptance; laporan status ke manajemen tidak bisa dipercaya | Bagas | CLOSED, S06-5, A4 |
| P0-04 | Eskalasi gate (`force:1`) menaikkan gate melewati semua gap tanpa approver/otorisasi | Gate menjadi formalitas: siapa pun bisa memaksa lolos; audit hanya mencatat "ESKALASI" | Bagas + Victor | G0–G5, A4, B1 |
| P0-05 | Tidak ada autentikasi & otorisasi; seluruh endpoint terbuka (termasuk `DELETE /api/projects/:id`, approval change, konfirmasi laporan) | Tidak ada pemisahan operator/approver yang disyaratkan SOP; data governance bisa diubah pihak mana pun yang menjangkau URL | Victor | B1, S05-10 |
| P0-06 | `status` proyek bisa diisi langsung dari body → state mustahil (gate G5 + `status:closed`) | Status proyek tidak lagi mencerminkan posisi gate; dashboard & KPI salah | Bagas | A5, S02-5 |
| P0-07 | Deliverable & prasyarat wajib bisa dihapus kapan saja tanpa approval | Kontrol bisa "dibersihkan" agar gate lolos; bukti proses hilang | Bagas | S03-2, S03-3, E3 |
| P0-08 | G4 → G5 tanpa satu pun bukti acceptance/QA/handover | Proyek masuk transisi tanpa acceptance yang sah; risiko sengketa dengan customer | Bagas + Adit | G4, S06-2, E6 |

### P1 — Kehilangan jejak audit / accountability

| ID | Gap | Dampak bisnis | Pemilik usulan | Rujukan |
| --- | --- | --- | --- | --- |
| P1-01 | Semua event ber-actor `operator web` (hardcoded) | Riwayat tidak bisa dipakai untuk pertanggungjawaban; audit trail tidak bernilai | Bagas + Victor | X-1, A12 |
| P1-02 | Tidak ada pencatat verifikator/waktu untuk NDE, anggaran, onboarding | Prinsip accountability SOP-02 tidak terpenuhi; verifikasi tidak bisa dibuktikan | Bagas | S02-6, E2 |
| P1-03 | Konfirmasi PM tanpa waktu konfirmasi; `pm_confirmed` bisa dikirim saat pembuatan laporan | Tidak bisa membuktikan laporan dikonfirmasi sebelum keputusan diambil | Bagas | S05-5, E5 |
| P1-04 | Approval change request tanpa identitas approver berwenang (approver teks bebas) | Perubahan baseline tanpa jejak kewenangan | Bagas + Victor | S05-7, E5 |
| P1-05 | `DELETE /api/projects/:id` menghapus permanen termasuk seluruh `events` (cascade) | Riwayat gate bisa dihapus; bertentangan dengan sifat governance | Bagas | X-2, B7 |
| P1-06 | Verifikasi prasyarat Buffer tanpa verifikator/bukti (200 dengan `verified_by:""`) | Jejak verifikasi bisa kosong/palsu | Bagas | S04-3, E4 |
| P1-07 | Perubahan jalur & reopen tanpa alasan/approver | Keputusan struktural tidak terlacak | Bagas | S01-8, S06-5, A2 |

### P2 — Kelengkapan proses

| ID | Gap | Dampak bisnis | Pemilik usulan | Rujukan |
| --- | --- | --- | --- | --- |
| P2-01 | Jenis kontrak, status tahapan procurement, dan role/FTE per peran tidak dimodelkan | Klasifikasi kontrak & KPI kapasitas tidak bisa dihitung; keputusan resource berbasis teks bebas | Adit (rule) + Bagas (model) | S01-2, S01-3, S01-6, E1 |
| P2-02 | Prasyarat Buffer tidak dipetakan B1–B4; checklist exit/transition (B4) tidak ada | Kepatuhan SOP-04 tidak bisa dinilai per tahap; exit penugasan Buffer tak terkontrol | Adit + Bagas | S04-2, S04-5, E4 |
| P2-03 | Acceptance & handover (BAPP/BAST, inventaris dokumen/akses/as-built) tidak ada | Tidak ada bukti acceptance; sengketa & serah terima bergantung dokumen manual di luar sistem | Adit + Bagas | S06-2, S06-4, E6 |
| P2-04 | QA/review checklist & hasil uji tidak ada | Kualitas deliverable tidak terukur; "review" hanya label status | Adit + Fajar | S05-6 |
| P2-05 | WBS/milestone/baseline tidak ada | Change control tidak punya baseline untuk dibandingkan; progres tidak bisa diuji | Adit | S05-1 |
| P2-06 | Format minimum laporan, tenggat, dan pengingat tidak ada | Kepatuhan laporan mingguan tidak bisa ditegakkan; "compliance 100%" hanya proxy 7 hari | Bagas + Adit | S05-3, S05-4, E5 |
| P2-07 | Eskalasi hanya flag boolean (tanpa tujuan/level/SLA) | Eskalasi tidak bisa dilacak & diukur | Adit | S05-9 |
| P2-08 | Evaluasi load activity & lessons learned tidak terstruktur (hanya `notes`) | Evaluasi pasca-penugasan tidak ada bukti; pembelajaran tidak terkumpul | Adit + Bagas | S06-6, E6 |
| P2-09 | Parameter BPOM (70/30/50%, 4 minggu, periode) hardcoded di UI/seed | Perubahan Nota Dinas = ubah kode + deploy; angka tidak bisa diaudit per proyek | Adit + Fajar | S07-1, S07-3, E7 |
| P2-10 | Validasi tanggal longgar & campur UTC/lokal | Deadline pengadaan & aging blocker bisa salah 1 hari / salah hitung tanpa error | Bagas | X-5, A6, A8 |
| P2-11 | Kode proyek dari `COUNT(*)` → 500 saat kode terpakai ulang | Intake gagal; identitas proyek tidak stabil untuk referensi dokumen | Bagas | X-6, A3 |
| P2-12 | Intake tanpa transaksi; kegagalan di tengah meninggalkan proyek tanpa checklist | Proyek "hidup" tapi tidak bisa diverifikasi gatenya; pembersihan manual | Bagas | A5 |
| P2-13 | Field tidak bisa dikosongkan (`s(x)` lalu fallback `row.x`) | Data salah tidak bisa dikoreksi; operator mencari akal (hapus-tambah) sehingga jejak hilang | Bagas | S03-5, A7 |
| P2-14 | Hardening HTTP: rate limit hanya tulis & mudah dipalsukan, tanpa security header, XSS lewat skema URL | Risiko keamanan sebelum dipakai bersama data nyata | Victor + Fajar | B2, B3, B4 |

### P3 — Kosmetik / konsistensi

| ID | Gap | Dampak bisnis | Pemilik usulan | Rujukan |
| --- | --- | --- | --- | --- |
| P3-01 | Istilah gate "B1–B3" di layar vs "B1–B4" di SOP; `CLOSED` vs "END" | Operator salah paham cakupan gate Buffer | Rico | E4, S04-2 |
| P3-02 | Error 500 mengirim `err.message` internal ke pengguna | Kebocoran detail internal & pesan tidak ramah | Bagas | B5 |
| P3-03 | Tidak ada indikator simpan per baris; render ulang menghilangkan tab/posisi | Operator kehilangan konteks, risiko input ganda | Fajar | C6 |
| P3-04 | Copy SOP/RACI/KPI hardcoded di kode (tidak bisa disunting PO) | Revisi kebijakan butuh deploy; teks berisiko menyimpang dari SOP resmi | Diana + Fajar | C1, C8 |

**Catatan kepemilikan.** Rico memegang C1–C8 (UX/a11y), Sofia D1 + verifikasi, Diana dokumentasi &
traceability, Adit definisi aturan/KPI (DEEP-220), Bagas/Fajar perbaikan teknis (stage 2), Victor
auth/hardening/ops. Item P0/P1 **tidak boleh** diselesaikan hanya di frontend — kontrol harus di server.

---

## 5. Definisi "pilot siap"

**Pilot siap** = aplikasi boleh dipakai untuk **proyek nyata dalam jumlah terbatas** sebagai alat kontrol
tunggal, dengan risiko yang sudah diketahui dan diterima THEOFILUS. Pilot siap **bukan** production-ready.

### 5.1 Kondisi minimum yang harus benar sebelum proyek nyata dimasukkan

| # | Kondisi | Kriteria lulus | Verifikator |
| --- | --- | --- | --- |
| 1 | Seluruh **P0 tertutup** | AC-01.4, 03.2, 03.3, 03.4, 04.3, 04.4, 06.1, 06.5 hijau; tidak ada cara menaikkan gate tanpa data (termasuk `force`, `/close`, hapus item) | Sofia |
| 2 | **Jejak audit minimum** (P1-01..P1-07 tertutup): setiap perubahan gate & keputusan menyimpan **siapa, kapan, apa, keputusan apa** | AC-01.8, 02.3, 02.4, 05.3, 05.6 hijau; `events.actor` = pengguna nyata, `verified_by`/`decided_at`/`pm_confirmed_at` terisi | Sofia + Diana |
| 3 | **AuthN + RBAC minimum**: peran operator / PM / approver / auditor; endpoint tulis tertutup bagi yang tidak berhak | AC-05.6, 05.9 hijau; audit akses oleh Victor | Victor + Sofia |
| 4 | **Keputusan terbuka dijawab** (Q1–Q5, Q7 minimal) dan tertulis di ADR | ADR disetujui THEOFILUS | THEOFILUS + Diana |
| 5 | **Data pilot terpisah dari data demo**: seed tidak berjalan otomatis pada DB pilot; ada prosedur reset | Instruksi + bukti uji | Victor |
| 6 | **Backup & restore diuji** (SQLite WAL checkpoint + prosedur restore) | Uji restore berhasil, dicatat | Victor + Sofia |
| 7 | **Peran & approver pilot ditetapkan** per gate, dengan nama nyata; daftar proyek pilot (≤5) dan operator terlatih | Daftar approver + daftar proyek + daftar operator | THEOFILUS + Diana |
| 8 | **Runbook operasi**: cara pakai harian, cara eskalasi bila aplikasi gagal, kontak | Runbook ditinjau | Diana |
| 9 | **Skenario AC `[MUST]` lulus** di environment pilot (bukan hanya lokal), termasuk regresi otomatis di CI | Laporan Sofia: 46/46 `[MUST]` hijau | Sofia |

### 5.2 Yang boleh menyusul (tidak memblokir pilot)

- Sebagian besar **P2** yang tidak menjadi prasyarat AC `[MUST]`: WBS/milestone penuh (P2-05), QA checklist
  (P2-04), eskalasi ber-SLA (P2-07), evaluasi terstruktur (P2-08) — boleh menyusul dengan prosedur manual
  tercatat selama pilot.
- **P2-06** boleh menyusul bila tenggat laporan mingguan ditegakkan manual dan tercatat.
- Seluruh **P3** (kosmetik), WCAG AA penuh, modularisasi frontend, dashboard lanjutan.
- Retensi & export audit otomatis (P1-05 sebagian): boleh menyusul **hanya jika** soft-delete sudah aktif dan
  backup harian terbukti.
- Multi-tenant, SSO, integrasi sistem keuangan/procurement, notifikasi otomatis, mobile.

### 5.3 Larangan selama pilot

- Jangan pakai data proyek di luar daftar pilot.
- Jangan gunakan `force`/`/close` sebagai jalan pintas: selama P0-03/P0-04 belum tertutup, setiap pemakaian
  harus dicatat manual dan dilaporkan mingguan ke THEOFILUS.
- Jangan mempublikasikan KPI apa pun ke manajemen sebelum definisi & populasi disetujui (DEEP-220).

---

## 6. Pertanyaan terbuka untuk THEOFILUS

Pertanyaan diurutkan berdasarkan apa yang **memblokir**. Nomor Q dipakai sebagai rujukan di gap register &
kriteria pilot.

| # | Pertanyaan | Mengapa memblokir | Default bila tidak dijawab |
| --- | --- | --- | --- |
| Q1 | **Siapa approver resmi tiap gate** (G0–G5, dan B1–B4 pada jalur Buffer)? Apakah aplikasi wajib memaksa otorisasi per gate, atau cukup mencatat approver? | Menentukan apakah P0-04 (force tanpa approver) diperbaiki sebagai RBAC penuh atau pencatatan approver saja; juga menentukan model peran di auth (P0-05) | Perbaiki sebagai RBAC penuh: gate hanya bisa naik oleh peran approver, eskalasi butuh approver level di atasnya |
| Q2 | **Apakah riwayat gate/proyek boleh dihapus?** Bila ya, oleh siapa dan berapa lama retensinya? | Menentukan desain P1-05 (soft delete + retensi) dan kewajiban backup; hapus permanen sekarang menghapus audit | Riwayat **immutable**; proyek hanya bisa di-*archive* (soft delete), hapus permanen = operasi admin dengan jejak |
| Q3 | **Satu tenant (hanya DDP) atau banyak unit/CFU** yang memakai aplikasi ini? | Menentukan model data & otorisasi sejak awal; retrofit multi-tenant mahal | Satu tenant DDP, dengan `tribe_unit`/`customer_cfu` sebagai dimensi laporan |
| Q4 | **Apakah eskalasi gate (`force`) tetap diizinkan?** Bila ya, siapa yang berwenang, dan dokumen/alasan apa yang wajib dilampirkan? | Salah satu P0; tanpa keputusan ini fitur tidak bisa dihapus maupun dipertahankan | Diizinkan hanya untuk peran approver tertinggi, wajib alasan + daftar gap yang dieskalasi, tercatat di jejak |
| Q5 | **Apakah ringkasan SOP revisi 3.0 di aplikasi adalah rujukan resmi?** Mohon dokumen SOP/NDE resmi (PDF) untuk diverifikasi butir-per-butir | Matriks ini dinilai terhadap ringkasan di aplikasi; bila dokumen resmi berbeda, verdict & AC harus direvisi | Anggap ringkasan revisi 3.0 sebagai baseline sementara; selisih dicatat sebagai risiko |
| Q6 | **Data pilot: data nyata atau anonim?** Berapa lama data disimpan, dan siapa yang boleh mengakses? | Menentukan kewajiban PDP (SOP-05 "security/kerahasiaan") dan desain akses | Data nyata terbatas ≤5 proyek, akses berbasis peran, retensi 1 tahun |
| Q7 | **Apakah 7 deliverable FR dan 8 prasyarat Buffer benar-benar wajib semua**, atau boleh disesuaikan per proyek (layar sekarang menyatakan "daftar bisa disesuaikan")? | Menentukan apakah item wajib dikunci (P0-07) atau boleh dikurangi dengan approval | Wajib semua; pengurangan hanya via approval + alasan tercatat |
| Q8 | **Angka BPOM 70%/30%/50% dan batas 4 minggu** — apakah berlaku hanya untuk kasus BPOM 2026 atau pola untuk semua penugasan Buffer sementara? Siapa pemilik angkanya? | Menentukan model data P2-09 (parameter per proyek vs konstanta sistem) | Parameter per proyek, diisi dari Nota Dinas; angka lama jadi nilai default |
| Q9 | **Tenggat laporan mingguan**: hari apa, jam berapa, dan siapa yang menegur bila terlambat? | Menentukan validasi & pengingat (P2-06) serta arti "compliance" | Tenggat Jumat 17.00 WIB; keterlambatan tercatat & tampil ke PM/Chapter |
| Q10 | **Acceptance**: apakah perlu unggah BAPP/BAST digital, atau cukup nomor + tanggal + penandatangan? Apakah tanda tangan basah tetap di luar sistem? | Menentukan bentuk entitas acceptance (P2-03) dan apakah perlu penyimpanan file | Cukup metadata (nomor, tanggal, penandatangan) + tautan dokumen di drive resmi |

---

## 7. Lampiran — bukti reproduksi

Semua bukti diambil dari aplikasi berjalan (Node v24.18.1, DB bersih, seed 3 proyek). Ringkas dan dapat
diulang; urutan sesuai tabel di §2 dan §3.

```bash
cd apps/ddp-project-control && rm -rf data && PORT=3312 node server.js &
B=http://localhost:3312
```

| Bukti | Perintah | Hasil yang diamati |
| --- | --- | --- |
| B1 — tanpa auth | `curl -X POST $B/api/projects -H 'Content-Type: application/json' -d '{"name":"Uji","track":"first_responder","project_type":"new"}'` | `200 {"id":4,"code":"PRJ-2026-004",...}` tanpa kredensial |
| E1 — field dibuang | tambahkan `"contract_type":"lumsum","role_fte":[{"role":"PM","fte":0.5}]` pada perintah di atas, lalu `curl $B/api/projects/4` | Kedua field tidak ada di respons |
| A1 (G2A) | hapus 7 deliverable proyek FR (`DELETE /api/projects/4/deliverables/:id`), isi NDE/anggaran/onboarding, lalu `POST /api/projects/4/advance` 2× | `{"next":"G2A","gaps":[]}` → `{"next":"G3","gaps":[]}` dengan 0 deliverable |
| A1 (G2B) | hapus 8 `buffer_checks`, lalu `POST /advance` dari G2B | `{"next":"G3","gaps":[]}` dengan 0 prasyarat |
| A2 — jalur berubah | `PUT /api/projects/4 {"track":"buffer"}` pada proyek di G2A | `gate_info {"next":null,"gaps":[]}`; `POST /advance` → `422 "Project sudah berada pada gate akhir"` |
| A2 — G2B dilewati | proyek FR di G3 → `PUT {"track":"buffer"}` | `gate_info next = G4`; G2B tidak pernah dinilai, 0 `buffer_checks` |
| A4 — eskalasi | `POST /api/projects/4/advance -d '{"force":1}'` 2× | Gate naik G4 → G5 dengan `"forced":1`; `events.actor = "operator web"` |
| A5 — state mustahil | `PUT /api/projects/4 {"status":"closed"}` saat gate G5 | 200; gate `G5`, status `closed` |
| A4/S06-5 — close bypass | `POST /api/projects/7/close` dari G0 | `{"ok":true,"gate":"CLOSED","status":"closed"}`, `prev_gate: "G0"` |
| A3 — kode bentrok | `DELETE /api/projects/4` lalu `POST /api/projects {...}` | `500 {"error":"UNIQUE constraint failed: projects.code"}` |
| A6 — tanggal | `PUT {"start_date":"2026-13-45","end_date":"bukan-tanggal"}` | 200; nilai tersimpan apa adanya |
| A7 — tak bisa dikosongkan | `PUT deliverables/:id {"evidence_url":"https://bukti"}` lalu `{"evidence_url":""}` | Nilai tetap `https://bukti` |
| B3 — header | `curl -i $B/api/kpis` | Hanya `content-type`, `date`, `connection`, `transfer-encoding` |
| B2 — rate limit baca | 260× `GET /api/kpis` | Semua `200` |
| E5 — laporan | `POST /api/projects/:id/reports -d '{"period":"minggu lalu","pm_confirmed":1,"pm_confirmed_by":"siapa saja"}'` | 200; tidak ada `pm_confirmed_at` |
| S05-7 — change | `POST /changes -d '{"title":"Tambah scope","approver":"Siapa Saja"}'` lalu `PUT /api/changes/:id {"status":"disetujui"}` | 200 tanpa kredensial |
| E6 — acceptance tidak ada | `GET $B/api/projects/4/acceptance` (juga `/handover`, `/bapp`) | `404 Endpoint tidak ditemukan` |
| G4 — tanpa bukti | proyek di G4 → `POST /advance` | `{"next":"G5","gaps":[]}` |
| S04-3 — verifikasi kosong | `PUT /api/projects/:id/buffer_checks/:cid {"verified":1}` | `verified:1`, `verified_by:""`, `evidence:""` |
| S03-4 — setujui kosong | `POST /deliverables {"name":"Deliverable tanpa bukti"}` lalu `PUT {"status":"disetujui"}` | 200; `evidence_url:""`, `reviewed_by:""` |
| S01-4 — lead time | `GET /api/projects` | PRJ-2026-002: `submit_by 2026-10-16`, warning "terlambat 6 hari"; PRJ-2026-003: `submit_by 2026-10-11`, "terlambat 11 hari" |
| X-4 — KPI | `GET /api/kpis` (baseline seed) | `admin 67, fr 0, buffer_tech 50, weekly 100, blockers 1 (age 3), transition 100` — transition dari 1 proyek eligible |

---

## 8. Ringkasan untuk tim

- **Untuk Sofia (DEEP-225):** 50 skenario di §3 siap dipakai; 46 `[MUST]`. Hari ini 10 LULUS / 40 GAGAL —
  kegagalan itu adalah *acceptance test*, bukan bug tak terdokumentasi. Prioritaskan AC yang menutup P0.
- **Untuk Bagas (DEEP-222):** P0-01/02 (vacuous gate), P0-03 (`/close`), P0-06 (status), P0-07 (hapus item
  wajib), P2-10/11/12/13 adalah perubahan aturan di server. Matriks §2 memberi butir & bukti per aturan.
- **Untuk Fajar (DEEP-223):** kriteria gate di frontend (`gateCriteria`, app.js:33) **berbeda** dari server
  (`gateGaps`) — setelah server diperbaiki, frontend harus membaca satu sumber (kontrak Bagas), bukan
  duplikat.
- **Untuk Adit (DEEP-220):** butir yang menunggu definisi aturan: S01-2/3/6, S02-4, S04-2/5, S05-1/6/9,
  S06-2/4/6, S07-1/6, X-4. Jangan duplikasi: dokumen ini menetapkan *apa yang harus benar*, bukan angka.
- **Untuk Victor (DEEP-224):** P0-05/P1-01/P2-14 adalah prasyarat pilot (auth, identitas pelaku, hardening).
- **Untuk Diana (DEEP-226):** dokumen ini + audit menjadi bahan traceability SOP↔fitur↔test; Q1–Q10 jadi
  daftar keputusan yang harus dijawab THEOFILUS.

*Dokumen ini menggambarkan kondisi aplikasi per 22 Oktober 2026 pada commit `af65560`. Setelah perbaikan
stage 2, verdict & baseline AC harus diperbarui — bukan disalin.*
