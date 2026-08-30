# Dokumen Analisis Sistem - Aplikasi Mobile CBT (Computer Based Test)

Dokumen ini berisi analisis sistem mendalam untuk proyek pengembangan aplikasi mobile **Computer Based Test (CBT)**. Analisis ini mencakup identifikasi kebutuhan sistem (fungsional & non-fungsional), Use Case Diagram, Activity Diagram, dan Class Diagram.

---

## 1. Identifikasi Kebutuhan Sistem

Tahap ini mengidentifikasi kebutuhan fungsional (apa saja fitur yang harus disediakan sistem) dan kebutuhan non-fungsional (batasan teknis, keamanan, performa, dan kegunaan sistem).

### A. Kebutuhan Fungsional (Functional Requirements)

| ID | Fitur Utama | Deskripsi Detail | Aktor Terkait |
| :--- | :--- | :--- | :--- |
| **F-01** | Autentikasi Pengguna | Sistem harus mendukung login/logout terenkripsi menggunakan username/email dan password. Hak akses dibagi menjadi Admin, Guru, dan Siswa. | Siswa, Guru, Admin |
| **F-02** | Manajemen Data Master | Admin dapat mengelola data pengguna (siswa & guru), data kelas, mata pelajaran, serta hak akses dalam sistem. | Admin |
| **F-03** | Manajemen Bank Soal | Guru dapat membuat, memperbarui, dan menghapus soal (Pilihan Ganda dan Essay). Soal dapat dilengkapi teks, bobot nilai, serta lampiran gambar. | Guru |
| **F-04** | Manajemen Ujian & Token | Guru dapat menjadwalkan ujian, mengasosiasikan bank soal, menetapkan durasi, mengatur kelas peserta, mengacak soal/jawaban, dan membuat token ujian. | Guru |
| **F-05** | Pengerjaan Ujian | Siswa dapat mengikuti ujian setelah memasukkan token valid. Halaman pengerjaan memiliki fitur navigasi soal (sebelumnya/berikutnya), penanda ragu-ragu, timer mundur, dan auto-save jawaban. | Siswa |
| **F-06** | Sinkronisasi Jawaban Offline | Aplikasi mobile dapat menyimpan jawaban sementara di lokal database perangkat saat koneksi internet tidak stabil, lalu mengirimkannya ketika terhubung kembali. | Siswa |
| **F-07** | Pemantauan Ujian Real-time | Guru dapat melihat status siswa yang sedang menempuh ujian (sedang mengerjakan, selesai, terlambat) secara real-time. | Guru |
| **F-08** | Penilaian & Rekap Nilai | Sistem melakukan penilaian otomatis untuk soal pilihan ganda. Guru dapat menilai jawaban essay secara manual. Hasil nilai akhir dapat diekspor ke format Excel/PDF. | Guru, Siswa |
| **F-09** | Riwayat Ujian | Siswa dapat melihat riwayat ujian yang telah diselesaikan beserta skor akhir (jika diizinkan oleh guru/instansi). | Siswa |

### B. Kebutuhan Non-Fungsional (Non-Functional Requirements)

| ID | Parameter | Kebutuhan Teknis / Operasional |
| :--- | :--- | :--- |
| **NF-01** | **Keamanan (Security)** | <ul><li>Password disimpan dengan enkripsi searah (hashing bcrypt/argon2).</li><li>Token JWT digunakan untuk autentikasi API session.</li><li>**Anti-Cheating:** Sistem mendeteksi jika aplikasi diminimalkan (backgrounded) atau siswa mencoba keluar dari layar ujian, lalu memberikan peringatan otomatis atau mengunci ujian.</li></ul> |
| **NF-02** | **Keandalan (Reliability)** | <ul><li>Data pengerjaan disinkronisasi setiap 10-15 detik ke server (auto-save).</li><li>Menggunakan SQLite/Hive di perangkat mobile untuk penyimpanan lokal transien agar data pengerjaan aman dari crash aplikasi.</li></ul> |
| **NF-03** | **Performa (Performance)** | <ul><li>Aplikasi mobile harus responsif dengan waktu muat soal di bawah 2 detik.</li><li>Server backend harus mampu menangani konkurensi tinggi ketika ratusan siswa memulai ujian secara bersamaan.</li></ul> |
| **NF-04** | **Usability & Portabilitas** | <ul><li>UI/UX dirancang ramah pengguna (clean design), responsif di berbagai ukuran layar smartphone, dengan font yang mudah dibaca.</li><li>Aplikasi dikembangkan menggunakan Flutter agar dapat dijalankan di platform Android dan iOS secara native.</li></ul> |

