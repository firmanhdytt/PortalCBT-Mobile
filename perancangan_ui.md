# Perancangan UI/UX Lengkap - Sistem CBT Mobile & Web Admin

Dokumen ini merinci rancangan antarmuka pengguna (UI) dan alur pengalaman pengguna (UX) untuk seluruh fitur pada aplikasi **CBT Mobile (Siswa)** dan **Dashboard Web Admin (Guru & Admin)**. Tampilan dirancang bersih (clean), minimalis, berbasis mode terang (light mode), dan fokus pada fungsionalitas.

---

## BAGIAN 1: Antarmuka Aplikasi Mobile (Aktor: Siswa)

Aplikasi mobile berfokus pada kemudahan pengerjaan ujian bagi siswa di layar smartphone.

### 1. Halaman Login Siswa
*   **Tujuan**: Autentikasi siswa untuk masuk ke sistem CBT.
*   **Elemen UI**:
    *   Logo Sekolah/Aplikasi (Header terpusat).
    *   Input Field `Username / NIS` (Ikon Akun).
    *   Input Field `Password` (Ikon Gembok & Tombol Show/Hide).
    *   Tombol `Masuk` (Primary Blue, lebar penuh).
    *   Teks "Butuh Bantuan? Hubungi Admin" di bagian paling bawah.
*   **UX Flow**: Siswa memasukkan kredensial -> Validasi API -> Sukses -> Masuk ke Halaman Dashboard. Jika gagal, input field berkedip merah dan muncul pesan error melayang (*snackbar*).
*   **Mockup Visual**:
    ![Tampilan Login Mobile](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/cbt_mobile_app/assets/cbt_login_ui_1784983947313.png)

---

### 2. Halaman Dashboard & Daftar Ujian Aktif
*   **Tujuan**: Menampilkan data siswa dan list ujian yang bisa diikuti.
*   **Elemen UI**:
    *   **Header**: Foto profil siswa, nama, kelas, dan tombol *Logout* (ikon keluar berwarna merah tipis di kanan atas).
    *   **Kartu Informasi**: Menampilkan jumlah ujian yang sudah selesai hari ini.
    *   **Daftar Ujian Aktif (List Card)**:
        *   Judul Ujian (misal: "Ujian Matematika Semester Ganjil").
        *   Informasi Detail: Jumlah Soal, Durasi (menit), Batas Pengerjaan.
        *   Tombol `Mulai Ujian` (Warna biru terang).
*   **UX Flow**: Siswa memilih salah satu kartu ujian -> Klik `Mulai Ujian` -> Muncul pop-up dialog verifikasi token.
*   **Mockup Visual**:
    ![Tampilan Dashboard Mobile](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/cbt_mobile_app/assets/cbt_dashboard_ui_1784983965499.png)

---

### 3. Pop-up Dialog Verifikasi Token (Exam Entry)
*   **Tujuan**: Mencegah pengerjaan ujian sebelum instruksi guru.
*   **Elemen UI**:
    *   Judul: "Masukkan Token Ujian".
    *   Detail Ujian: Nama Ujian dan Aturan Pengerjaan (peringatan anti-curang).
    *   Input Field `Token` (Maksimal 6 karakter huruf kapital).
    *   Tombol `Batal` (Teks abu-abu) dan `Konfirmasi` (Tombol biru).
*   **UX Flow**: Siswa memasukkan token -> Sistem mencocokkan token lokal dengan memanggil API (atau memvalidasi token lokal di SQLite yang telah diunduh) -> Jika valid, mulai mengunduh paket soal ujian -> Transisi masuk ke Layar Pengerjaan.

---

