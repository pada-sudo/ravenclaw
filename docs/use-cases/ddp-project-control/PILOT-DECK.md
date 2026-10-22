# DDP Project Control — Deck Validasi Internal & Daftar Keputusan Pilot

- **Tanggal:** 22 Oktober 2026
- **Penyusun:** Rangga (Proposal/Content), issue DEEP-227 — bagian dari DEEP-218 (Web Apps)
- **Audiens:** THEOFILUS JIMMY + pemilik proses DDP
- **Status bahan:** draf validasi internal. **Bukan** klaim siap produksi.
- **Basis penilaian:** branch integrasi `agent/pedro-tech-lead/46e74842a795`, commit `c1fa241`
  (stage 1 & 2 sudah merged; stage 3 — test Sofia, dokumentasi Diana — masih berjalan).
- **Format:** Markdown, tiap `---` adalah satu slide (bisa dirender dengan Marp). Empat slide:
  ringkasan masalah & pengguna · model gate + KPI · status perbaikan · keputusan yang diminta.

---

## Slide 1 — Masalah yang diselesaikan & siapa penggunanya

**Masalahnya.** Setiap penugasan DDP di jalur **First Responder** (proyek baru) dan **Buffer**
(proyek existing) harus melewati persetujuan bertahap (gate) menurut SOP-01..07. Sebelum aplikasi
ini, bukti kelulusan sebuah gate tersebar di dokumen, chat, dan spreadsheet: **tidak ada satu tempat**
yang bisa menunjukkan posisi penugasan, membuktikan syarat gate benar-benar terpenuhi, dan menyimpan
siapa memutuskan apa pada tanggal berapa.

**Yang dilakukan aplikasi.** Mencatat posisi setiap penugasan di dalam proses, menolak kenaikan gate
bila syaratnya belum ada datanya, dan menyimpan jejak pelaku. Aplikasi ini **bukan** ERP atau sistem
pengadaan — ia kontrol proses, bukan sumber data keuangan.

**Siapa yang memakainya** (peran ditegakkan di aplikasi — `docs/ADR/ADR-002-rbac-roles.md`):

| Peran | Yang dikerjakan |
| --- | --- |
| Operator | Intake proyek, mengisi deliverable/prasyarat, laporan mingguan, RAID, change request |
| PM | Konfirmasi laporan mingguan, keputusan, menandai proyek selesai |
| Approver | Menaikkan gate (termasuk eskalasi), memutuskan change request, mengarsipkan proyek |
| Auditor | Membaca riwayat gate, bukti, dan data yang sudah diarsipkan (tanpa mengubah) |

**Batas kejujuran yang perlu dibaca audiens:** aplikasi ini masih berstatus *draf untuk validasi
internal* dan **belum punya layar login** — untuk mencoba alur hari ini, sesi login disetel lewat API
(`apps/ddp-project-control/README.md`, bagian "Login tanpa UI"). Konsekuensi dan pemiliknya ada di
Slide 2 (butir K1).

---

## Slide 2 — Model gate G0–G5 dan 6 KPI pilot

### Model gate (satu jalur tetap per penugasan)

| Gate | Artinya | Jalur |
| --- | --- | --- |
| G0 | Kualifikasi: jalur dan alasan penggunaan Shared Service ditetapkan | FR & Buffer |
| G1 | Administratif: NDE tersedia, anggaran disetujui, onboarding/akses berjalan | FR & Buffer |
| **G2A** | Setup First Responder: 7 deliverable wajib disetujui | **hanya First Responder** |
| **G2B** | Kesiapan Buffer: 8 prasyarat teknis terverifikasi | **hanya Buffer** |
| G3 | Delivery: tidak ada blocker terbuka, laporan mingguan berjalan | FR & Buffer |
| G4 | Acceptance: isu residual punya owner & tenggat | FR & Buffer |
| G5 | Transisi: lessons learned tercatat | FR & Buffer |
| CLOSED | Penugasan ditutup | FR & Buffer |

FR: G0 → G1 → **G2A** → G3 → G4 → G5 → CLOSED · Buffer: G0 → G1 → **G2B** → G3 → G4 → G5 → CLOSED.
Jalur **tidak bisa diubah** setelah intake. Rujukan: `apps/ddp-project-control/docs/DOMAIN-RULES.md` §1–§3.

