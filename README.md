# DDP Project Control

Web app untuk workflow bisnis project DDP Telkom — jalur **First Responder** dan
**Buffer**, gate **G0–G5**, SOP-01 s/d SOP-07.

Status: **baseline as-received**, belum diperbaiki. Hasil crosscheck per bagian
dan per kapabilitas ada di
`docs/use-cases/ddp-project-control/AUDIT-2026-10-22-baseline.md`.

## Menjalankan

```bash
cd apps/ddp-project-control
node server.js            # http://localhost:3000 (PORT bisa di-override)
```

Butuh Node **>= 24** (`node:sqlite`). Tidak ada dependency eksternal — tanpa
`npm install`.

Data tersimpan di `data/ddp.sqlite` (dibuat otomatis, di-*seed* dengan 3 proyek
contoh bila kosong). Direktori `data/` tidak di-commit.

## Struktur

| File | Isi |
| --- | --- |
| `server.js` | HTTP server + router + seluruh logika domain, skema DB, seed |
| `public/index.html` | Shell SPA (sidebar + `<main>`) |
| `public/app.js` | Seluruh UI: router hash, render halaman, modal, tabel |
| `public/style.css` | Design token (CSS variable) + komponen visual |

## Peta endpoint

Baca `GET /api/meta` untuk daftar deliverable First Responder, checklist Buffer,
lead time pengadaan, dan urutan gate per jalur.

## Catatan

Aplikasi ini **belum** punya autentikasi, otorisasi, test, maupun pipeline
deploy. Jangan dipakai dengan data produksi sebelum item P0/P1 pada audit
diatas selesai.
