# Perancangan Database Lengkap (Server & Lokal Client) - CBT Mobile

Aplikasi CBT (Computer Based Test) mobile berbasis Flutter memiliki dua arsitektur basis data:
1.  **Database Server (PostgreSQL/MySQL)**: Menyimpan seluruh data master (pengguna, kelas, bank soal), data transaksional ujian nasional/sekolah, monitoring, dan rekapitulasi nilai akhir.
2.  **Database Lokal Client (SQLite)**: Menyimpan cache ujian aktif dan lembar jawaban sementara pada perangkat mobile siswa untuk mendukung pengerjaan luring (offline resiliency).

---

## BAGIAN 1: Desain Database Server (PostgreSQL / MySQL)

Database server mengelola seluruh relasi sistem CBT secara lengkap untuk semua aktor: **Siswa, Guru, dan Administrator**.

### 1. Tabel: `users` (Kredensial & Peran Akses)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID unik pengguna |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Username login |
| `password` | VARCHAR(255) | NOT NULL | Password terenkripsi (bcrypt) |
| `role` | VARCHAR(15) | CHECK (admin, guru, siswa) | Peran akses pengguna |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu pendaftaran |

### 2. Tabel: `kelas` (Manajemen Kelas)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID kelas |
| `nama_kelas`| VARCHAR(20) | UNIQUE, NOT NULL | Nama kelas (misal: XII RPL 1) |

### 3. Tabel: `mata_pelajaran` (Mata Pelajaran)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID mata pelajaran |
| `kode_mapel`| VARCHAR(10) | UNIQUE, NOT NULL | Kode mata pelajaran (misal: INF-12) |
| `nama_mapel`| VARCHAR(100)| NOT NULL | Nama mata pelajaran |

### 4. Tabel: `siswa` (Data Profil Siswa)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID siswa |
| `user_id` | INT | FOREIGN KEY (users.id) | Kunci relasi login siswa |
| `nis` | VARCHAR(20) | UNIQUE, NOT NULL | Nomor Induk Siswa |
| `nama` | VARCHAR(100)| NOT NULL | Nama lengkap siswa |
| `kelas_id` | INT | FOREIGN KEY (kelas.id) | Kelas tempat siswa belajar |

### 5. Tabel: `guru` (Data Profil Guru)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID guru |
| `user_id` | INT | FOREIGN KEY (users.id) | Kunci relasi login guru |
| `nip` | VARCHAR(20) | UNIQUE, NOT NULL | Nomor Induk Pegawai |
| `nama` | VARCHAR(100)| NOT NULL | Nama lengkap guru |

### 6. Tabel: `bank_soal` (Paket Soal)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID paket soal |
| `mapel_id` | INT | FOREIGN KEY (mata_pelajaran.id)| Terkait mata pelajaran apa |
| `guru_id` | INT | FOREIGN KEY (guru.id) | Pembuat bank soal |
| `judul` | VARCHAR(100)| NOT NULL | Judul bank soal |

### 7. Tabel: `soal` (Butir Soal Ujian)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID unik soal |
| `bank_soal_id`| INT | FOREIGN KEY (bank_soal.id) | Terkait paket soal mana |
| `jenis_soal`| VARCHAR(10) | CHECK (PG, ESSAY) | Format Pilihan Ganda / Essay |
| `teks_soal` | TEXT | NOT NULL | Deskripsi pertanyaan |
| `gambar_url`| VARCHAR(255)| - | Lampiran gambar di server storage |
| `bobot` | NUMERIC(5,2)| DEFAULT 1.00 | Nilai maksimal soal |

### 8. Tabel: `pilihan_jawaban` (Opsi Soal Pilihan Ganda)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID unik pilihan jawaban |
| `soal_id` | INT | FOREIGN KEY (soal.id) | Terkait soal mana |
| `teks_pilihan`| TEXT | NOT NULL | Konten opsi jawaban |
| `label` | CHAR(1) | NOT NULL | Label abjad (A, B, C, D, E) |
| `is_kunci` | BOOLEAN | DEFAULT FALSE | Penanda kunci jawaban ujian |

