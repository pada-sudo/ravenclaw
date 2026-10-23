# Traceability PRD v1.0 ↔ Fitur ↔ Test — RavenClaw (v2)

- **Tanggal verifikasi:** 23 Oktober 2026
- **Commit yang dinilai:** `849e0bfbabe64f97cf5a9291081356e6c5dcb575` pada branch `agent/pedro-tech-lead/51d765bfc03a` (dari `main` `74e71f4`), belum di-merge ke `main`
- **Penyusun:** Diana (DEEP-237)
- **Sumber requirement:** PRD v1.0 *DDP Project Control Application* (23 Oktober 2026, lampiran DEEP-234, attachment `01a1672f-e3c9-7911-97c4-d8a3f28214b0`) — FR-01..FR-37, US-01..US-18, R01..R15, 9 blok Acceptance Criteria, OQ-01..OQ-08
- **Sumber kontrak:** `docs/DOMAIN-RULES.md` §13–§23, `docs/ADR/ADR-005-prd-v1-alignment.md`, `openapi.yaml` 2.2.0 (`x-impl-status`)
- **Sumber test:** `tests/` — 39 test `node --test`; `npm test` **39/39 lulus** pada commit di atas
- **Dokumen pendamping:** `TRACEABILITY-2026-10-22.md` (basis SOP/playbook, 66 butir) — dipetakan silang di §7, bukan digantikan

Dokumen ini menjawab satu pertanyaan: **untuk setiap ID requirement PRD, di mana buktinya di aplikasi hari ini, dan apa yang belum ada?** Status hanya menyatakan apa yang bisa saya tunjukkan; butir yang hanya bisa dibuktikan manual ditandai "manual" beserta perintahnya (§10).

## Arti status

| Status | Arti | Tingkat kepercayaan |
| --- | --- | --- |
| **LULUS** | Mekanisme ada dan **mengikat**: perilakunya dibuktikan test otomatis di `tests/`, atau endpoint-nya menolak input yang salah. | Tinggi |
| **SEBAGIAN** | Mekanisme ada (field, endpoint, layar) tetapi tidak mengikat penuh; celahnya disebut eksplisit. | Sedang |
| **BELUM** | Tidak dimodelkan di runtime: tidak ada kolom, tabel, endpoint, atau aturan. Bisa jadi sudah ada **kontrak**-nya (`DOMAIN-RULES`/`openapi.yaml`) — kontrak tidak dihitung sebagai bukti. | Tinggi (bahwa belum ada) |

**Bukan verdict kualitas.** LULUS berarti kontrolnya bekerja, bukan berarti UX, istilah, atau angka KPI-nya benar. Kualitas UX, test plan, dan definisi angka KPI bukan lingkup dokumen ini (masing-masing milik Rico, Sofia, Adit).

## 1. Ringkasan

| Kelompok | Baris | LULUS | SEBAGIAN | BELUM |
| --- | ---: | ---: | ---: | ---: |
| FR-01..FR-37 | 37 | 2 | 20 | 15 |
| US-01..US-18 | 18 | 3 | 11 | 4 |
| R01..R15 | 15 | 1 | 7 | 7 |
| AC (9 blok: US-01/02/03/08/10/15/16/17/18) | 9 | 0 | 6 | 3 |
| **Subtotal butir fitur (FR+US+R+AC)** | **79** | **6** | **44** | **29** |
| OQ-01..OQ-08 (keputusan, bukan fitur) | 8 | 0 | 0 | 8 |
| **Total baris terdokumentasi** | **87** | **6** | **44** | **37** |

Angka di atas dihitung ulang dari isi tabel (§2–§6), bukan diperkirakan: setiap baris punya tepat satu status, dan jumlah per kelompok dijumlahkan kembali di akhir setiap bagian.

Untuk OQ, **BELUM** berarti "keputusan belum ada di PRD", bukan cacat aplikasi; default usulan yang dipakai sementara ada di `ADR-005` §"Keputusan yang menunggu manusia" dan `DOMAIN-RULES` §11.

### 1.1 Cara menghitung ID (dan koreksi angka "89")

Issue DEEP-237 menyebut **89 ID** (37 FR + 18 US + 15 R + sisanya AC/OQ). Hasil hitung ulang atas dokumen PRD v1.0:

| Kelompok | Jumlah | Dasar hitung |
| --- | ---: | --- |
| FR | 37 | `FR-01`..`FR-37`, berurutan tanpa lompatan (§5 PRD) |
| US | 18 | `US-01`..`US-18`, berurutan tanpa lompatan (§4 PRD) |
| R | 15 | `R01`..`R15` (§3.2 PRD) |
| AC | **9** | blok "Acceptance Criteria" yang benar-benar ada: US-01, US-02, US-03, US-08, US-10, US-15, US-16, US-17, US-18. PRD menyebutnya "Key examples", bukan 18 AC. |
| OQ | **8** | `OQ-01`..`OQ-08` (§11 PRD) |
| **Total** | **87** | 37 + 18 + 15 + 9 + 8 |

Angka 89 **tidak dapat direproduksi** dari dokumen PRD: tidak ada dua ID tambahan yang bisa saya tunjukkan (tidak ada AC untuk 9 US lainnya, tidak ada OQ-09/OQ-10, dan §7 NFR tidak bernomor). Menebak dua ID supaya cocok dengan angka issue akan membuat dokumen ini tidak bisa diaudit, jadi saya mencatat 87 dan menyebut selisihnya di sini. Yang tetap terpenuhi: **setiap ID yang ada di PRD** (FR, US, R, AC, OQ) bisa dicari di satu dokumen ini dan punya bukti atau alasan "BELUM".

NFR §7 (performance, accessibility, security, data retention, availability, scalability, localisation, observability, browser support) tidak ber-ID sehingga tidak dinilai per baris; mekanisme yang terlihat (rate limit, security header, sesi, retensi event) sudah dinilai lewat FR-10..FR-14, FR-17, FR-34 dan butir lintas-potong di `TRACEABILITY-2026-10-22.md` §10.

## 2. Functional requirements FR-01..FR-37

