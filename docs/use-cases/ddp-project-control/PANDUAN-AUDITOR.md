# Panduan Auditor — RavenClaw

**Peran:** `auditor` · **Siapa:** pihak yang membuktikan bahwa proses DDP benar-benar dijalankan —
bukan yang menjalankannya.
**Prinsip:** auditor **tidak mengubah apa pun**. Nilai audit tergantung pada seberapa jujur Anda
menyebut apa yang bisa dan tidak bisa dibuktikan sistem.

Ringkasan kewenangan (lengkap: `docs/ADR/ADR-002-rbac-roles.md`):

| Auditor boleh | Auditor tidak boleh |
| --- | --- |
| Membaca semua proyek, gate, deliverable, prasyarat, laporan, RAID, change request, KPI | Membuat/mengubah proyek, gate, deliverable, prasyarat, laporan, RAID, change request |
| Membaca proyek yang sudah dihapus (soft delete) lewat `GET /api/projects?include_deleted=true` | Menaikkan gate, konfirmasi laporan, menyetujui change request, mengeskalasi |
| Mengambil salinan database untuk analisis di luar aplikasi (prosedur §7) | Menghapus atau membuka kembali proyek |

Server menolak setiap penulisan dari peran auditor dengan `403 Akses ditolak` (terverifikasi
`test_http`: *auditor cannot mutate projects*).

> Status 22 Oktober 2026: aplikasi masih draft. Yang paling memengaruhi pekerjaan auditor: **UI belum
> punya layar login** (K1), **tidak ada ekspor riwayat** (X-2), **detail proyek hanya menampilkan 200
> event terakhir**, dan **beberapa kolom bukti masih bisa kosong** (K4). Semua konsekuensinya ada di
> §6 dan `TRACEABILITY-2026-10-22.md`.

## 1. Sebelum mulai

1. Masuk sebagai `auditor` (lihat `apps/ddp-project-control/README.md` bagian
   *Login tanpa UI (sementara)* bila layar login belum ada).
2. Tetapkan lingkup audit: **satu proyek**, **satu gate**, atau **satu periode** (mis. semua laporan
   mingguan Oktober). Audit menyeluruh tanpa lingkup akan berhenti di volume data, bukan di bukti.
3. Siapkan daftar bukti di luar sistem yang Anda butuhkan (NDE, BAPP/BAST, Nota Dinas BPOM, MoM KT) —
   aplikasi belum menyimpan dokumen, hanya teks/tautan.

## 2. Membaca posisi dan riwayat satu proyek

1. Buka **Proyek & Penugasan**; saring dengan **Jalur**, **Gate**, atau **Status**.
2. Klik kode proyek → halaman detail. Empat bagian pertama adalah bahan audit utama:
   - **Posisi Gate** — bagan gate aktif, Business Owner, PM, Tribe/Unit, NDE, status anggaran,
     onboarding, FTE, periode penugasan, alasan Shared Service, rencana definitif.
   - **Riwayat Proses per Gate** — pilih setiap gate pada bagan. Untuk gate aktif tampil
     **Kriteria & kesiapan** (gap yang masih terbuka saat ini), **Catatan proses gate**, dan
     **Jejak proses gate** (waktu, aksi, catatan, aktor).
   - **Deliverable Setup — SOP-03** (jalur First Responder) atau **Prasyarat Teknis Buffer — SOP-04**
     (jalur Buffer) — status, evidence, reviewer/verifikator, due date.
   - Tab **Laporan Mingguan**, **RAID / Risiko & Blocker**, **Change Request**, **Log Aktivitas**.
3. Catat tiga hal untuk setiap gate: **(a)** siapa aktornya, **(b)** kapan, **(c)** bukti apa yang
   dirujuk. Bila salah satu kosong, tulis "tidak terbukti" — jangan disimpulkan dari status gate.

## 3. Membaca bukti gate

1. **G1 Administratif** — NDE (nomor & tanggal), status anggaran, status onboarding. Semuanya
   *self-declared* oleh operator; bukti sebenarnya ada di dokumen NDE/anggaran di luar aplikasi.
   Periksa **Catatan proses gate G1** untuk nomor dokumen, lalu cocokkan dengan dokumen aslinya.
