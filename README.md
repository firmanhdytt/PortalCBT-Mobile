# 📚 Sistem CBT (Computer Based Test)

Aplikasi ujian berbasis komputer (CBT) yang terdiri dari:
- **Web Portal** untuk Guru & Admin (berjalan di browser)
- **Aplikasi Mobile** Flutter untuk Siswa

---

## 📁 Struktur Folder

```
cbt_mobile_app/
├── cbt_backend/          ← Server + Web Portal (Node.js + Express)
│   ├── server.js         ← File utama server API
│   ├── database.js       ← Helper database JSON
│   ├── cbt_db.json       ← File database (JSON-based)
│   ├── public/
│   │   ├── index.html    ← Halaman web portal Guru & Admin
│   │   └── app.js        ← Logika JavaScript portal
│   ├── package.json
│   └── node_modules/
│
├── cbt_mobile_app/       ← Aplikasi Flutter untuk Siswa
│   ├── lib/
│   │   ├── main.dart
│   │   ├── views/
│   │   │   ├── login_page.dart
│   │   │   ├── dashboard_page.dart
│   │   │   └── exam_page.dart
│   │   └── services/
│   │       ├── api_service.dart
│   │       └── db_helper.dart
│   └── pubspec.yaml
│
├── assets/               ← Gambar referensi UI
├── analisis_sistem.md    ← Dokumentasi analisis sistem
├── perancangan_database.md ← Dokumentasi skema database
└── perancangan_ui.md     ← Dokumentasi rancangan UI
```

---

## 🚀 Cara Menjalankan Web Portal (Guru & Admin)

> **Syarat:** Node.js sudah terinstall di komputer Anda.

### Langkah-langkah:

**1. Buka terminal / Command Prompt**

**2. Masuk ke folder backend:**
```bash
cd C:\Users\LENOVO\.gemini\antigravity\scratch\cbt_mobile_app\cbt_backend
```

**3. Install dependencies (hanya pertama kali):**
```bash
npm install
```

**4. Jalankan server:**
```bash
npm start
```

**5. Buka browser dan akses:**
```
http://localhost:3000
```

---

## 🔐 Akun Login Default

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `admin`  |
| Guru  | `guru`   | `guru`   |
| Siswa | `siswa`  | `siswa`  |
| Siswa | `siswa2` | `siswa2` |

> **Catatan:** Admin dapat menambahkan siswa baru dengan password kustom melalui halaman **Data Siswa**.

---

## 📱 Cara Menjalankan Aplikasi Mobile Flutter (Siswa)

> **Syarat:** Flutter SDK sudah terinstall & server backend sedang berjalan.

### Langkah-langkah:

**1. Buka terminal dan masuk ke folder Flutter:**
```bash
cd C:\Users\LENOVO\.gemini\antigravity\scratch\cbt_mobile_app\cbt_mobile_app
```

**2. Install Flutter dependencies:**
```bash
flutter pub get
```

**3. Jalankan aplikasi (dengan emulator/device aktif):**
```bash
flutter run
```

> **Pastikan IP server** di file `lib/services/api_service.dart` sudah sesuai dengan IP komputer Anda jika menggunakan perangkat fisik.

---

## ✨ Fitur yang Tersedia

### 👨‍💼 Admin
- ✅ Tambah / hapus data siswa (dengan password kustom)
- ✅ Tambah kelas & mata pelajaran

### 👨‍🏫 Guru
- ✅ Buat paket bank soal (PG & Essay)
- ✅ Edit / hapus butir soal
- ✅ Rilis & kelola sesi ujian
- ✅ **Hapus ujian yang sudah mati/tidak aktif**
- ✅ Live monitoring pengerjaan siswa
- ✅ Koreksi jawaban essay

### 👨‍🎓 Siswa (Web & Mobile)
- ✅ Login dengan NIS & password
- ✅ Lihat daftar ujian aktif
- ✅ Kerjakan soal PG & Essay
- ✅ Auto-save jawaban setiap 10 detik
- ✅ Lihat hasil setelah selesai ujian
