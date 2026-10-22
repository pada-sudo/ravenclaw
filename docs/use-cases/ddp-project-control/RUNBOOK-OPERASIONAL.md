# Runbook Operasional — DDP Project Control

**Status:** draft operasional. Perintah pada §3–§6 **sudah diuji** pada 22 Oktober 2026 (native Node 24
dan Docker 29.9.1) dengan hasil yang disebutkan masing-masing bagian. Pemilik operasional: **Victor
(DevOps)**; pemilik proses: THEOFILUS.

## 1. Peta layanan & konfigurasi

Komponen: satu proses Node tanpa dependensi eksternal (bawaan `node:http`, `node:sqlite`) + satu file
SQLite + aset statis `public/` di belakangnya.

| Variabel env | Default | Arti |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `DATA_DIR` | `./data` | Lokasi database `ddp.sqlite` (di Docker: `/data`) |
| `DB_NAME` | `ddp.sqlite` | Nama file (dipakai skrip backup/restore) |
| `SESSION_TTL_SECONDS` | `28800` (8 jam) | Masa berlaku sesi |
| `COOKIE_SECURE` | `false` | `true` bila sudah di belakang HTTPS |
| `TRUSTED_ORIGINS` | kosong | Daftar origin (mis. `https://ddp.example.com`) untuk izin CORS/preflight |
| `LOG_LEVEL` | `info` | Hanya `info` dan `silent` yang berbeda (lihat §6) |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `120` / `60000` | Batas request per identitas per window |

Dicatat agar tidak menyesatkan operator:

- **`SESSION_SECRET` ditulis di `compose.yaml` dan ADR-004, tetapi tidak pernah dibaca kode.**
  Token sesi berupa `sha256(secret || random)` yang disimpan di tabel `sessions` (`lib/auth.js:71`),
  jadi `SESSION_SECRET` bisa dihapus dari compose bila ingin mengurangi kebingungan.
- **Belum ada `nginx.conf`/`Caddyfile` di repo.** README menyebut opsi reverse proxy, tetapi
  konkretnya belum ada. Selama di belakang proxy: set `COOKIE_SECURE=true` dan isi `TRUSTED_ORIGINS`.
- **`scripts/` tidak ikut di image Docker** (Dockerfile hanya menyalin `package.json`, `server.js`,
  `lib`, `migrations`, `public`). Jalankan backup/restore dari host atau lewat perintah di §4/§5.

## 2. Menjalankan layanan

### 2a. Lokal / server tanpa Docker (sudah diuji)

```bash
cd apps/ddp-project-control
npm test                 # 39 test, harus 39/39 (~10 detik) — jalankan sebelum setiap rilis
PORT=3000 DATA_DIR=./data SESSION_TTL_SECONDS=28800 node server.js
curl -s http://localhost:3000/healthz      # {"status":"ok",...}
```

Database dibuat otomatis bila belum ada, migrasi dijalankan berurutan (`migrations/`), lalu data seed
dimuat (bisa dicegah dengan `SEED_DATA=false`). Verifikasi login:

```bash
curl -s -c /tmp/c.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"operator","password":"operator"}'
curl -s -b /tmp/c.txt http://localhost:3000/api/kpis | head -c 200
```

### 2b. Docker Compose (sudah diuji)

```bash
cd apps/ddp-project-control
docker compose up -d --build
docker compose ps                       # healthcheck /healthz tiap 30 detik
curl -s http://localhost:3000/healthz
docker compose logs -f --tail 50 ddp-project-control
```

Catatan hasil uji: image multi-stage `node:24.18.1-alpine`, berjalan sebagai non-root `1001:1001`,
data menetap di volume `ddp-sqlite:/data`, dan `restart: unless-stopped`. Jaga izin file di volume
milik uid 1001 — file backup yang disalin balik ke volume wajib `chown 1001:1001` (lihat §5).

### 2c. Menjalankan sebagai layanan (belum diuji di lingkungan ini)

Template systemd (penempatan `/etc/systemd/system/ddp-project-control.service`), jangan dianggap
sudah divalidasi:

