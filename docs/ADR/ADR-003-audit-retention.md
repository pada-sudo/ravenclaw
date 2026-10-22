# ADR-003: Retensi Jejak Audit dan Penanganan Hapus Proyek

## Status
Diusulkan — menunggu persetujuan Pedro sebelum final.

## Konteks
Audit baseline menemukan `DELETE /api/projects/:id` menghapus proyek secara permanen bersama seluruh riwayat gate, weekly report, RAID, dan events (B7). Untuk alat governance, jejak audit harus immutable/retained.

## Keputusan
1. **Soft delete untuk proyek**: `DELETE /api/projects/:id` hanya mengisi `deleted_at` dan mengubah `status` menjadi `closed`. Data proyek dan seluruh relasinya tetap tersimpan.
2. **Tabel `events` sebagai immutable audit log**: setiap aksi penting (intake, update, gate advance, force/eskalasi, konfirmasi report, keputusan change request, hapus proyek) dicatat di `events` dengan aktor, gate, aksi, catatan, dan timestamp.
3. **Retensi**: sementara tidak ada purge otomatis. Backup harian (lihat `scripts/backup.sh`) menyimpan snapshot ke direktori terpisah. Keputuhan retensi jangka panjang (misal 7 tahun sesuai kebutuhan regulator) dapat diimplementasikan sebagai archivasi backup ke cold storage tanpa menghapus data produksi.
4. **Akses data terhapus**: `GET /api/projects?include_deleted=true` memerlukan peran dengan kewenangan baca; auditor dapat mengaksesnya untuk keperluan audit.

## Konsekuensi
- Storage berkembang seiring waktu; mitigasi dengan backup terjadwal dan archivasi.
- Tidak ada endpoint "hard delete" yang tersedia bagi pengguna.
- Bila di masa depan diperlukan anonymisasi/Privacy request, dilakukan dengan mengubah field identifiable di tabel proyek (bukan menghapus events).

## Dependensi
- Perlu sinkronisasi dengan Bagas/Diana mengenai durasi retensi yang disyaratkan SOP atau kebijakan Telkom.