### 4. Layar Pengerjaan Soal (Exam Screen)
*   **Tujuan**: Antarmuka pengerjaan soal pilihan ganda dan essay.
*   **Elemen UI**:
    *   **Top Bar**: Label Soal (misal: "Soal No. 12 dari 40"), Timer Mundur (misal: "01:24:10" dengan visual warna oranye jika waktu tersisa < 10 menit).
    *   **Question Box**: Wadah putih berisi teks soal (dan gambar pendukung jika ada).
    *   **Opsi Jawaban (Pilihan Ganda)**: 5 Tombol Opsi (A, B, C, D, E). Opsi terpilih berwarna biru penuh dengan ikon centang di ujung kanan opsi.
    *   **Input Jawaban (Essay)**: Box text-area dengan placeholder "Tulis jawaban Anda di sini..." yang muncul jika jenis soal = `ESSAY`.
    *   **Bottom Navigation Bar**:
        *   Tombol `Sebelumnya` (Previous).
        *   Checkbox `Ragu-Ragu` dengan ikon bendera kuning (untuk menandai soal yang belum yakin).
        *   Tombol `Berikutnya` (Next).
    *   **Floating Navigation Sidebar**: Tombol grid nomor soal (1-40). Nomor soal berwarna hijau (sudah dijawab), kuning (ragu-ragu), dan abu-abu (belum dijawab).
*   **UX Flow**: Setiap kali siswa memilih/mengubah jawaban, data langsung masuk ke basis data lokal SQLite (`sync_status = 'pending'`). Tombol navigasi memungkinkan perpindahan instan antarno soal.
*   **Mockup Visual**:
    ![Tampilan Pengerjaan Soal Mobile](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/cbt_mobile_app/assets/cbt_exam_ui_1784983982445.png)

---

### 5. Dialog Konfirmasi Selesai Ujian
*   **Tujuan**: Verifikasi sebelum siswa mengirimkan ujian secara permanen.
*   **Elemen UI**:
    *   Pernyataan: "Apakah Anda yakin ingin menyelesaikan ujian ini?".
    *   Status: Menampilkan peringatan jika masih ada soal yang belum dijawab atau ditandai ragu-ragu (misal: "Peringatan: Masih ada 3 soal belum dijawab!").
    *   Checkbox: "Saya menyatakan telah memeriksa semua jawaban dengan jujur".
    *   Tombol `Kembali` (Abu-abu) dan `Selesai & Kirim` (Warna hijau sukses).
*   **UX Flow**: Siswa harus mencentang pernyataan integritas terlebih dahulu sebelum tombol `Selesai & Kirim` menjadi aktif. Setelah diklik, sistem memaksa sinkronisasi sisa jawaban SQLite ke server dan mengembalikan siswa ke dashboard.

---

## BAGIAN 2: Antarmuka Dashboard Web (Aktor: Guru & Admin)

Dashboard Web dirancang lebar dan informatif untuk mempermudah guru dan admin melakukan manajemen bank soal, monitoring, dan penilaian.

### 1. Dashboard Utama Guru / Admin
*   **Tujuan**: Menyajikan rangkuman performa sistem dan ujian aktif secara real-time.
*   **Elemen UI**:
    *   **Sidebar Navigasi**: Menu Dashboard, Data Master (Siswa/Guru), Bank Soal, Jadwal Ujian, Monitoring Live, Evaluasi Essay, dan Rekapitulasi Nilai.
    *   **Kartu Statistik (Top Bar)**: Total Siswa Aktif, Jumlah Bank Soal, Ujian Berlangsung Hari Ini.
    *   **Monitoring Live Widget**: Tabel aktivitas ujian terkini (Nama Ujian, Token, Kelas target, Jumlah siswa masuk).

---

### 2. Halaman Bank Soal (Manajemen Pertanyaan)
*   **Tujuan**: Tempat guru membuat, mengedit, dan menghapus soal-soal ujian.
*   **Elemen UI**:
    *   **Header**: Judul Halaman dan Tombol `+ Tambah Soal Baru`.
    *   **Filter & Pencarian**: Dropdown pilihan Mata Pelajaran, jenis soal (PG/Essay), dan bar pencarian kata kunci soal.
    *   **Tabel Daftar Soal**: Kolom No, Teks Soal (singkat), Jenis Soal, Bobot Nilai, Pembuat, dan Aksi (Ikon Edit, Ikon Hapus).