### 6 KPI pilot — definisi dari katalog Adit (DEEP-220)

| KPI | Artinya bagi pemangku kepentingan | Cara membacanya |
| --- | --- | --- |
| Kesiapan administratif | Berapa penugasan aktif yang urusan NDE, anggaran, dan onboarding-nya sudah beres | %; bila penyebut < 3 tampilkan pecahan (mis. 2/3), jangan persen |
| FR readiness | Berapa proyek First Responder yang seluruh 7 deliverable setup-nya sudah disetujui sebelum eksekusi | %; target usulan ≥95% |
| Buffer technical readiness | Berapa proyek Buffer yang seluruh 8 prasyarat teknisnya terverifikasi | %; 100% wajib sebelum eksekusi |
| Kepatuhan laporan mingguan | Berapa proyek di fase delivery yang laporannya masuk sesuai jadwal | %; <80% buruk |
| Blocker terbuka + umur | Berapa blocker yang masih terbuka dan sudah berapa lama | angka absolut; umur > 14 hari = merah |
| Kesiapan transisi | Berapa proyek Buffer yang rencana transisinya siap sebelum masa bridging berakhir | **wajib pecahan** bila penyebut < 5 — jangan tampilkan 100% dari 1 proyek |

Catatan: angka contoh di katalog Adit berasal dari **data demo**, bukan hasil pilot. Ringkasan KPI di
halaman Referensi aplikasi juga memuat satu butir ke-7 ("Chapter document review") yang **belum punya
definisi katalog** — belum boleh dipakai sebagai KPI pilot. Rujukan: katalog KPI Adit (DEEP-220) +
`apps/ddp-project-control/public/content/kpi.json`.

---

## Slide 3 — Apa yang sudah diperbaiki vs apa yang belum

Dasar: audit baseline (`AUDIT-2026-10-22-baseline.md`, temuan A/B/C/D/E), matriks SOP George
(`BASELINE-REQUIREMENTS-2026-10-22.md`), dan test yang benar-benar dijalankan ulang pada deck ini.

### Sudah diperbaiki (stage 1–2) — tiap baris punya uji atau kode sebagai rujukan

| # | Perbaikan | Rujukan |
| --- | --- | --- |
| 1 | Gate tidak bisa lolos dengan daftar kosong: G2A menuntut 7 deliverable, G2B menuntut 8 prasyarat (menutup A1/P0-01/P0-02) | `lib/domain.js:125-160`; uji `tests/test_domain.js:9`, `:29`; `tests/test_http.js:128` (422 + daftar gap) |
| 2 | Jalur (FR/Buffer) tidak bisa diubah setelah intake (A2) | `tests/test_http.js:150`; `DOMAIN-RULES.md` §1 |
| 3 | Kode proyek unik dan tahan hapus (A3): hapus lalu buat proyek baru tetap berhasil | `tests/test_http.js:116` |
| 4 | Eskalasi gate butuh approver + alasan; operator ditolak (A4) | `tests/test_http.js:137` (operator → tolak), `:143` (approver + alasan → boleh) |
| 5 | Login sesi + 4 peran ditegakkan; permintaan tanpa sesi ditolak 401; auditor tidak bisa mengubah (B1). ADR peran masih berstatus **diusulkan** | `tests/test_http.js:98`, `:186`; `ADR-002-rbac-roles.md` |
| 6 | Jejak audit mencatat aktor nyata (bukan `'operator web'`) (A12/P1-01) | `lib/db.js:90` (`actorFrom`), `:109` (`logEvent`) |
| 7 | Hapus proyek = arsip (soft delete); riwayat gate tetap ada dan bisa dibaca auditor (B7/P1-05). Kebijakan retensi masih **usulan** (ADR-003) | `tests/test_http.js:192`; `ADR-003-audit-retention.md` |
| 8 | Header keamanan + rate limit dengan pembersihan berkala (B2/B3) | `tests/test_http.js:202`, `:211`; `tests/test_security.js` |
| 9 | Tautan bukti hanya boleh `http/https` (dan skema dokumen internal); `javascript:` tidak dirender (B4) | `public/modules/utils.js:33`; `tests/test_frontend.mjs:49` |
| 10 | Tanggal mustahil ditolak; field bisa dikosongkan untuk koreksi (A6/A7) | `tests/test_domain.js:55`, `:64`; `tests/test_http.js:169` |
| 11 | Deliverable/prasyarat wajib tidak bisa dihapus selama proyek aktif (P0-07) | `tests/test_http.js:159`; `lib/routes.js:287`, `:341` |
| 12 | Docker, healthcheck, backup & restore terdokumentasi dan diuji manual (D2/D4) | `apps/ddp-project-control/compose.yaml`, `scripts/backup.sh`, `scripts/restore.sh`, `README.md` ("Backup & restore") |
| 13 | Suite test otomatis ada: **39/39 lulus** saat dijalankan ulang pada deck ini (22 Okt 2026, Node v24.18.1) | `cd apps/ddp-project-control && rm -rf data && npm test` |

