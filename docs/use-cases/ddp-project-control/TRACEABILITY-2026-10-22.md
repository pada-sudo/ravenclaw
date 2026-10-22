# Traceability SOP ↔ Fitur ↔ Test — RavenClaw

- **Tanggal verifikasi:** 22 Oktober 2026
- **Commit yang dinilai:** `41ba7e4` pada branch `agent/pedro-tech-lead/46e74842a795` (setelah merge stage 1–2)
- **Penyusun:** Diana (DEEP-226)
- **Sumber butir aturan:** `BASELINE-REQUIREMENTS-2026-10-22.md` §2 (10 butir gate & jalur + 10 SOP-01 + 6 SOP-02 + 6 SOP-03 + 6 SOP-04 + 10 SOP-05 + 6 SOP-06 + 6 SOP-07 + 6 lintas-potong) dan §3 (AC-01..AC-07, 50 skenario kriteria penerimaan George)
- **Sumber kontrak:** `apps/ddp-project-control/openapi.yaml`
- **Sumber test:** `apps/ddp-project-control/tests/` (39 test, `node --test`)

Dokumen ini menjawab satu pertanyaan audit: **untuk setiap butir SOP dan setiap gate, di mana buktinya di
aplikasi, dan apa yang membuktikan bahwa butir itu benar-benar ditegakkan?** Kolom *status* hanya berisi
apa yang bisa saya tunjukkan hari ini; yang tidak bisa saya buktikan ditandai apa adanya.

## Arti status

| Status | Arti | Tingkat kepercayaan |
| --- | --- | --- |
| **LULUS** | Ditegakkan dan **dibuktikan** hari ini — oleh test otomatis di `tests/`, atau oleh uji manual yang perintahnya ada di §8. | Tinggi |
| **SEBAGIAN** | Mekanisme ada (field/endpoint/layar), tetapi tidak mengikat penuh; celahnya disebut di kolom *sisa celah*. | Sedang |
| **BELUM** | Tidak dimodelkan: tidak ada field, entitas, endpoint, atau layar. | Tinggi (bahwa belum ada) |
| **PENDING** | Butuh artefak/keputusan pihak lain (Adit: aturan & KPI; Sofia: test plan; Rico: istilah UI; THEOFILUS: Q1–Q10). Bukan penilaian teknis. | — |

**Bukan verdict kualitas.** Status LULUS berarti kontrolnya bekerja, bukan berarti UX/istilah/angkanya
benar. Yang menilai kualitas teknis adalah Sofia (DEEP-225); yang menetapkan angka adalah Adit (DEEP-220).

## 1. Ringkasan

| Area | Butir | LULUS | SEBAGIAN | BELUM |
| --- | ---: | ---: | ---: | ---: |
| Gate & jalur (G0–G5, CLOSED, FR/Buffer) | 10 | 3 | 6 | 1 |
| SOP-01 Intake & klasifikasi | 10 | 4 | 2 | 4 |
| SOP-02 Verifikasi administratif & mobilisasi | 6 | — | 5 | 1 |
| SOP-03 First Responder setup | 6 | 5 | — | 1 |
| SOP-04 Buffer & prasyarat B1–B4 | 6 | 2 | 2 | 2 |
| SOP-05 Delivery, QA, change, eskalasi | 10 | 3 | 3 | 4 |
| SOP-06 Acceptance, handover, closure | 6 | — | 3 | 3 |
| SOP-07 Kasus BPOM | 6 | — | 4 | 2 |
| Lintas-potong (audit, resource, KPI, validitas) | 6 | 2 | 4 | — |
| **Total** | **66** | **19** | **29** | **18** |

Butir yang menunggu artefak pihak lain **tetap dinilai** (biasanya BELUM) dan pemiliknya dicatat di §12;
status PENDING tidak dipakai agar tidak ada butir yang menggantung tanpa penilaian.

Untuk 50 kriteria penerimaan George: **19 LULUS**, **3 SEBAGIAN**, **28 BELUM** (rincian §4).

**Perubahan dibanding baseline 22 Oktober (`af65560`):** kontrol gate yang paling berbahaya sudah
tertutup — daftar wajib kosong (G2A/G2B), hapus item wajib, ubah jalur, kode proyek bentrok, tanggal
invalid, status mustahil, jejak pelaku, auth/RBAC, dan soft delete. Yang **belum** tertutup dan masih
memblokir pilot: penutupan proyek dari gate mana pun, bukti acceptance/handover, bukti+verifikator saat
menandai `disetujui`/`terverifikasi`, format laporan mingguan, serta seluruh model data SOP-06/SOP-07.

