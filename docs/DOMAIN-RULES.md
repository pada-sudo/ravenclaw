# Domain Rules — RavenClaw

Dokumen ini adalah satu-satunya sumber kebenaran untuk aturan gate, status, dan batasan domain aplikasi **RavenClaw**. Backend (`server.js`) dan frontend (`public/app.js`) harus mengonsumsi aturan yang sama melalui `GET /api/meta`.

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

## 11. Asumsi yang Perlu Dikonfirmasi

- Daftar 7 deliverable FR dan 8 prasyarat Buffer diasumsikan final sesuai SOP-03/SOP-04. Bila katalog Adit berbeda, perlu diselaraskan di stage 1.
- Force advance tidak memeriksa peran sampai stage 2 (Victor).
- Retensi event: saat ini dibatasi 200 baris per proyek di `GET /api/projects/:id`; kebijakan arsip panjang menunggu keputusan operasional.

## 12. Kontrak API

Lihat `openapi.yaml` untuk detail path, method, request/response, dan kode error.
