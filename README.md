# Gerah — Penasihat Heat Stress (MVP)

Aplikasi peringatan panas untuk mandor, pekerja luar ruang, dan guru PJOK di Bandung.
Satu basis kode **React Native + Expo** untuk Android, iOS, dan web (desktop Windows/macOS/Linux
lewat browser/PWA), dengan backend **FastAPI + PostgreSQL** yang dijalankan di Docker.

> Semua angka adalah **estimasi model** dari prakiraan BMKG + Open-Meteo, bukan pengukuran WBGT.

## Struktur

```
gerah/
├── docker-compose.yml        # stack produksi: db, api, worker, web, proxy
├── docker-compose.dev.yml    # override dev: auto-reload, port terbuka, data demo
├── .env.example              # registry, password DB, domain
├── Makefile                  # make up / dev / test / release / deploy
├── proxy/Caddyfile           # /api/* → api, sisanya → web; HTTPS otomatis bila pakai domain
├── .github/workflows/        # CI: tes → build multi-arch → push ke GHCR saat tag v*
├── services/api/             # FastAPI + worker (satu image, dua perintah)
│   ├── app/heat.py           # heat index NWS + WBGT Liljegren (pywbgt), versi matahari & teduh
│   ├── app/risk.py           # 5 level, ambang kerja vs sekolah, saran ID + Sunda
│   ├── app/ingest.py         # BMKG (adm4, ≤60 req/menit) + Open-Meteo → fusi → Postgres
│   ├── app/worker.py         # penjadwal (default tiap 60 menit)
│   ├── app/main.py           # REST API
│   └── locations.json        # daftar kelurahan awal (kode Kemendagri adm4)
└── apps/mobile/              # Expo Router (Android/iOS/web)
    ├── src/app/              # index (pilih peran & lokasi), beranda, timeline,
    │                         # checklist, p3k, laporan, profil
    ├── src/lib/              # api, penyimpanan lokal, pengingat (notifikasi lokal)
    ├── Dockerfile            # expo export web → nginx
    └── eas.json              # profil build APK/AAB/IPA via EAS
```

## Menjalankan

```bash
cp .env.example .env          # isi REGISTRY dan POSTGRES_PASSWORD
make up                       # → http://localhost:8080 (web) dan http://localhost:8080/api/docs
make logs                     # lihat log api & worker
```

Mode pengembangan (API auto-reload, data demo bila internet tidak tersedia):

```bash
make dev                      # API juga di http://localhost:8000/docs
cd apps/mobile && npm install
EXPO_PUBLIC_API_URL=http://<IP-laptop>:8080/api npx expo start   # scan QR di Expo Go
```

## Push ke registry setiap ada versi baru

```bash
make login                    # sekali saja (GHCR: pakai GitHub token dengan scope write:packages)
make release TAG=0.1.0        # build api+web → tes → push :0.1.0 dan :latest
```

Atau otomatis lewat GitHub Actions: `git tag v0.1.0 && git push --tags`
→ image `ghcr.io/<owner>/gerah-api` dan `gerah-web` untuk amd64 + arm64.

Di server (cukup salin `docker-compose.yml`, `proxy/`, `.env`):

```bash
make deploy TAG=0.1.0         # pull image lalu up -d, tanpa build di server
```

Hanya **dua image** yang di-push: `gerah-api` (dipakai service `api` dan `worker`) dan `gerah-web`.
Postgres dan Caddy memakai image resmi.

## Android & iOS

Aplikasi mobile **tidak berjalan di dalam container**. Bangun dengan EAS:

```bash
cd apps/mobile
npx eas-cli@latest build -p android --profile preview      # APK untuk uji di HP
npx eas-cli@latest build -p all --profile production      # AAB (Play Store) + IPA (App Store)
```

Ganti `EXPO_PUBLIC_API_URL` di `eas.json` ke domain server Anda. Build iOS butuh akun Apple Developer
(US$99/tahun); EAS membangunnya di cloud sehingga tidak wajib punya Mac.