## 2. Gate & jalur

| ID | Butir | Status | Implementasi (layar/field/endpoint) | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| G0 | Jalur ditentukan; alasan Shared Service dicatat | SEBAGIAN | `reason_shared_service`, layar *Edit gate G0*; `gateGaps` `lib/domain.js:132` | `test_domain`: *G0 new project rejects without reason_shared_service* | Alasan self-declared — tidak ada bukti/approver/waktu. Jalur **tidak** bisa diubah setelah intake (`422`, lihat S01-8) |
| G1 | NDE, anggaran, onboarding | SEBAGIAN | `nde_no`, `nde_date`, `budget_status`, `onboarding_status`; `lib/domain.js:136` | `test_domain`: *G1 first responder requires NDE, budget…*; manual: tiga gap berurutan lalu hilang | Ketiganya cukup diketik operator; tidak ada `verified_by`/`verified_at`, tidak ada nomor dokumen anggaran |
| G2A | 7 deliverable wajib disetujui | LULUS | `lib/domain.js:141` (hitung wajib + status); hapus item wajib ditolak di `lib/routes.js:279` | `test_domain`: *G2A rejects when not all approved*; `test_http`: *DELETE required deliverable on active project is rejected*; manual: gate naik hanya setelah 7/7 `disetujui` | Kualitas "disetujui" bergantung S03-4 (evidence/reviewer belum wajib) |
| G2B | 8 prasyarat Buffer terverifikasi | LULUS | `lib/domain.js:149`; hapus item wajib ditolak `lib/routes.js:333` | `test_domain`: *G2B rejects when checklist is empty*, *…not verified*; manual: 8 item tampil, gap `8 prasyarat teknis Buffer wajib belum terverifikasi` | Prasyarat belum dipetakan B1–B4 (S04-2); "terverifikasi" tanpa bukti (S04-3) |
| G3 | Scope/timeline/FTE/akses/weekly disepakati | SEBAGIAN | `lib/domain.js:157` — hanya blocker terbuka + keberadaan ≥1 laporan | Manual: G3→G4 naik dengan `start_date`/`fte` kosong dan 1 laporan | `start_date`, `end_date`, `fte`, `access_status`, umur laporan tidak diperiksa (AC-05.8) |
| G4 | Validasi hasil, QA, dokumen serah terima | SEBAGIAN | `lib/domain.js:163` — hanya owner+due untuk risk terbuka | Manual: G4→G5 `200 {"next":"G5","gaps":[]}` tanpa catatan acceptance | Tidak ada entitas acceptance/handover (S06-2/S06-4) |
| G5 | Transisi definitif, isu residual, lessons learned | SEBAGIAN | `lib/domain.js:170` — hanya `notes` tidak kosong | Manual: `notes` diisi → `200 {"next":"CLOSED"}` | `definitive_plan`, `bridging_end`, evaluasi tidak diperiksa |
| CLOSED | Ditutup hanya setelah seluruh gate | BELUM | `POST .../close` hanya memeriksa peran `pm_action` (`lib/routes.js:207`) | Manual: dari **G0** → `200 {"ok":true,"gate":"CLOSED"}` (peran `pm`) | Tidak ada pemeriksaan gate; P0-03 masih terbuka |
| Jalur FR | 7 deliverable SOP-03 otomatis | LULUS | `FR_DELIVERABLES` `lib/domain.js:5`; dibuat di `lib/routes.js:89` | Manual: intake FR → `deliverables=7`, `buffer_checks=0` | — |
| Jalur Buffer | 8 prasyarat SOP-04 otomatis; gate B1–B4 | SEBAGIAN | `BUFFER_CHECKS` `lib/domain.js:14` | Manual: intake Buffer → `buffer_checks=8`, `deliverables=0`; G1→G2B `200` | Checklist datar, tanpa klasifikasi B1–B4 dan tanpa checklist exit (B4); label layar masih "B1–B3" |

