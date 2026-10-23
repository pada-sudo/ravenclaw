# RavenClaw

Aplikasi web untuk mengendalikan workflow bisnis project **DDP Telkom** pada jalur
**First Responder** dan **Buffer**: gate G0–G5 (termasuk G2A/G2B), SOP-01 s/d SOP-07,
deliverable FR, prasyarat teknis Buffer, weekly report, RAID, change request, dan kasus khusus BPOM.

Aplikasi ini **bukan** sistem ERP/procurement. Fungsinya: mencatat posisi setiap penugasan di
dalam proses, membuktikan bahwa syarat sebuah gate benar-benar terpenuhi sebelum gate itu naik,
dan menyimpan jejak siapa melakukan apa dan kapan.

> **Status: draft untuk validasi internal — belum production-ready.**
> Backend (kontrak API, integritas data, auth/RBAC, hardening, Docker/backup) sudah diperbaiki di
> stage 1–2. Keterbatasan yang masih terbuka — termasuk **UI belum punya layar login** dan
> **proyek masih bisa ditutup dari gate mana pun** — didaftar di bagian
> [Keterbatasan yang diketahui](#keterbatasan-yang-diketahui) dan dilacak per butir di
> `docs/use-cases/ddp-project-control/TRACEABILITY-2026-10-22.md`.

## Siapa yang memakai

| Peran | Yang dikerjakan di aplikasi | Panduan |
| --- | --- | --- |
| **Operator** | Intake proyek, deliverable/checklist, laporan mingguan, RAID, change request | `docs/use-cases/ddp-project-control/PANDUAN-OPERATOR.md` |
| **PM** (Project Manager) | Konfirmasi laporan mingguan, keputusan, menandai proyek selesai | `docs/use-cases/ddp-project-control/PANDUAN-PM.md` |
| **Approver** | Menaikkan gate dengan eskalasi, membuka kembali proyek, menghapus (soft delete) | `docs/use-cases/ddp-project-control/PANDUAN-APPROVER.md` |
| **Auditor** | Membaca riwayat gate, bukti, dan data yang sudah dihapus (read-only) | `docs/use-cases/ddp-project-control/PANDUAN-AUDITOR.md` |

Kewenangan teknis per peran ada di `docs/ADR/ADR-002-rbac-roles.md`; aturan gate ada di
`docs/DOMAIN-RULES.md`.

## Prasyarat

- **Node.js ≥ 24** (`node:sqlite` dipakai langsung, tanpa dependency eksternal) — cek dengan `node -v`.
- Tidak perlu `npm install`. Tidak ada `node_modules`.
- Untuk Docker: Docker Engine + Docker Compose v2.

## Menjalankan lokal

```bash
# dari root repo ini (aplikasi ada di root, tidak ada subdirektori apps/)
node server.js            # http://localhost:3000
```

Varian yang sering dipakai:

```bash
PORT=8080 DATA_DIR=./data node server.js      # ganti port & lokasi database
rm -rf data && node server.js                 # mulai dari database kosong (seed ulang)
```

Database SQLite dibuat otomatis di `${DATA_DIR:-data}/ddp.sqlite` dan di-*seed* dengan 3 proyek
contoh (PRJ-2026-001 Buffer/BPOM di G3, PRJ-2026-002 First Responder di G2A, PRJ-2026-003 Buffer di G1)
serta 4 akun demo. Direktori `data/` tidak di-commit.

### Konfigurasi lewat `.env`

`node server.js` **tidak membaca `.env` secara otomatis**. Dua cara yang bekerja (keduanya teruji):

```bash
# 1) minta Node memuat .env (Node >= 20.6)
cp .env.example .env && node --env-file=.env server.js

# 2) ekspor manual
set -a; . ./.env; set +a; node server.js
```

`docker compose` **membaca `.env` sendiri** — lihat bagian [Docker](#docker).




### Login tanpa UI (sementara)

Build frontend saat ini **belum punya layar login**: `public/index.html` dimuat tanpa sesi, dan
setiap panggilan `/api/*` akan dijawab `401`, sehingga halaman menampilkan state error. Sampai
layar login tersedia, ambil cookie sesi lewat API lalu pakai browser yang sama:

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"operator","password":"operator"}'
# ambil nilai Set-Cookie: ddp_session=... lalu set sebagai cookie di browser (DevTools → Application → Cookies)
```

Cara ini cukup untuk menguji alur dan menangkap layar, bukan untuk pemakaian nyata. Status dan
pemilik perbaikannya: lihat [Keterbatasan yang diketahui](#keterbatasan-yang-diketahui) butir K1.

## Docker

```bash
docker compose up -d --build      # baca .env, publikasi ${PORT:-3000}, volume ravenclaw-sqlite -> /data
curl -s localhost:3000/healthz    # {"status":"ok",...}
docker compose down               # tambahkan -v bila ingin menghapus volume datanya
```

`.env` minimal untuk compose:

```bash
PORT=3000
SESSION_SECRET=<string-acak-panjang>   # bila kosong compose memberi peringatan; sesi tetap jalan
                                       # (token acak di DB — env ini tidak dibaca kode, lihat K12)
COOKIE_SECURE=true                     # wajib bila diakses lewat HTTPS
TRUSTED_ORIGINS=https://<host-aplikasi>
```

Tanpa compose:

```bash
docker build -t ravenclaw .
docker run -d -p 3000:3000 -v ravenclaw-sqlite:/data \
  -e SESSION_SECRET=<string-acak-panjang> ravenclaw
```

Catatan operasional (terverifikasi):

- Container berjalan sebagai **uid 1001**, jadi **named volume** aman dipakai. Bila memakai bind
  mount (`-v /srv/ddp:/data`), direktori host harus bisa ditulis uid 1001
  (`chown -R 1001:1001 /srv/ddp`), jika tidak container gagal start dengan
  `Error: unable to open database file`.
- Image **tidak** memuat `scripts/` — `scripts/backup.sh` hanya untuk pemakaian di host.
  Prosedur backup versi container ada di [Backup & restore](#backup--restore).
- Healthcheck memakai `GET /healthz`; status terlihat di `docker compose ps`.

## Backup & restore

Skrip ada di `scripts/`, idempoten, dan memakai `node:sqlite` bila `sqlite3` CLI tidak tersedia.

- **Backup** (`backup.sh`) melakukan `PRAGMA wal_checkpoint(TRUNCATE)` lebih dulu, sehingga aman
  dijalankan saat layanan hidup.
- **Restore** (`restore.sh`) **hanya boleh dijalankan setelah layanan dihentikan.** Restore ke
  direktori lain aman; restore ke direktori data yang sedang dipakai proses hidup menyebabkan file
  tidak konsisten (uji 22 Oktober: `wrong # of entries in index ...`). Prosedur lengkap:
  `docs/use-cases/ddp-project-control/RUNBOOK-OPERASIONAL.md` §4.

```bash
# Backup -> ./backups/ravenclaw-<UTC>.sqlite
DATA_DIR=./data bash scripts/backup.sh ./backups

# Restore ke direktori data lain (aman: tidak menimpa data yang sedang dipakai)
bash scripts/restore.sh ./backups/ravenclaw-<UTC>.sqlite ./data-restored
# database lama (bila ada) disimpan sebagai ddp.sqlite.pre-restore-<UTC>, lalu PRAGMA quick_check dijalankan
```

Untuk menjalankan dari hasil restore: `DATA_DIR=./data-restored node server.js`.

Backup dari container (script tidak ada di image):

```bash
docker compose exec -T ravenclaw node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/data/ddp.sqlite');
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
db.exec(\"VACUUM INTO '/data/ravenclaw-backup.sqlite'\");"
docker compose cp ravenclaw:/data/ravenclaw-backup.sqlite ./ravenclaw-backup.sqlite
```

Uji restore berkala: restore ke direktori baru, jalankan dengan `DATA_DIR` berbeda, lalu buka
`/api/projects` — jumlah proyek harus sama dengan saat backup.

## Test

```bash
# dari root repo ini
rm -rf data && npm test          # atau: rm -rf data && node --test 'tests/*.js' 'tests/*.mjs'
```

39 test (domain, HTTP/RBAC, security, frontend util). Per 22 Oktober 2026: **39/39 lulus**.

Dua hal yang perlu diketahui agar hasilnya tidak menyesatkan:

- **Test tidak idempoten.** `tests/test_http.js` memakai `DATA_DIR` tetap `data/test-http` (mengabaikan
  env `DATA_DIR` Anda) dan mengubah state seed — mis. menaikkan gate proyek 2. Tanpa `rm -rf data`
  lebih dulu, 4 test akan gagal karena sisa run sebelumnya, bukan karena regresi.
- Test HTTP menyalakan server sendiri pada port acak (`PORT=0`) dan memakai database terpisah, jadi
  aman dijalankan berdampingan dengan instance pengembangan Anda.

Test manual per kriteria penerimaan (traceability SOP ↔ fitur ↔ test) ada di
`docs/use-cases/ddp-project-control/TRACEABILITY-2026-10-22.md`.

## Mengganti password

Belum ada endpoint/CLI manajemen pengguna; password diubah langsung di database dengan format hash
yang sama seperti `lib/auth.js` (scrypt `N=16384,r=8,p=1`, `keylen=64`, disimpan `salt_b64:hash_b64`):

```bash
node -e '
const crypto=require("node:crypto"); const {DatabaseSync}=require("node:sqlite");
const [db,user,pw]=process.argv.slice(1);
const salt=crypto.randomBytes(16);
const key=crypto.scryptSync(pw,salt,64,{N:16384,r:8,p:1});
const h=`${salt.toString("base64")}:${key.toString("base64")}`;
const d=new DatabaseSync(db);
console.log("rows:", d.prepare("UPDATE users SET password_hash=?, updated_at=? WHERE username=?").run(h,new Date().toISOString(),user).changes);
' ./data/ddp.sqlite operator '<password-baru>'
```

Hentikan layanan dulu bila memungkinkan, dan **jangan menonaktifkan akun dengan `DELETE`**: keempat
akun demo dibuat ulang setiap server start (`INSERT OR IGNORE` di `lib/db.js`), sehingga user yang
dihapus kembali aktif dengan password default. Gunakan `UPDATE users SET active=0 WHERE username=...`.

## Peta folder

| Path | Isi |
| --- | --- |
| `server.js` | HTTP server, routing, middleware keamanan, logging terstruktur |
| `lib/routes.js` | Definisi endpoint + RBAC per endpoint |
| `lib/domain.js` | Aturan gate (`gateGaps`), validasi input, lead time pengadaan, KPI |
| `lib/db.js` | Koneksi SQLite, migrasi, transaksi, seed 3 proyek + 4 akun demo |
| `lib/auth.js` | Sesi cookie, scrypt password, matriks peran |
| `lib/security.js` | Rate limit, security headers, same-origin check |
| `migrations/` | DDL bernomor (001 initial, 002 index + soft delete, 003 users/sessions) |
| `public/index.html` | Shell SPA (sidebar + `<main>`) |
| `public/modules/` | Frontend ES module: `api`, `router`, `state`, `components`, `views/*` |
| `public/content/*.json` | Konten yang bisa disunting PO tanpa deploy: `sop`, `gates`, `kpi`, `raci`, `bpom-case` |
| `public/style.css` | Design token (CSS variable) + komponen visual |
| `openapi.yaml` | **Kontrak API** (OpenAPI 3.1) — sumber kebenaran endpoint |
| `docs/DOMAIN-RULES.md` | Aturan domain: jalur, item wajib, syarat gate, enum, penomoran |
| `docs/ADR/` | Keputusan arsitektur (auth, RBAC, retensi audit, topologi deploy) |
| `scripts/backup.sh`, `scripts/restore.sh` | Backup/restore SQLite (host-side) |
| `tests/` | Test `node:test` (domain, HTTP, security, frontend) |

## Endpoint

Kontrak lengkap (skema request/response, kode error, contoh) ada di **`openapi.yaml`** — dokumen ini
tidak menyalinnya, hanya memetakan kelompoknya. Semua endpoint kecuali `GET /healthz` dan
`POST /api/auth/login` memerlukan cookie sesi `ddp_session`.

| Kelompok | Endpoint | Peran minimum |
| --- | --- | --- |
| Kesehatan | `GET /healthz` | publik |
| Sesi | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session` | publik / sesi |
| Metadata | `GET /api/meta` (deliverable FR, prasyarat Buffer, lead time, urutan gate) | semua peran |
| KPI | `GET /api/kpis` | semua peran |
| Proyek | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}` | baca: semua · tulis: operator/PM/approver · hapus: approver |
| Gate | `POST /api/projects/{id}/advance` (normal: operator/PM/approver · `force`: approver), `POST .../close` (PM/approver), `POST .../reopen` (approver), `PUT .../gate_notes/{gate}` | lihat `docs/ADR/ADR-002-rbac-roles.md` |
| Deliverable FR | `POST .../deliverables`, `PUT/DELETE .../deliverables/{did}` | operator/PM/approver |
| Prasyarat Buffer | `POST .../buffer_checks`, `PUT/DELETE .../buffer_checks/{cid}` | operator/PM/approver |
| Laporan mingguan | `POST .../reports`, `PUT /api/reports/{rid}/confirm` | tulis: operator/PM/approver · konfirmasi: PM/approver |
| RAID | `POST .../risks`, `PUT /api/risks/{rid}` | operator/PM/approver |
| Change request | `POST .../changes`, `PUT /api/changes/{cid}` | ajukan: operator/PM/approver · putuskan: approver |

Tidak ada endpoint `auth/register`, manajemen pengguna, acceptance/handover, atau ekspor audit —
lihat [Keterbatasan yang diketahui](#keterbatasan-yang-diketahui).

## Keterbatasan yang diketahui

Daftar ini adalah hasil verifikasi 22 Oktober 2026 pada branch integrasi `41ba7e4`. Rincian bukti,
dampak, dan pemilik ada di `docs/use-cases/ddp-project-control/TRACEABILITY-2026-10-22.md`.

| # | Keterbatasan | Dampak | Pemilik |
| --- | --- | --- | --- |
| K1 | UI belum punya layar login; frontend masih memakai tombol "Identitas operator" (localStorage) yang tidak dipakai server | Aplikasi tidak bisa dipakai lewat browser tanpa menyetel cookie manual | Fajar (frontend) |
| K2 | `POST /api/projects/{id}/close` menutup proyek dari gate mana pun | Penugasan bisa "selesai" tanpa acceptance | Bagas (server) |
| K3 | Gate G4 → G5 belum menuntut bukti acceptance/handover (BAPP/BAST) | SOP-06 belum punya kontrol | Bagas + Adit |
| K4 | Status `disetujui`/`verified` masih bisa disetel tanpa evidence dan reviewer/verifikator | Bukti gate bisa kosong | Bagas |
| K5 | Prasyarat Buffer belum dipetakan B1–B4; layar masih berlabel "B1–B3" | Kepatuhan SOP-04 tidak bisa dinilai per tahap | Bagas + Rico |
| K6 | Laporan mingguan: periode tidak divalidasi format, field isi boleh kosong, tidak ada tenggat/`pm_confirmed_at` | Kepatuhan laporan tidak bisa ditegakkan | Bagas + Adit |
| K7 | Angka BPOM (70/30/50%, bridging ≤4 minggu) ada di `public/content/bpom-case.json`, belum menjadi data per proyek dan tidak divalidasi | Perubahan Nota Dinas masih manual; batas 4 minggu tak dicek | Adit + Fajar |
| K8 | `docs/DOMAIN-RULES.md` §2 menyatakan deliverable wajib boleh dihapus setelah G2A; kode menolak sampai proyek `CLOSED` | Aturan tertulis dan perilaku berbeda | Bagas |
| K9 | Seed membuat ulang akun demo (password default) setiap start | Akun yang "dihapus" aktif kembali | Victor |
| K10 | Tombol **Eskalasi & tetap naik gate** di UI tidak mengirim `force_reason`, sedangkan server mewajibkannya | Tombol selalu gagal `422 Force advance wajib menyertakan force_reason` | Fajar + Bagas |
| K11 | KPI `blocker_avg_age_days` selalu `0` — `daysBetween()` hanya menerima `YYYY-MM-DD`, sedangkan `created_at` ISO lengkap | Umur blocker tidak terbaca di dashboard | Bagas |
| K12 | `SESSION_SECRET` diisi di `compose.yaml`/ADR-004, tetapi tidak dibaca kode mana pun (token sesi acak di DB) | Operator mengira ada tanda tangan kriptografik; ADR terlihat tidak diimplementasikan | Bagas + Victor |

## Dokumen terkait

Di `docs/use-cases/ddp-project-control/`:

- `AUDIT-2026-10-22-baseline.md` — audit baseline (temuan A/B/C/D/E) beserta bukti reproduksi.
- `BASELINE-REQUIREMENTS-2026-10-22.md` — matriks kesesuaian SOP ↔ fitur, 50 kriteria penerimaan, gap register, definisi "pilot siap" (George).
- `TRACEABILITY-2026-10-22.md` — matriks SOP ↔ fitur ↔ test dengan status terkini per butir (19 LULUS / 29 SEBAGIAN / 18 BELUM).
- `TRACEABILITY-PRD-2026-10-23.md` — matriks PRD v1.0 (FR-01..FR-37, US-01..US-18, R01..R15, 9 AC, OQ-01..OQ-08) ↔ fitur ↔ test: 6 LULUS / 44 SEBAGIAN / 37 BELUM dari 87 baris, plus pemetaan silang 66 butir SOP lama dan daftar konflik PRD vs implementasi.
- `PANDUAN-OPERATOR.md`, `PANDUAN-PM.md`, `PANDUAN-APPROVER.md`, `PANDUAN-AUDITOR.md` — langkah tugas per peran.
- `RUNBOOK-OPERASIONAL.md` — konfigurasi, backup/restore, logging, sesi, drill pemulihan.
- `RUNBOOK-INSIDEN.md` — gejala → tindakan: layanan mati, database korup, restore, gate naik tanpa bukti.
- `ADR-INDEX.md` — indeks keputusan (ADR) dengan tanggal & status.

Di aplikasi: `docs/DOMAIN-RULES.md` (aturan domain), `docs/ADR/` (ADR penuh), `openapi.yaml` (kontrak API).
