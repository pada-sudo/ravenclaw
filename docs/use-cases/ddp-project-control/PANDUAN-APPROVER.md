# Panduan Approver — RavenClaw

**Peran:** `approver` · **Siapa:** pihak berwenang yang menjamin gate hanya naik bila syaratnya benar.
**Prinsip:** approver adalah **kontrol terakhir**. Segala yang bisa dilewati orang lain, di sinilah
tempatnya ditahan atau — bila keadaan memaksa — dieskalasi secara tercatat.

Ringkasan kewenangan (lengkap: `docs/ADR/ADR-002-rbac-roles.md`):

| Hanya approver yang boleh | Approver juga boleh |
| --- | --- |
| Menaikkan gate dengan **eskalasi** (`force` + alasan) | Semua yang boleh dilakukan operator & PM |
| Membuka kembali proyek (`reopen`) | Keputusan change request (`Setujui`/`Tolak`) |
| Menghapus proyek (soft delete → arsip) | Konfirmasi laporan mingguan |

> Status 22 Oktober 2026: aplikasi masih draft. Celah yang paling relevan bagi approver:
> **laporan bisa ditutup sebagai `CLOSED` dari gate mana pun oleh PM maupun approver** (K2) dan
> **status `disetujui`/`terverifikasi` bisa disetel tanpa bukti** (K4). Approver adalah pihak yang
> harus menahan kedua hal ini secara prosedural sampai server menegakkannya.

## 1. Sebelum mulai

1. Masuk sebagai `approver` (lihat `README.md` bagian *Login tanpa UI (sementara)* bila layar login
   belum ada).
2. Siapkan dasar kewenangan Anda: siapa yang menetapkan Anda sebagai approver untuk gate mana
   (daftar approver per gate adalah keputusan THEOFILUS — pertanyaan Q1 pada
   `BASELINE-REQUIREMENTS-2026-10-22.md` §6).
3. Buka **Dashboard** → **Pipeline Penugasan (Gate)** untuk melihat proyek yang menunggu gate.

## 2. Menilai kelayakan naik gate (jalur normal)

1. Dari **Dashboard**, klik kode proyek → halaman detail.
2. Pada bagan gate, klik gate aktif (mis. **G2A Setup FR**) untuk melihat **Kriteria & kesiapan**
   (daftar gap yang masih terbuka) dan **Jejak proses gate**.
3. Periksa buktinya, bukan hanya statusnya:
   - **G1 Administratif** — nomor & tanggal NDE, status anggaran, onboarding; cek nomor dokumen di
     **Catatan proses gate**.
   - **G2A Setup FR** — 7 baris **Deliverable Setup — SOP-03**: setiap baris `disetujui` dengan
     **Link evidence** dan **Reviewer** terisi.
   - **G2B Kesiapan Buffer** — 8 baris **Prasyarat Teknis Buffer**: semua tercentang, dengan
     **Evidence** dan **Verifikator**.
   - **G3 Delivery** — tidak ada **Blocker** terbuka di tab RAID, dan ada laporan mingguan.
   - **G4 Acceptance** — semua item RAID terbuka punya **Owner** & **Due date**, dan bukti
     acceptance/handover ada (BAPP/BAST atau catatan serah terima di catatan gate G4).
   - **G5 Transisi** — rencana talent definitif dan lessons learned/catatan penutupan terisi.
4. Bila semua **gap kosong**, gate dapat dinaikkan oleh operator/PM/approver. Bila Anda sendiri yang
   menaikkan: gunakan tombol pada kartu **Kontrol Gate** untuk gate yang sedang aktif.

## 3. Menaikkan gate dengan eskalasi (hanya approver)

Eskalasi berarti: **syarat tidak terpenuhi, tetapi keputusan bisnis memaksa gate naik**. Ini aksi
berisiko audit — perlakukan sebagai pengecualian, bukan jalan pintas.

1. Pastikan Anda sudah mencoba menutup gap secara normal.
2. Catat dulu alasannya di **Edit gate G…** → **Catatan proses gate**: nomor dokumen/NDE keputusan,
   nama pemberi persetujuan, dan gap yang diterima.
3. Ajukan eskalasi lewat API (UI belum menyediakan tombol eskalasi):

   ```bash
   curl -X POST http://localhost:3000/api/projects/<id>/advance \
     -H 'Content-Type: application/json' -b 'ddp_session=<cookie-anda>' \
     -d '{"force":1,"force_reason":"<alasan + dasar kewenangan + gap yang diterima>"}'
   ```

