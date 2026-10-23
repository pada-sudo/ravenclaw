# ADR-005: Penyelarasan RavenClaw dengan PRD v1.0

## Status

Diusulkan — menunggu keputusan THEOFILUS (acceptance) dan konfirmasi OQ-01..OQ-08.
Berlaku sebagai acuan kontrak untuk DEEP-236..DEEP-243 selama berstatus "Diusulkan".

## Konteks

PRD v1.0 `DDP Project Control Application` (23 Oktober 2026, lampiran DEEP-234, attachment
`01a1672f-e3c9-7911-97c4-d8a3f28214b0`) mendefinisikan 15 peran (R01–R15), gate G0–G5 dengan
kontrol Buffer B1–B4 dan sub-gate s4/sY, status gate empat tahap, evidence-first, eskalasi
L1–L4 dengan SLA, serta acceptance/BAST.

RavenClaw hari ini berangkat dari model yang lebih sempit (baseline 22 Okt 2026):

| Aspek | Runtime sekarang | PRD v1.0 | Selisih |
|-------|------------------|----------|---------|
| Peran | 4 (`operator`, `pm`, `approver`, `auditor`) | 15 (`R01`–`R15`) | FR-10 |
| Jalur proyek | `track` = `first_responder` / `buffer` | `path` = Solution Vision / Solution | FR-04 |
| Status gate | `projects.gate` sebagai pointer, tanpa status | `belum_mulai → dalam_proses → review → disetujui` | FR-07 |
| Kontrol Buffer | 8 prasyarat SOP-04 (`buffer_checks`), wajib untuk G2B | B1–B4 opsional + sub-gate s4/sY | FR-02, FR-03 |
| Deliverable | status + `evidence_url` tunggal | versioning + evidence-first berlapis | FR-15..FR-17 |
| Blocker/eskalasi | `risks` kind=blocker + flag `escalated` | L1–L4, SLA, log resolusi | FR-23..FR-26 |
| Acceptance | `notes` + close | BAST + evaluasi closure + reopen guard | FR-35..FR-37 |
| Procurement | `procurement_doc` + lead time | vendor category, tender status, contract type | FR-31, FR-32 |
| Compliance/PDP | tidak ada | bukti QA/security/accessibility + klasifikasi data | FR-33, FR-34 |

Keputusan di ADR ini **hanya menetapkan kontrak** (DEEP-235). Tidak ada perubahan perilaku
runtime pada issue ini; `npm test` tetap 39/39 hijau.

## Keputusan

### 1. Kontrak lebih dulu, implementasi bertahap

`openapi.yaml` dan `docs/DOMAIN-RULES.md` adalah acuan tunggal. Setiap operasi yang belum ada di
runtime ditandai `x-impl-status: contract-only` di `openapi.yaml`; aturan yang belum ditegakkan
ditandai **[kontrak]** di `DOMAIN-RULES.md`. Stage implementasi mengikuti stage issue yang ada:

| Stage | Issue | Bagian kontrak yang dipakai |
|-------|-------|-----------------------------|
| 2 | DEEP-236 | §16 peran + matriks izin |
| 2 | DEEP-237 | §23 traceability |
| 3 | DEEP-238 | §14 status gate, §15 B1–B4 |
| 4 | DEEP-239 | §17 deliverable + evidence-first |
| 5 | DEEP-240, DEEP-241 | §18 eskalasi + KPI/SLA |
| 6 | DEEP-242, DEEP-243 | §19 BAST, §21 compliance/PDP |

### 2. `track` dipertahankan, `path` diturunkan

`track` **tidak diganti nama dan tidak dimigrasi**. `path` adalah field turunan read-only:

| `track` (tersimpan) | `path` (turunan) | `project_type` wajib |
|---------------------|------------------|----------------------|
| `first_responder` | `solution_vision` | `new` |
| `buffer` | `solution` | `existing` |

Alasan:

