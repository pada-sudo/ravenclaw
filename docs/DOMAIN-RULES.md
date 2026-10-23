# Domain Rules — RavenClaw

Dokumen ini adalah satu-satunya sumber kebenaran untuk aturan gate, status, dan batasan domain aplikasi **RavenClaw**. Backend (`server.js`) dan frontend (`public/app.js`) harus mengonsumsi aturan yang sama melalui `GET /api/meta`.

Bagian §1–§12 adalah aturan yang **sudah ditegakkan runtime**. Bagian §13–§23 adalah aturan hasil penyelarasan PRD v1.0 (DEEP-235) dan ditandai **[kontrak]** selama belum ada kode yang menegakkannya. Skema field-nya ada di `openapi.yaml`; keputusan arsitektur dan peta migrasinya ada di `docs/ADR/ADR-005-prd-v1-alignment.md`.

## 1. Jalur Proyek (`track`)

| Track | Gate sequence | Kapan dipakai |
|-------|---------------|---------------|
| `first_responder` | G0 → G1 → G2A → G3 → G4 → G5 → CLOSED | Proyek baru; setup awal pasca-kontrak |
| `buffer` | G0 → G1 → G2B → G3 → G4 → G5 → CLOSED | Proyek existing/berjalan; bridging atau eksekusi berkelanjutan |

- `track` **wajib** dipilih saat intake (`POST /api/projects`).
- Setelah intake, `track` **tidak boleh diubah**. `PUT /api/projects/:id` akan menolak perubahan `track` dengan `422`. Alasan: perubahan jalur setelah data gate terbentuk akan menyebabkan gate lolos tanpa checklist yang benar dan merusak jejak audit.

## 2. Daftar Item Wajib per Jalur

### First Responder — 7 Deliverable SOP-03

| # | Nama | Owner Role |
|---|------|------------|
| 1 | WBS | Project Manager |
| 2 | BRD | PM dan/atau Business Analyst |
| 3 | SAD | Solution Architect |
| 4 | Workforce Plan | Solution Architect |
| 5 | Initial Data Solution | Data Team |
| 6 | Initial Design Documentation | Design Team |
| 7 | Project Charter | Ditandatangani seluruh pemangku kepentingan |

- Item wajib dibuat otomatis saat intake.
- Item wajib **tidak boleh dihapus** selama proyek belum melewati G2A.
- Untuk lolos G2A, **seluruh 7 deliverable wajib harus berstatus `disetujui`**.

### Buffer — 8 Prasyarat Teknis SOP-04 (B1–B3)

| # | Item |
|---|------|
| 1 | BRD existing tersedia dan telah direview |
| 2 | SAD existing tersedia dan telah direview |
| 3 | Coding repository, change log, user story tersedia dan telah direview |
| 4 | Knowledge transfer dari tim sebelumnya selesai |
| 5 | Scope/timeline/kapasitas (role, FTE, periode, task) disepakati |
| 6 | Akses dokumentasi relevan diperoleh talent |
| 7 | Weekly progress disampaikan ke PM setiap minggu |
| 8 | Risk/blocker dilaporkan sedini mungkin (RAID log) |

- Item wajib dibuat otomatis saat intake.
- Item wajib **tidak boleh dihapus** selama proyek belum melewati G2B.
- Untuk lolos G2B, **seluruh 8 prasyarat wajib harus terverifikasi (`verified = 1`)**.

## 3. Aturan Lolos Gate (fail-closed)

Gate hanya dapat dinaikkan bila **semua** gap untuk gate saat ini kosong. Jika ada gap, server mengembalikan `422` dengan `next` dan array `gaps`.

| Gate | Gap bila ... |
|------|--------------|
| G0 | `track` kosong, atau `reason_shared_service` kosong. |
| G1 | `nde_no` atau `nde_date` kosong; `budget_status != disetujui`; `onboarding_status = belum_mulai`. |
| G2A | Kurang dari 7 deliverable wajib, atau ada deliverable wajib yang belum `disetujui`. |
| G2B | Kurang dari 8 prasyarat wajib, atau ada prasyarat wajib yang belum terverifikasi. |
| G3 | Ada risk `kind = blocker` berstatus `open`; atau belum ada weekly report. |
| G4 | Ada risk berstatus `open` yang belum memiliki `owner` dan `due_date`. |
| G5 | `notes` (lessons learned) kosong. |
| CLOSED | — |

## 4. Eskalasi / Force Advance

`POST /api/projects/:id/advance` menerima `force: true | 1`.

- Force advance **diizinkan** tanpa memeriksa peran (RBAC di stage 2 — Victor).
- Force advance wajib mencatat:
  - `actor` dari konteks request (bukan string hardcoded).
  - Alasan force wajib diisi (`force_reason`).
  - Semua gap yang ada saat itu.
  - Entri audit ditandai sebagai eskalasi.
- Tanpa `force_reason`, `force: true` ditolak `422`.

## 5. State yang Dilarang

Kombinasi berikut ditolak `422`:

- `gate = CLOSED` dengan `status != closed`.
- `status = closed` dengan `gate != CLOSED`.
- `track` kosong atau diubah setelah intake.

## 6. Penomoran Proyek

