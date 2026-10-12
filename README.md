# 📚 Portal CBT (Computer Based Test) Multi-Platform

Sistem Ujian Berbasis Komputer (**Computer Based Test / CBT**) modern yang terintegrasi penuh antara:
1. **Web Portal Terpadu (Admin & Guru)**: Berbasis Node.js & Express dengan antarmuka web responsif.
2. **Aplikasi Mobile (Siswa)**: Berbasis Flutter SDK untuk Android dengan sistem anti-curang (*Kiosk Mode*, deteksi kecurangan, dan sinkronisasi offline).

---

## 🌐 Informasi Live Deployment (Production)

| Layanan | URL / Endpoint | Keterangan |
| :--- | :--- | :--- |
| **Portal Web (Admin & Guru)** | [https://backend-cbt.solusibersamaa.com](https://backend-cbt.solusibersamaa.com) | Akses browser langsung tanpa hash routing |
| **Download APK Mobile (Android)** | [https://backend-cbt.solusibersamaa.com/downloads/cbt-mobile.apk](https://backend-cbt.solusibersamaa.com/downloads/cbt-mobile.apk) | APK rilis otomatis tersambung ke server live |
| **REST API Base URL** | `https://backend-cbt.solusibersamaa.com/api` | Endpoint komunikasi JSON aman (HTTPS + JWT) |

> 💡 **Fitur Baru APK:** Aplikasi Android secara *default* sudah mengarah langsung ke domain live `backend-cbt.solusibersamaa.com`. Siswa **tidak perlu lagi memasukkan IP server secara manual** saat melakukan login.

---

## 🛠️ Arsitektur & Stack Teknologi

| Komponen | Teknologi | Keterangan & Modul Utama |
| :--- | :--- | :--- |
| **Backend Framework** | Node.js, Express.js | Arsitektur MVC bertingkat (*Routes, Controllers, Services, Repositories*) |
| **Database Engine** | MySQL (InnoDB) | Transaksi ACID, skema relasional 18 tabel dengan proteksi *foreign key* aman |
| **Keamanan & Auth** | JWT & Bcrypt | Dual token (Access + Refresh), Rate Limiter, Helmet, CORS, XSS Protection |
| **Frontend Portal** | Vanilla JS, HTML5, CSS3 Modern | SPA responsif (*Clean CSS Variable System*), Dark Mode & Kontras Tinggi |
| **Mobile Client** | Flutter SDK (Dart) | *Clean Architecture*, SQLite offline caching, Kiosk Lock, Anti-curang |

---

## 📁 Struktur Direktori Repositori

```text
PortalCBT-Mobile/
├── cbt_backend/                 ← Server REST API & Web Portal
│   ├── server.js                ← Entrypoint Express server & rute download APK
│   ├── src/
│   │   ├── config/              ← Konfigurasi koneksi MySQL pool
│   │   ├── controllers/         ← Controller (Auth, Master, Exam, Proctoring, dll.)
│   │   ├── database/            ← Script migrasi skema database (Phase 1 s/d 11)
│   │   ├── middlewares/         ← Auth JWT, Role Validator, Error Handler
│   │   ├── repositories/        ← Data Access Layer (Repository pattern)
│   │   ├── routes/              ← Endpoint admin, guru, siswa, profil, notifikasi
│   │   ├── services/            ← Business logic & kalkulasi analitik
│   │   └── utils/               ← JWT helper, ErrorCodes, ApiResponse formatters
│   └── public/
│       ├── index.html           ← Halaman antarmuka Web Portal
│       ├── app.js               ← Logika UI, manajemen state, dan AJAX handler
│       └── downloads/           ← Direktori file unduhan APK mobile
│
├── cbt_mobile_app/              ← Aplikasi Mobile Siswa (Flutter)
│   ├── android/                 ← Konfigurasi native Android & Gradle
│   ├── lib/
│   │   ├── core/                ← Network client, theme, storage, anti-cheat
│   │   │   ├── constants/       ← ApiEndpoints (defaultHost: backend-cbt.solusibersamaa.com)
│   │   │   ├── network/         ← ApiClient terstandarisasi dengan fallback HTTPS
│   │   │   └── storage/         ← SessionStorage dengan proteksi host otomatis
│   │   ├── data/                ← Datasources, Models, dan Repositories
│   │   ├── domain/              ← Entities & Use Cases
│   │   ├── presentation/        ← Halaman UI (Login, Dashboard, Ujian, Kiosk Lock)
│   │   └── services/            ← ApiService & SQLite Helper
│   └── pubspec.yaml             ← Konfigurasi dependencies Flutter
│
└── README.md                    ← Dokumentasi teknis proyek
```

---

## ✨ Fitur-Fitur Utama Sistem

### 👨‍💼 1. Modul Administrator
* **Ringkasan Real-Time**: Statistik total siswa, guru, kelas, dan mata pelajaran secara terpusat.
* **Manajemen Guru & Penempatan**: Penambahan akun pengajar serta *workspace assignment* (kelas & mata pelajaran) dengan verifikasi relasi yang aman.
* **Manajemen Siswa**: Tambah/edit/hapus siswa, pencarian NIS, dan cetak kartu ujian peserta.
* **Manajemen Kelas & Mapel**: Pengelolaan data akademik dengan sinkronisasi langsung ke bank soal.
* **Aksesibilitas & Tema**: Pengaturan Dark Mode, mode kontras tinggi, dan ukuran teks.

### 👩‍🏫 2. Modul Guru (Workspace Pengajar)
* **Penyusunan Bank Soal**: Buat paket soal untuk kelas & mapel yang ditugaskan, dukung pilihan ganda (PG) 5 opsi (A–E) dan soal essay.
* **Analisis Psikometrik Butir Soal**: Kalkulasi tingkat kesukaran (*P*), daya pembeda (*D 27% Upper/Lower*), dan efektivitas distraktor.
* **Peluncuran & Kontrol Sesi Ujian**: Pengaturan durasi, token unik, pengacakan nomor soal/opsi jawaban, dan batas toleransi pelanggaran.
* **Live Proctoring & Monitoring**: Memantau progres pengerjaan ujian per siswa secara real-time serta fitur *unlock request* bagi siswa yang terkunci karena keluar aplikasi.
* **Penilaian Manual Essay & Rekap**: Antarmuka koreksi jawaban uraian dengan pembobotan nilai dan penerbitan sertifikat digital.

### 👨‍🎓 3. Modul Siswa (Mobile App Flutter)
* **Zero-Configuration Login**: Terhubung otomatis ke server backend produksi tanpa input manual IP address.
* **Ujian Anti-Curang (Proctoring Kiosk)**: Deteksi otomatis ketika aplikasi berpindah ke latar belakang (*background*), *split screen*, atau *screenshot*.
* **Sinkronisasi Offline (SQLite)**: Jawaban tersimpan aman di database lokal HP dan otomatis terunggah ke server ketika koneksi internet stabil.
* **Pengerjaan Fleksibel**: Ragam penanda soal ragu-ragu, navigasi nomor butir soal, hitung mundur durasi, serta tampilan hasil instan (jika diaktifkan oleh guru).
* **Kartu Peserta & Sertifikat**: Unduh kartu ujian digital dengan QR Code verifikasi.

---

## 🔐 Akun Akses Default

| Peran (Role) | Username / NIP / NIS | Password | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Hak penuh seluruh modul master data |
| **Guru (Pengajar)** | `guru` / `19850101` | `guru123` | Kelola bank soal, sesi ujian, & monitoring |
| **Siswa 1** | `2026001` | `2026001` | Akses ujian kelas XII RPL 1 |
| **Siswa 2** | `2026002` | `2026002` | Akses ujian kelas XII RPL 2 |

---

## 🚀 Panduan Menjalankan Secara Lokal (Development)

### 1. Menjalankan Backend & Web Portal
```bash
# 1. Pindah ke direktori backend
cd cbt_backend

# 2. Pasang dependensi Node.js
npm install

# 3. Konfigurasi file lingkungan (.env)
# Sesuaikan DB_HOST, DB_USER, DB_PASSWORD, dan DB_NAME ke MySQL lokal

# 4. Jalankan migrasi database
node src/database/migrate.js

# 5. Jalankan server backend
npm start
```
Buka browser Anda di `http://localhost:3000`.

### 2. Menjalankan Aplikasi Mobile Flutter
```bash
# 1. Pindah ke direktori mobile app
cd cbt_mobile_app

# 2. Pasang dependensi Flutter
flutter pub get

# 3. Jalankan aplikasi pada emulator atau perangkat fisik Android
flutter run
```

---

## 📦 Panduan Build APK Android
Untuk mengompilasi APK mandiri:
```bash
cd cbt_mobile_app
flutter build bundle
```
File APK yang telah ter-compile dapat diunduh langsung oleh pengguna melalui tombol **"Download Aplikasi Android"** di halaman login web portal.

---

## 📄 Lisensi
Hak Cipta © 2026 CBT Mobile & Web Portal Solution. Seluruh hak cipta dilindungi.