## 3. SOP-01 — Intake, klasifikasi, permintaan Shared Service

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S01-1 | Tujuan/outcome terukur | BELUM | Hanya `notes` bebas | — | Tidak ada field tujuan/outcome |
| S01-2 | Jenis kontrak | BELUM | `validateProjectInput` whitelist (`lib/domain.js:218`) | Manual: `POST` dengan `contract_type:"lumsum"` → `200`; `GET` proyek → `{}` (field dibuang) | Field & nomor/tanggal kontrak tidak ada |
| S01-3 | Status tahapan procurement | BELUM | `procurement_doc` + `procurement_target_start` saja | — | Tidak ada status proses/tanggal tiap tahap |
| S01-4 | Kontrol waktu pengadaan (60/45/30/14 hari) | LULUS | `PROC_LEAD_DAYS`, `procurementInfo()` `lib/domain.js` | Manual: PRJ-2026-002 PKDF → `submit_by 2026-10-16`, peringatan "terlambat 6 hari"; PRJ-2026-003 → `2026-10-11`, "terlambat 11 hari" | Tidak ada jalur dispensasi tercatat |
| S01-5 | Target mulai pekerjaan | LULUS | `procurement_target_start`, `start_date`, input `type=date` | `test_domain`/`test_http`: tanggal invalid `422` | — |
| S01-6 | Kebutuhan role/FTE per peran | BELUM | `fte` hanya string bebas | Manual: `role_fte:[{role:"PM",fte:0.5}]` → `200`, field tidak tersimpan | Menunggu model aturan Adit (PENDING untuk angkanya) |
| S01-7 | Klasifikasi jalur FR vs Buffer | LULUS | `track` wajib; `lib/domain.js:218` | Manual: `POST` tanpa `track` → `422 Jalur (track) wajib first_responder atau buffer` | — |
| S01-8 | Jalur tidak berubah tanpa kontrol | LULUS | `lib/routes.js:144` menolak perubahan `track` | `test_http`: *PUT /api/projects/:id rejects track change after intake* (`422`) | — |
| S01-9 | Permintaan CFU via NDE (nomor, tanggal, lingkup) | SEBAGIAN | `nde_no`, `nde_date` diperiksa di G1 | `test_domain`: gap NDE | Ruang lingkup & lampiran dokumen tidak ada |
| S01-10 | Scope awal & risiko keterlambatan resource | SEBAGIAN | `notes` bebas; RAID butuh proyek | — | Scope bukan daftar; risiko belum bisa dicatat saat intake |

## 4. SOP-02 — Verifikasi administratif & mobilisasi

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S02-1 | Verifikasi NDE (nomor/tanggal/lingkup) | SEBAGIAN | Gap G1 | `test_domain` | Tanpa verifikator, waktu, dan lingkup |
| S02-2 | Anggaran disetujui & tersedia di sistem keuangan | SEBAGIAN | `budget_status` enum 3 nilai | Manual: `disetujui` cukup diketik | Tidak ada referensi dokumen/sistem keuangan |
| S02-3 | Onboarding: akses sistem, orientasi, hak akses | SEBAGIAN | `onboarding_status` enum 3 nilai | Manual: `berjalan` cukup dipilih | Tidak ada daftar akses/tanggal efektif/PIC |
| S02-4 | Chapter menilai kapasitas; role/FTE/periode | BELUM | — | — | Menunggu aturan Adit |
| S02-5 | Gap administrasi → status Pending/Blocked + eskalasi | SEBAGIAN | `status` enum `active/pending/blocked/closed`; `assertStateConsistent` `lib/domain.js:114` | Manual: `PUT {"status":"closed"}` pada proyek aktif → `422` | Gap hanya teks di layar; tidak ada register gap/eskalasi; status tidak otomatis |
| S02-6 | Accountability: siapa memverifikasi & kapan | SEBAGIAN | `actorFrom()` menulis `"<nama> [<role>]"` ke `events` | Manual: event intake = `Operator Demo [operator]`; `test_http` login/sesi | Tidak ada field `verified_by`/`verified_at` per butir verifikasi (jejaknya hanya event perubahan) |