*   **UX Flow**: Guru memilih `Tambah Soal Baru` -> Muncul form input teks pertanyaan (wysiwyg editor), drop-area unggah gambar, pemilihan jenis soal, opsi A-E (jika PG) beserta penanda kunci jawaban, serta bobot nilai -> Klik `Simpan`.
*   **Mockup Visual**:
    ![Manajemen Bank Soal](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/cbt_mobile_app/assets/cbt_guru_bank_soal_ui_1785062039287.png)

---

### 3. Halaman Monitoring Ujian Real-Time
*   **Tujuan**: Pengawasan ujian secara langsung untuk mendeteksi kecurangan dan memantau progres siswa.
*   **Elemen UI**:
    *   **Header**: Judul Ujian Aktif, Token Ujian, Sisa Waktu Ujian Global.
    *   **Grid Kartu Siswa**: Setiap siswa yang berpartisipasi ditampilkan dalam bentuk kartu kecil berisi:
        *   Nama Siswa & NIS.
        *   Progres Pengerjaan (Visual Progress Bar, misal: *24/40 Soal Terjawab*).
        *   Status Kehadiran/Koneksi: `Online` (Hijau), `Offline` (Merah - tanda koneksi terputus), atau `Selesai` (Biru).
        *   Status Kecurangan (Peringatan): Berwarna kuning/merah jika terdeteksi siswa meminimalkan aplikasi mobile CBT (melanggar lockdown mode).
*   **UX Flow**: Layar melakukan refresh otomatis setiap 10 detik melalui koneksi web socket/pooling API. Guru dapat mengklik tombol `Paksa Selesai` pada siswa tertentu jika melakukan kecurangan berat.
*   **Mockup Visual**:
    ![Tampilan Monitoring Real-time](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/cbt_mobile_app/assets/cbt_guru_monitoring_ui_1785062016333.png)

---

### 4. Halaman Evaluasi & Penilaian Essay
*   **Tujuan**: Antarmuka bagi guru untuk memberikan penilaian manual pada soal bertipe Essay.
*   **Elemen UI**:
    *   Dropdown pilihan Ujian dan pilihan Soal Essay ke-N.
    *   **Tabel Penilaian**:
        *   Nama Siswa.
        *   Kunci Jawaban Guru (sebagai acuan).
        *   Jawaban Tertulis Siswa (teks lengkap).
        *   Kolom Input `Skor` (Input angka dengan batas maksimal sesuai bobot soal).
        *   Tombol `Simpan Nilai`.
*   **UX Flow**: Guru membaca jawaban siswa -> Memasukkan nilai angka -> Klik enter/simpan -> Nilai masuk ke tabel database `jawaban_peserta.nilai_manual` dan memicu update nilai akhir pada tabel `hasil_ujian`.

---

### 5. Halaman Rekapitulasi & Ekspor Hasil Ujian
*   **Tujuan**: Rekap data kelulusan dan nilai seluruh siswa untuk diunduh.
*   **Elemen UI**:
    *   Dropdown Pemilihan Sesi Ujian (misal: "Ujian Fisika Kelas XII").
    *   **Tabel Nilai**: Kolom No, NIS, Nama Siswa, Jumlah PG Benar, Jumlah PG Salah, Nilai Essay, Nilai Akhir, dan Status (Lulus/Tidak Lulus berdasarkan KKM).
    *   Tombol `Ekspor ke Excel` (Warna hijau) dan `Cetak Laporan PDF` (Warna merah).
*   **UX Flow**: Guru memilih sesi ujian -> Tabel memuat data secara instan -> Guru mengeklik tombol ekspor untuk menghasilkan unduhan file rekap secara lokal.

---

### 6. Halaman Manajemen Data Master (Khusus Aktor: Admin)
*   **Tujuan**: Mengelola data dasar sistem (Pengguna, Kelas, Mapel).
*   **Elemen UI**:
    *   Tabel tab dinamis: `Data Siswa`, `Data Guru`, `Data Kelas`, `Data Mapel`.
    *   Fungsi CRUD lengkap (Tambah baru, Edit baris, Hapus baris).
    *   Fitur `Import CSV/Excel` untuk mengunggah ratusan data siswa/guru secara massal.