2. **G2A Setup First Responder** — 7 baris wajib. Status `disetujui` **tidak** menjamin ada bukti:
   server belum mewajibkan `evidence_url` dan `reviewed_by` (K4). Baris dengan evidence/reviewer kosong
   adalah temuan, bukan pelanggaran aplikasi.
3. **G2B Kesiapan Buffer** — 8 prasyarat wajib; `verified_at` terisi otomatis saat item dicentang,
   tetapi `verifikator` dan `evidence` bisa kosong (K4).
4. **G3 Delivery** — tidak ada **Blocker** terbuka dan ada laporan mingguan. Server tidak memeriksa
   FTE/periode/akses, jadi periksa isi laporan dan data proyek secara manual.
5. **G4 Acceptance** — server hanya memeriksa `owner` + `due_date` untuk item RAID terbuka. Bukti
   acceptance/handover (BAPP/BAST) **tidak ada di sistem** — minta salinannya di luar aplikasi.
6. **G5 Transisi** — server hanya memeriksa catatan penutupan tidak kosong. Rencana talent definitif
   dibaca dari **Rencana definitif/transisi** pada **Posisi Gate**.

## 4. Membaca laporan mingguan dan keputusan PM

1. Buka tab **Laporan Mingguan**. Setiap baris memuat periode, rencana vs realisasi, evidence,
   blocker, keputusan yang dibutuhkan, status akses, dan pengirim.
2. Periksa kolom konfirmasi PM. Yang **tidak** tersedia: **waktu konfirmasi** (`pm_confirmed_at`
   tidak ada). Artinya: Anda bisa membuktikan *siapa* yang mengonfirmasi, **tidak** *kapan*. Bila
   urutan waktu penting (mis. laporan dikonfirmasi setelah keputusan diambil), bukti harus diambil dari
   `Log Aktivitas` (event "Weekly report dikonfirmasi PM") — bukan dari tabel laporan.
3. Laporan bertanda terlambat **tidak** tersedia di sistem (belum ada tenggat, K6). Keterlambatan
   dinilai manual terhadap periode laporan.

## 5. Membaca change request, eskalasi, dan penutupan

1. Tab **Change Request** — judul, deskripsi, penilaian dampak, approver, status, `decided_at`.
   Status `disetujui` dapat diberikan tanpa penilaian dampak (K4), dan kolom **approver** bisa berisi
   nama siapa pun. Yang mengikat keputusan hanyalah: peran sesi pelaku (approver) dan waktu keputusan.
   Ambil aktor & waktunya dari **Log Aktivitas** ("Keputusan change request").
2. Eskalasi gate — cari event **"Gate dinaikkan dengan ESKALASI"** di **Log Aktivitas**. Event itu
   memuat aktor, alasan (`force_reason`), dan seluruh gap saat eskalasi. Ini bukti terkuat yang
   dimiliki aplikasi untuk eskalasi.
3. Penutupan (`CLOSED`) — **bisa terjadi dari gate mana pun** (K2). Untuk audit, selalu bandingkan
   `prev_gate` dengan syarat G5; penutupan dari G0–G4 adalah temuan prosedural, bukan kesalahan UI.
4. Buka kembali proyek — event **"Project dibuka kembali"** mencatat aktor dan gate asal/tujuan, tetapi
   **tidak** mencatat alasan. Alasan hanya ada bila approver menuliskannya di **Catatan proses gate**.

## 6. Apa yang tidak bisa dibuktikan dari aplikasi

Sebutkan batas ini di laporan audit Anda. Semua sudah tercatat sebagai keterbatasan, bukan sesuatu yang
bisa Anda akali saat membaca data.

| Pertanyaan audit | Status bukti |
| --- | --- |
| Siapa yang memverifikasi NDE/anggaran/onboarding, dan kapan? | Hanya event perubahan (aktor + waktu); tidak ada field verifikator khusus |
| Kapan laporan mingguan dikonfirmasi PM? | **Tidak tersimpan**; hanya event di log |
| Apakah deliverable `disetujui` benar-benar punya bukti? | Kolom evidence/reviewer bisa kosong — periksa per baris |
| Ada BAPP/BAST atau dokumen handover? | Tidak ada entitas/lampiran di sistem |
| Apakah laporan mingguan terlambat? | Tidak ada tenggat di sistem; hitung manual |
| Siapa yang menghapus proyek dan kapan? | Event "Project dihapus (soft delete)" menyebut kode & pelaku; detail proyek terhapus **tidak** bisa dibuka (`404`), hanya lewat daftar `include_deleted=true` |
| Riwayat lengkap satu proyek (>200 event)? | Detail proyek hanya mengembalikan 200 event terbaru; ambil dari salinan database (§7) |
| Ekspor riwayat (CSV/PDF)? | Belum ada; pakai salinan database dan kueri baca-saja |