## 5. SOP-03 — First Responder setup

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S03-1 | 7 deliverable otomatis dengan penyusun sesuai SOP | LULUS | `FR_DELIVERABLES`; `GET /api/meta` | Manual: 7 baris; nama & `owner_role` sama dengan SOP-03 | — |
| S03-2 | Item wajib bertanda & tidak bisa hilang | LULUS | kolom `required`; `DELETE` ditolak `lib/routes.js:279` | Manual: 7× `DELETE` → `422 Deliverable wajib tidak boleh dihapus…`; `test_http` | — |
| S03-3 | Status, evidence, reviewer, due date | LULUS | kolom `status`/`evidence_url`/`reviewed_by`/`due_date`; layar *Deliverable Setup — SOP-03* | Manual: field tersimpan & terbaca | — |
| S03-4 | `disetujui` hanya dengan evidence + reviewer | BELUM | `PUT .../deliverables/:did` tidak memeriksa isi | Manual: `{"status":"disetujui","evidence_url":"","reviewed_by":""}` → `200` | P0 — bukti gate bisa kosong |
| S03-5 | Data salah bisa dikoreksi (termasuk dikosongkan) | LULUS | nilai body dipakai apa adanya (`lib/routes.js:297`) | `test_domain`: *validateProjectInput preserves empty string for optional fields* | Koreksi tidak ditandai khusus di jejak (hanya event "deliverable diperbarui") |
| S03-6 | Gate G2A memeriksa status seluruh deliverable | LULUS | `lib/domain.js:141` | `test_domain` | — |

## 6. SOP-04 — Buffer (termasuk B1–B4)

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S04-1 | 8 prasyarat otomatis | LULUS | `BUFFER_CHECKS`; `lib/routes.js:89` | Manual: 8 baris, 0 deliverable | — |
| S04-2 | Pemetaan B1/B2/B3/B4 | BELUM | `buffer_checks` datar (tanpa kolom klasifikasi) | Layar: *Prasyarat Teknis Buffer — SOP-04 (Gate B1–B3)* | Label "B1–B3" ≠ SOP "B1–B4" (P3-01, perlu Rico) |
| S04-3 | Verifikasi dengan bukti + verifikator + waktu | SEBAGIAN | kolom `evidence`, `verified_by`, `verified_at` | Manual: `{"verified":1}` → `200` dengan `verified_by:""`, `evidence:""` (`verified_at` terisi) | Tidak ada syarat isi |
| S04-4 | G2B hanya lolos bila semua terverifikasi | LULUS | `lib/domain.js:149` | `test_domain`: empty & not-verified | — |
| S04-5 | Checklist exit/transition (B4) sebelum penugasan berakhir | BELUM | Hanya `bridging_end` + `definitive_plan` teks | — | Tidak ada checklist B4 |
| S04-6 | KT selesai dengan bukti (MoM/checklist) | SEBAGIAN | item checklist + `evidence` teks | — | Tidak ada lampiran/daftar hadir |

## 7. SOP-05 — Delivery control, QA, perubahan, eskalasi

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S05-1 | WBS/milestone/planned-actual/baseline | BELUM | — | — | Tidak ada entitas WBS/baseline (P2-05) |
| S05-2 | Weekly progress: selesai vs rencana, evidence, blocker, risiko, keputusan | LULUS | `weekly_reports` lengkap; layar *Weekly Report — SOP-05* | Manual: kolom tersimpan & tampil | Kelengkapan tidak divalidasi (S05-3) |
| S05-3 | Format minimum laporan divalidasi | BELUM | `lib/routes.js:374` hanya mewajibkan `period` tidak kosong | Manual: `{"period":"minggu lalu"}` → `200`, isi kosong | — |
| S05-4 | Tenggat & pengingat laporan | BELUM | KPI hanya menghitung laporan 7 hari terakhir | — | Menunggu keputusan Q9 (tenggat & penegur) |
| S05-5 | Konfirmasi PM: siapa & kapan | SEBAGIAN | `pm_confirmed`, `pm_confirmed_by`; endpoint `PUT /api/reports/:rid/confirm` (peran `pm_action`) | Manual: konfirmasi → `pm_confirmed_by:"Project Manager Demo [pm]"`; tidak ada `pm_confirmed_at` | Waktu konfirmasi tidak tersimpan; `pm_confirmed` masih bisa dikirim saat pembuatan laporan (`lib/routes.js:387`) |
| S05-6 | QA/kualitas: checklist & hasil uji | BELUM | Hanya `status='review'` + `reviewed_by` | — | Menunggu aturan Adit |
| S05-7 | Change control: dampak, approval berwenang, jejak | SEBAGIAN | `change_requests`; keputusan hanya peran `approver_action` (`lib/routes.js:461`) | Manual: operator `PUT` → `403`; approver menyetujui tanpa `impact_assessment` → `200` | Dampak tidak wajib; `approver` masih teks bebas; baseline tidak berubah |
| S05-8 | RAID: deskripsi, dampak, owner, due, mitigasi | LULUS | tabel `risks`; layar RAID | Manual: item tercatat & tampil | — |
| S05-9 | Jalur & SLA eskalasi blocker | SEBAGIAN | flag `escalated`; eskalasi gate mencatat alasan (`lib/routes.js:191`) | `test_http`: *approver can force advance with reason* | Tidak ada tujuan/level/SLA/bukti notifikasi (P2-07) |
| S05-10 | Security/kerahasiaan; akses berbasis kebutuhan | LULUS | sesi cookie + RBAC (`lib/auth.js`); rate limit & security header (`lib/security.js`) | `test_http`: *anonymous requests are rejected*, *auditor cannot mutate projects*, *operator cannot force advance*, *security headers…*, *rate limit…*; manual: operator `PUT /api/changes/:cid` → `403` | UI belum punya layar login (K1) dan akun demo dipakai bersama (K9) |

