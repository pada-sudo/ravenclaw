# ADR-004: Topologi Deploy dan Konfigurasi Runtime

## Status
Diusulkan — menunggu persetujuan Pedro sebelum final.

## Konteks
Issue DEEP-224 meminta Dockerfile multi-stage, non-root, healthcheck, konfigurasi via env, dan prosedur backup/restore.

## Keputusan
1. **Container image**: multi-stage Dockerfile berbasis `node:24.18.1-alpine`, non-root user `app` (uid 1001), hanya menyalin file runtime.
2. **Database**: SQLite disimpan di volume `ddp-sqlite` yang di-mount ke `/data` di container. WAL mode (`PRAGMA journal_mode = WAL`) tetap aktif.
3. **Healthcheck**: `GET /healthz` mengembalikan `200 {"status":"ok"}`. Dockerfile dan `compose.yaml` keduanya mendefinisikan healthcheck yang sama.
4. **Konfigurasi via environment variable**: `PORT`, `DATA_DIR`, `SESSION_TTL_SECONDS`, `SESSION_SECRET`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `COOKIE_SECURE`, `TRUSTED_ORIGINS`, `LOG_LEVEL`. Semua rahasia (password DB bila ada, secret) hanya via env, tidak di-commit.
5. **Reverse proxy**: di production, ditempatkan di belakang reverse proxy (NGINX/HAProxy/Traefik) yang menangani TLS termination dan mengirim header `X-Forwarded-Proto`. `TRUSTED_ORIGINS` harus berisi origin resmi aplikasi.
6. **Backup**: `scripts/backup.sh` dijalankan oleh cron/job scheduler di host atau sidecar container; melakukan `PRAGMA wal_checkpoint(TRUNCATE)` lalu copy/VACUUM. `scripts/restore.sh` memvalidasi integritas file hasil restore.
7. **Logging**: structured log JSON ke stdout dengan field `timestamp`, `request_id`, `method`, `path`, `status`, `duration_ms`, `actor`. Detail error 500 dicatat di server, tidak dikirim ke klien.

## Konsekuensi
- Skalabilitas horizontal terbatas karena SQLite; untuk jumlah pengguna internal DDP Telkom dianggap cukup. Bila di masa depan perlu multi-instance, perlu migrasi ke PostgreSQL/MySQL atau shared storage.
- Deploy simple: `docker compose up -d` di single node.

## Risiko dan mitigasi
- Risiko: volume SQLite tidak di-backup → mitigasi: backup otomatis harian dan uji restore berkala.
- Risiko: container crash saat write dengan WAL → mitigasi: WAL checkpoint sebelum backup; SQLite auto-recovery saat startup.