| ID | Ringkas | Status | Bukti | Sisa celah |
| --- | --- | --- | --- | --- |
| FR-01 | Gate G0 → G1 → G2A → G2B → G3 → G4 → G5 | SEBAGIAN | `GATE_NEXT` per `track` `lib/domain.js:37-40`; kenaikan fail-closed `gateGaps` `lib/domain.js:125-174` + `POST .../advance` `lib/routes.js:176-205`; test `gateGaps: G2A first responder rejects when deliverables not all approved`, `POST /api/projects/:id/advance returns 422 with gaps when incomplete` | Urutan G2A→G2B tidak pernah terjadi: satu proyek hanya melewati salah satu (`first_responder` → G2A, `buffer` → G2B). Disengaja menurut ADR-005 §2/§4 — lihat §8.1 |
| FR-02 | Buffer gates B1–B4 sebagai kontrol opsional | BELUM | Kontrak saja: `docs/DOMAIN-RULES.md` §15; `PUT /api/projects/{id}/buffer_controls/{code}` bertanda `x-impl-status: contract-only` (`openapi.yaml:847`); manual: `PUT /api/projects/4/buffer_controls/B1` → `404` | Tidak ada tabel/kolom `buffer_controls` (grep `lib/`, `migrations/` = 0). `BUFFER_CHECKS` **bukan** bukti FR-02 (§8.3) |
| FR-03 | Sub-gate s4/sY | BELUM | Sama seperti FR-02; posisi pun belum ditetapkan di PRD (D-03, ADR-005) | Tidak ada kode, skema, maupun definisi posisi |
| FR-04 | Dua jalur kerja: Solution Vision & Solution | SEBAGIAN | `track` menggerakkan checklist dan urutan gate (`lib/domain.js:24,37-40`; intake `lib/routes.js:89-124`); test `PUT /api/projects/:id rejects track change after intake` | Istilah/nilai PRD tidak muncul sebagai data: manual `GET /api/projects/4` **tanpa** field `path`; `project_type` boleh bertentangan dengan `track` (manual: `existing` + `first_responder` → `200`). Lihat §8.2 |
| FR-05 | Kode proyek otomatis `PRJ-YYYY-NNN` | LULUS | `nextProjectCode()` `lib/db.js:114-123` (counter per tahun, atomik); test `POST /api/projects then DELETE then POST again yields unique code`; manual: `PRJ-2026-004` | — |
| FR-06 | Klasifikasi `new`/`existing` dan perutean ke jalur | SEBAGIAN | Enum `project_type` `lib/domain.js:25,227,237`; kolom `projects.project_type` `migrations/001_initial.sql:12` | Tidak ada perutean: `track` dipilih terpisah (`lib/domain.js:236`) dan boleh bertentangan; tidak ada `path_type_mismatch`; tidak ada test |
| FR-07 | Status gate `belum_mulai → dalam_proses → review → disetujui` | BELUM | Tidak ada `gate_status` di `lib/`/`migrations/` (grep = 0); `projects.gate` hanya pointer (`migrations/001_initial.sql:22`). Empat nilai itu milik `deliverables.status` (`lib/domain.js:29`), bukan gate | State machine gate dan riwayat transisi (`gate_records`) tidak ada |
| FR-08 | Tolak kenaikan gate bila prasyarat belum lengkap | SEBAGIAN | Fail-closed per gate dengan `422` + array `gaps`: `lib/domain.js:125-174`, `lib/routes.js:176-187`; test `gateGaps: G2B buffer rejects when checklist is empty`, `…when checklist items not verified`, `gateGaps: G0 new project rejects without reason_shared_service` | Prasyarat "deliverables **+ evidence**" belum utuh: deliverable bisa `disetujui` tanpa evidence (FR-17) sehingga gap G2A bisa kosong tanpa bukti |
| FR-09 | Approval kenaikan gate oleh approver per RACI | BELUM | `advance` biasa hanya butuh `write_project` (`lib/routes.js:177-179`); hanya jalur `force` yang butuh `approver_action` (`lib/routes.js:189-192`); test `approver can force advance with reason`, `operator cannot force advance` | Tidak ada approver per gate, tidak ada aksi `approve_gate`; test yang ada hanya membuktikan peran global, bukan RACI |
| FR-10 | 15 peran (R01–R15) dengan RBAC | BELUM | Runtime: 4 peran & 4 aksi (`lib/auth.js:7-22`); `users.role` CHECK 4 nilai (`migrations/003_users_and_sessions.sql:147`); `GET /api/roles` → `404` (kontrak `openapi.yaml:756`) | Katalog peran, kolom `role_code`, dan matriks aksi belum ada kodenya |
| FR-11 | PM konsolidator tunggal per proyek | BELUM | `projects.pm` hanya teks bebas (`migrations/001_initial.sql:11`); menulis proyek terbuka untuk operator/PM/approver (`lib/auth.js:19`) | Tidak ada kepemilikan PM per proyek; tidak ada field konsolidasi yang dilindungi |
| FR-12 | Hanya approver yang ditetapkan boleh approve gate | BELUM | Tidak ada aksi `approve_gate`; status deliverable diubah oleh `write_project` (`lib/routes.js:297-319`) | Tidak ada endpoint approval gate; tidak ada pemisahan approver per gate |
| FR-13 | RACI per gate sebagai data yang ditampilkan | SEBAGIAN | RACI tampil sebagai konten statis: `public/content/raci.json` → `public/modules/views/reference.js:7-17,64-66`; manual: halaman referensi menampilkan "RACI Ringkas (usulan)" | Bukan per gate, bukan matriks approver §16.4, bukan data API (`GET /api/raci` → `404`) |
| FR-14 | Manager/Chapter Manager bukan approver tunggal | BELUM | Tidak ada approver per gate, sehingga pembatasan ini belum bisa ditegakkan | Hanya usulan §14.3/§16.2; menunggu OQ-01 |
| FR-15 | Katalog deliverable per gate (Project Request, BRD, User Story, SAD, Workforce Plan, IDS, IDD, Security Review, BAST) | SEBAGIAN | 7 deliverable FR otomatis dengan `owner_role` (`lib/domain.js:5-13`; dibuat `lib/routes.js:113-115`); test G2A + manual: 7 baris | Hanya 7 dari katalog; tidak ada `project_request`, `user_story`, `security_review`, `qa_test_result`, `accessibility_review`, `compliance_evidence`, `bast`; tidak ada kolom `kind` (`migrations/001_initial.sql:37-48`) |
| FR-16 | Versioning + status + evidence per deliverable | SEBAGIAN | Status, `evidence_url`, `reviewed_by`, `due_date` (`migrations/001_initial.sql:37-48`; `lib/routes.js:297-319`) | Tidak ada versi/riwayat: `version`/`deliverable_versions` tidak ada di `lib/`/`migrations/`; evidence tidak wajib |
| FR-17 | Evidence-first: `disetujui` tanpa evidence ditolak | BELUM | `PUT .../deliverables/:did` menulis status apa adanya (`lib/routes.js:297-319`); manual: `PUT {"status":"disetujui"}` → `200` dengan `evidence_url:""`, `reviewed_by:""`; tidak ada test | Aturan `422 evidence_required` belum ada; ini juga gap P0 pada `TRACEABILITY-2026-10-22.md` (S03-4, AC-03.4) |
| FR-18 | Status deliverable terlihat di dashboard per proyek & per gate | SEBAGIAN | `GET /api/projects/:id` mengembalikan daftar deliverable (`lib/routes.js:126-142`); layar *Deliverable Setup* `public/modules/views/project-detail.js:269`; KPI `fr_readiness_pct` (`lib/domain.js:181-184`) di `public/modules/views/dashboard.js:31` | Dashboard tidak mengelompokkan per gate; status gate per se tidak ada (FR-07), jadi "per gate" hanya label kartu |
| FR-19 | Assignment talent merujuk ND | SEBAGIAN | `nde_no`/`nde_date` wajib di G1 (`lib/domain.js:136-140`); test `gateGaps: G1 first responder requires NDE, budget, and BO/PM` | Merujuk ND di level **proyek**, bukan assignment per talent (tidak ada entitas assignment). Koreksi label §23 "jalan" ada di §9 |
| FR-20 | Visibilitas SMM | BELUM | Tidak ada field/skema; SMM adalah sistem eksternal (OQ-05; `DOMAIN-RULES` §23.1) | Di luar cakupan v1; menunggu OQ-05 |
| FR-21 | Assignment Talent Buffer PM + status knowledge transfer | SEBAGIAN | Status KT ada sebagai satu baris checklist `BUFFER_CHECKS` (`lib/domain.js:18`) yang diverifikasi lewat `PUT .../buffer_checks/:cid` (`lib/routes.js:351-372`) | Tidak ada entitas assignment talent; KT hanya boolean `verified`, tanpa bukti wajib |
| FR-22 | Status onboarding per talent | SEBAGIAN | `onboarding_status` enum 3 nilai (`lib/domain.js:28`; `migrations/001_initial.sql:21`), diperiksa di G1 (`lib/domain.js:139`) | Level proyek, bukan per talent; cukup dipilih, tanpa tanggal efektif/PIC |
| FR-23 | Blocker: deskripsi, dampak, owner, due date, status | SEBAGIAN | Tabel `risks` punya `description`, `impact`, `owner`, `due_date`, `status` (`migrations/001_initial.sql:80-94`); `POST .../risks` menerima semuanya (`lib/routes.js:406-421`) | Tidak wajib: manual `{"kind":"blocker","title":"Blocker uji"}` → `200`; tidak ada kode `blocker_incomplete` |
| FR-24 | Routing blocker ke eskalasi L1–L4 | BELUM | Hanya flag `escalated` (`migrations/001_initial.sql:91`); `escalation_level`/`escalation_log` tidak ada (grep = 0) | Tidak ada level, tujuan, atau routing |
| FR-25 | SLA per level (L1 3h, L2 3h, L3/L4 per-case) | BELUM | Tidak ada field SLA (`sla_due_at` grep = 0) | Perhitungan & pelanggaran SLA tidak ada |
| FR-26 | Log semua eskalasi + status resolusi + timestamp | SEBAGIAN | `risks.status` open/closed + `closed_at` (`migrations/001_initial.sql:90-93`; `lib/routes.js:423-445`) dan event audit (`lib/db.js:109-112`) | Tidak ada log eskalasi (level, alasan, aktor, waktu naik level) |
| FR-27 | Weekly report otomatis terkonsolidasi | SEBAGIAN | Tabel `weekly_reports` memuat planned/actual/evidence/blockers/next_steps/decisions (`migrations/001_initial.sql:62-78`); `POST .../reports` (`lib/routes.js:374-390`); konfirmasi PM (`:392-404`) | Dibuat manual, bukan auto-generate; tidak memuat snapshot gate status; tidak ada unduh/bagikan. Isi boleh kosong (manual: `{"period":"minggu lalu"}` → `200`) |
| FR-28 | Dashboard real-time: gate status, KPI, SLA eskalasi | SEBAGIAN | `GET /api/kpis` dihitung per request (`lib/domain.js:176-216`; `lib/routes.js:59-64`); dashboard `public/modules/views/dashboard.js:9-56` | KPI/SLA eskalasi tidak ada (FR-25 BELUM); "gate status" hanya kolom `gate` pada daftar proyek |
| FR-29 | 6 KPI: admin, technical, compliance, blocker health, solution vision, transition readiness | SEBAGIAN | 5 dari 6 terisi: `admin_readiness_pct`, `buffer_tech_readiness_pct`, `blockers_open`, `fr_readiness_pct`, `transition_ready_pct` (`lib/domain.js:201-215`) | `compliance_readiness_pct` tidak ada; blocker health cacat: manual `GET /api/kpis` → `blocker_avg_age_days: 0`, `blocker_list[].age_days: null` (K11) |
| FR-30 | Master register dengan field minimum | SEBAGIAN | `projects` + KPI: `code`, `name`, `customer_cfu`, `business_owner`, `pm`, `project_type`, `gate`, status deliverable (`migrations/001_initial.sql:4-35`; `lib/routes.js:66-87`) | `chapter_manager` dan `scope` tidak ada kolomnya (grep = 0); "admin readiness" hanya turunan field, bukan field register |
| FR-31 | Kesiapan procurement (vendor category, tender, contract type) + tenggat | SEBAGIAN | `procurement_doc`, `procurement_target_start`, `submit_by`, `warning` (`lib/domain.js:262-273`; `lib/routes.js:84`) | `vendor_category`, `tender_status`, `contract_type` tidak ada (grep = 0); tidak ada status proses/tahap |
| FR-32 | Tenggat kontrak: SPKS 2 bln, PO 1,5 bln, SPB 1 bln, SPB 2 mgg | LULUS | `PROC_LEAD_DAYS` 60/45/30/14 hari (`lib/domain.js:31-36`), `procurementInfo()` (`:262-273`); manual: dokumen PKDF + target → `submit_by` dan peringatan keterlambatan | Nama dokumen runtime (PKDF/Justifikasi Kontrak Lumsum/Surat Pesanan) ≠ istilah PRD (SPKS/PO/SPB); pemetaan resmi menunggu D-01 |
| FR-33 | Bukti kepatuhan (QA, security, accessibility) | BELUM | Tidak ada tabel/kolom; `compliance_evidence` hanya kontrak (`DOMAIN-RULES` §21.1) | Tidak ada penyimpanan, status, atau review R12 |
| FR-34 | Klasifikasi data + kepatuhan PDP | BELUM | `data_classification`/`pdp_assessment` tidak ada (grep = 0) | Tidak ada field, validasi, atau konsekuensi gate |
| FR-35 | Sign-off customer (BAST) di G5 | BELUM | `PUT /api/projects/{id}/acceptance` contract-only (`openapi.yaml:886`); manual: `GET /api/projects/4/acceptance` → `404` | Tidak ada tabel acceptance/BAST |
| FR-36 | Penutupan dengan bukti acceptance + evaluasi | SEBAGIAN | `POST /api/projects/:id/close` (`lib/routes.js:207-219`) menulis event; G5 hanya butuh `notes` (`lib/domain.js:170-172`) | Menutup dari gate mana pun: manual `POST .../close` pada proyek G0 → `200 {"gate":"CLOSED"}` (K2); acceptance/evaluasi tidak wajib |
| FR-37 | Reopen bila prasyarat penutupan belum terpenuhi | SEBAGIAN | `POST /api/projects/:id/reopen` (`lib/routes.js:221-233`) hanya `approver_action`, kembali ke `prev_gate` atau G5 | Tidak wajib `reason`; acceptance tidak dikembalikan ke `menunggu_tanda_tangan`; tidak ada `reopen_count` |