4. Syarat yang ditegakkan server (terverifikasi): `force` tanpa `force_reason` → `422`; peran selain
   approver → `403`. Server mencatat event **"Gate dinaikkan dengan ESKALASI"** berisi aktor, alasan,
   dan seluruh gap saat itu.
5. Setelah eskalasi, laporkan pada laporan mingguan proyek tersebut: gate apa, alasan apa, siapa yang
   menyetujui.

**Batas:** server hanya memeriksa *peran*, belum memeriksa *tingkat kewenangan per gate* (mis. apakah
approver G4 sama dengan approver G2A). Sampai Q1 dijawab, kewenangan per gate diatur prosedur.

## 4. Keputusan change request (SOP-05)

1. Buka detail proyek → tab **Change Request**.
2. Periksa **Judul**, **Deskripsi perubahan**, **Penilaian dampak (scope/timeline/biaya/resource)**.
   Bila dampak belum dinilai, **jangan** putuskan — minta operator melengkapinya (server belum
   mewajibkan dampak).
3. Klik **Setujui** atau **Tolak**. Keputusan menyimpan waktu (`decided_at`) dan aktor.
4. Catat dasar keputusan di **Catatan proses gate** pada gate aktif — sistem belum punya kolom
   komentar keputusan.

## 5. Membuka kembali proyek

1. Dari detail proyek (atau daftar **Proyek & Penugasan**) klik **Buka kembali**.
2. Server mengembalikan gate ke `prev_gate` (gate terakhir sebelum `CLOSED`) dan status menjadi
   `active`.
3. Sebelum menekan tombol, catat **alasan** pembukaan kembali di **Catatan proses gate** — server
   mencatat aksi & aktor, tetapi belum menyimpan alasan.
4. Kabari PM dan operator, karena data dapat berubah setelah gate dibuka kembali.

## 6. Menghapus / mengarsipkan proyek

1. Dari daftar **Proyek & Penugasan** klik **Hapus**, atau dari detail proyek tombol **Hapus**.
2. Ini **soft delete**: `deleted_at` diisi, status menjadi `closed`, dan seluruh data (deliverable,
   prasyarat, laporan, RAID, riwayat) tetap tersimpan serta dapat dibaca auditor lewat
   `GET /api/projects?include_deleted=true`. Tidak ada hard delete.
3. Hapus hanya untuk proyek yang dibuat keliru (salah jalur, duplikat). Proyek nyata diarsipkan dengan
   cara **Selesai**, bukan **Hapus**.
4. Bila proyek sudah dihapus, intake baru aman: kode proyek memakai counter, tidak mendaur ulang
   (terverifikasi — `PRJ-2026-00x` tetap unik).

## 7. Yang belum ditegakkan sistem

| Hal | Kondisi | Sikap approver |
| --- | --- | --- |
| Penutupan proyek dari gate mana pun | Bisa (K2) | Tolak secara prosedur; hanya izinkan dari G5 |
| Bukti acceptance G4→G5 | Tidak diperiksa (K3) | Minta BAPP/BAST atau catatan serah terima dulu |
| Evidence/reviewer saat `disetujui` | Tidak diperiksa (K4) | Periksa manual sebelum menaikkan gate |
| Kewenangan per gate | Hanya peran, belum per gate (Q1) | Sepakati daftar approver per gate secara tertulis |
| Peringatan bridging BPOM > 4 minggu | Tidak divalidasi (K7) | Periksa durasi manual; catat dasar Nota Dinas |

## 8. Bila sistem menolak

| Pesan | Arti | Tindakan |
| --- | --- | --- |
| `422 Syarat gate belum terpenuhi` + `gaps` | Gate belum boleh naik | Selesaikan gap, atau eskalasi (§3) bila memang harus |
| `422 Force advance wajib menyertakan force_reason` | Eskalasi tanpa alasan | Tulis alasan + dasar kewenangan |
| `403` pada `force`/`reopen`/`DELETE` | Bukan sesi approver | Periksa peran akun |
| `422 Project sudah berada pada gate akhir` | Gate tidak punya penerus (jalur tidak dikenal) | Periksa `track` proyek, hubungi Bagas |

## 9. Tentang tangkapan layar

Belum tersedia (lingkungan penyusunan tanpa peramban). Bila ditambahkan, ambil:
`approver-01-gate-detail.png` (kartu **Kontrol Gate** dengan daftar gap),
`approver-02-eskalasi.png` (event eskalasi pada **Jejak proses gate**),
`approver-03-change.png` (tab Change Request dengan tombol keputusan).