## Endpoint utama

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | status & waktu ingest terakhir |
| `GET /api/v1/locations` | daftar kelurahan |
| `GET /api/v1/forecast/{adm4}?role=mandor&workload=berat&acclimatized=true` | level sekarang, saran, puncak 24 jam, timeline per jam |
| `GET /api/v1/weekly/{adm4}` | jam kerja per level 7 hari terakhir |
| `GET /api/v1/heat-index?t=32&rh=60` | kalkulator heat index |
| `GET /api/v1/meta` | ambang, warna, disclaimer, atribusi |

## Peran pengguna dan tabel ambang

Onboarding dua langkah: pilih kelompok, lalu peran. Satu peran = satu tabel ambang WBGT (°C, batas bawah
Waspada/Siaga/Bahaya/Ekstrem). Semua angka adalah heuristik desain, bukan nilai regulasi.

| Kelompok | Peran | Tabel | Ambang |
|---|---|---|---|
| 🔨 Kerja | 👷 Mandor/K3, 🧱 Tukang & galian | kerja sedang (opsi berat) | 28 / 30 / 31,5 / 33 |
| 🔨 Kerja | 🧹 Petugas kebersihan | kerja berat | 26,5 / 28,5 / 30 / 31,5 |
| 🔨 Kerja | 🛒 Pedagang & PKL, 🚦 Penjaga jalan & keamanan | kerja ringan | 29,5 / 31 / 32 / 33 |
| 🎒 Sekolah & olahraga | 🏫 Guru PJOK, 🎒 Pelajar | sekolah (Jepang) | 25 / 28 / 31 / 33 |
| 🎒 Sekolah & olahraga | 🏃 Olahraga & komunitas | olahraga (JSPO) | 21 / 25 / 28 / 31 |
| 🏠 Keluarga & umum | 👪 Pendamping keluarga | sensitif | 25 / 28 / 31 / 33 |
| 🏠 Keluarga & umum | 🚶 Warga umum & wisatawan | umum (myENV) | 31 / 32 / 33 / 35 |

Tabel kerja diturunkan dari NAB ISBB Permenaker 5/2018 per beban kerja. Belum teraklimatisasi = naik satu
level (kerja & olahraga). Peran pelajar tidak memakai profil kesehatan. Peran lama `pekerja` otomatis
menjadi `tukang`. Ojek online/kurir sengaja tidak disertakan. Petani & peternak (indeks THI) menunggu
perluasan wilayah ke Kab. Bandung/Bandung Barat.

## Privasi (UU PDP No. 27/2022)

- Server hanya menerima **kode kelurahan, peran, dan beban kerja**. Koordinat GPS diubah ke kelurahan terdekat di perangkat.
- Profil kesehatan (hamil, haid, lansia/penyakit kronis) **disimpan hanya di perangkat** dan dipakai untuk menaikkan level secara lokal.
- Checklist mandor tersimpan di perangkat.

## Menambah kelurahan

Tambahkan entri ke `services/api/locations.json` (kode adm4 Kemendagri). Nama dan koordinat diperbarui
otomatis dari respons BMKG. Untuk seluruh 151 kelurahan Kota Bandung, worker butuh ±3 menit per siklus
BMKG karena jeda 1,1 detik per permintaan.

## Atribusi data

- Prakiraan cuaca: **BMKG** (wajib dicantumkan).
- Radiasi matahari, UV, tekanan: **Open-Meteo** (CC BY 4.0). Gratis hanya untuk penggunaan non-komersial.
- WBGT: model Liljegren et al. (2008) melalui paket `pywbgt`.

## Yang masih harus divalidasi

- Ambang level adalah heuristik desain; kalibrasi dengan sensor WBGT saat pilot.
- Terjemahan bahasa Sunda adalah draf; validasi oleh penutur asli.
- Tabel NAB Permenaker 5/2018 baris 0–25% perlu dicek ke lampiran resmi JDIH Kemnaker.