1. `projects.track` adalah kolom NOT NULL berisi data nyata; rename = migrasi tabel + backfill +
   pemutusan `GATE_NEXT`, filter `GET /api/projects?track=`, dan frontend (`public/modules/*`).
2. PRD tidak meminta nama field, hanya dua jalur kerja (FR-04) — nilai turunan memenuhi maksud itu.
3. Menambah kolom `path` yang bisa ditulis akan menciptakan dua sumber kebenaran yang bisa
   bertentangan. Turunan tidak bisa bertentangan.

Konsekuensi: klien yang butuh istilah PRD membaca `project.path`; yang menulis tetap memakai
`track`. `project_type` divalidasi konsisten dengan `path` (422 `path_type_mismatch`) saat stage 3.

### 3. Peran: katalog sebagai data, peran legacy tetap hidup

- Katalog R01–R15 menjadi **data** (tabel `roles`), bukan `CHECK` constraint. Constraint 4 nilai
  di `migrations/003_users_and_sessions.sql` tidak diubah karena tidak bisa menampung 15 nilai
  tanpa migrasi destruktif.
- Penambahan kolom peran PRD pada `users` (mis. `role_code`, nullable) dilakukan di DEEP-236.
- **Bundle izin peran legacy tidak dikurangi.** Pengguna lama tetap bisa login dan bekerja;
  pengurangan izin akan memutus alur yang sedang berjalan tanpa persetujuan manusia.

Peta migrasi peran:

| Peran legacy | Peran PRD | Izin yang dipertahankan | Catatan |
|--------------|-----------|-------------------------|---------|
| `operator` | `R14` Operator/Admin Aplikasi | `read`, `write_project`, `submit_deliverable`, `manage_reports`, `manage_master_data` | data entry, master data, report |
| `pm` | `R04` Project Manager | `read`, `write_project`, `pm_action`, `submit_deliverable`, `approve_deliverable`, `close_project`, `raise_blocker` | konsolidator tunggal (FR-11) |
| `approver` | `R10` Reviewer/Approver Governance | `approver_action`, `approve_gate`, `force_advance`, `decide_change`, `delete_project`, `reopen_project` | pemegang approval + force advance |
| `auditor` | `R15` Owner/Agile ALSKJKTTP | `read` saja | hak baca-saja **dipertahankan**; upgrade ke izin R15 penuh = keputusan D-02 |

Catatan penting: `auditor` tidak punya padanan PRD yang persis. PRD tidak mengenal peran audit
read-only, sedangkan R15 punya hak menulis (kualitas data, report). Karena itu `auditor`
dipetakan ke R15 secara identitas, tetapi bundle izinnya tetap baca-saja sampai manusia memutuskan.

### 4. Status gate dipisahkan dari pointer gate

- `projects.gate` tetap pointer gate aktif (sudah dipakai di semua query dan `GATE_NEXT`).
- Status satu gate disimpan terpisah (`gate_records`, satu baris per transisi) dengan empat nilai
  yang **sudah** dipakai `deliverables.status`: `belum_mulai`, `dalam_proses`, `review`, `disetujui`.
  Tidak ada enum baru untuk status gate — memakai ulang enum yang ada menghindari kosakata ganda.
- `POST /advance` mensyaratkan gate aktif berstatus `disetujui` (selain gap checklist §3).
  Ini **belum** ditegakkan di runtime (DEEP-238).

### 5. Buffer B1–B4 dipisahkan dari `buffer_checks`

`buffer_checks` (8 prasyarat SOP-04, wajib untuk G2B) dan kontrol PRD B1–B4/s4/sY adalah dua
konsep berbeda yang mudah tertukar karena sama-sama bernama "buffer":

| | `buffer_checks` | `buffer_controls` |
|---|---|---|
| Asal | SOP-04 | PRD FR-02/FR-03 |
| Jumlah | 8 item per proyek | 6 baris (B1–B4, s4, sY) |
| Sifat | wajib pada jalur `buffer` | **opsional** |
| Menahan gate | ya (G2B) | tidak (kecuali `mandatory=true`) |