---

## 2. Use Case Diagram

Use Case Diagram menggambarkan interaksi antara aktor (Siswa, Guru, Admin) dengan fungsi-fungsi utama yang disediakan oleh sistem CBT.

```mermaid
flowchart TD
    %% Definisi Aktor
    subgraph Aktor [Aktor Sistem]
        S([Siswa / Peserta])
        G([Guru / Pengawas])
        Ad([Administrator])
    end

    %% Definisi Use Cases
    subgraph UCs [Fungsi & Fitur CBT]
        UC_Login(Login & Autentikasi)
        UC_Master(Kelola Data Master & Pengguna)
        UC_BankSoal(Kelola Bank Soal)
        UC_JadwalUjian(Kelola Jadwal & Token Ujian)
        UC_MulaiUjian(Mengikuti Ujian / Masukkan Token)
        UC_Monitor(Memantau Ujian Real-time)
        UC_Nilai(Menilai Jawaban Essay & Rekap Nilai)
        UC_Riwayat(Melihat Hasil & Riwayat Ujian)
        UC_Logout(Logout)
    end

    %% Hubungan Aktor ke Use Case
    S ---> UC_Login
    S ---> UC_MulaiUjian
    S ---> UC_Riwayat
    S ---> UC_Logout

    G ---> UC_Login
    G ---> UC_BankSoal
    G ---> UC_JadwalUjian
    G ---> UC_Monitor
    G ---> UC_Nilai
    G ---> UC_Logout

    Ad ---> UC_Login
    Ad ---> UC_Master
    Ad ---> UC_Logout
```

---

## 3. Activity Diagram

Activity Diagram menjelaskan alur kerja (workflow) proses bisnis utama dalam sistem CBT. Di bawah ini disajikan dua alur utama: Alur Siswa Mengerjakan Ujian dan Alur Guru Mengelola & Memantau Ujian.

### A. Activity Diagram: Siswa Mengikuti Ujian

Diagram ini menunjukkan langkah-langkah yang dilalui siswa mulai dari login hingga mengirimkan jawaban ujian.

```mermaid
flowchart TD
    Start([Mulai]) --> Login[Login ke Aplikasi Mobile]
    Login --> Dashboard[Lihat Daftar Ujian Aktif]
    Dashboard --> PilihUjian[Pilih Ujian & Masukkan Token]
    PilihUjian --> CekToken{Token Valid?}
    
    CekToken -- Tidak --> TampilkanPesan[Tampilkan Pesan Error] --> PilihUjian
    CekToken -- Ya --> MuatSoal[Muat Soal & Jalankan Timer Mundur]
    
    MuatSoal --> TampilHalaman[Tampilkan Halaman Ujian]
    TampilHalaman --> JawabSoal[Jawab/Ubah Jawaban Soal]
    JawabSoal --> AutoSave[Simpan Jawaban ke Lokal & Sync Server]
    
    AutoSave --> CekKondisi{Apakah Waktu Habis\natau Klik Selesai?}
    CekKondisi -- Tidak --> NavigasiSoal[Navigasi Ke Soal Lain] --> TampilHalaman
    CekKondisi -- Ya --> KirimJawaban[Kirim Seluruh Lembar Jawaban]
    
    KirimJawaban --> KoreksiPG[Sistem Koreksi Otomatis Pilihan Ganda]
    KoreksiPG --> SimpanHasil[Simpan Hasil Sementara]
    SimpanHasil --> Selesai([Selesai])
```