**Hitung ulang FR:** LULUS 2 (FR-05, FR-32) + SEBAGIAN 20 + BELUM 15 = **37**.

- SEBAGIAN (20): FR-01, 04, 06, 08, 13, 15, 16, 18, 19, 21, 22, 23, 26, 27, 28, 29, 30, 31, 36, 37
- BELUM (15): FR-02, 03, 07, 09, 10, 11, 12, 14, 17, 20, 24, 25, 33, 34, 35

## 3. User story US-01..US-18

| ID | Ringkas | Status | Bukti | Sisa celah |
| --- | --- | --- | --- | --- |
| US-01 | Pemohon Bisnis mengajukan permintaan proyek (requirement, target, info kontrak, ND) → G0 | SEBAGIAN | `POST /api/projects` (`lib/routes.js:89-124`); field target/ND/alasan: `procurement_target_start`, `nde_no`, `nde_date`, `reason_shared_service` (`lib/domain.js:221-232`) | Tidak ada field requirement bisnis maupun info kontrak; tidak ada peran R01; status awal `active` (bukan "dalam_proses") |
| US-02 | PM membuat proyek, kode otomatis, klasifikasi new/existing → jalur yang benar | SEBAGIAN | Kode otomatis FR-05 (LULUS); `project_type` disimpan (`lib/domain.js:227,237`) | Perutean tidak otomatis: `track` dipilih operator; kombinasi `existing` + `first_responder` diterima `200` (manual) |
| US-03 | Satu tempat untuk scope, disiplin, evidence, blocker, laporan; peran tak berwenang tak bisa mengubah | SEBAGIAN | Satu layar detail proyek: `GET /api/projects/:id` (`lib/routes.js:126-142`) + `public/modules/views/project-detail.js` | Tidak ada field "konsolidasi PM" yang dilindungi; operator/PM/approver sama-sama `write_project` (`lib/auth.js:19`) |
| US-04 | Chapter Manager meninjau kesiapan talent di G1 (role, SMM, personel, onboarding, jadwal) | SEBAGIAN | G1 memeriksa NDE, anggaran, onboarding (`lib/domain.js:136-140`); test `gateGaps: G1 first responder requires NDE, budget, and BO/PM` | Role/SMM/personel/jadwal tidak dimodelkan; tidak ada peran R03; verifikator tidak tercatat |
| US-05 | BA membuat BRD + user story sebagai deliverable G2A, berversi, siap direview SA | SEBAGIAN | Deliverable BRD otomatis dengan owner "PM dan/atau Business Analyst" (`lib/domain.js:7`); status + `reviewed_by` (`lib/routes.js:297-319`) | User Story tidak dibuat otomatis; tidak ada versi (FR-16); evidence tidak wajib |
| US-06 | SA membuat SAD + Workforce Plan dan mencatat status validasi teknis | SEBAGIAN | SAD & Workforce Plan otomatis, owner `Solution Architect` (`lib/domain.js:8-9`) | "Status validasi teknis" tidak terpisah dari status deliverable; evidence tidak wajib |
| US-07 | Data Team membuat IDS sebagai deliverable yang terlacak | LULUS | `Initial Data Solution` otomatis (`lib/domain.js:10`); status/evidence/reviewer tersimpan (`migrations/001_initial.sql:37-48`); manual: 7 baris saat intake | Evidence tidak wajib (FR-17) — deliverable bisa `disetujui` kosong |
| US-08 | Design Team membuat IDD sebagai deliverable yang terlacak | LULUS | `Initial Design Documentation` otomatis (`lib/domain.js:11`); mekanisme sama dengan US-07 | Sama seperti US-07 |
| US-09 | Talent Buffer PM menugaskan talent via ND + melacak KT | BELUM | Tidak ada entitas assignment; KT hanya satu baris checklist (FR-21) | Tidak ada ND per assignment maupun status KT per orang |
| US-10 | Reviewer menyetujui/menolak deliverable dan kenaikan gate, tercatat dengan bukti + timestamp | SEBAGIAN | Perubahan status deliverable + `reviewed_by` + event bertimestamp (`lib/routes.js:297-319`; `lib/db.js:109-112`) | Approval **gate** tidak ada (FR-07/FR-09); penolakan tidak mewajibkan `note`; approver tidak dibatasi per gate |
| US-11 | Procurement melacak vendor category, tender, dan timeline kontrak | SEBAGIAN | Dokumen procurement + lead time + peringatan (`lib/domain.js:262-273`) | Vendor category & tender status tidak ada (FR-31) |
| US-12 | QA/Security/PDP mereview kepatuhan dan menerbitkan bukti kepatuhan | BELUM | Tidak ada mekanisme; laporan hanya punya "evidence" teks bebas, bukan jenis kepatuhan | FR-33/FR-34 BELUM |
| US-13 | Customer memberi sign-off BAST dan acceptance | BELUM | Tidak ada tabel/endpoint acceptance (manual `GET .../acceptance` → `404`) | FR-35 BELUM |
| US-14 | Operator/Admin membuat master data, mengubah status deliverable, mengelola laporan | LULUS | Peran `operator` (`lib/auth.js:18-19`) dapat intake (`lib/routes.js:89`), ubah deliverable (`:297`), buat laporan (`:374`), ubah data proyek (`:144`); test `login and logout work`, `auditor cannot mutate projects` | Nama aksi di ADR-005 lebih rinci daripada 4 aksi di kode; kemampuan intinya terbukti |
| US-15 | Siapa pun mengangkat blocker (deskripsi, dampak, owner, due) → L1 + SLA | SEBAGIAN | `POST .../risks` kind=blocker (`lib/routes.js:406-421`) | Field tidak wajib (manual `200` tanpa owner/due); tidak ada L1/SLA; `auditor` read-only sehingga "any role" tidak terpenuhi (manual `403`) |
| US-16 | PM membuat laporan mingguan terkonsolidasi, bisa diunduh/dibagikan | SEBAGIAN | Kolom laporan (`migrations/001_initial.sql:62-78`) + konfirmasi PM (`lib/routes.js:392-404`) | Tidak auto-generate; gate status tidak disertakan; tidak ada ekspor/unduh |
| US-17 | Dashboard menampilkan gate status, KPI, SLA eskalasi secara real-time | SEBAGIAN | `/api/kpis` + dashboard (`public/modules/views/dashboard.js:9-56`); akses butuh sesi — test `anonymous requests are rejected` | SLA eskalasi tidak ada; gate status hanya kolom pada daftar proyek |
| US-18 | PM/role mengeskalasi blocker sesuai severity dengan SLA dan status resolusi | BELUM | Tidak ada level, SLA, maupun auto-eskalasi; hanya flag `escalated` | FR-24..FR-26 BELUM |

