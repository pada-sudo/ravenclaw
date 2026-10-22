# DDP Project Control

Web app untuk workflow bisnis project DDP Telkom — jalur **First Responder** dan
**Buffer**, gate **G0–G5**, SOP-01 s/d SOP-07.

Stage 2 (auth, hardening, deploy) telah diimplementasikan. Keputusan arsitektur
dokumentasikan di `docs/ADR/`.

## Menjalankan

Butuh Node **>= 24** (`node:sqlite`). Tidak ada dependency eksternal — tanpa
`npm install`.

```bash
cp .env.example .env
# Sunting .env sesuai lingkungan (terutama SESSION_SECRET di produksi)
node server.js            # http://localhost:3000 (PORT bisa di-override)
```

Data tersimpan di `${DATA_DIR:-data}/ddp.sqlite` (dibuat otomatis, di-*seed* dengan 3 proyek
contoh dan 4 akun demo bila kosong). Direktori `data/` tidak di-commit.

### Akun demo

| Username | Password | Peran |
| --- | --- | --- |
| `operator` | `operator` | operator |
| `pm` | `pm` | project manager |
| `approver` | `approver` | approver |
| `auditor` | `auditor` | auditor (read-only) |

**Penting:** Ganti password default sebelum digunakan di produksi.

## Struktur

| File | Isi |
| --- | --- |
| `server.js` | HTTP server, router, middleware keamanan, logging terstruktur |
| `lib/routes.js` | Definisi endpoint + RBAC |
| `lib/domain.js` | Logika bisnis, validasi, KPI |
| `lib/db.js` | Koneksi SQLite, migrasi, transaksi, seed |
| `lib/auth.js` | Sesi cookie, scrypt password hash, RBAC matrix |
| `lib/security.js` | Rate limiter, security headers, origin/CSRF check |
| `public/index.html` | Shell SPA (sidebar + `<main>`) |
| `public/app.js` | Seluruh UI: router hash, render halaman, modal, tabel |
| `public/style.css` | Design token (CSS variable) + komponen visual |

## Peta endpoint

Kontrak API lengkap ada di `openapi.yaml`. Endpoint utama:

- `GET /healthz` — health check (tanpa auth)
- `POST /api/auth/login` — login (tanpa auth)
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/meta` — deliverable FR, checklist Buffer, lead time, urutan gate
- CRUD proyek, deliverable, buffer checks, weekly reports, RAID, change requests

Semua endpoint API (kecuali login dan healthz) memerlukan sesi cookie
`ddp_session` dan role yang sesuai.

## Test

```bash
rm -rf data
NODE_ENV=test node --test tests/*.js
```

## Docker

```bash
docker build -t ddp-project-control .
# atau
docker compose up
```

Pastikan `SESSION_SECRET` di-set di `.env` sebelum menjalankan container.

## Backup & restore

```bash
# Backup (jalankan saat layanan berjalan maupun dihentikan)
DATA_DIR=./data bash scripts/backup.sh ./backups

# Restore ke direktori baru
bash scripts/restore.sh ./backups/ddp-YYYYmmddTHHMMSSZ.sqlite ./data-new
```

Restore akan membuat cadangan database yang sudah ada dengan sufiks
`.pre-restore-<timestamp>` sebelum menimpa.

## Variabel lingkungan

Lihat `.env.example` untuk daftar lengkap. Yang kritis untuk produksi:

- `SESSION_SECRET` — kunci HMAC untuk tanda-tangan cookie sesi (minimal 32 byte, base64)
- `COOKIE_SECURE` — set `true` bila served via HTTPS
- `TRUSTED_ORIGINS` — origin yang diizinkan untuk CORS/mutating requests
- `RATE_LIMIT_*` — batas request per identitas/IP