```ini
[Unit]
Description=DDP Project Control
After=network.target

[Service]
WorkingDirectory=/opt/Product/apps/ddp-project-control
Environment=PORT=3000
Environment=DATA_DIR=/var/lib/ddp
Environment=SESSION_TTL_SECONDS=28800
Environment=COOKIE_SECURE=true
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=ddp

[Install]
WantedBy=multi-user.target
```

## 3. Backup (sudah diuji)

### 3a. Dari host (native)

```bash
cd apps/ddp-project-control
DATA_DIR=./data bash scripts/backup.sh ./backups
# → Checkpointing WAL and creating backup: ./backups/ddp-20261022T054114Z.sqlite
```

Skrip ini `PRAGMA wal_checkpoint(TRUNCATE)` lalu `.backup`/`VACUUM INTO`, sehingga hasilnya
konsisten walau layanan berjalan. **Isi backup identik dengan data layanan** (uji: 10 proyek / 44 event
terbaca kembali dari backup).

### 3b. Dari dalam container (sudah diuji — `scripts/` tidak ada di image)

```bash
docker exec ddp-project-control node -e '
  const {DatabaseSync}=require("node:sqlite"); const fs=require("node:fs");
  const ts=new Date().toISOString().replace(/[-:]/g,"").replace(/\..+/,"Z");
  fs.mkdirSync("/data/backups",{recursive:true});
  const dst="/data/backups/ddp-"+ts+".sqlite";
  const q=String.fromCharCode(39);            // petik tunggal untuk string literal SQL
  const db=new DatabaseSync("/data/ddp.sqlite");
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM INTO "+q+dst+q);
  console.log(dst);'
docker cp ddp-project-control:/data/backups/ddp-<TS>.sqlite ./backups/   # salinan keluar container
```

(Pada `VACUUM INTO` path wajib string literal **petik tunggal** — petik ganda dibaca sebagai nama kolom;
`String.fromCharCode(39)` dipakai agar kutip tidak bentrok dengan kutip shell.) Backup yang ditulis ke
`/data/backups` ikut tersimpan di volume; tetap salin keluar container — volume bisa hilang bersama
`docker compose down -v`.

### 3c. Jadwal, retensi, verifikasi

```cron
0 1 * * *  cd /opt/Product/apps/ddp-project-control && DATA_DIR=./data bash scripts/backup.sh /var/backups/ddp >> /var/log/ddp-backup.log 2>&1
```

Retensi yang layak dijaga: **14 harian + 4 mingguan** (sesuaikan dengan retensi audit DB dari ADR-003
dan keputusan THEOFILUS). Verifikasi backup setelah dibuat — jangan pernah percaya pesan "Backup
complete" tanpa memeriksanya:

```bash
node -e 'const {DatabaseSync}=require("node:sqlite");
 const db=new DatabaseSync(process.argv[1],{readOnly:true});
 console.log(db.prepare("PRAGMA quick_check").get());
 console.log(db.prepare("select count(*) c from projects").get());' ./backups/ddp-<TS>.sqlite
```

Backup berisi **nama & kegiatan orang** — perlakukan seperti data produksi (izin akses terbatas,
enkripsi bila disimpan jauh dari server).

## 4. Restore (sudah diuji; prosedur wajib urut)

> **Aturan keras:** **hentikan layanan lebih dulu.** Uji 22 Oktober menunjukkan restore saat layanan
> masih hidup menghasilkan `wrong # of entries in index idx_gate_notes_project_id` (SQLite menolak
> konsistensi file karena proses yang berjalan masih memegang handle + `-wal`), dan perubahan
> sesudahnya masuk ke file lama yang sudah dipindahkan. Jangan pernah melakukan ini.


**Restore native (diuji):**

