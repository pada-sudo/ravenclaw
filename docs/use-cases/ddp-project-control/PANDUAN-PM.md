# Panduan PM (Project Manager) — DDP Project Control

**Peran:** `pm` · **Siapa:** PM yang bertanggung jawab atas penugasan dan isi laporan.
**Prinsip:** PM **mengonfirmasi dan memutuskan**, bukan memasukkan data mentah. Operator yang
mencatat; approver yang menaikkan gate dengan eskalasi.

Ringkasan kewenangan (lengkap: `docs/ADR/ADR-002-rbac-roles.md`):

| Boleh | Tidak boleh |
| --- | --- |
| Baca semua data & KPI | Menaikkan gate dengan eskalasi (`force`) |
| Ubah data proyek, deliverable, prasyarat, RAID | Membuka kembali proyek (`reopen`) |
| Konfirmasi laporan mingguan (**khusus PM/approver**) | Menghapus/soft-delete proyek |
| Menandai proyek selesai (`close`) | Memutuskan change request (saat ini hanya approver) |

> Status 22 Oktober 2026: aplikasi masih draft untuk validasi internal. Dua hal yang paling
> memengaruhi pekerjaan PM: **proyek bisa ditutup dari gate mana pun** dan **konfirmasi laporan tidak
> menyimpan waktu konfirmasi**. Lihat [§6](#6-yang-belum-ditegakkan-sistem).

## 1. Sebelum mulai

1. Masuk sebagai `pm` (lihat `README.md` bagian *Login tanpa UI (sementara)* bila layar login belum ada).
2. Buka **Dashboard**: enam kartu KPI (Kesiapan administratif, FR readiness, Buffer tech readiness,
   Kepatuhan laporan mingguan, Blocker terbuka, Kesiapan transisi), **Pipeline Penugasan (Gate)**, dan
   tabel **Blocker Terbuka & Umur**.
3. Baca prinsip pembacaan KPI (§5) sebelum memakai angkanya di rapat.

## 2. Rutinitas mingguan: konfirmasi laporan mingguan (SOP-05)

1. Dari **Dashboard**, klik kode proyek pada pipeline atau pada tabel blocker → halaman detail proyek.
2. Buka tab **Laporan Mingguan**.
3. Periksa satu baris laporan: **Periode**, **Talent/FTE**, **Rencana**, **Realisasi**, **Blocker**,
   **Evidence**, serta kolom **Konfirmasi PM**.
4. Buka **Evidence** (tautan) dan pastikan progres yang diklaim punya bukti.
5. Bila isi sudah memadai, klik **Konfirmasi PM** pada baris itu, isi **Nama PM yang mengonfirmasi**,
   lalu simpan. Laporan berubah menjadi `OK · <nama>`.
6. Bila isi belum memadai, **jangan** konfirmasi. Tulis kekurangan di **Catatan proses gate** untuk
   gate aktif (tombol **Edit gate G…**) dan minta operator melengkapi.
7. Lakukan sebelum keputusan apa pun diambil; konfirmasi adalah dasar "laporan sudah diperiksa PM".

**Batas hari ini:** waktu konfirmasi tidak disimpan (`pm_confirmed_at` belum ada) dan
`pm_confirmed` masih bisa disetel saat laporan dibuat. Bila kepatuhan laporan dipakai sebagai bukti
formal, catat tanggal konfirmasi di **Catatan proses gate**.

## 3. Keputusan atas RAID (SOP-05/06)

1. Buka tab **RAID / Risiko & Blocker**.
2. Periksa item **Blocker** berstatus `terbuka` — daftar ini yang menghalangi gate G3→G4.
3. Untuk item yang perlu perhatian manajemen: pastikan **Owner** dan **Due date** terisi (syarat
   G4→G5) dan minta operator menandai eskalasi.
4. Item ditutup oleh operator dengan tombol **Tutup** setelah selesai; PM memverifikasi bahwa
   penutupannya beralasan (tanggal tutup terlihat di kolom status).
5. Untuk isu residual yang akan dibawa melewati G5, catat keputusan formal (terima/tunda/tolak) di
   **Catatan proses gate** G5 — sistem belum punya entitas keputusan isu residual.

## 4. Menandai proyek selesai (SOP-06)

1. Pastikan proyek benar-benar berada di **G5 Transisi** dan acceptance/handover sudah selesai
   (BAPP/BAST, serah terima akses & dokumentasi) — ini **tidak diperiksa sistem**.
2. Buka detail proyek → tombol **Selesai**, atau dari daftar **Proyek & Penugasan** klik **Selesai**
   pada baris proyek.
3. Konfirmasi dialog. Gate menjadi `CLOSED`, status `closed`, dan gate sebelumnya disimpan sebagai
   `prev_gate` (dasar **Buka kembali** oleh approver).
4. Catat nomor BAPP/BAST dan tanggal serah terima di **Catatan proses gate** G5 — inilah bukti yang
   akan dibaca auditor.

**Jangan** memakai tombol **Selesai** sebagai jalan pintas: server mengizinkannya dari gate mana pun
(celah K2), tetapi secara proses itu berarti penugasan ditutup tanpa acceptance.

## 5. Membaca KPI tanpa salah tafsir

| KPI | Yang dihitung | Yang harus diwaspadai |
| --- | --- | --- |
| Kesiapan administratif | Proyek aktif dengan NDE, anggaran `disetujui`, onboarding ≥ `berjalan` | Anggaran hanya status yang diketik, tanpa verifikator |
| FR readiness | Proyek FR dengan 7 deliverable `disetujui` | `disetujui` bisa tanpa evidence (K4) |
| Buffer tech readiness | Proyek Buffer dengan ≥8 prasyarat terverifikasi | Verifikasi bisa tanpa verifikator (K4) |
| Kepatuhan laporan mingguan | Proyek G3–G5 dengan laporan ≤7 hari | Bukan "tepat waktu"; hanya "ada laporan seminggu terakhir" |
| Blocker terbuka + umur | Jumlah blocker `open` dan umur rata-rata/maksimum | Umur dihitung dari `created_at` |
| Kesiapan transisi | Proyek Buffer dengan `bridging_end` & `definitive_plan` | Tidak ada penanda jumlah sampel: 100% bisa berarti 1 dari 1 proyek |

Aturan: **jangan** mempublikasikan angka KPI ke manajemen sebelum definisi dan populasinya disetujui
(DEEP-220). Bila ragu, sebut angka beserta penyebutnya ("1 dari 1 proyek").

## 6. Yang belum ditegakkan sistem

| Hal | Kondisi | Tindakan PM |
| --- | --- | --- |
| Penutupan proyek | Bisa dari gate mana pun | Hanya tutup dari G5 dengan bukti acceptance |
| Bukti acceptance (BAPP/BAST) | Tidak ada entitas/endpoint | Simpan nomor & tanggal di catatan gate G5 + arsip dokumen di drive resmi |
| Waktu konfirmasi laporan | Tidak disimpan | Catat tanggal di catatan gate |
| Keputusan change request | Hanya peran `approver` yang bisa memutuskan (ADR-002) | Bila PM seharusnya berwenang, ajukan perubahan ke THEOFILUS — jangan minta akun approver "pinjaman" |
| FTE per peran | Teks bebas | Rincian peran ditulis di **Catatan** proyek |

## 7. Bila sistem menolak

| Pesan | Arti | Tindakan |
| --- | --- | --- |
| `403` saat konfirmasi laporan | Anda belum masuk sebagai `pm`/`approver` | Periksa sesi/peran |
| `422 Project sudah berada pada gate akhir` | Proyek sudah `CLOSED` (atau jalur tidak dikenal) | Minta approver membuka kembali |
| `422 Track tidak boleh diubah setelah intake` | Mencoba memperbaiki jalur | Buat proyek baru; approver menghapus yang salah |

## 8. Tentang tangkapan layar

Belum tersedia (lingkungan penyusunan tanpa peramban). Bila ditambahkan, ambil:
`pm-01-dashboard.png` (kartu KPI + pipeline), `pm-02-konfirmasi-laporan.png` (tombol Konfirmasi PM),
`pm-03-raid.png` (tabel RAID dengan blocker terbuka).