Kode proyek: `PRJ-<tahun>-<urutan 3 digit>`.
- Urutan diambil dari tabel counter per tahun (`project_counters`), bukan `COUNT(*)`.
- Counter naik atomik dalam transaksi; tahan hapus proyek dan restart server.

## 7. Tanggal dan Zona Waktu

- Semua tanggal disimpan dalam format kalender `YYYY-MM-DD` sesuai input.
- Validasi: tahun 1000–9999, bulan 01–12, hari valid untuk bulan/tahun.
- Semua perhitungan tanggal (aging, lead time) menggunakan UTC midgnight agar tidak bergeser antar-zona waktu.
- Tampilan/ekspektasi kalender untuk operator Indonesia adalah `Asia/Jakarta`; server tidak menggeser tanggal hanya karena zona waktu berbeda.

## 8. Hapus Proyek

`DELETE /api/projects/:id` melakukan **soft delete** (`deleted_at` diisi). Data proyek, deliverable, checklist, RAID, weekly report, dan event tetap ada untuk audit. `GET /api/projects` tidak menampilkan proyek yang sudah dihapus kecuali dengan `?include_deleted=true`.

## 9. Audit & Identitas Aktor

- Setiap aksi mutasi mencatat event ke tabel `events`.
- `actor` diisi dari konteks request (header `x-actor-id` / `x-actor-name` sementara, sampai auth middleware Victor siap).
- `logEvent()` menerima objek `{ actorId?, actorName? }` dan menulis `actor` dalam bentuk `"actorName [actorId]"` atau fallback `"system"`.

## 10. Enums

| Entitas | Nilai valid |
|---------|-------------|
| `track` | `first_responder`, `buffer` |
| `project_type` | `new`, `existing` |
| `gate` | `G0`, `G1`, `G2A`, `G2B`, `G3`, `G4`, `G5`, `CLOSED` |
| `budget_status` | `belum_diajukan`, `diajukan`, `disetujui` |
| `onboarding_status` | `belum_mulai`, `berjalan`, `selesai` |
| `deliverable.status` | `belum_mulai`, `dalam_proses`, `review`, `disetujui` |
| `risk.kind` | `risiko`, `isu`, `blocker`, `dependensi` |
| `change_request.status` | `diajukan`, `disetujui`, `ditolak` |
| `path` (turunan, §13) | `solution_vision`, `solution` |
| `gate_status` (§14) | `belum_mulai`, `dalam_proses`, `review`, `disetujui` |
| `control.code` (§15) | `B1`, `B2`, `B3`, `B4`, `s4`, `sY` |
| `control.status` (§15) | `tidak_berlaku`, `belum_mulai`, `dalam_proses`, `review`, `disetujui` |
| `role_code` (§16) | `R01`..`R15` |
| `deliverable.kind` (§17) | `project_request`, `brd`, `user_story`, `sad`, `workforce_plan`, `ids`, `idd`, `security_review`, `qa_test_result`, `accessibility_review`, `compliance_evidence`, `bast`, `wbs`, `project_charter`, `other` |
| `escalation.level` (§18) | `L1`, `L2`, `L3`, `L4` |
| `acceptance.status` (§19) | `draft`, `menunggu_tanda_tangan`, `ditandatangani` |
| `acceptance.result` (§19) | `diterima`, `diterima_dengan_catatan`, `ditolak` |
| `vendor_category` (§20) | `penyedia_tunggal`, `penunjukan_langsung`, `terbatas`, `terbuka`, `tidak_berlaku` |
| `tender_status` (§20) | `belum_mulai`, `persiapan`, `pengumuman`, `evaluasi`, `penetapan`, `selesai`, `gagal`, `tidak_berlaku` |
| `contract_type` (§20) | `spks`, `po`, `spb_new_item`, `spb_tanpa_new_item` |
| `data_classification` (§21) | `publik`, `internal`, `terbatas`, `rahasia` |

## 11. Asumsi yang Perlu Dikonfirmasi

- Daftar 7 deliverable FR dan 8 prasyarat Buffer diasumsikan final sesuai SOP-03/SOP-04. Bila katalog Adit berbeda, perlu diselaraskan di stage 1.
- Force advance tidak memeriksa peran sampai stage 2 (Victor).
- Retensi event: saat ini dibatasi 200 baris per proyek di `GET /api/projects/:id`; kebijakan arsip panjang menunggu keputusan operasional.
- Kontrol Buffer B1–B4 (§15) bersifat opsional sampai OQ-03 dijawab; default `tidak_berlaku`.
- Posisi sub-gate `s4`/`sY` (§15) adalah usulan; PRD FR-03 hanya menyebut kodenya tanpa peta posisi.
- Approver per gate (§14.3) dan RACI (§16.4) adalah usulan default sampai OQ-01 dijawab.
- Pemetaan nama dokumen procurement (§20) mengikuti urutan lead time, bukan nama resmi; menunggu konfirmasi R11.
- Peran legacy `auditor` memetakan ke R15 dengan hak baca-saja dipertahankan (ADR-005 §3).

## 12. Kontrak API

Lihat `openapi.yaml` untuk detail path, method, request/response, dan kode error.

## 13. Jalur (`track`) vs `path` — FR-04, FR-06