Keputusan posisi default (OQ-03 belum dijawab): B1 sebelum G2A/G2B, B2 sebelum G3, B3 sebelum G4,
B4 sebelum G5, `s4` di dalam G4, `sY` di dalam G5. Semua default `status = tidak_berlaku` sehingga
proyek yang tidak memakai kontrol tidak melihat gap tambahan. Bila OQ-03 menyatakan wajib, cukup
mengubah `mandatory = true` pada baris kontrol — tanpa mengubah skema.

### 6. Deliverable: `kind` + `version` + evidence-first

- `deliverable.kind` memakai katalog PRD (FR-15). Lima jenis kepatuhan (FR-33) menjadi `kind`
  deliverable, bukan tabel baru — struktur dan aturan evidence-nya identik.
- Versi `<major>.<minor>`, riwayat append-only (`deliverable_versions`).
- Evidence-first: `disetujui` tanpa evidence → `422 evidence_required`; hapus evidence terakhir
  dari deliverable `disetujui` juga ditolak. Berlaku sama untuk gate (§14) dan BAST (§19).

### 7. Blocker memakai `risks`, bukan tabel baru

`risks` sudah punya `kind = 'blocker'`, `owner`, `due_date`, `impact`, dan `escalated`. Yang
ditambahkan: `escalation_level`, `sla_due_at`, `resolution`, dan tabel append-only
`escalation_log`. Tidak ada duplikasi model risiko/isu.

Default SLA (OQ-02 belum dijawab): L1 3 hari, L2 3 hari, L3/L4 per-case tanpa auto-escalate;
auto-escalate hanya L1→L2 pada pelanggaran SLA (sesuai US-18 AC).

### 8. Acceptance/BAST sebagai resource eksplisit

BAST tidak ditempel ke `notes`. Satu record acceptance per proyek, ditandatangani R13, dengan
co-sign R10. `POST /close` mewajibkan `acceptance.status = ditandatangani` + evidence (DEEP-242).
Reopen mengembalikan proyek ke G5 dan menyetel acceptance ke `menunggu_tanda_tangan` — data
penutupan sebelumnya tetap tersimpan (tidak ada penghapusan riwayat).

### 9. Procurement dan compliance sebagai field, bukan modul

Vendor category, tender status, dan contract type menjadi field pada objek procurement yang sudah
ada; klasifikasi data/PDP menjadi field proyek + `compliance_evidence`. Tidak ada modul pengadaan
(PRD §2.2: aplikasi tidak mengeksekusi pengadaan).

## Peta migrasi data

### Tabel/kolom baru (bertahap, semua nullable atau berdefault)

| Stage | Perubahan | Dampak data lama |
|-------|-----------|------------------|
| 2 (DEEP-236) | `roles` (katalog R01–R15, seed 15 baris); `users.role_code` nullable | `role_code` kosong untuk user lama → izin legacy tetap dipakai |
| 3 (DEEP-238) | `gate_records`; `buffer_controls` (6 baris per proyek, default `tidak_berlaku`); `projects.gate_status` default `belum_mulai` | proyek lama mendapat `gate_status = belum_mulai`; tidak ada gate yang tiba-tiba dianggap disetujui |
| 4 (DEEP-239) | `deliverables.kind` default `other`; `deliverables.version` default `1.0`; `deliverable_versions`; `evidence` | deliverable lama menjadi `kind = other`, tidak dihitung sebagai prasyarat gate |
| 5 (DEEP-240) | `risks.escalation_level` default `L1`; `risks.sla_due_at`; `escalation_log`; `risks.resolution_*` | blocker lama menjadi L1 dengan SLA dihitung dari `created_at` (bisa langsung breached — dilaporkan apa adanya) |
| 6 (DEEP-242) | `project_acceptance`; `projects.data_classification` default `internal`; `compliance_evidence`; `projects.chapter_manager`, `projects.scope` | proyek lama tanpa BAST tetap bisa dibaca; tidak bisa ditutup sampai BAST direkam (force advance tetap tersedia) |