**Hitung ulang US:** LULUS 3 (US-07, US-08, US-14) + SEBAGIAN 11 + BELUM 4 (US-09, US-12, US-13, US-18) = **18**.

## 4. Peran R01..R15

Status di sini menilai **peran sebagai mekanisme akses** (apakah peran itu ada dan membatasi aksi), bukan apakah pekerjaannya bisa dilakukan manual di luar aplikasi. Pemetaan resmi: `ADR-005` §3.

| ID | Peran (PRD) | Status | Bukti | Sisa celah |
| --- | --- | --- | --- | --- |
| R01 | Pemohon Bisnis / C7U | BELUM | Tidak ada kode peran; intake dilakukan `operator`/`pm`/`approver` (`lib/auth.js:19`) | Katalog peran hanya kontrak (`openapi.yaml:756`) |
| R02 | Tribe / Unit terkait | BELUM | — | Tidak ada peran atau field kesiapan talent internal |
| R03 | Chapter Manager DPS | BELUM | — | Tidak ada peran; `chapter_manager` juga tidak ada sebagai field proyek (FR-30) |
| R04 | Project Manager (PM) | SEBAGIAN | Peran legacy `pm` (`lib/auth.js:7-12`) — dipetakan ke R04 oleh ADR-005 §3; `pm_action` untuk konfirmasi laporan & `close` (`lib/routes.js:207,392`) | Konsolidasi per proyek tidak ditegakkan (FR-11); PM bukan satu-satunya penulis field proyek |
| R05 | Business Analyst (BA) | SEBAGIAN | Hanya label `owner_role` pada BRD (`lib/domain.js:7`) | Tidak ada izin/penugasan per peran; siapa pun dengan `write_project` bisa mengubah BRD |
| R06 | Solution Architect (SA) | SEBAGIAN | Label `owner_role` pada SAD & Workforce Plan (`lib/domain.js:8-9`) | Sama seperti R05 |
| R07 | Data Team | SEBAGIAN | Label `owner_role` pada IDS (`lib/domain.js:10`) | Sama seperti R05 |
| R08 | Design Team | SEBAGIAN | Label `owner_role` pada IDD (`lib/domain.js:11`) | Sama seperti R05 |
| R09 | Talent Buffer PM | BELUM | Tidak ada peran; KT hanya checklist (FR-21) | Tidak ada assignment/ND per talent |
| R10 | Reviewer / Approver Governance | SEBAGIAN | Peran legacy `approver`: `approver_action` untuk `force_advance`, `reopen`, `delete`, `decide_change` (`lib/auth.js:21`; `lib/routes.js:189,221,236,461`) | Tidak ada `approve_gate` per gate; R10 belum dibatasi ke G2A/G2B/G4 |
| R11 | Procurement | BELUM | — | Tidak ada peran maupun data vendor/tender |
| R12 | QA / Security / PDP | BELUM | — | Tidak ada peran maupun bukti kepatuhan |
| R13 | Customer | BELUM | — | Tidak ada peran, BAST, atau acceptance |
| R14 | Operator / Admin Aplikasi | LULUS | Peran legacy `operator` dapat data entry, ubah deliverable, kelola laporan (`lib/auth.js:18-19`; `lib/routes.js:89,297,374`); test `login and logout work` | Tidak ada peran terpisah "admin aplikasi" vs operator; kemampuan R14 terbukti |
| R15 | Owner / Agile ALSKJKTTP Project Control | SEBAGIAN | `auditor` read-only dipertahankan (`lib/auth.js:18`; test `auditor cannot mutate projects`) — identitas R15 per ADR-005 §3 | Izin tulis R15 (kualitas data, laporan) belum diberikan; menunggu D-02 |