```bash
cd apps/ddp-project-control
# 1. berhenti (systemctl stop ddp-project-control  /  docker compose stop)
# 2. lipat WAL ke file utama SEBELUM menyalin: transaksi terakhir bisa masih ada di -wal,
#    sedangkan restore.sh hanya menyelamatkan ddp.sqlite (tanpa -wal) sebagai pre-restore
DATA_DIR=./data node -e 'const {DatabaseSync}=require("node:sqlite");
 new DatabaseSync(process.env.DATA_DIR+"/ddp.sqlite").exec("PRAGMA wal_checkpoint(TRUNCATE)")'
# 3. restore — database lama otomatis diselamatkan sebagai <db>.pre-restore-<ts>
bash scripts/restore.sh ./backups/ddp-20261022T054114Z.sqlite ./data
#    → Restored ... ; Previous database ... preserved as ...pre-restore-...
#    → ok        (PRAGMA quick_check)
rm -f ./data/ddp.sqlite-wal ./data/ddp.sqlite-shm   # sisa WAL milik database LAMA
# 4. jalankan ulang, lalu verifikasi isi
systemctl start ddp-project-control
curl -s http://localhost:3000/healthz
```

> **Soal `-wal`:** bila layanan berhenti tanpa penutupan rapi, transaksi yang sudah di-*commit* bisa
> masih berada di `ddp.sqlite-wal`. Menghapusnya **saat restore** memang diniatkan (isi database diganti
> isi backup), tetapi jangan pernah menghapusnya pada database yang ingin dipertahankan — uji 22
> Oktober: `rm ddp.sqlite-wal` tanpa restore membuang satu proyek yang baru dibuat, tanpa pesan error
> apa pun.

**Restore Docker volume (diuji):** setelah `docker compose down`, jalankan wadah sekali pakai dari
service yang sama. `docker compose run` otomatis memakai volume layanan (`ddp-sqlite:/data`); `-v`
hanya menambahkan folder backup dari host:

```bash
cd apps/ddp-project-control
BK=ddp-20261022T054657Z.sqlite      # berkas di ./backups
docker compose down
docker compose run --rm --no-deps -e BK="$BK" -v "$PWD/backups:/backup:ro" \
  --entrypoint sh ddp-project-control -c '
  set -e
  node -e "const{DatabaseSync}=require(\"node:sqlite\");new DatabaseSync(\"/data/ddp.sqlite\").exec(\"PRAGMA wal_checkpoint(TRUNCATE)\")"
  cp /data/ddp.sqlite "/data/ddp.sqlite.pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
  rm -f /data/ddp.sqlite-wal /data/ddp.sqlite-shm
  cp "/backup/$BK" /data/ddp.sqlite
  chown 1001:1001 /data/ddp.sqlite
  node -e "const{DatabaseSync}=require(\"node:sqlite\");const d=new DatabaseSync(\"/data/ddp.sqlite\",{readOnly:true});console.log(\"quick_check:\",d.prepare(\"PRAGMA quick_check\").get(),\"projects:\",d.prepare(\"select count(*) c from projects\").get())"'
docker compose up -d
```

Hasil uji 22 Oktober: native → 10 proyek/44 event kembali utuh dan server boot normal; Docker → 5
proyek sebelum restore menjadi **4 proyek** (isi backup), `quick_check: ok`, salinan
`ddp.sqlite.pre-restore-<ts>` tersimpan. Jangan hapus salinan pre-restore sampai instalasi dikonfirmasi
sehat. Pemeriksaan pasca-restore minimum: `healthz`, jumlah proyek (`/api/projects?limit=200`), dan
`PRAGMA quick_check`.

## 5. Logging (potongan yang perlu diketahui)

Aplikasi menulis **satu baris JSON per request ke stdout** (`server.js` `logRequest`):

```json
{"timestamp":"...","request_id":"req-...","method":"GET","path":"/api/projects","status":200,"duration_ms":12,"actor":"Operator Demo [operator]"}
```

- `LOG_LEVEL` **hanya** membedakan `info` (default) dan `silent` (menonaktifkan semua log). Nilai
  lain (`debug`, `warn`, `error`) diperlakukan seperti `info` — jangan mengandalkan level granular.
- Error ditulis ke stderr sebagai JSON (mis. `cleanup_failed`).
- **Rotasi tidak disediakan aplikasi** — serahkan ke lapisan bawah:
  - Docker: `docker logs` + logging driver (`json-file` + `max-size`, mis. `10m` `max-file: 3`);
  - systemd: journald (otomatis);
  - bare metal: `node server.js >> /var/log/ddp.jsonl 2>&1` + logrotate `copytruncate`.