### Backfill

- Tidak ada backfill yang mengubah nilai historis. Kolom baru hanya diberi default.
- `deliverables` lama: `kind = other` **disengaja** — kalau ditebak dari `name`, deliverable yang
  namanya mirip tapi bukan prasyarat akan tiba-tiba menahan gate.
- `gate_status` proyek lama tidak diisi `disetujui` secara massal; stage 3 memutuskan per proyek
  (default `belum_mulai`, dan gate yang sudah dilewati dicatat sebagai riwayat tanpa status).
- `path` tidak di-backfill karena turunan.

### Yang **tidak** dimigrasi

- Nama nilai `track` (tetap `first_responder`/`buffer`).
- Nama field KPI lama (`fr_readiness_pct`, `buffer_tech_readiness_pct`) — label PRD hanya di UI.
- `buffer_checks` → `buffer_controls`: tidak ada konversi data; dua tabel hidup berdampingan.
- Peran legacy → peran PRD: pemetaan di aplikasi, bukan penulisan ulang `users.role`.

## Dampak breaking change

| Perubahan | Breaking? | Mitigasi |
|-----------|-----------|----------|
| Rename `track` → `path` | **Ya** (DB, API, frontend, test) | **ditolak** — `path` dibuat turunan (§2) |
| `users.role` diubah jadi 15 nilai | **Ya** (constraint + sesi + UI) | **ditolak** — katalog tabel + kolom baru (§3) |
| Field baru di respons proyek (`path`, `gate_status`, `gates`, `buffer_controls`) | Tidak (aditif) | klien lama mengabaikan field tak dikenal |
| Status gate wajib `disetujui` sebelum `advance` | **Ya secara perilaku** untuk proyek yang dulu naik gate tanpa approval | force advance + `force_reason` tetap tersedia; diumumkan di rilis stage 3 (DEEP-238) |
| Deliverable `disetujui` tanpa evidence ditolak | **Ya secara perilaku** | data lama tidak diubah; hanya transisi baru yang ditolak (DEEP-239) |
| `POST /close` wajib BAST | **Ya secara perilaku** | force advance / prosedur administrasi; DEEP-242 |
| Blocker lama langsung breached | Tidak (data) tapi mengejutkan (KPI) | dilaporkan sebagai temuan, bukan bug; baseline KPI baru |

Tidak ada endpoint lama yang dihapus atau diganti tipenya pada ADR ini.

## Keputusan yang menunggu manusia

Usulan default berlaku **sampai** keputusan resmi turun; tidak ada yang diimplementasikan sebagai
"perilaku final" tanpa jawaban. Owner dan due mengikuti PRD §11.

| ID | Pertanyaan | Owner | Due (PRD) | Default usulan bila tidak dijawab |
|----|-----------|-------|-----------|-----------------------------------|
| OQ-01 | Siapa approver resmi per gate? | Chapter Manager DPS | sebelum Phase 1 | §14.3: G0/G1/G3 → R03; G2A/G2B/G4 → R10; G5 → R13 (+co-sign R10) |
| OQ-02 | SLA L3/L4 persisnya? | Pisjen / Governance | sebelum Phase 2 | L3/L4 `per_case`, tanpa auto-escalate; hanya L1→L2 otomatis |
| OQ-03 | B1–B4 wajib atau opsional? | PMO / Governance | sebelum Phase 1 | **opsional**, `mandatory = false`, `tidak_berlaku` sebagai default |
| OQ-04 | Retensi file evidence? | PDP / Security | sebelum Phase 1 | minimal 5 tahun (PRD §7), selaras ADR-003; tanpa purge otomatis |
| OQ-05 | Integrasi Workday/SAP di Phase 1? | IT / HR | sebelum Phase 2 | tidak; ND diisi manual (`nde_no`/`nde_date`), FR-20/FR-21 ditunda |
| OQ-06 | Ukuran maksimum upload evidence? | IT Infrastructure | sebelum Phase 1 | 10 MB per file, hanya tipe dokumen+PDF; ditolak `413` |
| OQ-07 | Multi-bahasa di Phase 1? | PMO | sebelum Phase 1 | tidak; UI Bahasa Indonesia, istilah teknis Inggris (sesuai PRD §7) |
| OQ-08 | Jalur bila PM dan Chapter Manager berselisih soal kenaikan gate? | Pisjen | sebelum Phase 2 | eskalasi L3 ke R10; force advance R10 dengan `force_reason` + audit |