**Hitung ulang R:** LULUS 1 (R14) + SEBAGIAN 7 (R04, R05, R06, R07, R08, R10, R15) + BELUM 7 (R01, R02, R03, R09, R11, R12, R13) = **15**.

## 5. Acceptance criteria (9 blok yang ada di PRD)

PRD hanya memberi AC untuk 9 user story ("Key examples"). Yang tidak ada AC-nya tidak saya karang; kebutuhannya dinilai di baris US masing-masing.

| ID | Kriteria (ringkas) | Status | Bukti | Sisa celah |
| --- | --- | --- | --- | --- |
| AC-US-01 | Permintaan masuk G0 dengan status "dalam_proses", semua field tersimpan & terlihat PM | SEBAGIAN | Proyek lahir di `gate=G0` (`lib/routes.js:109`) dan field tersimpan/terbaca (`GET /api/projects/:id`) | Status awal `active`, bukan `dalam_proses`; field requirement & kontrak tidak ada |
| AC-US-02 | Kode `PRJ-YYYY-NNN`, proyek `new` dirutekan ke Solution Vision | SEBAGIAN | Format kode LULUS (`lib/db.js:114-123`; test unique code); `project_type` tersimpan | Tidak ada `path`/Solution Vision di respons; perutean tidak ditegakkan (manual `existing` + `first_responder` → `200`) |
| AC-US-03 | Scope, disiplin, evidence, blocker, laporan terlihat di satu tempat; peran tak berwenang tidak bisa mengubah field konsolidasi | SEBAGIAN | Satu layar detail proyek (`lib/routes.js:126-142`; `public/modules/views/project-detail.js`) | Tidak ada field konsolidasi terlindungi; otorisasi hanya tingkat peran global |
| AC-US-08 | `disetujui` tanpa evidence ditolak + pesan "Evidence required before approval" | BELUM | Manual: `PUT .../deliverables/8 {"status":"disetujui"}` → `200`, `evidence_url:""` | Tidak ada validasi; pesan error tidak ada |
| AC-US-10 | Approval gate mengubah status ke `disetujui` dan tercatat dengan timestamp + approver ID | BELUM | `POST .../advance` mencatat event bertimestamp + aktor (`lib/routes.js:196-202`; `lib/db.js:109-112`) | Tidak ada status gate `disetujui` (FR-07) maupun approver per gate (FR-09); yang tercatat adalah kenaikan pointer gate |
| AC-US-15 | Blocker menyimpan deskripsi, dampak, owner, due dan masuk L1 dengan SLA | SEBAGIAN | `POST .../risks` menerima field tersebut (`lib/routes.js:406-421`) | Tidak wajib (manual `200` tanpa owner/due); tidak ada L1/SLA |
| AC-US-16 | Laporan memuat scope, disiplin, evidence, blocker, next steps, gate status; bisa diunduh/dibagikan | SEBAGIAN | Kolom `planned`/`actual`/`evidence_url`/`blockers`/`next_steps`/`decisions_needed` (`migrations/001_initial.sql:62-78`) | Gate status tidak disertakan; tidak ada unduh/ekspor; isi boleh kosong |
| AC-US-17 | Dashboard menampilkan gate status, KPI, SLA eskalasi real-time; peran tak berwenang ditolak | SEBAGIAN | Dashboard `public/modules/views/dashboard.js:9-56`; auth: test `anonymous requests are rejected`, `auditor cannot mutate projects` | SLA eskalasi tidak ada; gate status hanya kolom `gate` |
| AC-US-18 | Pelanggaran SLA L1 (3 hari) otomatis naik ke L2 dan tercatat | BELUM | Tidak ada perhitungan SLA/level (grep `sla_due_at`, `escalation_level` = 0) | FR-24/FR-25 BELUM |

**Hitung ulang AC:** LULUS 0 + SEBAGIAN 6 + BELUM 3 (AC-US-08, AC-US-10, AC-US-18) = **9**.

## 6. Open questions OQ-01..OQ-08

Baris ini bukan fitur; status **BELUM** berarti keputusan resmi belum ada. Yang dicatat adalah default sementara (`ADR-005`, `DOMAIN-RULES` §11) supaya tidak ada dua jawaban diam-diam.

| ID | Pertanyaan | Status | Default sementara / bukti | Pemilik (PRD) |
| --- | --- | --- | --- | --- |
| OQ-01 | Siapa approver resmi per gate? | BELUM | ADR-005: G0/G1/G3 → R03, G2A/G2B/G4 → R10, G5 → R13 (+co-sign R10); runtime belum punya approver per gate (FR-09 BELUM) | Chapter Manager DPS |
| OQ-02 | SLA persis L3/L4? | BELUM | Default: L3/L4 per-case tanpa auto-escalate; runtime belum punya SLA (FR-25 BELUM) | Pisjen / Governance |
| OQ-03 | B1–B4 wajib atau opsional? | BELUM | Default: opsional (`mandatory=false`, `tidak_berlaku`); runtime belum punya kontrol B1–B4 (FR-02 BELUM) | PMO / Governance |
| OQ-04 | Retensi file evidence? | BELUM | Default: minimal 5 tahun, tanpa purge otomatis (juga menunggu ADR-003) | PDP / Security |
| OQ-05 | Integrasi Workday/SAP di Phase 1? | BELUM | Default: tidak; ND diisi manual (`nde_no`/`nde_date`) — FR-20/FR-21 ditunda | PMO / IT |
| OQ-06 | Definition of Solution Vision vs Solution final? | BELUM | Default = pemetaan ADR-005 §2 (`first_responder` → Solution Vision, `buffer` → Solution); belum ada field `path` di runtime (FR-04) | Solution Architect |
| OQ-07 | BRD wajib sebelum SAD, atau boleh paralel? | BELUM | Default: gate G2A mensyaratkan **semua** deliverable `disetujui` (`lib/domain.js:141-148`), jadi paralel tidak mungkin; keputusan resmi tetap terbuka | Business Analyst |
| OQ-08 | Berapa lama Talent Buffer boleh ada? | BELUM | Default: bridging dianggap selesai bila talent definitif terencana (`transition_ready_pct`); tidak ada batas hari | Talent Buffer PM |