## 8. SOP-06 — Acceptance, handover & penutupan

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S06-1 | Inventaris deliverable selesai/belum | SEBAGIAN | FR: tabel `deliverables`; Buffer: hanya prasyarat | — | Buffer tidak punya daftar deliverable |
| S06-2 | Testing/QA/acceptance sesuai kontrak | BELUM | — | Manual: `GET /api/projects/:id/acceptance` → `404` | Entitas BAPP/BAST tidak ada (Q10) |
| S06-3 | Isu residual: owner, due, keputusan formal | SEBAGIAN | `lib/domain.js:163` | Manual: G4→G5 lolos dengan risk ber-owner | Tidak ada keputusan formal (terima/tunda/tolak) + approver |
| S06-4 | Handover dokumentasi/akses/as-built | BELUM | Hanya `gate_notes` teks | — | — |
| S06-5 | Tutup penugasan; talent definitif ditangani | SEBAGIAN | `POST /api/projects/:id/close` | Manual: dari G0 → `200 CLOSED` | Tanpa pemeriksaan gate; `definitive_plan` tidak diwajibkan |
| S06-6 | Evaluasi load activity & lessons learned | BELUM | `notes` bebas di G5 | — | Menunggu aturan Adit |

## 9. SOP-07 — Kasus BPOM

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| S07-1 | 70% Delivery 3 bulan + 30% Manage Service sebagai data | BELUM | `public/content/bpom-case.json` (teks) + `bpom_case` flag | Manual: proyek BPOM seed hanya punya teks di `notes` | Parameter bukan data per proyek (Q8) |
| S07-2 | Dukungan DPS 50% sebagai dukungan sementara | SEBAGIAN | `fte` teks + `bpom_case` | — | Tidak ada batas/validasi maupun penanda "sementara" |
| S07-3 | Periode bridging ≤ 4 minggu | SEBAGIAN | `start_date`, `bridging_end`; hitung sisa hari di UI | `test_frontend`: *daysLeft calculates remaining days* | Durasi tidak divalidasi |
| S07-4 | Pemenuhan definitif paralel | SEBAGIAN | `definitive_plan` + KPI `transition_ready_pct` | Manual: `GET /api/kpis` | Tidak ada status/tanggal efektif pemenuhan |
| S07-5 | Buffer 50% bukan pemenuhan permanen | SEBAGIAN | Banner BPOM + alert dashboard | Manual: panel BPOM tampil pada proyek `bpom_case=1` | Tidak ada aturan yang memblokir perpanjangan |
| S07-6 | Evaluasi minimal 1 bulan | BELUM | — | — | Menunggu aturan Adit |

## 10. Lintas-potong