### 9. Tabel: `ujian` (Jadwal & Token Sesi Ujian)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID sesi ujian |
| `nama_ujian`| VARCHAR(100)| NOT NULL | Judul sesi ujian (misal: UTS Ganjil) |
| `bank_soal_id`| INT | FOREIGN KEY (bank_soal.id) | Kumpulan soal yang digunakan |
| `kelas_id` | INT | FOREIGN KEY (kelas.id) | Ditujukan untuk kelas apa |
| `token` | VARCHAR(10) | UNIQUE, NOT NULL | Token verifikasi masuk ujian |
| `durasi_menit`| INT | NOT NULL | Batas waktu pengerjaan |
| `waktu_mulai`| TIMESTAMP | NOT NULL | Tanggal & jam ujian dimulai |
| `waktu_selesai`| TIMESTAMP| NOT NULL | Batas tanggal & jam ujian ditutup |
| `is_aktif` | BOOLEAN | DEFAULT TRUE | Status rilis token aktif |

### 10. Tabel: `jawaban_peserta` (Rekaman Jawaban Siswa)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | BIGSERIAL | PRIMARY KEY | ID record jawaban |
| `siswa_id` | INT | FOREIGN KEY (siswa.id) | Identitas siswa pengerja |
| `ujian_id` | INT | FOREIGN KEY (ujian.id) | Terkait sesi ujian mana |
| `soal_id` | INT | FOREIGN KEY (soal.id) | Soal yang dijawab |
| `pilihan_jawaban_id`| INT | FOREIGN KEY (pilihan_jawaban.id)| Opsi dipilih (NULL untuk Essay) |
| `teks_jawaban_essay`| TEXT | - | Isi jawaban essay (NULL untuk PG) |
| `is_ragu` | BOOLEAN | DEFAULT FALSE | Status bendera ragu-ragu |
| `waktu_dijawab`| TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu klik simpan jawaban |
| `nilai_manual`| NUMERIC(5,2)| - | Nilai guru (khusus Essay) |

### 11. Tabel: `hasil_ujian` (Kalkulasi Nilai Akhir)
| Nama Kolom | Tipe Data | Constraint | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | SERIAL | PRIMARY KEY | ID hasil ujian |
| `siswa_id` | INT | FOREIGN KEY (siswa.id) | Identitas siswa |
| `ujian_id` | INT | FOREIGN KEY (ujian.id) | Sesi ujian yang dikerjakan |
| `jumlah_benar`| INT | DEFAULT 0 | Jumlah jawaban PG benar |
| `jumlah_salah`| INT | DEFAULT 0 | Jumlah jawaban PG salah |
| `nilai_akhir`| NUMERIC(5,2)| DEFAULT 0.00 | Total akumulasi nilai akhir |
| `waktu_selesai`| TIMESTAMP| DEFAULT CURRENT_TIMESTAMP | Waktu klik selesaikan ujian |

---

## BAGIAN 2: Desain Database Lokal Client (SQLite - Flutter)

Database SQLite pada perangkat mobile bertindak sebagai cache per sesi ujian untuk satu akun **Siswa**. Data guru tidak disimpan secara lokal di mobile karena guru memantau secara real-time via backend web dashboard/app.

| Tabel Lokal SQLite | Kegunaan | Relasi dari Server |
| :--- | :--- | :--- |
| **`siswa`** | Profil siswa yang login di aplikasi mobile | Satu baris (dari server `siswa` & `kelas`) |
| **`ujian`** | Sesi ujian yang saat ini dimasuki siswa | Satu baris (dari server `ujian`) |
| **`soal`** | Kumpulan butir soal ujian siswa tersebut | Kumpulan baris (dari server `soal`) |
| **`pilihan_jawaban`** | Opsi PG untuk seluruh soal yang diunduh | Kumpulan baris (dari server `pilihan_jawaban`) |
| **`jawaban_peserta`** | Penyimpanan jawaban lokal sebelum di-sync | Jawaban aktif siswa (Sinkronisasi ke server) |

---

## BAGIAN 3: Script DDL Lengkap

