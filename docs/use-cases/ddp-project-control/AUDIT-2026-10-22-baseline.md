# Audit Baseline — DDP Project Control

- **Tanggal:** 22 Oktober 2026
- **Auditor:** Pedro (Tech Lead), atas penugasan THEOFILUS JIMMY
- **Isu induk:** DEEP-218 — Web Apps
- **Baseline yang diaudit:** `ddp-project-control-v3.tar.gz` (server.js 787 baris,
  public/app.js 833 baris, public/style.css 168 baris, public/index.html 28 baris)
- **Lokasi setelah audit:** `apps/ddp-project-control/`

Setiap temuan di bawah **diverifikasi dengan menjalankan aplikasi** (`PORT=3311
node server.js`) dan memanggil endpoint-nya, bukan hanya membaca kode.

## Ringkasan

| Area | Kritis | Tinggi | Sedang | Rendah |
| --- | --- | --- | --- | --- |
| A. Domain & kontrol gate | 2 | 3 | 5 | 2 |
| B. Keamanan | 1 | 1 | 3 | 2 |
| C. Frontend | 0 | 1 | 3 | 3 |
| D. Kualitas & operasi | 0 | 1 | 4 | 1 |
| E. Kesesuaian bisnis (SOP-01..07) | 0 | 2 | 5 | 1 |

Verdict: aplikasi sudah menangkap **model proses** (jalur, gate, deliverable,
RAID, weekly report, pengadaan) dengan cukup baik sebagai prototipe, tetapi
**belum layak dipakai sebagai alat kontrol** karena aturan gate dapat dilewati
tanpa data, tidak ada identitas pelaku maupun otorisasi, dan tidak ada test.

## A. Domain & kontrol gate (server.js)

**A1 — Kritis — Gate lolos dengan checklist kosong.** `gateGaps()` menghitung
baris yang *belum* disetujui; bila tidak ada baris sama sekali, hasilnya 0 dan
gate dianggap lolos (vacuous truth). Reproduksi: hapus 7 deliverable sebuah
proyek First Responder, lalu `POST /api/projects/4/advance` dua kali →
`{"next":"G2A","gaps":[]}` lalu `{"next":"G3","gaps":[]}` tanpa satu pun
deliverable. UI justru menampilkan kriteria ✗ (memakai syarat `length > 0`) —
server dan UI tidak sepakat.

**A2 — Tinggi — `track` bisa diubah setelah intake.** `PUT /api/projects/:id`
menerima `track` tanpa efek samping: deliverable First Responder tetap ada,
`buffer_checks` tidak dibuat. Akibatnya gate G2B lolos kosong dan jalur gate
berubah tanpa catatan khusus.

**A3 — Kritis — Penomoran proyek memakai `COUNT(*)`.** `nextProjectCode()`
menghitung jumlah baris `PRJ-<tahun>-%`. Menghapus proyek di tengah membuat
kode terpakai ulang atau bertabrakan. Reproduksi: `DELETE /api/projects/2` lalu
`POST /api/projects` → **HTTP 500 `{"error":"UNIQUE constraint failed:
projects.code"}`**. Selain gagal, pesan ini membocorkan detail internal DB.

**A4 — Tinggi — Eskalasi gate tanpa otorisasi.** `POST /advance` dengan
`force:1` menaikkan gate melewati semua gap; tidak ada peran/approver yang
diperiksa, jejaknya hanya satu baris di `events`.

**A5 — Tinggi — Tanpa transaksi dan tanpa invariant status.** `POST /api/projects`
menyisipkan project + 7 deliverable (atau 8 checklist) tanpa `BEGIN/COMMIT`;
kegagalan di tengah meninggalkan data setengah jadi. `status` juga bisa diisi
langsung dari body sehingga lahir state mustahil (gate `G0` + status `closed`).

**A6 — Sedang — Validasi tanggal longgar.** `nde_date:"bukan-tanggal"` dan
`start_date:"2026-13-45"` diterima apa adanya; `daysBetween()` lalu
mengembalikan `null` sehingga pengingat pengadaan dan aging blocker salah hitung
tanpa error.

**A7 — Sedang — Field tidak bisa dikosongkan.** Pola `s(body.x) || row.x`
membuat nilai kosong diabaikan. Reproduksi: `PUT` `evidence:"https://bukti"`
lalu `PUT` `evidence:""` → nilai lama tetap. Data yang salah tidak bisa
dikoreksi.