| ID | Butir | Status | Implementasi | Bukti | Sisa celah |
| --- | --- | --- | --- | --- | --- |
| X-1 | Setiap aktivitas punya pelaku | LULUS | `actorFrom(req, session)` (`lib/db.js`); dipakai semua handler | Manual: `events.actor = "Operator Demo [operator]"` | — |
| X-2 | Riwayat immutable, dapat diaudit, tersimpan | SEBAGIAN | Soft delete (`lib/routes.js:236`); `events` hanya INSERT | `test_http`: *Soft delete hides project…* ; manual: proyek terhapus tetap terbaca auditor dengan `include_deleted=true` | Tidak ada export/retensi; detail proyek hanya menampilkan 200 event terakhir (`lib/routes.js:126`); **tidak ada cara membatalkan hapus** lewat API |
| X-3 | Resource governance (FTE, masa tugas, onboarding, kapasitas) | SEBAGIAN | `fte` teks, `start_date`/`end_date`/`bridging_end`, `onboarding_status`, `definitive_plan` | Manual: field tersimpan | Kapasitas Chapter & assignment per peran tidak ada |
| X-4 | KPI dihitung dari data, definisi disetujui PO | SEBAGIAN | `computeKpis()` `lib/domain.js:176`; `GET /api/kpis` | Manual: `admin 25%, fr 0%, buffer 25%, weekly 100%, blockers 1, transition 100%` | (a) `transition_ready_pct` dari 1 proyek tanpa penanda sampel; (b) **`blocker_avg_age_days` selalu 0** karena `daysBetween()` hanya menerima `YYYY-MM-DD` sedangkan `created_at` berupa ISO lengkap; (c) definisi menunggu Adit |
| X-5 | Kontrol validitas data | SEBAGIAN | `validateDateField`, enum `oneOf`, `assertStateConsistent` | `test_http`: *rejects impossible date*; manual: `{"status":"closed"}` pada proyek aktif → `422` | Skema URL `evidence_url` tidak divalidasi server (`javascript:` diterima); konsistensi `start_date` ≤ `end_date` tidak diperiksa |
| X-6 | Identitas proyek unik & stabil | LULUS | `nextProjectCode()` memakai tabel `project_counters` | `test_http`: *…DELETE then POST again yields unique code* | — |

## 11. Kriteria penerimaan (AC-01..AC-07)

**19 LULUS · 3 SEBAGIAN · 28 BELUM** dari 50 skenario baseline.

Kolom *bukti* menyebut test atau perintah manual (§13). AC yang tidak berubah dari baseline tetap
dicantumkan agar matriks ini bisa dipakai sebagai daftar kerja Sofia.

### AC-01 — Intake (SOP-01)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-01.1 | LULUS | Manual: `POST` tanpa `track` → `422` | — |
| AC-01.2 | LULUS | Manual: proyek FR → `deliverables=7`, `buffer_checks=0` | — |
| AC-01.3 | LULUS | Manual: proyek Buffer → `buffer_checks=8`, `deliverables=0` | — |
| AC-01.4 | LULUS | `test_http`: *unique code* | — |
| AC-01.5 | BELUM | Manual: `contract_type`/`role_fte` dibuang (`200`, tidak ada di `GET`) | Butuh model data (Adit + Bagas) |
| AC-01.6 | LULUS | Manual: `submit_by` & warning PKDF/SP | — |
| AC-01.7 | LULUS | `test_http`: *rejects track change* | — |
| AC-01.8 | LULUS | Manual: event intake mencantumkan `Operator Demo [operator]` | — |

### AC-02 — Verifikasi administratif (SOP-02)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-02.1 | LULUS | `test_domain`: G1 gap NDE | — |
| AC-02.2 | LULUS | `test_domain`: G1 gap anggaran; manual: gap hilang setelah field terisi | — |
| AC-02.3 | BELUM | Manual: `budget_status:"disetujui"` diterima tanpa referensi bukti | Tidak ada field bukti/verifikator |
| AC-02.4 | LULUS | Manual: event memuat nama & waktu pelaku | Tidak ada field `verified_by` khusus — bukti berasal dari jejak event |
| AC-02.5 | BELUM | Manual: status hanya berubah manual; `422` hanya untuk kombinasi mustahil | Tidak ada register gap/eskalasi |
| AC-02.6 | BELUM | — | Menunggu aturan Adit |

### AC-03 — Setup First Responder (SOP-03)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-03.1 | LULUS | `test_domain` + `test_http`: advance `422` dengan gap deliverable | — |
| AC-03.2 | LULUS | `test_domain`: *G2A …* + manual: seluruh `DELETE` item wajib → `422` | — |
| AC-03.3 | LULUS | `test_http`: *DELETE required deliverable … rejected* | — |
| AC-03.4 | BELUM | Manual: `disetujui` tanpa evidence/reviewer → `200` | P0-07/K4 |
| AC-03.5 | LULUS | `test_domain`: *preserves empty string* | — |
| AC-03.6 | SEBAGIAN | Manual: `javascript:alert(1)` **diterima** server (`200`); `test_frontend`: *safeUrl allowlists only http/https…* menolak render | Validasi skema URL di server belum ada |
| AC-03.7 | BELUM | — | Tidak ada daftar penandatangan |