**Hitung ulang OQ:** BELUM 8 = **8**.

## 7. Pemetaan silang butir SOP lama ↔ ID PRD

Tujuan bagian ini: **satu sumber kebenaran**. `TRACEABILITY-2026-10-22.md` menilai 66 butir SOP/playbook; PRD menilai FR/US/R. Keduanya tidak boleh hidup sendiri-sendiri, jadi setiap butir lama dipetakan ke ID PRD yang menaunginya. Kolom "Catatan" menyebut bila cakupannya tidak sama persis. Tabel ini 61 baris untuk 66 butir: S07-1..S07-6 digabung dalam satu baris karena keenamnya sama-sama tidak punya padanan PRD (§7.2).

| Butir SOP lama (`TRACEABILITY-2026-10-22.md`) | ID PRD terkait | Catatan |
| --- | --- | --- |
| G0 (intake & klasifikasi) | FR-01, FR-06, US-01, AC-US-01, R01/R04 | PRD memisahkan R01 (pemohon) dan R04 (PM); runtime hanya punya PM/operator |
| G1 (kesiapan talent) | FR-01, FR-08, FR-19, FR-22, US-04, R03 | ND & onboarding diperiksa di level proyek, bukan per talent |
| G2A (Solution Vision) | FR-01, FR-08, FR-15, US-05, US-06, US-07, US-08, R05–R08 | Sama-sama "semua deliverable disetujui"; PRD menambah User Story (tidak ada di runtime) |
| G2B (Solution) | FR-01, FR-02, FR-03, FR-08, FR-21 | Checklist buffer = `buffer_checks` (SOP-04), bukan B1–B4 (FR-02) |
| G3 (eksekusi & monitoring) | FR-01, FR-08, FR-27, FR-28, US-16, US-17 | — |
| G4 (compliance & review) | FR-01, FR-33, FR-34, US-12, R12 | Tidak ada mekanisme di kedua dokumen |
| G5 (closure & BAST) | FR-01, FR-35, FR-36, US-13, R13 | SOP-06 = PRD G5; keduanya belum ada acceptance |
| CLOSED | FR-36, FR-37 | PRD menambah syarat prasyarat penutupan |
| Jalur FR (First Responder) | FR-04, FR-06, FR-01 | Istilah PRD: *Solution Vision* / `path`; runtime: `track=first_responder` |
| Jalur Buffer | FR-02, FR-04, FR-21 | Istilah PRD: *Solution* / `path`; runtime: `track=buffer` |
| S01-1 (ruang lingkup & outcome) | FR-30, US-01 | PRD memakai `scope` di master register, bukan field outcome |
| S01-2 (jenis kontrak & vendor) | FR-31, US-11 | Vendor category/tender tidak ada di runtime |
| S01-3 (tahap tender & timeline) | FR-31, US-11 | Hanya tenggat submit yang dihitung |
| S01-4 (tenggat kontrak 60/45/30/14) | FR-32 | LULUS di runtime (`PROC_LEAD_DAYS`) |
| S01-5 (target start & asumsi) | FR-32, US-01 | Diambil dari `procurement_target_start` |
| S01-6 (kebutuhan role & FTE) | R02, R03, US-04 | Tidak dimodelkan |
| S01-7 (proyek baru → jalur A) | FR-04, FR-06, US-02 | Perutean hanya manual |
| S01-8 (proyek existing → jalur B) | FR-04, FR-06, US-02 | Sama |
| S01-9 (ND & data talent) | FR-19, US-01, US-04 | ND level proyek |
| S01-10 (risiko keterlambatan resource) | FR-23, US-15 | Berupa entri RAID, bukan analisis kapasitas |
| S02-1 (verifikasi NDE/ND) | FR-19, US-04 | Diperiksa sebagai gap G1 |
| S02-2 (anggaran & BO/PM) | FR-30, US-04, R04 | Anggaran hanya nomor/flag, tanpa nilai |
| S02-3 (onboarding talent) | FR-22, US-04 | Level proyek |
| S02-4 (role, SMM, personel) | FR-20, FR-30, US-04 | Tidak ada; OQ-05 |
| S02-5 (status pending/blocked per talent) | FR-07, FR-24 | Status per talent tidak ada; gate status juga belum ada |
| S02-6 (akuntabilitas PM) | FR-09, FR-11, FR-12, US-10 | Belum ditegakkan |
| S03-1 (BRD/SAD/IDS/IDD sebagai deliverable) | FR-15, US-05..US-08 | 7 deliverable otomatis |
| S03-2 (prasyarat gate G2A) | FR-08, US-05 | Fail-closed |
| S03-3 (status deliverable & progres) | FR-16, FR-18 | Tanpa versi |
| S03-4 (evidence sebelum disetujui) | FR-17, AC-US-08 | BELUM di keduanya |
| S03-5 (koreksi/versi deliverable) | FR-16 | Tidak ada versi |
| S03-6 (review & approval gate) | FR-09, FR-12, US-10 | Hanya deliverable, bukan gate |
| S04-1 (prasyarat teknis buffer) | FR-02, FR-08 | Kontrak vs checklist |
| S04-2 (kontrol B1–B4) | FR-02, FR-03 | BELUM; SOP tak memakai istilah B1–B4 |
| S04-3 (bukti prasyarat) | FR-08, FR-17 | Evidence tidak wajib |
| S04-4 (verifikasi prasyarat) | FR-08 | `PUT .../buffer_checks/:cid` |
| S04-5 (definitive plan/handover) | FR-21, FR-29 | Hanya baris KT |
| S04-6 (knowledge transfer) | FR-21, AC-US-08 | Boolean tanpa bukti wajib |
| S05-1 (scope & disiplin di laporan) | FR-27, FR-30 | Disiplin tidak dimodelkan |
| S05-2 (isi laporan mingguan) | FR-27, US-16 | Kolom ada, isi bebas |
| S05-3 (kadensi & konfirmasi PM) | FR-27, R04, AC-US-16 | `pm_action` konfirmasi |
| S05-4 (tenggat laporan) | FR-27, FR-29 | Hanya KPI kepatuhan 7 hari |
| S05-5 (konsolidasi lintas proyek) | FR-27, FR-28, US-17 | Dashboard, bukan laporan gabungan |
| S05-6 (bukti kepatuhan) | FR-33, US-12 | BELUM |
| S05-7 (change control) | FR-09, FR-12, US-10 | `POST .../changes` ada, tanpa approval gate |
| S05-8 (pencatatan blocker) | FR-23, US-15 | Field tidak wajib |
| S05-9 (eskalasi & SLA) | FR-24, FR-25, FR-26, US-18 | BELUM |
| S05-10 (validitas & klasifikasi data) | FR-34, R12 | BELUM |
| S06-1 (ringkasan deliverable saat closure) | FR-18, FR-36 | Hanya daftar deliverable |
| S06-2 (BAST & acceptance) | FR-35, US-13, R13 | BELUM |
| S06-3 (evaluasi pasca-implementasi) | FR-36 | Tidak ada field evaluasi |
| S06-4 (handover ke operasi) | FR-21, FR-36 | Hanya KT checklist |
| S06-5 (penutupan proyek) | FR-36, US-13 | Bisa menutup dari gate mana pun (K2) |
| S06-6 (pelajaran & arsip) | FR-36 | Hanya event + catatan |
| S07-1..S07-6 (playbook BPOM) | — | **Tidak ada padanan di PRD**; lihat §7.2 |
| X-1 (audit trail) | FR-26, US-10 | Event audit per entitas |
| X-2 (riwayat perubahan deliverable) | FR-16, US-10 | Tidak ada versi |
| X-3 (data talent & ND) | FR-19, FR-21, FR-22, R02, R03 | Level proyek saja |
| X-4 (KPI & dashboard) | FR-28, FR-29, US-17 | 5 dari 6 KPI |
| X-5 (validitas & keamanan data) | FR-34, FR-17 | BELUM |
| X-6 (kode & identitas proyek) | FR-05, US-02 | LULUS |