## 7. Membaca proyek yang sudah dihapus dan mengambil salinan untuk analisis

Daftar biasa menyembunyikan proyek terhapus; UI tidak punya tombolnya, jadi pakai API (baca-saja):

```bash
curl -s -b 'ddp_session=<cookie-anda>' \
  'http://localhost:3000/api/projects?include_deleted=true&limit=200' | head -c 400
```

Untuk analisis menyeluruh (riwayat >200 event, agregasi, pencocokan antar tabel), ambil **salinan**
database lebih dulu — jangan menjalankan kueri berat pada database yang sedang dipakai:

```bash
cd apps/ddp-project-control
DATA_DIR=./data bash scripts/backup.sh ./backups-audit     # salinan konsisten (WAL checkpoint)
node -e '
const {DatabaseSync}=require("node:sqlite");
const db=new DatabaseSync(process.argv[1],{readOnly:true});
const rows=db.prepare("SELECT created_at,gate,action,actor,note FROM events WHERE project_id=? ORDER BY created_at").all(2);
console.log(rows);
' ./backups-audit/ddp-<UTC>.sqlite
```

Aturan main: kueri **baca-saja** (`readOnly: true`), tidak pernah menulis ke database layanan, dan
salinan hasil audit disimpan di tempat yang aksesnya terbatas (berisi nama orang dan data proyek).

## 8. Daftar periksa audit minimum (per proyek)

1. Gate saat ini vs `status` proyek konsisten? (`CLOSED` ⇔ `closed`)
2. Apakah proyek mencapai gate sekarang **tanpa** event eskalasi? Bila ada eskalasi: alasan & aktor ada?
3. Untuk setiap gate yang dilewati: aktor, waktu, dan bukti yang dirujuk ada di **Jejak proses gate**?
4. `disetujui` pada 7 deliverable / `verified` pada 8 prasyarat: berapa baris tanpa evidence atau
   reviewer/verifikator? (angka ini adalah temuan utama audit hari ini)
5. Laporan mingguan: ada per periode yang dituntut SOP? Periode berformat? Konfirmasi PM ada buktinya?
6. RAID: blocker terbuka punya owner + due date? Ada yang overdue?
7. Change request: dampak dinilai sebelum keputusan? Keputusan punya aktor approver?
8. BPOM: periode bridging ≤ 4 minggu? Ada rencana definitif? (keduanya tidak divalidasi sistem)
9. Penutupan: dari gate berapa? Ada evaluasi/lessons learned?

## 9. Bila yang Anda temukan adalah penyimpangan

1. Jangan mengubah data (Anda tidak bisa — dan tidak boleh lewat jalur lain).
2. Catat: proyek, gate, waktu, aktor, bukti (screenshot/kueri), dan butir SOP yang dilanggar.
3. Laporkan ke pemilik proses (PM proyek dan approver gate tersebut), tembuskan ke THEOFILUS sebagai
   pemilik keputusan; sertakan rujukan butir pada `TRACEABILITY-2026-10-22.md` agar perbaikan bisa
   dilacak ke kode/test.
4. Bila temuan menyangkut aplikasi (bukan orang), tambahkan ke `RUNBOOK-INSIDEN.md` bila perlu
   tindakan segera, atau ke daftar keterbatasan README bila itu celah yang sudah diketahui.

## 10. Tentang tangkapan layar

Belum tersedia (lingkungan penyusunan tanpa peramban). Bila ditambahkan, ambil:
`auditor-01-posisi-gate.png` (kartu **Posisi Gate** + bagan), `auditor-02-jejak-gate.png`
(**Jejak proses gate** dengan aktor & waktu), `auditor-03-log-aktivitas.png` (tab **Log Aktivitas**
dengan event eskalasi), `auditor-04-deliverable.png` (**Deliverable Setup** dengan evidence kosong).