**A8 — Sedang — Campur UTC dan waktu lokal.** `today()` memakai
`toISOString()` (UTC), `addDays()` memakai `setDate()` (lokal). Di TZ non-UTC
tanggal bergeser satu hari: `addDays("2026-12-15", -60)` = `2026-10-16` di UTC
tetapi `2026-10-15` di `America/Los_Angeles`. Deadline pengadaan/spesifikasi
"2 bulan sebelum mulai" bisa salah sehari untuk operator WIB yang bekerja
sebelum 07:00.

**A9 — Sedang — Tidak ada index dan query N+1.** `sqlite_master` hanya berisi
autoindex PK/UNIQUE; semua query anak memakai `WHERE project_id = ?` tanpa
index. `computeKpis()` menjalankan query di dalam loop per proyek (68
`db.prepare` di file) — O(n) query per buka dashboard.

**A10 — Sedang — Migrasi ad-hoc.** Skema hanya `CREATE TABLE IF NOT EXISTS`
plus satu `ALTER TABLE ... prev_gate` yang dieksekusi di tengah file. Kolom
baru berikutnya tidak akan pernah sampai ke DB existing; tidak ada versi skema
(`user_version`/tabel migrasi).

**A11 — Rendah — Kode proyek tidak atomik; `events` tanpa batas & retensi;
`GET /api/projects` tanpa pagination.**

**A12 — Rendah — Jejak audit tanpa identitas.** `logEvent()` selalu menulis
`actor = 'operator web'`; seluruh riwayat tidak bisa dipakai untuk
pertanggungjawaban.

## B. Keamanan

**B1 — Kritis — Tidak ada autentikasi maupun otorisasi.** Seluruh endpoint
terbuka, termasuk `DELETE /api/projects/:id`. Reproduksi: `curl -X POST
http://host/api/projects -d '{"name":"Audit Test A",...}'` tanpa kredensial →
`200`. Tidak ada konsep peran (operator / PM / approver / auditor) padahal SOP
mensyaratkan pemisahan approver.

**B2 — Tinggi — Rate limit mudah dilewati dan bocor memori.** Hanya
POST/PUT/DELETE yang dibatasi; kuncinya `x-forwarded-for` (bisa dipalsukan
klien); `rateMap` in-memory tidak pernah dibersihkan. Reproduksi: 250 × `GET
/api/kpis` → tetap `200`.

**B3 — Sedang — Tanpa security header.** Respons hanya membawa
`Content-Type` dan `Cache-Control`: tidak ada `Content-Security-Policy`,
`X-Content-Type-Options`, `Referrer-Policy`.

**B4 — Sedang — Stored XSS lewat skema URL.** `evidence_url:
"javascript:alert(document.cookie)"` disimpan apa adanya dan dirender ke
`href` (escape hanya mencegah keluar dari atribut, bukan skema berbahaya).

**B5 — Rendah — Bocor internal di error 500** (`err.message` dikirim apa
adanya, lihat A3).

**B6 — Rendah — Tanpa pemeriksaan Origin/CSRF.**

**B7 — Sedang — Hapus permanen tanpa arsip.** `DELETE /api/projects/:id`
meng-cascade deliverable, weekly report, RAID, dan `events` proyek tersebut.
Untuk aplikasi governance, riwayat gate seharusnya *immutable/retained*.

## C. Frontend (public/app.js, index.html, style.css)

**C1 — Tinggi — `app.js` monolitik 833 baris.** Tidak ada router/komponen;
HTML dirakit sebagai string; seluruh isi SOP-07, RACI, dan KPI *hardcoded* di
kode sehingga perubahan kebijakan = ubah kode + deploy, tidak bisa disunting PO.

**C2 — Sedang — Dua sumber aturan yang divergen.** Daftar deliverable/checklist
ada di server (`FR_DELIVERABLES`, `BUFFER_CHECKS`, diekspor lewat `/api/meta`
tetapi tidak dipakai frontend), sedangkan kriteria gate diduplikasi di
`gateCriteria()` (frontend) vs `gateGaps()` (server) — dan keduanya sudah
berbeda perilaku (A1).

**C3 — Sedang — State loading/empty/error tidak konsisten**; kegagalan
ditampilkan lewat `alert()`.

**C4 — Sedang — Aksesibilitas belum dipenuhi**: stepper `<span role="button">`
tanpa `aria-*`, `<label>` tanpa `for`, checkbox tanpa label terhubung, tabel
lebar tanpa scroll horizontal, tidak ada skip-link, kontras teks sidebar
`#7b849c` di atas `#1d2333` di bawah ambang WCAG AA.

**C5 — Sedang — Aksi destruktif memakai `confirm()`/`prompt()` native**;
nama PM untuk konfirmasi laporan diisi lewat `prompt()` tanpa validasi.

**C6 — Rendah — Tidak ada indikator simpan per baris**; setiap simpan
me-render ulang halaman penuh sehingga posisi tab dan gate terpilih hilang.