**[kontrak]** PRD memakai istilah `path` dengan dua nilai: **Solution Vision** (proyek baru) dan **Solution** (proyek existing). Runtime saat ini memakai `track` dengan nilai `first_responder` / `buffer`.

- `track` **tetap** menjadi satu-satunya field yang ditulis klien. Nilainya tidak diubah dan tidak dimigrasi.
- `path` adalah field **turunan, read-only**, dihitung saat respons: `first_responder → solution_vision`, `buffer → solution`.
- `project_type` harus konsisten dengan `path`: `new → solution_vision`, `existing → solution`. Ketidakcocokan ditolak `422` kode `path_type_mismatch` **[kontrak]**.
- `path` tidak boleh dikirim di request body; bila dikirim, diabaikan (bukan error) supaya klien lama tidak pecah.

Alasan mempertahankan `track`: nilainya tersimpan di `projects.track`, dipakai `GATE_NEXT`, difilter `GET /api/projects?track=`, dan dikonsumsi frontend. Mengganti nama field = breaking change tanpa nilai tambah. Lihat ADR-005 §2.

## 14. Status per Gate — FR-07, FR-08, FR-09, FR-12

**[kontrak]** `projects.gate` adalah **pointer** ke gate yang sedang berjalan; **status** gate adalah hal terpisah dan mengikuti satu state machine untuk semua gate:

| Dari | Ke | Syarat |
|------|----|--------|
| `belum_mulai` | `dalam_proses` | gate aktif; prasyarat minimal gate terkait sudah diisi |
| `dalam_proses` | `review` | seluruh deliverable wajib gate tersebut minimal `review` dan punya evidence |
| `review` | `disetujui` | **hanya** approver yang ditetapkan untuk gate itu (§14.3) + minimal 1 evidence (§17) |
| `review` | `dalam_proses` | penolakan; `note` wajib menjelaskan alasan penolakan |
| `disetujui` | `review` | pembatalan persetujuan; hanya `approve_gate` + `note` wajib; dicatat di audit sebagai pembatalan |

### 14.1 Aturan kenaikan gate (fail-closed)

- `POST /api/projects/:id/advance` **hanya** boleh berhasil bila `gate_status` gate saat ini `disetujui` **[kontrak]** — selain gap checklist yang sudah ada di §3.
- Gate berikutnya masuk `belum_mulai` saat proyek naik gate.
- `force: true` (§4) tetap boleh melewati aturan ini, tetapi wajib mencatat `force_reason`, `gate_status` saat itu, dan seluruh gap; entri audit ditandai eskalasi.

### 14.2 Riwayat

- Setiap transisi menulis satu entri `gate_records` (`project_id`, `gate`, `status`, `approver_role`, `decided_by`, `decided_at`, `note`) dan satu event audit.
- Transisi ke status yang sama adalah no-op `200` dan **tidak** menulis audit baru.
- Riwayat gate tidak boleh dihapus, termasuk saat proyek di-soft-delete (§8).

### 14.3 Approver per gate (usulan default, OQ-01)

| Gate | Approver (`approve_gate`) | Catatan |
|------|---------------------------|---------|
| G0 | R03 Chapter Manager DPS | R04 PM menyiapkan, R01 mengajukan |
| G1 | R03 Chapter Manager DPS | R04 PM + R09 melengkapi ND/onboarding |
| G2A | R10 Reviewer/Approver Governance | deliverable R05/R06/R07/R08 disetujui lebih dulu |
| G2B | R10 Reviewer/Approver Governance | prasyarat Buffer (8 item, §2) terverifikasi lebih dulu |
| G3 | R03 Chapter Manager DPS | kesiapan talent; R09 melaporkan |
| G4 | R10 Reviewer/Approver Governance | bukti kepatuhan R12 wajib (§21) |
| G5 | R13 Customer (BAST) | co-sign governance oleh R10 (§19) |

Aturan FR-14: **tidak ada peran yang menjadi approver tunggal untuk semua gate.** R03 hanya memegang G0/G1/G3, R10 memegang G2A/G2B/G4, R13 memegang G5. Tabel ini adalah usulan default; berlaku sampai OQ-01 dijawab otoritas resmi.

## 15. Kontrol Buffer B1–B4 dan sub-gate s4/sY — FR-02, FR-03

**[kontrak]** Kontrol ini **berbeda** dari `buffer_checks`:

| Konsep | Isi | Sifat | Menahan gate? |
|--------|-----|-------|---------------|
| `buffer_checks` (§2, SOP-04) | 8 prasyarat teknis | wajib untuk jalur `buffer` | **Ya**, G2B |
| `buffer_controls` (§15, PRD FR-02/03) | B1–B4 + s4/sY | **opsional** | **Tidak** |

Aturan:

1. Setiap proyek punya 6 baris kontrol (B1–B4, s4, sY) dengan default `status = tidak_berlaku`.
2. Status kontrol mengikuti enum §10 `control.status`; `tidak_berlaku` berarti kontrol tidak dipakai proyek tersebut.
3. Kontrol **tidak pernah** menambah gap kenaikan gate. Bila `mandatory = true` (hanya setelah OQ-03 memutuskan wajib), barulah kontrol berstatus bukan `disetujui` menjadi gap.
4. `evidence` disarankan tetapi tidak wajib; bila diisi, satu entri per bukti (§17).
5. Posisi default (usulan, menunggu OQ-03):

