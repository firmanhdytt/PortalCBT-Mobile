class ApiEndpoints {
  static const String defaultHost = "backend-cbt.solusibersamaa.com";

  // Auth
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String me = '/auth/me';
  static const String logout = '/auth/logout';

  // Siswa Exam
  static String activeExams(int kelasId, int siswaId) =>
      '/siswa/ujian/$kelasId?siswa_id=$siswaId';
  static const String verifyToken = '/siswa/ujian/verifikasi-token';
  static String examQuestions(int ujianId) => '/siswa/ujian/soal/$ujianId';
  static const String syncAnswers = '/siswa/ujian/sync';
  static const String submitExam = '/siswa/ujian/submit';
  static String studentResults(int siswaId) => '/siswa/hasil/$siswaId';

  // Proctoring & Anti-Cheat
  static const String reportViolation = '/siswa/ujian/violation';
  static const String requestUnlock = '/siswa/ujian/unlock-request';
  static String unlockStatus(int ujianId, int siswaId) =>
      '/siswa/ujian/unlock-status/$ujianId/$siswaId';

  // Phase 8: Kartu Ujian & Sertifikat Digital
  static const String studentCard = '/siswa/kartu-ujian';
  static const String studentCertificates = '/siswa/sertifikat';

  // Phase 9: Profile & Avatar Management
  static const String profile = '/profile';
  static const String changePassword = '/profile/change-password';
  static const String uploadAvatar = '/profile/avatar';
  static const String deleteAvatar = '/profile/avatar';

  // Phase 10: In-App Notifications & Preferences
  static const String notifications = '/notifications';
  static const String unreadNotifications = '/notifications/unread-count';
  static String markNotificationRead(int id) => '/notifications/$id/read';
  static const String markAllNotificationsRead = '/notifications/read-all';
  static String deleteNotification(int id) => '/notifications/$id';
  static const String preferences = '/preferences';
}
