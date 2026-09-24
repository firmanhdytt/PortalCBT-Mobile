class AppStrings {
  static const String appName = 'CBT Mobile Client';
  static const String appTagline = 'Sistem Ujian Berbasis Komputer';

  // Auth Strings
  static const String loginTitle = 'Masuk ke Akun Siswa';
  static const String loginSubtitle = 'Gunakan NIS dan password yang diberikan oleh sekolah.';
  static const String usernameOrNis = 'Username / NIS';
  static const String password = 'Password';
  static const String btnLogin = 'Masuk Sekarang';
  static const String btnLoggingIn = 'Memverifikasi...';
  static const String serverIpSetting = 'Pengaturan IP Server';
  static const String btnLogout = 'Keluar Akun';
  static const String confirmLogout = 'Konfirmasi Keluar';
  static const String logoutConfirmMsg = 'Apakah Anda yakin ingin keluar dari akun siswa ini?';

  // Dashboard Strings
  static const String dashboardTitle = 'Daftar Ujian';
  static const String activeExams = 'Ujian Tersedia';
  static const String emptyExams = 'Tidak ada ujian aktif saat ini.';
  static const String noExamsAvailable = 'Tidak Ada Ujian Aktif Hari Ini';
  static const String tokenPrompt = 'Masukkan Token Ujian';
  static const String tokenHelp = 'Ketik 6 karakter token yang diberikan oleh pengawas/guru.';
  static const String btnStartExam = 'Mulai Kerjakan';

  // Exam Workspace Strings
  static const String examWorkspace = 'Ruang Ujian';
  static const String remainingTime = 'Sisa Waktu';
  static const String doubtQuestion = 'Ragu-ragu';
  static const String prevQuestion = 'Sebelumnya';
  static const String nextQuestion = 'Selanjutnya';
  static const String submitExam = 'Selesai Ujian';
  static const String examFinished = 'Ujian Selesai!';
  static const String confirmSubmitTitle = 'Kumpulkan Lembar Ujian?';
  static const String confirmSubmitContent =
      'Apakah Anda yakin ingin menyelesaikan ujian ini? Pastikan seluruh soal telah dijawab.';

  // Error Messages
  static const String errEmptyFields = 'Harap isi seluruh kolom yang wajib diisi!';
  static const String errInvalidToken = 'Token ujian tidak valid atau salah!';
  static const String errNetwork = 'Gagal terhubung ke server. Periksa koneksi Wi-Fi dan IP server.';
  static const String errGeneric = 'Terjadi kesalahan sistem. Silakan coba kembali.';
}