### 7.1 ID PRD yang tidak punya padanan di daftar SOP lama

| ID PRD | Kenapa tidak ada padanan |
| --- | --- |
| FR-03 (sub-gate s4/sY) | SOP tidak mengenal sub-gate; PRD pun belum menetapkan posisinya |
| FR-13, FR-14, OQ-01 (RACI per gate, bukan approver tunggal) | SOP lama hanya menyebut "verifikasi", tanpa matriks RACI |
| FR-30 (master register) | SOP menilai per gate, bukan register lintas proyek |
| US-11 (vendor category & tender) | S01-3 menyebut timeline tender, tapi bukan data vendor |
| US-17, US-18 (dashboard SLA, auto-eskalasi) | S05-9 menyebut eskalasi, tanpa level/SLA atau tampilan |
| OQ-02..OQ-08 | SOP tidak memuat open question; keputusan ini baru muncul di PRD |

### 7.2 Butir SOP lama yang tidak punya padanan di PRD

Enam butir playbook **BPOM** (S07-1..S07-6) tidak punya ID PRD: PRD v1.0 tidak memuat domain BPOM sama sekali. Konsekuensinya:

- Butir S07 tidak boleh diklaim sebagai "sudah ada di PRD", dan sebaliknya status PRD tidak boleh dipakai untuk menyatakan S07 lulus.
- Bila BPOM tetap masuk lingkup, ia butuh FR baru (mis. FR-38) di revisi PRD; sampai itu terjadi, S07 tetap dinilai hanya oleh `TRACEABILITY-2026-10-22.md`.
- S05-7 (change control) hanya terpetakan ke FR-09/FR-12 secara longgar — PRD tidak punya FR khusus change control; ini kandidat FR baru, bukan asumsi bahwa sudah tercakup.

## 8. PRD vs implementasi

Bagian ini hanya memuat hal-hal yang **benar-benar bertentangan** antara teks PRD dan perilaku runtime hari ini. Keputusan resmi diambil dari `ADR-005`; yang belum diputuskan saya sebut sebagai terbuka, bukan saya putuskan sendiri.

### 8.1 FR-01: PRD menulis gate berurutan (G2A → G2B), runtime memilih salah satu per `track`

- **PRD:** alur G0 → G1 → G2A → G2B → G3 → G4 → G5, dibaca sebagai urutan.
- **Runtime:** `GATE_NEXT` (`lib/domain.js:37-40`) hanya punya dua jalur: `first_responder` = G0→G1→**G2A**→G3→G4→G5, `buffer` = G0→G1→**G2B**→G3→G4→G5. Tidak ada proyek yang melewati G2A lalu G2B.
- **Keputusan ADR-005 §2/§4:** disengaja, **bukan bug**. G2A (Solution Vision) untuk proyek baru/First Responder, G2B (Solution) untuk proyek existing/buffer. Deviasi yang tercatat: PRD perlu dibaca sebagai "dua alternatif", dan revisi PRD disarankan menuliskannya begitu.
- **Konsekuensi yang tetap harus ditutup:** `project_type` dan `track` belum diikat (lihat §8.2), jadi kombinasi `existing` + `first_responder` lolos. Selama itu terbuka, "gate sesuai klasifikasi" hanya benar bila operator memilih dengan benar.

### 8.2 FR-04: PRD memakai Solution Vision/Solution, runtime memakai `track`

- **PRD:** dua jalur bernama *Solution Vision* dan *Solution*, dengan klasifikasi `new`/`existing` menentukan jalurnya.
- **Runtime:** hanya `track` = `first_responder` | `buffer` (`lib/domain.js:24`). Tidak ada field `path`, dan respons `GET /api/projects/:id` tidak memuat `path` sama sekali (hasil pemeriksaan: 0 kemunculan).
- **Keputusan ADR-005 §2:** `track` **tidak** diganti nama (menghindari migrasi data tanpa manfaat); `path` adalah field turunan **read-only**: `first_responder → solution_vision`, `buffer → solution`. `project_type` yang bertentangan harus ditolak dengan `422 path_type_mismatch`.
- **Status implementasi:** pemetaan turunan dan penolakan `path_type_mismatch` **belum ada** (manual: `existing` + `first_responder` → `200`). Ini pekerjaan tahap berikutnya, bukan sekadar dokumentasi.

### 8.3 FR-02: B1–B4 (PRD) bukan `BUFFER_CHECKS` (runtime)

Dua hal berbeda, dan menyamakannya akan menghasilkan klaim palsu:

| | `buffer_controls` (FR-02, PRD) | `buffer_checks` (SOP-04, runtime) |
| --- | --- | --- |
| Konsep | Kontrol pengaman Solution phase: B1 scope, B2 arsitektur, B3 biaya, B4 exit plan | Prasyarat teknis sebelum masuk G2B (satu baris per butir) |
| Wajib? | Opsional / per-case (`mandatory=false`, `tidak_berlaku`) | **Wajib** — G2B gagal bila kosong atau belum diverifikasi |
| Kode | Tidak ada (kontrak `openapi.yaml:847`, `x-impl-status: contract-only`; manual `PUT .../buffer_controls/B1` → `404`) | `BUFFER_CHECKS` `lib/domain.js:14-23`; diverifikasi `lib/routes.js:351-372`; test `gateGaps: G2B buffer rejects when checklist is empty` |
| Status PRD | **FR-02 BELUM** | Bukti untuk FR-08 (prasyarat gate), **bukan** FR-02 |

Keputusan ADR-005 §5: keduanya dipertahankan sebagai konsep terpisah dan **tidak digabung** di dokumen mana pun. Konsekuensi dokumentasi: `TRACEABILITY-2026-10-22.md` S04-2 ("kontrol B1–B4") hanya boleh merujuk FR-02, dan S04-1/3/4/6 hanya boleh merujuk FR-08/FR-21.

### 8.4 Konflik lain yang saya temukan saat verifikasi