Keputusan tambahan yang ditemukan saat penyelarasan (tidak ada di PRD):

| ID | Pertanyaan | Owner | Default usulan |
|----|-----------|-------|----------------|
| D-01 | Nama resmi dokumen procurement: PRD memakai SPKS/PO/SPB, runtime memakai PKDF/Justifikasi Kontrak Lumsum/Surat Pesanan | R11 Procurement | pertahankan label legacy di `procurement_doc`, tambahkan `contract_type` ternormalisasi 1:1 menurut lead time |
| D-02 | Apakah akun `auditor` boleh naik ke izin R15 penuh (menulis)? | THEOFILUS | tidak; tetap baca-saja sampai ada kebutuhan audit yang jelas |
| D-03 | Posisi resmi sub-gate `s4` dan `sY` (PRD hanya menyebut kode) | PMO / Governance | `s4` di dalam G4, `sY` di dalam G5; keduanya opsional |

## Alternatif yang ditolak

1. **Rename `track` → `path` dengan migrasi penuh.** Ditolak: breaking change di DB, API, frontend,
   dan test untuk keuntungan kosmetik. Nilai turunan memenuhi FR-04.
2. **Ganti `CHECK(role IN (...))` menjadi 15 nilai.** Ditolak: migrasi destruktif pada SQLite
   (rebuild tabel `users`), dan setiap peran baru berikutnya butuh migrasi lagi. Katalog data lebih tepat.
3. **Satukan `buffer_checks` dengan B1–B4.** Ditolak: satu wajib, satu opsional; menyatukan akan
   mengubah arti "terverifikasi" pada G2B dan berisiko meloloskan gate tanpa prasyarat SOP-04.
4. **Gate status disimpan di `projects.gate` (mis. `G2A:review`).** Ditolak: memecah format field
   yang dipakai filter, `GATE_NEXT`, dan frontend; riwayat transisi juga hilang.
5. **Tabel `blockers` terpisah.** Ditolak: menduplikasi `risks` (owner, due_date, impact, audit) dan
   memaksa dua jalur KPI.
6. **Menerapkan status gate/evidence-first langsung di DEEP-235.** Ditolak oleh batasan issue:
   stage 1 hanya kontrak; perilaku berubah di stage 3/4 dengan test sendiri.

## Konsekuensi

- Satu acuan untuk DEEP-236..DEEP-243; tidak ada issue implementasi yang menebak enum atau aturan.
- Runtime tidak berubah pada DEEP-235 (`npm test` 39/39 hijau tetap).
- Tiga perubahan **perilaku** akan terasa saat stage 3/4/6 rilis (gate status, evidence-first,
  close wajib BAST). Semua punya jalur `force` + `force_reason` yang sudah ada dan teraudit.
- KPI lama tetap bernama lama; label PRD hanya di tampilan, sehingga dashboard tidak perlu migrasi.
- Beban perawatan: `openapi.yaml` menjadi 56 skema dengan penanda `x-impl-status`; penanda harus
  diperbarui saat stage terkait selesai, kalau tidak kontrak akan berbohong tentang runtime.