| Kode | Jenis | Posisi default |
|------|-------|----------------|
| B1 | buffer | sebelum G2A/G2B (kesiapan solusi) |
| B2 | buffer | sebelum G3 (kesiapan mobilisasi) |
| B3 | buffer | sebelum G4 (kesiapan eksekusi) |
| B4 | buffer | sebelum G5 (kesiapan penutupan) |
| s4 | sub-gate | di dalam G4 |
| sY | sub-gate | di dalam G5 |

`s4`/`sY` hanya disebut kodenya di PRD FR-03, tanpa definisi posisi. Posisi di atas adalah usulan dan dicatat sebagai keputusan terbuka D-03 (ADR-005 §8).

## 16. Katalog Peran dan Matriks Izin — FR-10..FR-14

### 16.1 Katalog peran R01–R15

| Kode | Nama | Lingkup utama |
|------|------|---------------|
| R01 | Pemohon Bisnis / C7U | mengajukan permintaan proyek, requirement bisnis, ND |
| R02 | Tribe / Unit terkait | kesiapan & pemenuhan talent internal |
| R03 | Chapter Manager DPS | kapasitas, assignment, standar dokumen, evaluasi |
| R04 | Project Manager (PM) | konsolidator tunggal: scope, disiplin, evidence, blocker, report |
| R05 | Business Analyst (BA) | BRD dan user story |
| R06 | Solution Architect (SA) | SAD dan Workforce Plan |
| R07 | Data Team | Initial Data Solution (IDS) |
| R08 | Design Team | Initial Design Documentation (IDD) |
| R09 | Talent Buffer PM | assignment talent via ND, knowledge transfer, handover |
| R10 | Reviewer / Approver Governance | review deliverable, approval governance |
| R11 | Procurement | vendor category, tender, kontrak, PO/SPK |
| R12 | QA / Security / PDP | kualitas, keamanan, kepatuhan PDP |
| R13 | Customer | sign-off BAST dan acceptance |
| R14 | Operator / Admin Aplikasi | data entry, master data, reporting |
| R15 | Owner / Agile ALSKJKTTP Project Control | kualitas data, deliverable, reporting |

### 16.2 Matriks izin per aksi

Satu definisi saja di `lib/auth.js`. ✅ = diizinkan.