### A. DDL Server (PostgreSQL)
```sql
-- Kategori Pengguna & Akses
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(15) NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kelas (
    id SERIAL PRIMARY KEY,
    nama_kelas VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE mata_pelajaran (
    id SERIAL PRIMARY KEY,
    kode_mapel VARCHAR(10) UNIQUE NOT NULL,
    nama_mapel VARCHAR(100) NOT NULL
);

-- Profil Siswa & Guru
CREATE TABLE siswa (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nis VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    kelas_id INT NOT NULL REFERENCES kelas(id)
);

CREATE TABLE guru (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nip VARCHAR(20) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL
);

-- Paket Soal
CREATE TABLE bank_soal (
    id SERIAL PRIMARY KEY,
    mapel_id INT NOT NULL REFERENCES mata_pelajaran(id),
    guru_id INT NOT NULL REFERENCES guru(id),
    judul VARCHAR(100) NOT NULL
);

CREATE TABLE soal (
    id SERIAL PRIMARY KEY,
    bank_soal_id INT NOT NULL REFERENCES bank_soal(id) ON DELETE CASCADE,
    jenis_soal VARCHAR(10) NOT NULL CHECK (jenis_soal IN ('PG', 'ESSAY')),
    teks_soal TEXT NOT NULL,
    gambar_url VARCHAR(255),
    bobot NUMERIC(5,2) DEFAULT 1.00
);

CREATE TABLE pilihan_jawaban (
    id SERIAL PRIMARY KEY,
    soal_id INT NOT NULL REFERENCES soal(id) ON DELETE CASCADE,
    teks_pilihan TEXT NOT NULL,
    label CHAR(1) NOT NULL,
    is_kunci BOOLEAN DEFAULT FALSE
);

-- Sesi Ujian & Lembar Jawaban
CREATE TABLE ujian (
    id SERIAL PRIMARY KEY,
    nama_ujian VARCHAR(100) NOT NULL,
    bank_soal_id INT NOT NULL REFERENCES bank_soal(id),
    kelas_id INT NOT NULL REFERENCES kelas(id),
    token VARCHAR(10) UNIQUE NOT NULL,
    durasi_menit INT NOT NULL,
    waktu_mulai TIMESTAMP NOT NULL,
    waktu_selesai TIMESTAMP NOT NULL,
    is_aktif BOOLEAN DEFAULT TRUE
);

CREATE TABLE jawaban_peserta (
    id BIGSERIAL PRIMARY KEY,
    siswa_id INT NOT NULL REFERENCES siswa(id),
    ujian_id INT NOT NULL REFERENCES ujian(id),
    soal_id INT NOT NULL REFERENCES soal(id),
    pilihan_jawaban_id INT REFERENCES pilihan_jawaban(id),
    teks_jawaban_essay TEXT,
    is_ragu BOOLEAN DEFAULT FALSE,
    waktu_dijawab TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nilai_manual NUMERIC(5,2)
);

CREATE TABLE hasil_ujian (
    id SERIAL PRIMARY KEY,
    siswa_id INT NOT NULL REFERENCES siswa(id),
    ujian_id INT NOT NULL REFERENCES ujian(id),
    jumlah_benar INT DEFAULT 0,
    jumlah_salah INT DEFAULT 0,
    nilai_akhir NUMERIC(5,2) DEFAULT 0.00,
    waktu_selesai TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(siswa_id, ujian_id)
);
```

### B. DDL Lokal Client (SQLite)
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS siswa (
    id INTEGER PRIMARY KEY,
    nis TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    kelas_id INTEGER NOT NULL,
    nama_kelas TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ujian (
    id INTEGER PRIMARY KEY,
    nama_ujian TEXT NOT NULL,
    durasi_menit INTEGER NOT NULL,
    token TEXT NOT NULL,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'ongoing', 'completed'))
);

CREATE TABLE IF NOT EXISTS soal (
    id INTEGER PRIMARY KEY,
    ujian_id INTEGER NOT NULL,
    jenis_soal TEXT NOT NULL CHECK (jenis_soal IN ('PG', 'ESSAY')),
    teks_soal TEXT NOT NULL,
    gambar_url TEXT,
    gambar_lokal TEXT,
    bobot REAL DEFAULT 1.0,
    nomor_urut INTEGER NOT NULL,
    FOREIGN KEY (ujian_id) REFERENCES ujian (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pilihan_jawaban (
    id INTEGER PRIMARY KEY,
    soal_id INTEGER NOT NULL,
    teks_pilihan TEXT NOT NULL,
    label TEXT NOT NULL,
    FOREIGN KEY (soal_id) REFERENCES soal (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS jawaban_peserta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siswa_id INTEGER NOT NULL,
    ujian_id INTEGER NOT NULL,
    soal_id INTEGER NOT NULL,
    pilihan_jawaban_id INTEGER,
    teks_jawaban_essay TEXT,
    is_ragu INTEGER DEFAULT 0 CHECK (is_ragu IN (0, 1)),
    waktu_dijawab TEXT NOT NULL,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced')),
    FOREIGN KEY (siswa_id) REFERENCES siswa (id),
    FOREIGN KEY (ujian_id) REFERENCES ujian (id),
    FOREIGN KEY (soal_id) REFERENCES soal (id),
    FOREIGN KEY (pilihan_jawaban_id) REFERENCES pilihan_jawaban (id)
);
```
