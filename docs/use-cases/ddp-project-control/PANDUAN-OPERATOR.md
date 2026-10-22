# Panduan Operator — RavenClaw

**Peran:** `operator` · **Siapa:** staf DDP/Shared Service yang menjalankan proses harian.
**Prinsip:** operator **mencatat fakta dan bukti**. Operator tidak memutuskan gate naik, tidak
menyetujui eskalasi, dan tidak menutup proyek.

Panduan ini ditulis sebagai urutan tugas, bukan tur fitur. Layar yang disebut memakai label apa
adanya di aplikasi.

> Status 22 Oktober 2026: aplikasi masih **draft untuk validasi internal**; sebagian kontrol di bawah
> belum ditegakkan server (lihat [§7](#7-yang-belum-ditegakkan-sistem-jangan-diandalkan)).
> Tangkapan layar belum bisa disertakan — lihat [§8](#8-tentang-tangkapan-layar).

## 1. Sebelum mulai

1. Pastikan aplikasi berjalan (`node server.js`, `http://localhost:3000`) atau Anda diberi URL
   instance pilot.
2. Masuk sebagai `operator` (password dari pengelola aplikasi — lihat `README.md` bagian
   *Mengganti password*).
   Saat ini belum ada layar login di UI; bila halaman menampilkan error, lihat `README.md`
   bagian *Login tanpa UI (sementara)*.
3. Siapkan bahan yang akan dicatat: nomor & tanggal NDE, status anggaran, dokumen pengadaan
   (PKDF / Justifikasi / Surat Pesanan), target mulai, kebutuhan role/FTE, dan alamat bukti
   (link dokumen) untuk setiap deliverable.
4. Buka **Dashboard** untuk melihat posisi semua penugasan, lalu **Proyek & Penugasan** untuk bekerja.

## 2. Intake proyek baru (SOP-01)

1. Buka **Proyek & Penugasan**.
2. Klik **+ Intake Proyek (SOP-01)**.
3. Isi minimal: **Nama proyek / penugasan**, **Jalur Shared Service**, **Jenis proyek**.
   - Jalur **First Responder — proyek baru / setup** → sistem otomatis membuat 7 deliverable SOP-03.
   - Jalur **Buffer — proyek existing / dukungan eksekusi** → sistem otomatis membuat 8 prasyarat SOP-04.
4. Isi **Alasan penggunaan Shared Service**. Tanpa isian ini gate G0 tidak bisa naik.
5. Isi data administratif bila sudah ada: **Customer / CFU**, **Tribe / Unit**, **Business Owner**,
   **Project Manager**, **Nomor NDE**, **Tanggal NDE**, **Status anggaran**,
   **Status onboarding / akses talent**.
6. Bila pengadaan berjalan, isi **Dokumen pengadaan** + **Target mulai pekerjaan**; sistem menghitung
   **paling lambat diajukan** mundur dari target (PKDF 60 hari, Justifikasi Kontrak Lumsum 45 hari,
   Surat Pesanan *new item* 30 hari, Surat Pesanan tanpa *new item* 14 hari) dan menampilkan
   peringatan merah di daftar proyek bila sudah lewat.
7. Isi **Kebutuhan FTE** dalam teks bebas (mis. `50%`), **Tanggal mulai/akhir penugasan**; untuk jalur
   Buffer isi juga **Akhir masa bridging**, dan centang **Kasus khusus BPOM (SOP-07)** bila berlaku.
8. Klik simpan. Anda diarahkan ke halaman detail proyek dengan kode `PRJ-<tahun>-<urut>`.

**Jangan** mencoba mengubah **Jalur Shared Service** setelah intake: server menolak dengan
`422 Track tidak boleh diubah setelah intake`. Bila jalur salah, proyek harus dibuat ulang dan yang
salah dihapus oleh **approver**.

## 3. Verifikasi administratif & mobilisasi (SOP-02, gate G1)

1. Buka detail proyek, lihat **Posisi Gate** → gate aktif disorot pada bagan gate.
2. Klik gate **G1 Administratif** pada bagan untuk melihat **Kriteria & kesiapan** (daftar gap
   berjalan) dan **Catatan proses gate**.
3. Lengkapi data lewat **Edit** (di halaman daftar) sampai gap untuk G1 kosong:
   - NDE punya **nomor dan tanggal**;
   - **Status anggaran** = `disetujui`;
   - **Status onboarding / akses talent** minimal `berjalan`.
4. Catat hasil verifikasi manual (nomor dokumen anggaran, PIC akses) pada **Catatan proses gate** G1
   — sistem belum menyimpan kolom verifikator, jadi catatan ini yang menjadi bukti sementara.
5. Bila ada gap yang tidak bisa Anda selesaikan (anggaran belum turun, akses belum diberikan), ubah
   **status** proyek menjadi `Pending`/`Blocked` lewat **Edit** dan tulis gap-nya di **Catatan proses
   gate**, lalu eskalasi ke PM.

## 4. Deliverable setup First Responder (SOP-03, gate G2A)

1. Pada detail proyek jalur First Responder, buka kartu **Deliverable Setup — SOP-03 (First Responder)**
   atau pilih gate **G2A Setup FR** pada bagan.
2. Untuk setiap dari 7 baris (WBS, BRD, SAD, Workforce Plan, Initial Data Solution, Initial Design
   Documentation, Project Charter):
   1. isi **Link evidence** — alamat dokumen hasil (hanya `http`/`https` yang dirender sebagai tautan);
   2. isi **Reviewer** — nama pihak yang memeriksa;
   3. ubah **Status** mengikuti alur `belum_mulai` → `dalam_proses` → `review` → `disetujui`;
   4. isi **Due date** bila ada tenggat.
3. Klik **Simpan** di baris itu (setiap baris disimpan sendiri; tidak ada simpan massal).
   **Link evidence** hanya boleh `http`/`https` — skema lain ditolak di layar.
4. Jangan mengosongkan **Nama deliverable** dan **Penyusun** — keduanya bagian dari SOP-03.

Catatan: server **belum** menolak status `disetujui` tanpa evidence/reviewer. Isi keduanya secara
disiplin; auditor akan membaca kolom ini sebagai bukti.

## 5. Prasyarat teknis Buffer (SOP-04, gate G2B)

1. Buka detail proyek jalur Buffer → kartu **Prasyarat Teknis Buffer — SOP-04 (Gate B1–B3)**
   atau gate **G2B Kesiapan Buffer**.
2. Untuk setiap dari 8 baris: isi **Evidence** (link bukti: BRD, SAD, repository, MoM knowledge
   transfer), isi **Verifikator**, centang **Terverifikasi**, lalu klik **Simpan** pada baris itu.
3. Centang hanya setelah bukti benar-benar ada — server belum mewajibkan verifikator/bukti, jadi
   disiplin di sini adalah kontrolnya.
4. Bila sebuah prasyarat belum bisa dipenuhi, biarkan tidak tercentang dan tulis hambatannya pada
   **Catatan proses gate** G2B; gate tidak akan bisa naik (server menghitung 8/8).

## 6. Laporan mingguan, RAID, dan change request (SOP-05)

**Laporan mingguan**

1. Detail proyek → tab **Laporan Mingguan**.
2. Klik **+ Laporan Mingguan**. Isi **Periode** (default terisi `2026-W<n>`; pakai format itu atau
   rentang tanggal — server belum memvalidasi format), **Talent / Chapter / role / FTE**, **Rencana
   (aktivitas/WBS)**, **Realisasi / progres berbasis bukti**, **Evidence / link**, **Next steps**,
   **Blocker / risiko (owner, due date)**, **Keputusan yang dibutuhkan**, **Status akses / dokumen**,
   **Disampaikan oleh**.
3. Simpan. Laporan berstatus belum dikonfirmasi sampai PM menekan konfirmasi.
4. Kirim laporan paling lambat akhir minggu berjalan; keterlambatan belum tercatat otomatis di sistem,
   jadi laporkan manual ke PM.

**RAID (risiko/isu/blocker/dependensi)**

1. Tab **RAID / Risiko & Blocker** → **+ Item RAID**.
2. Pilih **Jenis** (`Risiko`, `Isu`, `Blocker`, `Dependensi`), isi **Judul**, **Deskripsi**, **Dampak**,
   **Owner**, **Due date**, **Mitigasi**, dan centang *Segera dieskalasikan ke PM / pihak berwenang*
   bila perlu.
3. Tutup item dengan tombol **Tutup** hanya setelah benar-benar selesai (status `closed` mencatat waktu).
4. **Blocker terbuka menghalangi gate G3→G4.** Blocker tanpa owner/due date menghalangi G4→G5.

**Change request**

1. Tab **Change Request** → ajukan dengan **judul**, **deskripsi**, **dampak**.
2. Anda **tidak** boleh menyetujui change request: keputusan ada di peran **approver**
   (server menolak dengan `403`).
3. Setelah diputuskan, catat nomor CR tersebut di laporan mingguan periode berjalan.

Catatan: tombol **Konfirmasi PM** (di tab Laporan Mingguan) dan **Setujui/Tolak** (di tab Change
Request) tetap tampil untuk operator, tetapi server menolaknya dengan `403` — bukan kerusakan.

## 7. Yang belum ditegakkan sistem (jangan diandalkan)

| Hal | Kondisi sebenarnya | Yang harus Anda lakukan |
| --- | --- | --- |
| Status `disetujui` pada deliverable | Bisa disetel tanpa evidence & reviewer | Isi bukti dulu, baru ubah status |
| Verifikasi prasyarat Buffer | Bisa dicentang tanpa verifikator/bukti | Isi verifikator + evidence, selalu |
| Format periode laporan & field minimum | Tidak divalidasi | Pakai format mingguan konsisten, isi semua field |
| Tenggat laporan | Tidak ada pengingat/status terlambat | Laporkan manual ke PM tiap Jumat |
| Perubahan jalur proyek | Ditolak (sudah benar) — hubungi approver bila salah input | Proyek dibuat ulang |
| Penutupan proyek | Siapa pun dengan peran PM/approver bisa menutup dari gate mana pun | **Jangan** pakai tombol **Selesai** sebelum G5 dan acceptance selesai |
| FTE per peran | Masih teks bebas (`50%`), tidak bisa diagregasi | Tulis rincian peran di **Catatan** |

## 8. Tentang tangkapan layar

Lingkungan penyusunan panduan ini tidak punya peramban, jadi tangkapan layar belum bisa dilampirkan.
Bila Anda menambahkan tangkapan layar, ambil empat ini (urut prioritas) dan simpan di
`docs/use-cases/ddp-project-control/img/` dengan nama yang sama seperti di panduan:

1. `operator-01-intake.png` — modal **Intake Proyek Baru — SOP-01** dengan semua field terlihat.
2. `operator-02-gate-g1.png` — kartu **Posisi Gate** + **Kriteria & kesiapan** untuk G1 berisi gap.
3. `operator-03-deliverable.png` — tabel **Deliverable Setup — SOP-03** satu baris terisi lengkap.
4. `operator-04-laporan.png` — tab **Laporan Mingguan** dengan satu laporan terisi.

## 9. Bila sistem menolak

| Pesan | Arti | Tindakan |
| --- | --- | --- |
| `Jalur (track) wajib first_responder atau buffer` | Intake tanpa jalur | Pilih jalur di form |
| `Syarat gate belum terpenuhi` + daftar `gaps` | Gate belum boleh naik | Selesaikan tiap gap yang disebut; jangan minta eskalasi untuk gap yang bisa Anda lengkapi |
| `Track tidak boleh diubah setelah intake` | Mencoba ubah jalur | Buat proyek baru; minta approver menghapus yang salah |
| `Deliverable wajib tidak boleh dihapus sebelum gate melewati G2A atau proyek ditutup` | Menghapus item wajib | Jangan dihapus; koreksi isinya |
| `Tanggal tidak valid untuk <field>` | Format tanggal salah | Pakai `YYYY-MM-DD` |
| `403` pada aksi | Peran Anda tidak berwenang | Serahkan ke PM/approver |
