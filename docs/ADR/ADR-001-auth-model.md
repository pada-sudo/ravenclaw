# ADR-001: Model Autentikasi dan Otorisasi RavenClaw

## Status
Diusulkan — menunggu persetujuan Pedro sebelum final.

## Konteks
Aplikasi RavenClaw adalah alat governance internal untuk workflow proyek DDP Telkom. Baseline audit menemukan seluruh endpoint `/api/*` terbuka tanpa autentikasi dan otorisasi (B1). Karena aplikasi ini mencatat approval gate dan eskalasi, jejak audit tidak bisa dipercaya tanpa identitas pelaku yang jelas.

## Keputusan
Menggunakan **server-side session cookie** untuk autentikasi:
- Cookie `HttpOnly`, `SameSite=Strict`, flag `Secure` opsional via env `COOKIE_SECURE`.
- Sesi disimpan di tabel SQLite `sessions` dengan token kriptografis acak dan waktu kedaluwarsa.
- Password disimpan dengan `crypto.scryptSync` (salt + derived key) — tanpa dependency eksternal.
- Setiap endpoint `/api/*` (kecuali `/api/auth/login`) memerlukan sesi valid; tanpanya mengembalikan `401`.
- Otorisasi berbasis peran dengan matriks kewenangan tetap di kode.

## Alternatif yang dipertimbangkan
1. **JWT stateless** — ditolak karena revoke token memerlukan daftar hitam atau rotasi secret; untuk aplikasi internal dengan sedikit pengguna, server-side session lebih sederhana dan mudah di-revoke lewat tabel.
2. **OAuth2/SAML** — ditolak karena aplikasi ini tanpa dependency eksternal dan belum ada IdP yang ditetapkan; dapat ditambahkan nanti sebagai SSO layer di reverse proxy.
3. **Bearer token** — ditolak karena rentan terhadap XSS bila disimpan di localStorage; cookie HttpOnly lebih aman.

## Konsekuensi
- Perlu tabel `users` dan `sessions` (migrasi 003).
- Login memerlukan query ke SQLite; performa tetap cepat untuk skala internal.
- Logout dan revoke sesi dapat dilakukan dengan menghapus baris di `sessions`.
- Sesuai dengan batasan "tanpa dependency eksternal".

## Catatan koordinasi
- Kontrak sesi (cookie name, TTL, respons 401/403) perlu disampaikan ke Fajar untuk integrasi UI.
- Nama peran diselaraskan dengan hasil George/Adit bila tersedia; sementara menggunakan peran minimal: operator, pm, approver, auditor.