**C7 — Rendah — `weekNumber()` salah untuk awal tahun; escape ganda pada
`fmt()`.**

**C8 — Rendah — Semua teks Indonesia hardcoded di markup** (tidak dipisah dari
logika, menyulitkan revisi copy).

## D. Kualitas & operasi

**D1 — Tinggi — Nol test, nol lint, nol README** pada paket aslinya.

**D2 — Sedang — Tidak ada Dockerfile/healthcheck/env terdokumentasi** (hanya
`PORT`). Seed berjalan otomatis saat DB kosong sehingga data demo bercampur
dengan data pilot.

**D3 — Sedang — Observability minimal**: hanya `console.log`/`console.error`,
tanpa structured log, request id, atau export audit.

**D4 — Sedang — Backup/restore SQLite WAL tidak ada** (tanpa checkpoint
terjadwal, tanpa prosedur restore).

**D5 — Rendah — `node:sqlite` masih eksperimental** dan `engines >= 24`; versi
Node wajib dipin.

**D6 — Sedang — Keputusan arsitektur belum tercatat (ADR)**: model auth, siapa
approver, retensi audit, single-tenant atau tidak.

## E. Kesesuaian bisnis (SOP-01..07)

**E1 — Tinggi — SOP-01:** jenis kontrak, status procurement tahap awal, dan
kebutuhan role/FTE per role tidak dimodelkan (`fte` hanya string bebas `"50%"`)
→ KPI kapasitas tidak bisa dihitung.

**E2 — Tinggi — SOP-02:** tidak ada pencatat verifikator untuk NDE, anggaran,
dan onboarding; prinsip *accountability* belum terpenuhi.

**E3 — Sedang — SOP-03:** 7 deliverable wajib bisa ditambah/dihapus bebas
hingga gate lolos (A1); deliverable wajib tidak punya penanda "wajib".

**E4 — Sedang — SOP-04:** UI menyebut gate **B1–B3**, tetapi model data hanya
checklist datar tanpa pemetaan B1/B2/B3/B4.

**E5 — Sedang — SOP-05:** weekly report tanpa validasi format minimum,
tanpa tenggat/pengingat, dan konfirmasi PM tidak menyimpan waktu konfirmasi.

**E6 — Sedang — SOP-06:** acceptance/handover (BAPP/BAST) dan evaluasi *load
activity* hanya ada di teks referensi, tanpa entitas atau checklist.

**E7 — Rendah — SOP-07:** angka 70%/30%/50% FTE, periode bridging, dan nomor
Nota Dinas *hardcoded* di frontend dan seed — bukan data proyek.

**E8 — Sedang — KPI:** definisi belum disetujui PO; `transition_ready_pct`
hanya dihitung dari 1 proyek eligible (100% menyesatkan); RACI dan matriks
kewenangan belum dikonfirmasi resmi (aplikasi sendiri sudah memberi disclaimer).

## Yang sudah baik (jangan dirusak saat perbaikan)

- Model proses G0–G5 dengan cabang G2A/G2B sesuai dua jalur, dan pemisahan
  `gateGaps()` sebagai satu titik aturan gate.
- Kontrol lead time pengadaan (PKDF 60h / Lumsum 45h / SP-new 30h / SP 14h)
  dengan peringatan tenggat — sudah benar dan berguna.
- Log aktivitas per gate + catatan gate (`gate_notes`) sebagai kerangka audit.
- Penanganan path traversal pada static server sudah benar (diuji
  `..%2fserver.js` → fallback `index.html`, bukan bocor).
- Seluruh query anak sudah di-scope `project_id` (tidak ada IDOR antar-proyek).
- Seed 3 proyek sudah mewakili ketiga kombinasi jalur/status yang penting.

## Peta temuan → sub-issue

| Sub-issue | Pemilik | Temuan |
| --- | --- | --- |
| Regresi & kriteria penerimaan (SOP conformance) | George | E1–E8 |
| Definisi aturan bisnis & katalog KPI | Adit | E1, E2, E5, E8, A6, A8 |
| UX/UI + aksesibilitas | Rico | C1, C3–C6, C8 |
| Backend: kontrak API + integritas data | Bagas | A1–A12, B5, B7 |
| Frontend: konsumsi kontrak & perbaikan UI | Fajar | C1–C8, B4 |
| Auth, RBAC, hardening & operasi | Victor | B1–B3, B6, D2–D5 |
| Test plan, otomasi & regression gate | Sofia | D1 + verifikasi A/B |
| Dokumentasi & traceability SOP↔fitur | Diana | D1, D6, E-docs |
| Deck validasi internal | Rangga | ringkasan E |