### B. Activity Diagram: Guru Mengelola Bank Soal & Memantau Ujian

Diagram ini menjelaskan alur kerja guru dalam menyusun soal, merilis ujian, memantau pengerjaan secara real-time, hingga merekap nilai.

```mermaid
flowchart TD
    StartG([Mulai]) --> LoginG[Login ke Dashboard Guru]
    LoginG --> KelolaSoal[Kelola Bank Soal]
    KelolaSoal --> TambahSoal[Buat/Edit Soal PG & Essay]
    TambahSoal --> SetUjian[Buat Jadwal & Konfigurasi Ujian]
    SetUjian --> RilisToken[Generate & Rilis Token Ujian]
    
    RilisToken --> PantauRealtime[Pantau Status Siswa Real-time]
    PantauRealtime --> CekStatus{Semua Siswa Selesai / Waktu Habis?}
    CekStatus -- Tidak --> PantauRealtime
    CekStatus -- Ya --> EvaluasiEssay[Koreksi & Nilai Jawaban Essay]
    
    EvaluasiEssay --> KalkulasiNilai[Kalkulasi Nilai Akhir]
    KalkulasiNilai --> ExportLaporan[Ekspor Rekap Nilai PDF/Excel]
    ExportLaporan --> SelesaiG([Selesai])
```

---

## 4. Class Diagram

Class Diagram menggambarkan struktur statis sistem dengan memperlihatkan kelas-kelas objek, atribut, metode, serta hubungan antar kelas.

```mermaid
classDiagram
    class User {
        +int id
        +string username
        +string password
        +string role
        +login()
        +logout()
    }

    class Siswa {
        +int id
        +string nis
        +string nama
        +int kelas_id
        +lihatHasilUjian()
        +ikutiUjian()
    }

    class Guru {
        +int id
        +string nip
        +string nama
        +buatSoal()
        +buatUjian()
        +pantauUjian()
        +nilaiEssay()
    }

    class Kelas {
        +int id
        +string nama_kelas
    }

    class MataPelajaran {
        +int id
        +string nama_mapel
        +string kode_mapel
    }

    class Soal {
        +int id
        +int mapel_id
        +string jenis_soal
        +string teks_soal
        +string gambar_url
        +double bobot
    }

    class PilihanJawaban {
        +int id
        +int soal_id
        +string teks_pilihan
        +boolean is_kunci
    }

    class Ujian {
        +int id
        +string nama_ujian
        +int mapel_id
        +int kelas_id
        +string token
        +int durasi_menit
        +datetime waktu_mulai
        +datetime waktu_selesai
        +boolean is_aktif
        +generateToken()
    }

    class JawabanPeserta {
        +int id
        +int siswa_id
        +int ujian_id
        +int soal_id
        +int pilihan_jawaban_id
        +string teks_jawaban_essay
        +boolean is_ragu
        +double nilai_manual
    }

    class HasilUjian {
        +int id
        +int siswa_id
        +int ujian_id
        +double nilai_akhir
        +datetime waktu_selesai
        +hitungNilaiOtomatis()
    }

    User <|-- Siswa
    User <|-- Guru
    Siswa "*" --> "1" Kelas : memiliki
    Soal "*" --> "1" MataPelajaran : terkait
    PilihanJawaban "*" --> "1" Soal : milik
    Ujian "*" --> "1" MataPelajaran : menguji
    Ujian "*" --> "1" Kelas : ditujukan
    JawabanPeserta "*" --> "1" Siswa : dijawab oleh
    JawabanPeserta "*" --> "1" Ujian : dalam
    JawabanPeserta "*" --> "1" Soal : untuk
    HasilUjian "1" --> "1" Siswa : milik
    HasilUjian "1" --> "1" Ujian : hasil dari
```
