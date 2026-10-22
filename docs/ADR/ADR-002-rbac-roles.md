# ADR-002: Peran dan Kewenangan (RBAC)

## Status
Diusulkan — menunggu persetujuan Pedro sebelum final.

## Konteks
SOP-01..07 mensyaratkan pemisahan tugas (segregation of duties) terutama antara pencatat data, penanggung jawab proyek, dan pihak yang menyetujui/menaikkan gate. Issue DEEP-224 meminta peran minimum: operator, PM, approver, auditor.

## Keputusan
Menerapkan empat peran dengan matriks kewenangan berikut terhadap endpoint API:

| Endpoint / Aksi | operator | pm | approver | auditor |
|-----------------|----------|----|----------|---------|
| `GET /api/*` (read, termasuk KPI, meta, detail) | ✅ | ✅ | ✅ | ✅ |
| `POST /api/projects` (intake) | ✅ | ✅ | ✅ | ❌ |
| `PUT /api/projects/:id` (ubah data proyek) | ✅ | ✅ | ✅ | ❌ |
| `POST /api/projects/:id/advance` normal | ✅ | ✅ | ✅ | ❌ |
| `POST /api/projects/:id/advance` `force=1` | ❌ | ❌ | ✅ | ❌ |
| `POST /api/projects/:id/close` | ❌ | ✅ | ✅ | ❌ |
| `POST /api/projects/:id/reopen` | ❌ | ❌ | ✅ | ❌ |
| `DELETE /api/projects/:id` (soft delete) | ❌ | ❌ | ✅ | ❌ |
| `PUT /api/projects/:id/gate_notes/:gate` | ✅ | ✅ | ✅ | ❌ |
| Deliverable / Buffer check CRUD | ✅ | ✅ | ✅ | ❌ |
| `POST /api/projects/:id/reports` | ✅ | ✅ | ✅ | ❌ |
| `PUT /api/reports/:rid/confirm` | ❌ | ✅ | ✅ | ❌ |
| RAID CRUD | ✅ | ✅ | ✅ | ❌ |
| `POST /api/projects/:id/changes` | ✅ | ✅ | ✅ | ❌ |
| `PUT /api/changes/:cid` (keputusan) | ❌ | ❌ | ✅ | ❌ |
| `GET /healthz` | ✅ | ✅ | ✅ | ✅ |

Kewenangan ditegakkan di `lib/auth.js` fungsi `hasPermission` dan di setiap handler route.

## Penjelasan peran
- **operator**: input data proyek, deliverable, weekly report, RAID; tidak boleh menyetujui atau menghapus.
- **pm**: konfirmasi weekly report, ubah scope/timeline, tutup proyek; tidak boleh force advance, hapus, atau memutuskan change request.
- **approver**: naikkan gate (termasuk force/eskalasi), putuskan change request, hapus/arsip proyek, buka kembali proyek.
- **auditor**: baca saja; tidak bisa membuat/ubah/hapus apapun.

## Konsekuensi
- Setiap `logEvent()` mencatat aktor sebagai `"<full_name> [<role>]"` sehingga jejak audit menunjukkan identitas dan peran pelaku.
- Bila ke depan George/Adit menetapkan nama peran berbeda, mapping dapat diubah di satu tempat (`lib/auth.js`) tanpa menyentuh domain rules.

## Risiko dan mitigasi
- Risiko: satu pengguna dengan banyak peran dapat menabrak segregation of duties. Mitigasi: setiap akun hanya memiliki satu peran; pengguna yang butuh peran lain mendapat akun terpisah.