### Belum selesai / masih terbuka — jangan diklaim siap

| # | Yang belum | Dampak bila dipakai pilot sekarang | Rujukan |
| --- | --- | --- | --- |
| K1 | UI belum punya layar login (sesi harus disetel manual) | Aplikasi belum bisa dipakai lewat browser oleh operator non-teknis | `README.md` butir K1 |
| K2 | Proyek bisa ditutup dari gate mana pun | Penugasan bisa "selesai" tanpa acceptance | `lib/routes.js:207-218`; `README.md` K2 |
| K3 | G4 → G5 belum menuntut bukti acceptance/handover (BAPP/BAST) | SOP-06 belum punya kontrol | `README.md` K3 |
| K4 | Status "disetujui"/"terverifikasi" bisa disetel tanpa bukti & verifikator | Bukti gate bisa kosong | `README.md` K4 |
| K5 | Prasyarat Buffer belum dipetakan ke B1–B4 | Kepatuhan SOP-04 tidak bisa dinilai per tahap | `README.md` K5 |
| K6 | Laporan mingguan: format, tenggat, dan waktu konfirmasi PM belum ditegakkan | "Kepatuhan laporan" masih proksi 7 hari | `README.md` K6 |
| K7 | Parameter BPOM (70/30/50%, bridging ≤ 4 minggu) masih konstanta tampilan, bukan data proyek | Perubahan Nota Dinas masih perlu ubah kode | `README.md` K7 |
| K8 | Definisi KPI Adit belum sepenuhnya diterapkan: KPI FR/Buffer belum memeriksa jumlah baris, KPI administratif menampilkan 0% saat tidak ada proyek aktif, blocker proyek yang sudah ditutup masih terhitung | Dashboard bisa menampilkan angka menyesatkan | `lib/domain.js:176-215`; katalog Adit KPI-1/2/3/5 |
| K9 | Suite test belum idempoten: pada direktori data kotor `test:http` gagal 2 dari 14 (bukan bug produk) | Regression gate bisa merah-hijau acak di CI | Dijalankan ulang 22 Okt: 39/39 bersih vs 12/14 saat diulang; penanganan di DEEP-225 (Sofia) |
| K10 | Matriks SOP George (66 butir: 10 terpenuhi / 30 sebagian / 26 belum ada) menilai **baseline** `af65560`; penilaian ulang setelah stage 1–2 belum dilakukan | Kita belum punya angka kepatuhan SOP terkini | `BASELINE-REQUIREMENTS-2026-10-22.md` §1; George (DEEP-219) |
| K11 | Verifikasi independen Sofia dan dokumentasi akhir Diana belum terbit | Belum ada bukti pihak ketiga bahwa test mencakup alur yang dipakai pilot | DEEP-225, DEEP-226 (status: berjalan) |

**Kalimat status yang boleh dipakai ke manajemen:** *"Kontrol gate inti sudah mengikat dan teruji di
lingkungan pengembangan; aplikasi belum siap dipakai operator tanpa pendampingan karena layar login
dan acceptance belum ada."* Jangan memakai kata "siap produksi".

---

## Slide 4 — Keputusan yang diminta dari THEOFILUS

Semua pertanyaan di bawah bisa dijawab **Ya/Tidak**; kolom terakhir adalah yang berlaku bila tidak
dijawab (usulan tim, bukan keputusan).