- Baris log memuat `actor` — amati permintaan `403`/`401` untuk mendeteksi percobaan akses tidak sah.
- Password **tidak** pernah masuk log (body tidak dicatat); sesi terekam sebagai `ddp_session`, bukan
  nilainya.

## 6. Sesi & rotasi sesi

- Masa berlaku: `SESSION_TTL_SECONDS` (default 8 jam), cookie `ddp_session`.
- Pembersihan otomatis: `DELETE FROM sessions WHERE expires_at <= now` **tiap 5 menit**
  (`server.js:229`), jadi tabel sesi tidak tumbuh tanpa batas.
- **Rotasi paksa semua sesi** (mis. setelah dugaan kebocoran, atau bila akun demo dipindahkan):

```bash
node -e 'const {DatabaseSync}=require("node:sqlite");
 const db=new DatabaseSync(process.env.DATA_DIR+"/ddp.sqlite");
 console.log("dihapus:", db.prepare("DELETE FROM sessions").run().changes);'
# lalu restart layanan; semua pengguna harus login ulang
```

- Per sesi: `POST /api/auth/logout` (seluruh perangkat yang membawa cookie itu ikut keluar).
- Bila diberi HTTPS: `COOKIE_SECURE=true`. Di belakang proxy tanpa konfigurasi, cookie tetap
  diterima — tetapi `TRUSTED_ORIGINS` harus memuat origin browser bila aplikasi pernah diakses lintas
  origin.

## 7. Uji kesehatan & drill pemulihan (disarankan bulanan)

| Langkah | Perintah | Yang harus muncul |
| --- | --- | --- |
| Test otomatis | `npm test` | 39/39 lulus |
| Kesehatan | `curl -s localhost:3000/healthz` | `{"status":"ok",...}` |
| KPI terbaca | `curl -s -b c.txt localhost:3000/api/kpis` | angka `admin/fr/buffer/weekly` |
| Backup | skrip §3 + `quick_check` | `{"quick_check":"ok"}` |
| Restore di mesin/uji | langkah §4 pada data hantu | jumlah proyek kembali ke jumlah backup |
| Rotasi sesi | langkah §6 | semua sesi ter logout |

Catat setiap drill: waktu, data baseline, dan hasil. Drill pemulihan yang gagal adalah temuan — buka
`RUNBOOK-INSIDEN.md`.

## 8. Pintu darurat

Perintah yang sering dibutuhkan saat insiden (urutannya juga ada di `RUNBOOK-INSIDEN.md`):

```bash
docker compose stop                              # hentikan layanan (bila native: systemctl stop)
docker compose logs --tail 200 ddp-project-control   # lihat kejadian terakhir
bash scripts/restore.sh ./backups/<ts>.sqlite ./data  # pulihkan ke backup terakhir (layanan sudah stop)
```

Jangan mematikan proses berdasarkan nama perintah saja — pastikan yang dihentikan memang proses layanan
ini, bukan proses lain yang kebetulan sama.

## 9. Checklist sebelum operasional (ditujukan ke THEOFILUS)

- [ ] Layar login di UI (K1) — tanpa ini setiap pengguna memakai akun demo bersama
- [ ] Akun demo dimatikan/diganti untuk pemakaian nyata (K9)
- [ ] `SESSION_SECRET` dibersihkan dari `compose.yaml` (§1) atau benar-benar dipakai
- [ ] Reverse proxy + `COOKIE_SECURE=true` + `TRUSTED_ORIGINS` terpasang di target produksi
- [ ] Retensi backup & DB audit disepakati (ADR-003 + Q5)
- [ ] Insiden runbook (`RUNBOOK-INSIDEN.md`) diuji oleh Victor
- [ ] Sisa temuan yang harus menutup sebelum pilot: `close` dari gate mana pun (K2), bukti wajib pada
      `disetujui`/`terverifikasi` (K4), tombol eskalasi tanpa alasan (I1), KPI blocker age (I5)