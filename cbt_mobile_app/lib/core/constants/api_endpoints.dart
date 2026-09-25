class ApiEndpoints {
  static const String defaultHost = "10.0.2.2:3000";

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
}
