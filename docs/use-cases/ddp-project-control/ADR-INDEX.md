# ADR-INDEX — Indeks Keputusan Desain, RavenClaw

Lima ADR aktif di `apps/ddp-project-control/docs/ADR/`. Semua masih **berstatus "Diusulkan"** dan
butuh persetujuan Pedro (Tech Lead) sebelum dianggap final; THEOFILUS menerima konsekuensinya.

| ADR | Judul | Status | Menjawab | File (di `apps/ddp-project-control/docs/ADR/`) |
| --- | --- | --- | --- | --- |
| ADR-001 | Model Autentikasi dan Otorisasi | Diusulkan (menunggu Pedro) | Bagaimana pengguna dipercaya & sesi dikelola (scrypt + cookie `ddp_session`) | `ADR-001-auth-model.md` |
| ADR-002 | Peran dan Kewenangan (RBAC) | Diusulkan (menunggu Pedro) | Peran operator/PM/approver/auditor dan matriks kewenangan per endpoint | `ADR-002-rbac-roles.md` |
| ADR-003 | Retensi Jejak Audit dan Penanganan Hapus Proyek | Diusulkan (menunggu Pedro) | Soft delete, retensi event, siapa boleh menghapus | `ADR-003-audit-retention.md` |
| ADR-004 | Topologi Deploy dan Konfigurasi Runtime | Diusulkan (menunggu Pedro) | Docker non-root, env config, healthcheck, backup/restore | `ADR-004-deploy-topology.md` |
| ADR-005 | Penyelarasan RavenClaw dengan PRD v1.0 | Diusulkan (menunggu THEOFILUS + OQ-01..OQ-08) | Katalog peran R01–R15, `track` vs `path`, status gate, B1–B4, eskalasi L1–L4, BAST; peta migrasi data | `ADR-005-prd-v1-alignment.md` |

## Yang tergantung ADR ini (dan belum pasti)

- **Retensi & penghapusan (ADR-003):** keputusan THEOFILUS soal retensi berapa lama (Q5) masih
  menentukan apakah `pre-restore-*`, event, dan backup boleh dipangkas.
- **Sesi (ADR-001):** `compose.yaml` masih mengisi `SESSION_SECRET` yang tidak dibaca kode
  (keterbatasan K12 di README) — rapikan saat ADR-001 difinalkan.
- **Deploy (ADR-004):** belum ada reverse proxy konkret di repo; `SESSION_SECRET` & `PORT` di compose
  mengikuti ADR, bukan kode. Prosedur yang teruji ada di
  `docs/use-cases/ddp-project-control/RUNBOOK-OPERASIONAL.md`.
- **Peran (ADR-002 vs ADR-005):** ADR-002 menetapkan 4 peran minimum; ADR-005 memetakan ke katalog
  PRD R01–R15 tanpa mengurangi izin legacy. Bila keduanya berbeda, ADR-005 yang berlaku untuk
  penamaan peran, ADR-002 tetap berlaku untuk kewenangan endpoint sampai DEEP-236 mendarat.

## Cara membaca ADR

Setiap ADR berurutan: Status → Konteks → Keputusan → Konsekuensi. Bila kode berbeda dengan ADR,
yang berlaku adalah **kode** dan ADR wajib diperbarui — jangan sebaliknya. Perubahan isi ADR termasuk
perubahan struktural: konfirmasikan ke pemiliknya (Pedro) dan catat di issue stage terkait.