| # | PRD | Runtime | Sifat |
| --- | --- | --- | --- |
| C-1 | FR-07: status gate 4 nilai | Tidak ada `gate_status`; `projects.gate` hanya pointer. Empat nilai yang ada milik `deliverables.status` (`lib/domain.js:29`) | Gap, berisiko menimbulkan klaim palsu "status gate sudah ada" |
| C-2 | FR-17/AC-US-08: evidence-first | `PUT .../deliverables/:did` menerima `disetujui` tanpa evidence (manual `200`, `evidence_url:""`) | Gap P0; bertentangan langsung dengan teks AC |
| C-3 | FR-19: assignment talent merujuk ND | ND (`nde_no`/`nde_date`) ada di level proyek dan diperiksa di G1 (`lib/domain.js:136-140`) | Perbedaan granularitas, bukan pelanggaran; label §23 perlu dikoreksi (§9) |
| C-4 | FR-27: laporan mingguan dihasilkan otomatis | `POST .../reports` manual; isi boleh kosong (manual `{"period":"minggu lalu"}` → `200`) | Gap |
| C-5 | FR-36: penutupan mensyaratkan acceptance + evaluasi | `POST .../close` berhasil dari gate mana pun (manual: proyek G0 → `200 {"gate":"CLOSED"}`, K2) | Gap; perlu aturan prasyarat yang sama seperti `advance` |
| C-6 | FR-37: reopen bila prasyarat belum terpenuhi | `reopen` tanpa `reason` wajib dan tanpa reset acceptance | Gap; `DOMAIN-RULES` §19.3 sendiri menandainya "kontrak" |
| C-7 | FR-33/34/35: bukti kepatuhan, klasifikasi data, BAST | Tidak ada tabel/kolom; `/acceptance` → `404` | Gap; bergantung ADR-003 (PDP) dan OQ-04 |
| C-8 | FR-29: blocker health | `blocker_avg_age_days: 0` dan `blocker_list[].age_days: null` (K11) | Bug perhitungan, bukan gap desain |

C-8 sengaja dimasukkan karena KPI yang salah lebih berbahaya daripada KPI yang tidak ada: dashboard menampilkan "rata-rata umur 0 hari" untuk blocker yang sudah lama terbuka.

## 9. Koreksi terhadap `DOMAIN-RULES` §23

§23 adalah titik awal yang baik, tetapi beberapa labelnya tidak bertahan saat diuji ke kode. Yang diubah di sini hanya **label**, bukan aturan domainnya.

| Butir §23 | Label §23 | Hasil verifikasi | Alasan |
| --- | --- | --- | --- |
| FR-19 | jalan | **SEBAGIAN** | ND diperiksa di level proyek; tidak ada assignment talent per orang |
| FR-21 | di luar cakupan | **SEBAGIAN** | KT bias dilacak sebagai `BUFFER_CHECKS[4]` (`lib/domain.js:18`) dan diverifikasi; hanya assignment yang tidak ada |
| FR-27 | jalan (field) | **SEBAGIAN** | Field ada, tetapi laporan dibuat manual, tanpa snapshot gate status, tanpa ekspor |
| FR-28 | jalan | **SEBAGIAN** | Dashboard + KPI ada; SLA eskalasi (bagian dari FR-28) tidak ada |
| FR-29 | jalan | **SEBAGIAN** | 5 dari 6 KPI; blocker health salah hitung (K11) |
| FR-36 | jalan | **SEBAGIAN** | `close` tidak memeriksa prasyarat apa pun (K2) |
| FR-37 | jalan | **SEBAGIAN** | `reason` tidak wajib, acceptance tidak di-reset |
| FR-18 | jalan | **SEBAGIAN** | Deliverable terlihat per proyek, tidak dikelompokkan per gate |

Catatan tambahan: `TRACEABILITY-2026-10-22.md` masih menuliskan path lama `apps/ddp-project-control/...` dan menyebut `npm test` 39 test; struktur repo sekarang menaruh `lib/`, `public/`, `tests/` di root. Path di dokumen lama tidak saya ubah (di luar lingkup DEEP-237), tetapi semua path di dokumen ini memakai struktur yang berlaku di commit `849e0bf`.

## 10. Cara memverifikasi ulang

```bash
git checkout agent/pedro-tech-lead/51d765bfc03a   # commit 849e0bf
rm -rf data && npm test                            # harapan: 39 test, 39 pass
npm start                                          # server lokal
```

Bukti manual yang saya jalankan (semua pada commit di atas, data uji terpisah):

```bash
# FR-17 / AC-US-08: disetujui tanpa evidence
curl -s -X PUT localhost:3312/api/projects/4/deliverables/8 \
  -H 'content-type: application/json' -d '{"status":"disetujui"}'
# → 200, "evidence_url":""

# FR-02 / FR-35: kontrak tanpa implementasi
curl -s -o /dev/null -w '%{http_code}\n' -X PUT localhost:3312/api/projects/4/buffer_controls/B1
curl -s -o /dev/null -w '%{http_code}\n' localhost:3312/api/projects/4/acceptance
# → 404 dan 404

# FR-06/§8.2: klasifikasi vs jalur tidak diikat
curl -s -X POST localhost:3312/api/projects -H 'content-type: application/json' \
  -d '{"name":"Uji kombinasi","track":"first_responder","project_type":"existing"}'
# → 200

# FR-23: blocker tanpa owner/due
curl -s -X POST localhost:3312/api/projects/4/risks -H 'content-type: application/json' \
  -d '{"kind":"blocker","title":"Blocker uji"}'
# → 200

# FR-36 / K2: tutup dari G0
curl -s -X POST localhost:3312/api/projects/5/close -H 'content-type: application/json' -d '{}'
# → 200 {"ok":true,"gate":"CLOSED","status":"closed"}
```

Selain itu saya memeriksa langsung: `grep -rn` untuk `gate_status`, `gate_records`, `acceptance`, `buffer_controls`, `vendor_category`, `tender_status`, `contract_type`, `escalation`, `sla_due_at`, `data_classification`, `chapter_manager`, `scope`, `role_code`, `raci` di `lib/` dan `migrations/` — semuanya 0 kemunculan kecuali `compliance` (`lib/domain.js`) dan `version` (PRAGMA migrasi).

## 11. Batasan dokumen ini

1. **Tidak menilai kualitas UX, copy, atau angka KPI.** Yang dinilai hanya mekanisme dan buktinya. Apakah 50% "admin readiness" masuk akal adalah pertanyaan produk, bukan traceability.
2. **Butir yang hanya bisa dibuktikan manual** ditandai "manual" di kolom bukti, dan perintahnya ada di §10. Tidak ada satu pun baris LULUS yang bersandar pada observasi manual semata — LULUS butuh test otomatis atau penolakan input.
3. **PRD hanya punya 9 blok AC**, bukan 18. Sembilan user story lain dinilai lewat baris US-nya, bukan lewat AC yang saya karang.
4. **NFR §7 tidak ber-ID**, sehingga tidak dinilai per baris (§1.1).
5. **Kontrak bukan bukti implementasi.** `x-impl-status: contract-only` di `openapi.yaml` saya perlakukan sebagai "BELUM", bukan "SEBAGIAN".
6. **Snapshot commit.** Semua status terikat pada `849e0bf`. Bila branch ini berubah, jalankan ulang §10 sebelum mempercayai tabel.