### AC-04 — Kesiapan Buffer (SOP-04)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-04.1 | LULUS | Manual: buffer G1→G2B, 8 item tampil | — |
| AC-04.2 | LULUS | `test_domain`: *G2B rejects when … not verified* | — |
| AC-04.3 | LULUS | `test_domain`: *G2B rejects when checklist is empty*; manual: hapus item wajib → `422` | — |
| AC-04.4 | BELUM | Manual: `{"verified":1}` tanpa bukti → `200` | — |
| AC-04.5 | BELUM | — | Butuh kolom klasifikasi B1–B4 |
| AC-04.6 | BELUM | — | Checklist B4 tidak ada |

### AC-05 — Delivery, QA, change, eskalasi (SOP-05)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-05.1 | BELUM | Manual: periode `"minggu lalu"` → `200` | — |
| AC-05.2 | BELUM | Manual: laporan tanpa planned/actual → `200` | — |
| AC-05.3 | BELUM | Manual: tidak ada `pm_confirmed_at`; `pm_confirmed` bisa dikirim saat membuat laporan | — |
| AC-05.4 | BELUM | — | Menunggu Q9 |
| AC-05.5 | BELUM | Manual: approver menyetujui tanpa `impact_assessment` → `200` | — |
| AC-05.6 | SEBAGIAN | Manual: operator → `403`; approver → `200` dan `decided_at` terisi | `approver` masih teks bebas; baseline tidak berubah |
| AC-05.7 | BELUM | — | Menunggu aturan Adit |
| AC-05.8 | BELUM | Manual: G3→G4 lolos dengan `start_date`/`fte` kosong | — |
| AC-05.9 | LULUS | `test_http`: 401 anonymous, auditor 403, operator force 403; manual: operator `PUT /api/changes` → `403` | — |

### AC-06 — Acceptance, handover, penutupan (SOP-06)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-06.1 | BELUM | Manual: G4→G5 → `200` tanpa bukti | — |
| AC-06.2 | BELUM | Manual: `/acceptance` → `404` | — |
| AC-06.3 | BELUM | — | — |
| AC-06.4 | BELUM | — | — |
| AC-06.5 | BELUM | Manual: `close` dari G0 → `200 CLOSED` | P0-03 |
| AC-06.6 | BELUM | — | — |
| AC-06.7 | SEBAGIAN | Manual: `reopen` hanya untuk approver, gate kembali ke `prev_gate` | Tidak ada field alasan/approver; alasan hanya bisa ditulis di catatan gate |

### AC-07 — Kasus BPOM (SOP-07)

| # | Status | Bukti | Sisa celah |
| --- | --- | --- | --- |
| AC-07.1 | BELUM | — | Parameter di `content/bpom-case.json`, bukan data proyek |
| AC-07.2 | BELUM | — | `fte` teks |
| AC-07.3 | LULUS | `test_frontend`: *daysLeft*; manual: panel BPOM & `daysLeft` tampil | — |
| AC-07.4 | BELUM | — | — |
| AC-07.5 | BELUM | — | — |
| AC-07.6 | BELUM | — | Menunggu aturan Adit |
| AC-07.7 | BELUM | Manual: `transition_ready_pct: 100` tanpa penanda `n=1` | — |

## 12. Yang masih menunggu pihak lain (jangan menebak)

| Artefak / keputusan | Pemilik | Dampak pada matriks ini |
| --- | --- | --- |
| Definisi aturan & KPI (FTE per peran, kapasitas Chapter, tenggat laporan, QA checklist, evaluasi, parameter BPOM, populasi KPI) | Adit (DEEP-220) | Butir S01-6, S02-4, S05-4, S05-6, S06-6, S07-1, S07-6, X-4 dinilai **BELUM model**, bukan "salah angka" |
| Test plan & eksekusi per AC | Sofia (DEEP-225) | Belum ada di branch integrasi; status AC di §11 adalah hasil uji manual saya + test di `tests/` |
| Istilah UI (B1–B3 vs B1–B4; CLOSED vs END) | Rico (DEEP-221) | P3-01 masih terbuka di layar |
| Jawaban Q1–Q10 (approver per gate, retensi, tenant, force, SOP resmi, data pilot, wajib/tidak 7+8 item, angka BPOM, tenggat laporan, bentuk acceptance) | THEOFILUS | Menentukan bentuk perbaikan; beberapa AC tidak bisa ditutup tanpa ini |
| Dokumen SOP/NDE resmi | THEOFILUS | Semua verdict diukur terhadap ringkasan SOP revisi 3.0 di aplikasi |