| Aksi | R01 | R02 | R03 | R04 | R05 | R06 | R07 | R08 | R09 | R10 | R11 | R12 | R13 | R14 | R15 |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| `read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | ✅ |
| `write_project` | ✅ |  |  | ✅ |  |  |  |  |  | ✅ |  |  |  | ✅ | ✅ |
| `pm_action` |  |  |  | ✅ |  |  |  |  |  | ✅ |  |  |  |  |  |
| `approver_action` |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |  |  |
| `submit_deliverable` |  |  |  | ✅ | ✅ | ✅ | ✅ | ✅ |  |  |  | ✅ |  | ✅ | ✅ |
| `approve_deliverable` |  |  | ✅ | ✅ |  |  |  |  |  | ✅ |  | ✅² |  |  |  |
| `approve_gate` |  |  | ✅³ |  |  |  |  |  |  | ✅⁴ |  |  | ✅⁵ |  |  |
| `force_advance` |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |  |  |
| `verify_buffer_control` |  |  | ✅ | ✅ |  |  |  |  |  | ✅ |  |  |  |  |  |
| `assign_talent` |  | ✅ | ✅ |  |  |  |  |  | ✅ |  |  |  |  |  |  |
| `manage_procurement` |  |  |  |  |  |  |  |  |  |  | ✅ |  |  | ✅ |  |
| `issue_compliance_evidence` |  |  |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |
| `sign_acceptance` |  |  |  |  |  |  |  |  |  |  |  |  | ✅ |  |  |
| `raise_blocker` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `escalate_blocker` |  |  | ✅ | ✅ |  |  |  |  |  | ✅ |  |  |  |  |  |
| `resolve_blocker` |  |  | ✅ | ✅ |  |  |  |  |  | ✅ |  | ✅ |  |  |  |
| `manage_reports` |  |  |  | ✅ |  |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `manage_master_data` |  |  |  |  |  |  |  |  |  |  |  |  |  | ✅ | ✅ |
| `decide_change` |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |  |  |
| `close_project` |  |  |  | ✅ |  |  |  |  |  | ✅ |  |  |  |  |  |
| `reopen_project` |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |  |  |
| `delete_project` |  |  |  |  |  |  |  |  |  | ✅ |  |  |  |  |  |

1. R13 hanya membaca proyek yang terkait dengannya.
2. R12 hanya untuk deliverable berkategori kepatuhan (`qa_test_result`, `security_test_result`, `accessibility_review`, `pdp_assessment`, `compliance_evidence`).
3. R03 hanya G0, G1, G3.
4. R10 hanya G2A, G2B, G4.
5. R13 hanya G5 (BAST), dan wajib co-sign R10.

Aturan turunan:

- **FR-11**: R04 adalah konsolidator tunggal. Hanya R04 (dan R10 sebagai approver) yang boleh mengubah field konsolidasi proyek. Peran lain yang mencoba → `403`.
- **FR-12**: `approve_gate` hanya dimiliki R03/R10/R13 sesuai §14.3; tidak ada peran lain yang boleh memindahkan status gate ke `disetujui`.
- **FR-14**: tidak ada peran yang memegang `approve_gate` untuk semua gate, dan tidak ada peran yang memegang seluruh aksi. R03 (Chapter Manager) bukan approver tunggal.
- Aksi yang tidak terdaftar di tabel = **ditolak** (fail-closed), termasuk untuk peran baru yang belum dipetakan.

### 16.3 Peran legacy yang harus tetap berfungsi

Empat peran yang ada sekarang tetap dipetakan ke katalog PRD. Bundle izin lamanya **tidak dikurangi** supaya sesi dan data lama tetap bekerja (DEEP-236).

| Peran legacy | Peran PRD | Izin dipertahankan |
|--------------|-----------|--------------------|
| `operator` | R14 | `read`, `write_project`, `submit_deliverable`, `manage_reports`, `manage_master_data` |
| `pm` | R04 | `read`, `write_project`, `pm_action`, `submit_deliverable`, `approve_deliverable`, `close_project`, `raise_blocker`, dll. |
| `approver` | R10 | `approver_action`, `force_advance`, `approve_gate`, `decide_change`, `delete_project`, `reopen_project` |
| `auditor` | R15 | `read` saja (hak baca-saja dipertahankan; upgrade ke izin R15 penuh menunggu D-02) |

### 16.4 RACI default per gate (usulan, OQ-01)

| Gate | R | A | C | I |
|------|---|---|---|---|
| G0 | R01 | R03 | R04, R14 | R10 |
| G1 | R04 | R03 | R01, R09, R14 | R10 |
| G2A | R05, R06 | R10 | R03, R07, R08, R04 | R01 |
| G2B | R06 | R10 | R03, R07, R08, R09, R04 | R01 |
| G3 | R09 | R03 | R02, R04, R10 | R01, R14 |
| G4 | R07, R08, R12 | R10 | R03, R04, R11 | R01, R13 |
| G5 | R04 | R13 | R10, R11, R12 | R01, R03, R14 |

Kolom A harus selalu sejalan dengan approver di §14.3. RACI ditampilkan sebagai data (`GET /api/raci`), bukan halaman terpisah.

## 17. Deliverable: katalog, versi, dan evidence-first — FR-15..FR-18

### 17.1 Katalog dan pemilik

| Kind | Nama | Gate | Pemilik (`submit_deliverable`) |
|------|------|------|-------------------------------|
| `project_request` | Project Request | G0 | R01 |
| `wbs` | WBS | G1 | R04 |
| `brd` | BRD | G2A | R05 |
| `user_story` | User Story | G2A | R05 |
| `sad` | SAD | G2A | R06 |
| `workforce_plan` | Workforce Plan | G2A | R06 |
| `ids` | Initial Data Solution | G2A | R07 |
| `idd` | Initial Design Documentation | G2A | R08 |
| `security_review` | Security Review | G4 | R12 |
| `qa_test_result` | QA Test Result | G4 | R12 |
| `accessibility_review` | Accessibility Review | G4 | R12 |
| `compliance_evidence` | Compliance Evidence | G4 | R12 |
| `bast` | Acceptance / BAST | G5 | R13 |
| `project_charter` | Project Charter | G1 | R04 |

`other` dipakai untuk deliverable tambahan yang tidak masuk katalog; tidak pernah dihitung sebagai prasyarat gate.

### 17.2 Versi

- Setiap deliverable punya `version` berformat `<major>.<minor>` (contoh `1.0`).
- Versi naik saat isi/evidence berubah setelah status pernah mencapai `review` atau `disetujui`.
- Riwayat versi **append-only**: `deliverable_versions` menyimpan `version`, `status`, `evidence`, `created_by`, `created_at`, `note`.
- Versi lama tidak boleh dihapus atau ditimpa, termasuk setelah proyek ditutup.

### 17.3 Transisi status dan evidence-first

| Dari | Ke | Syarat |
|------|----|--------|
| `belum_mulai` | `dalam_proses` | pemilik deliverable mulai bekerja |
| `dalam_proses` | `review` | wajib ada minimal 1 evidence |
| `review` | `disetujui` | `approve_deliverable` + evidence masih ada |
| `review` | `dalam_proses` | penolakan dengan `note` wajib |
| `disetujui` | `review` | revisi pasca-persetujuan; `note` wajib; versi naik |

Aturan **evidence-first (FR-17)**, tanpa pengecualian:

- Deliverable tidak boleh berstatus `disetujui` bila `evidence` kosong dan `evidence_url` kosong.
- Penolakan memakai `422` dengan kode error `evidence_required`.
- Evidence minimal punya `url` atau `reference_no` (ND/BAST/SPK/tiket), bukan hanya catatan teks.
- Menghapus evidence terakhir dari deliverable `disetujui` ditolak `422`; turunkan status lebih dulu ke `review`.
- Aturan yang sama berlaku untuk approval gate (§14) dan acceptance BAST (§19).

## 18. Blocker dan Eskalasi L1–L4 — FR-23..FR-26

Blocker **bukan tabel baru**: ia adalah baris `risks` dengan `kind = 'blocker'`.

### 18.1 Field wajib

Saat membuat `kind = 'blocker'`, field berikut wajib: `description`, `impact`, `owner`, `due_date`. Bila kurang → `422` kode `blocker_incomplete` **[kontrak]**.

Blocker baru otomatis masuk **L1** (US-15) dengan `sla_due_at = created_at + SLA(L1)`.

### 18.2 Level dan SLA

| Level | Pemilik | SLA | Kebijakan |
|-------|---------|-----|-----------|
| L1 | R04 PM | 3 hari | tetap (fixed) |
| L2 | R03 Chapter Manager | 3 hari | tetap (fixed) |
| L3 | R10 Approver Governance | per-case | per-case (OQ-02) |
| L4 | R10 + Pisjen | per-case | per-case (OQ-02) |

- SLA dihitung dalam hari kalender UTC (selaras §7), dari `created_at` saat L1 dan dari `occurred_at` setiap kali naik level.
- `sla_breached = today > sla_due_at` dan blocker masih `open`.
- Kenaikan otomatis: **L1 → L2** saat SLA L1 terlampaui (US-18 AC). Kenaikan ke L3/L4 selalu manual karena SLA-nya per-case; menunggu OQ-02.
- Kenaikan level wajib punya `escalation_reason`; tanpa itu → `422`.

### 18.3 Log resolusi (append-only)

- `escalation_log` menyimpan setiap kenaikan level: `level`, `from_level`, `to_level`, `reason`, `actor`, `actor_role`, `occurred_at`, `sla_due_at`, `breached`.
- Menutup blocker (`status = closed`) wajib mengisi `resolution` (`status` selesai/dibatalkan, `note`, `decided_by`, `decided_at`) — `422` bila kosong **[kontrak]**.
- Baris log tidak boleh diubah atau dihapus; koreksi dilakukan dengan entri baru yang menyebut koreksi tersebut.
- Efek pada gate: blocker `open` pada gate aktif menahan kenaikan gate di G3 (§3). Blocker `open` yang SLA-nya terlampaui dan berlevel L3/L4 menahan kenaikan gate mana pun **[kontrak]**.

## 19. Acceptance/BAST, Closure, dan Reopen — FR-35..FR-37

### 19.1 BAST

- Satu proyek punya satu record acceptance (`bast_no`, `bast_date`, `signed_by`, `signed_role` = R13, `result`, `evidence`, `evaluation`).
- Status: `draft` → `menunggu_tanda_tangan` → `ditandatangani`.
- `ditandatangani` wajib punya minimal 1 evidence (dokumen BAST) dan `result` terisi.
- Hanya R13 yang boleh menandatangani; R10 wajib mencatat co-sign governance.
- BAST yang `ditolak` tidak menutup proyek; proyek kembali ke `G5` dengan status `active`.

### 19.2 Penutupan

- `POST /api/projects/:id/close` wajib memenuhi: `gate = G5`, `acceptance.status = ditandatangani`, evidence acceptance ada, dan `lessons_learned` terisi (sudah ditegakkan lewat gap G5, §3).
- Penutupan menulis `evaluation` (`lessons_learned`, `evaluation_notes`) dan event audit.
- Syarat tambahan acceptance + evidence **[kontrak]**; saat ini hanya `lessons_learned` yang diperiksa.

### 19.3 Reopen

- `POST /api/projects/:id/reopen` hanya untuk R10 dan wajib `reason` **[kontrak]**.
- Efek: `status = active`, `gate = G5`, `acceptance.status` kembali `menunggu_tanda_tangan`, `reopen_count` bertambah 1.
- Reopen tidak menghapus bukti penutupan sebelumnya; seluruh riwayat tetap tersimpan.
- FR-37: reopen adalah jalur resmi bila prasyarat penutupan ternyata belum terpenuhi — bukan dengan mengedit data historis.

## 20. Procurement dan Deadline Kontrak — FR-31, FR-32

### 20.1 Field

| Field | Enum / Arti |
|-------|-------------|
| `vendor_category` | `penyedia_tunggal`, `penunjukan_langsung`, `terbatas`, `terbuka`, `tidak_berlaku` |
| `tender_status` | `belum_mulai`, `persiapan`, `pengumuman`, `evaluasi`, `penetapan`, `selesai`, `gagal`, `tidak_berlaku` |
| `contract_type` | `spks`, `po`, `spb_new_item`, `spb_tanpa_new_item` |
| `procurement_doc` | label legacy yang dipakai `PROC_LEAD_DAYS` (§ runtime) |
| `procurement_target_start` | tanggal mulai yang diinginkan |
| `contract_deadline` | `procurement_target_start − contract_deadline_days` |

### 20.2 Peta tipe kontrak dan lead time

| `contract_type` | Label legacy (`procurement_doc`) | Lead time | Deadline kontrak |
|-----------------|----------------------------------|-----------|------------------|
| `spks` | `PKDF` | 60 hari | 2 bulan |
| `po` | `Justifikasi Kontrak Lumsum` | 45 hari | 1,5 bulan |
| `spb_new_item` | `Surat Pesanan dengan new item` | 30 hari | 1 bulan |
| `spb_tanpa_new_item` | `Surat Pesanan tanpa new item` | 14 hari | 2 minggu |

Pemetaan di atas mengikuti **urutan lead time**, bukan kesetaraan nama resmi: PRD menyebut SPKS/PO/SPB, runtime memakai PKDF/Justifikasi Kontrak Lumsum/Surat Pesanan. Konfirmasi nama resmi menunggu R11 (D-01, ADR-005 §8).

### 20.3 Aturan kesiapan

- `procurement_target_start` + `procurement_doc` menghasilkan `submit_by` dan `warning` (sudah berjalan, §runtime).
- Kesiapan procurement (`ready = true`) mensyaratkan `vendor_category`, `tender_status`, dan `contract_type` terisi bukan `tidak_berlaku`, dan `submit_by` belum lewat.
- Procurement `ready = false` pada gate G3 menjadi gap kenaikan gate **[kontrak]** — pekerjaan belum boleh dimulai sebelum procurement siap.
- PRD tidak meminta aplikasi mengeksekusi pengadaan (SPK/kontrak); aplikasi hanya melacak status dan evidence.

## 21. Compliance dan PDP — FR-33, FR-34

### 21.1 Bukti kepatuhan

`compliance_evidence` per proyek, satu baris per jenis:

| `kind` | Nama | Pemilik |
|--------|------|---------|
| `qa_test_result` | hasil uji QA | R12 |
| `security_test_result` | hasil uji keamanan | R12 |
| `accessibility_review` | review aksesibilitas (WCAG 2.1 AA) | R12 |
| `pdp_assessment` | asesmen PDP | R12 |
| `compliance_evidence` | bukti kepatuhan lain | R12 |

- Empat jenis pertama wajib berstatus `disetujui` sebelum G4 boleh `disetujui` **[kontrak]**.
- Setiap baris wajib punya evidence; aturan evidence-first §17 berlaku.
- `reviewer_role` selalu R12; hanya R12 yang boleh mengubah status baris ini.

### 21.2 Klasifikasi data dan PDP

- `data_classification` wajib diisi saat intake; default usulan `internal` bila kosong **[kontrak]**.
- Bila `data_classification` = `terbatas` atau `rahasia`, maka `pdp_scope = true` dan `pdp_assessment` wajib sebelum G4.
- Data pribadi tidak boleh ditulis ke `note` bebas, log, atau nama file evidence; rujuk nomor dokumen.
- Retensi evidence minimal 5 tahun (PRD §7), selaras ADR-003; durasi final menunggu OQ-04.

## 22. Master Register dan KPI — FR-27..FR-30

### 22.1 Register minimum (FR-30)

| Field register PRD | Sumber di RavenClaw |
|--------------------|---------------------|
| project ID | `projects.code` (`PRJ-YYYY-NNN`) |
| nama proyek | `projects.name` |
| C7U | `projects.customer_cfu` |
| Chapter Manager | `projects.chapter_manager` **[kontrak]** |
| business owner PM | `projects.business_owner`, `projects.pm` |
| scope | `projects.scope` **[kontrak]** |
| klasifikasi | `projects.project_type` + `projects.path` (turunan) |
| admin readiness | gap G1 (§3) — tercermin di `kpis.admin_readiness_pct` |
| talent readiness | `projects.nde_no`, `projects.nde_date`, `projects.onboarding_status` |
| deliverable status | `deliverables.status` per gate |
| evidence status | `deliverables.evidence` / `evidence_url` per deliverable |

### 22.2 KPI (FR-29)

| KPI PRD | Field `GET /api/kpis` |
|---------|------------------------|
| admin readiness | `admin_readiness_pct` |
| technical readiness | `buffer_tech_readiness_pct` |
| compliance | `compliance_readiness_pct` **[kontrak]** |
| blocker health | `blockers_open`, `blocker_avg_age_days`, `blocker_max_age_days`, `blocker_sla_adherence_pct` **[kontrak]** |
| solution vision readiness | `fr_readiness_pct` (nama dipertahankan; ekuivalen Solution Vision) |
| transition readiness | `transition_ready_pct` |

Nama field lama **tidak diganti** — frontend dan test yang ada memakainya. Nama PRD hanya menjadi label tampilan.

### 22.3 Weekly report dan dashboard

- Weekly report wajib memuat: scope, discipline, evidence, blockers, next steps, gate status (FR-27). Field yang sudah ada: `planned`, `actual`, `evidence_url`, `blockers`, `next_steps`, `decisions_needed`; bagian "gate status" diambil dari `gate`/`gate_status` saat laporan dibuat **[kontrak]**.
- Dashboard (FR-28) membaca `GET /api/kpis` + daftar proyek; real-time berarti dihitung saat request, tanpa cache materialized.

## 23. Traceability FR-01..FR-37 dan R01..R15

Kolom "Lokasi" menunjuk bagian dokumen ini (`DR`) atau `openapi.yaml` (komponen skema). Status: **jalan** = sudah ditegakkan runtime, **kontrak** = aturan/skema sudah ditetapkan tetapi belum ada kode.

| FR | Ringkas | Lokasi | Status |
|----|---------|--------|--------|
| FR-01 | gate G0..G5 | DR §1, §3, `GateId` | jalan |
| FR-02 | Buffer B1–B4 opsional | DR §15, `BufferControl` | kontrak |
| FR-03 | sub-gate s4/sY | DR §15, `ControlCode` | kontrak |
| FR-04 | path Solution Vision/Solution | DR §13, `ProjectPath` | kontrak (turunan) |
| FR-05 | kode PRJ-YYYY-NNN | DR §6, `Project.code` | jalan |
| FR-06 | klasifikasi new/existing → path | DR §13 | kontrak |
| FR-07 | status gate 4 tahap | DR §14, `GateStatus` | kontrak |
| FR-08 | tolak kenaikan bila prasyarat kurang | DR §3, §14.1, respons `422` | jalan (checklist) / kontrak (gate_status) |
| FR-09 | approval oleh approver per RACI | DR §14.3, §16.4, `GateStatusInput` | kontrak |
| FR-10 | 15 peran RBAC | DR §16.1, `RoleCode` | kontrak (stage 2 = DEEP-236) |
| FR-11 | PM konsolidator tunggal | DR §16.2 | kontrak |
| FR-12 | hanya approver boleh approve gate | DR §14.3, §16.2 | kontrak |
| FR-13 | RACI per gate sebagai data | DR §16.4, `RaciEntry`, `GET /api/raci` | kontrak |
| FR-14 | manager bukan approver tunggal | DR §14.3, §16.2 | kontrak |
| FR-15 | katalog deliverable per gate | DR §17.1, `DeliverableKind` | kontrak (katalog) / jalan (deliverable FR 7 item) |
| FR-16 | versioning + status + evidence | DR §17.2, `DeliverableVersion` | kontrak |
| FR-17 | evidence-first | DR §17.3, `Evidence` | kontrak |
| FR-18 | status deliverable di dashboard | `Kpis`, `GET /api/projects/:id` | jalan |
| FR-19 | talent assignment merujuk ND | DR §22.1 (`nde_no`, `nde_date`) | jalan (sebagai referensi ND) |
| FR-20 | visibilitas SMM | — | **di luar cakupan**: SMM adalah sistem eksternal (OQ-05); tidak ada field/skema di PRD v1 |
| FR-21 | assignment Talent Buffer PM + status KT | — | **di luar cakupan**: butuh entitas assignment talent; tidak diminta pada keluaran stage 1, menunggu OQ-05 |
| FR-22 | status onboarding per talent | DR §22.1 (`onboarding_status`), `Project` | jalan |
| FR-23 | blocker: field wajib | DR §18.1, `RiskInput` | jalan sebagian / kontrak (field wajib) |
| FR-24 | eskalasi L1–L4 | DR §18.2, `EscalationLevel` | kontrak |
| FR-25 | SLA per level | DR §18.2, `EscalationSla` | kontrak |
| FR-26 | log eskalasi + resolusi | DR §18.3, `EscalationLog`, `Resolution` | kontrak |
| FR-27 | weekly report terkonsolidasi | DR §22.3, `WeeklyReport` | jalan (field) / kontrak (gate status) |
| FR-28 | dashboard real-time | DR §22.3, `Kpis` | jalan |
| FR-29 | 6 KPI | DR §22.2, `Kpis` | jalan sebagian / kontrak (compliance, SLA) |
| FR-30 | master register minimum | DR §22.1, `Project` | jalan sebagian / kontrak (`chapter_manager`, `scope`) |
| FR-31 | kesiapan procurement | DR §20.1, `ProcurementInfo` | kontrak (vendor/tender) / jalan (doc+lead) |
| FR-32 | deadline kontrak | DR §20.2 | jalan (`PROC_LEAD_DAYS`) |
| FR-33 | bukti kepatuhan | DR §21.1, `ComplianceEvidence` | kontrak |
| FR-34 | klasifikasi data + PDP | DR §21.2, `DataClassification` | kontrak |
| FR-35 | BAST di G5 | DR §19.1, `Acceptance` | kontrak |
| FR-36 | closure + bukti acceptance | DR §19.2 | kontrak (syarat acceptance) / jalan (lessons learned) |
| FR-37 | reopen bila prasyarat belum terpenuhi | DR §19.3 | jalan (endpoint) / kontrak (reason, reset gate) |

Peran R01–R15 seluruhnya didefinisikan di §16.1 dan matriks izinnya di §16.2; tidak ada peran yang berada di luar cakupan.

### 23.1 Di luar cakupan issue DEEP-235

- **Talent/SMM (FR-20, FR-21)** — butuh sistem eksternal dan entitas assignment baru; tidak ada di daftar keluaran stage 1. Usulan: issue terpisah setelah OQ-05 dijawab.
- **Notifikasi/email, mobile native, AI/ML prediktif** — Non-Goals PRD §2.2.
- **Eksekusi pengadaan** — Non-Goal PRD §2.2; aplikasi hanya melacak status.
- **Migrasi data legacy otomatis** — PRD §9.3 menyatakan migrasi manual oleh R14.