| # | Pertanyaan | Jawaban | Bila tidak dijawab |
| --- | --- | --- | --- |
| D-1 | Apakah hasil stage 1–2 di-merge ke `main` **setelah** Sofia (test) dan Diana (dokumentasi) selesai? | Ya / Tidak / Tunggu | Tetap di branch integrasi; tidak ada rilis |
| D-2 | Apakah cakupan pilot dibatasi maksimal **5 proyek** dan hanya proyek yang sudah berjalan? | Ya / Tidak | Batasi 5 proyek, daftar ditetapkan THEOFILUS |
| D-3 | Apakah proyek pilot memakai **data nyata** (bukan anonim)? | Ya / Tidak | Data nyata terbatas 5 proyek, akses berbasis peran |
| D-4 | Apakah model **4 peran** (operator, PM, approver, auditor) disetujui sebagai model persetujuan pilot? | Ya / Tidak | Dipakai apa adanya (`ADR-002`), satu akun satu peran |
| D-5 | Apakah **approver gate G0–G5** ditetapkan per gate dengan nama nyata, dan aplikasi wajib **menolak** kenaikan gate oleh yang bukan approver? | Ya / Tidak | RBAC penuh: hanya approver yang boleh menaikkan gate |
| D-6 | Apakah **eskalasi gate (force)** tetap diizinkan? Bila ya, hanya approver tertinggi dengan alasan tertulis? | Ya / Tidak | Diizinkan hanya untuk approver, wajib alasan + daftar gap |
| D-7 | Apakah **riwayat gate bersifat permanen**: proyek hanya diarsipkan (tidak bisa dihapus permanen), dan retensi ditetapkan **7 tahun**? | Ya / Tidak | Riwayat permanen, tanpa hapus; retensi mengikuti kebijakan arsip |
| D-8 | Apakah **pemilik data pilot** adalah pemilik proses DDP (bukan Chapter/PMO), dengan akses baca untuk auditor? | Ya / Tidak | Pemilik: pemilik proses DDP; auditor baca saja |
| D-9 | Apakah **7 deliverable FR dan 8 prasyarat Buffer wajib seluruhnya** (tidak boleh dikurangi per proyek tanpa persetujuan)? | Ya / Tidak | Wajib semua; pengurangan hanya lewat persetujuan tercatat |
| D-10 | Apakah butir berikut **boleh menyusul** (tidak memblokir pilot): pemetaan B1–B4, entitas acceptance/BAPP, tenggat laporan mingguan, layar login, WCAG AA penuh? | Ya / Tidak | Boleh menyusul dengan prosedur manual tercatat |

**Dua hal yang belum kami minta diputuskan**, karena datanya belum ada: (a) target angka KPI (perlu
satu siklus data pilot), (b) integrasi ke sistem keuangan/procurement.

---

## Lampiran — cara memeriksa ulang klaim di deck ini

```bash
multica repo checkout git@github.com:pada-sudo/Product.git --ref agent/pedro-tech-lead/46e74842a795
cd Product/apps/ddp-project-control
rm -rf data && npm test                 # 39/39 lulus (22 Okt 2026)
grep -n "deliverables.length < REQUIRED_FR_COUNT" lib/domain.js   # gate fail-closed (A1)
grep -n "'/api/projects/:id/close'" -A 12 lib/routes.js           # K2 masih terbuka
```

**Sumber yang dipakai:** `AUDIT-2026-10-22-baseline.md` (temuan A1/A2/A3/A4/A6/A7/B1/B2/B3/B4/B7,
A12, P0/P1) · `BASELINE-REQUIREMENTS-2026-10-22.md` (matriks 66 butir, gap register, definisi pilot
siap, pertanyaan Q1–Q10) · katalog aturan bisnis & KPI Adit (DEEP-220) · `README.md` +
`docs/ADR/ADR-002`, `ADR-003` · test `tests/test_domain.js`, `test_http.js`, `test_security.js`,
`test_frontend.mjs`.

**Yang tidak ada di deck ini dan memang tidak diklaim:** hasil uji independen Sofia (DEEP-225), status
dokumentasi akhir Diana (DEEP-226), dan penilaian ulang matriks SOP setelah perbaikan.
