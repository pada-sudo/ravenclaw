# Runbook Insiden — DDP Project Control

**Tujuan:** langkah pertama saat ada gangguan, tanpa menebak. **Pemilik:** Victor (DevOps).
**Prosedur panjang (backup, restore, sesi, log) ada di `RUNBOOK-OPERASIONAL.md`** — dokumen ini hanya
daftar gejala → tindakan → siapa yang dipanggil.

Prinsip: **hentikan dulu, buktikan kemudian.** Untuk aplikasi governance, kehilangan data lebih mahal
daripada downtime. Jangan pernah menulis langsung ke database yang sedang dipakai layanan.

## 1. Gejala → tindakan

| Gejala | Penyebab paling mungkin | Tindakan segera | Pemilik |
| --- | --- | --- | --- |
| `/healthz` gagal / `docker compose ps` unhealthy | proses mati, port bentrok, volume tak bisa ditulis | `docker compose logs --tail 200`; cek `docker compose ps`; pastikan `/data` bisa ditulis uid 1001 | Victor |
| Semua `/api/*` menjawab `401` di browser | UI belum punya layar login (K1) atau cookie kedaluwarsa (`SESSION_TTL_SECONDS`) | login ulang lewat `POST /api/auth/login`, set cookie `ddp_session`; lihat README *Login tanpa UI* | Fajar |
| `429 Too Many Requests` | `RATE_LIMIT_MAX` (default 120/menit per identitas) terlampaui | tunggu satu window, atau naikkan `RATE_LIMIT_MAX` lalu restart; jangan mematikan limiter | Victor |
| Error `unable to open database file` | izin direktori data (bind mount bukan uid 1001) / `DATA_DIR` salah | `chown -R 1001:1001 <dir>` atau pakai named volume | Victor |
| `database is locked` | dua proses memakai `DATA_DIR` yang sama | hentikan salah satu; hanya satu proses per database | Victor |
| `PRAGMA quick_check` ≠ `ok` / `wrong # of entries in index` | database korup, **atau** restore dilakukan saat layanan hidup | hentikan layanan, restore dari backup terverifikasi (§RUNBOOK-OPERASIONAL §4), jangan coba `VACUUM` pada file yang sedang dipakai | Victor + Bagas |
| Data "kembali ke masa lalu" setelah restore | sisa `-wal`/`-shm` dari database lama, atau backup yang dipilih lebih tua | pastikan layanan berhenti sebelum restore dan `-wal`/`-shm` dihapus; cek `ddp.sqlite.pre-restore-*` | Victor |
| Riwayat/proyek hilang dari daftar | proyek di-soft-delete | `GET /api/projects?include_deleted=true`; **tidak ada endpoint undelete** — pemulihan lewat restore/kueri terkontrol | Bagas |
| Gate naik padahal syarat belum lengkap | eskalasi `force` oleh approver, atau celah kontrol (K2/K4) | cari event `Gate dinaikkan dengan ESKALASI` di **Log Aktivitas** (alasan + aktor + gap); bila tanpa alasan → insiden proses, lapor approver & THEOFILUS | Pedro |

## 2. Urutan penanganan umum

1. **Pastikan lingkupnya:** satu pengguna, satu proyek, atau seluruh layanan?
2. **Ambil bukti sebelum memperbaiki:** `docker compose logs --tail 500 > insiden-<ts>.log`,
   `bash scripts/backup.sh ./backups` (bila database masih bisa dibuka), screenshot layar bermasalah.
3. **Hentikan layanan** bila ada risiko tulis-menulis: `docker compose stop` / `systemctl stop`.
4. **Pulihkan** mengikuti `RUNBOOK-OPERASIONAL.md` §4 (restore selalu dengan layanan berhenti).
5. **Verifikasi:** `healthz`, jumlah proyek, `PRAGMA quick_check`, satu login, satu halaman detail.
6. **Catat:** waktu deteksi, waktu pulih, data yang hilang (rentang waktu), penyebab, tindakan.
7. **Laporkan** ke THEOFILUS; bila melibatkan kode, buka issue perbaikan dan tautkan ke butir
   `TRACEABILITY-2026-10-22.md`.

## 3. Insiden yang tidak boleh diselesaikan sendiri

| Insiden | Kenapa harus dieskalasi |
| --- | --- |
| Kehilangan data di luar rentang backup | Perlu keputusan pemilik data (THEOFILUS) sebelum rekonstruksi manual |
| Dugaan kebocoran sesi/akun | Rotasi seluruh sesi (`RUNBOOK-OPERASIONAL.md` §6) lalu lapor; akun demo dipakai bersama (K9) |
| Perubahan angka/aturan gate | Menyangkut kontrak SOP — kewenangan Adit + Pedro, bukan operator |
| Permintaan menghapus permanen data audit | Bertentangan dengan ADR-003; hanya THEOFILUS yang boleh memutuskan |

## 4. Yang belum ada (jangan diasumsikan)

- Belum ada alerting/notifikasi otomatis: pemantauan masih manual (`/healthz`, `docker compose ps`).
- Belum ada endpoint *undelete* maupun ekspor audit — pemulihan data terhapus hanya lewat restore.
- Belum ada layar login di UI (K1), sehingga "pengguna tidak bisa masuk" sering berarti masalah cookie,
  bukan gangguan server.
- Belum ada reverse proxy/TLS di repo; `COOKIE_SECURE=true` baru berlaku setelah HTTPS terpasang.