## 13. Cara memverifikasi ulang

```bash
cd apps/ddp-project-control
rm -rf data && npm test                      # 39 test, harus 39/39 lulus (~10 detik)
rm -rf /tmp/dd && DATA_DIR=/tmp/dd PORT=3312 node server.js &
B=http://localhost:3312
curl -s -c /tmp/c.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"operator"}'
curl -s -b /tmp/c.txt "$B/api/projects/2" | head -c 400          # gate_info + deliverables
curl -s -b /tmp/c.txt "$B/api/kpis"                              # X-4
```

Butir yang bisa diuji satu per satu (bukti §2–§10):

| Untuk membuktikan | Perintah |
| --- | --- |
| G2A menolak deliverable kosong | `DELETE` setiap `deliverables/{did}` pada proyek FR → `422`; `POST .../advance` → `422` |
| `disetujui` tanpa bukti | `PUT .../deliverables/{did}` `{"status":"disetujui","evidence_url":"","reviewed_by":""}` → `200` (masih bocor) |
| `close` dari gate mana pun | login `pm`, `POST /api/projects/{id}/close` pada proyek G0 → `200 CLOSED` (masih bocor) |
| Jejak pelaku | `GET /api/projects/{id}` → `events[].actor` berisi `"<nama> [<role>]"` |
| RBAC | login `operator` → `POST .../advance {"force":1}` → `403`; login `auditor` → `POST /api/projects` → `403` |
| Soft delete | `DELETE` sebagai approver → `GET /api/projects?include_deleted=true` masih memuat proyek; `GET /api/projects/{id}` → `404` |
| Kode proyek unik | hapus proyek lalu intake baru → kode baru (`PRJ-2026-0xx` tidak didaur ulang) |
| KPI blocker age | `GET /api/kpis` → `blocker_avg_age_days: 0` meski ada blocker berumur beberapa hari (cacat X-4) |

## 14. Inkonsistensi yang harus diselesaikan pemiliknya (bukan diperbaiki diam-diam)

Ditemukan saat menyusun matriks ini. Semua dicatat, tidak ada yang saya ubah di kode.

| # | Temuan | Bukti | Pemilik |
| --- | --- | --- | --- |
| I1 | Tombol **Eskalasi & tetap naik gate** di UI mengirim `{"force":1}` **tanpa** `force_reason`, sehingga selalu ditolak `422 Force advance wajib menyertakan force_reason` | `public/modules/views/project-detail.js` (`bindAdvanceActions`), `lib/routes.js:191` | Fajar + Bagas |
| I2 | `docs/DOMAIN-RULES.md` §4 menyebut force advance "diizinkan tanpa memeriksa peran" dan §9 menyebut aktor dari header `x-actor-*`; keduanya sudah tidak berlaku (peran approver + `force_reason` wajib; aktor dari sesi) | `docs/DOMAIN-RULES.md` vs `lib/routes.js:189-192`, `lib/db.js` `actorFrom` | Bagas (pemilik dokumen domain) |
| I3 | `docs/DOMAIN-RULES.md` §2 menyebut item wajib boleh dihapus setelah G2A; kode baru mengizinkan setelah `CLOSED` | `lib/routes.js:279`, `lib/routes.js:333` | Bagas |
| I4 | Label layar "Gate B1–B3" vs SOP B1–B4 | `public/modules/views/project-detail.js:288`, `lib/domain.js:155` | Rico + Bagas |
| I5 | `blocker_avg_age_days` selalu `0` (lihat X-4) | `lib/domain.js` `daysBetween`/`computeKpis` | Bagas |
| I6 | README/compose/ADR menyebut `SESSION_SECRET`, tetapi kode tidak membacanya (token sesi acak di DB). Tidak berbahaya, tetapi menyesatkan operator | `lib/auth.js` vs `compose.yaml`, `docs/ADR/ADR-004` | Victor |
| I7 | `public/content/*.json` dapat disunting PO tanpa deploy, tetapi `gateGaps` di server tetap sumber kebenaran — perubahan teks SOP di `content` tidak mengubah aturan gate | `lib/domain.js:125` vs `public/content/gates.json` | Adit + Fajar |
