import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/exam_model.dart';
import '../models/question_model.dart';
import '../models/answer_model.dart';
import '../models/exam_result_model.dart';
import '../models/student_card_model.dart';
import '../models/certificate_model.dart';
import '../models/user_profile_model.dart';
import '../models/app_notification_model.dart';
import '../models/user_preference_model.dart';

class ExamRemoteDataSource {
  final ApiClient _client;

  ExamRemoteDataSource(this._client);

  Future<List<ExamModel>> fetchActiveExams(int kelasId, int siswaId) async {
    final res = await _client.get(ApiEndpoints.activeExams(kelasId, siswaId));
    if (res is List) {
      return res.map((e) => ExamModel.fromJson(e as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<ExamModel> verifyToken(int ujianId, String token) async {
    final res = await _client.post(
      ApiEndpoints.verifyToken,
      data: {'ujian_id': ujianId, 'token': token},
    );

    if (res is Map<String, dynamic> && res['ujian'] != null) {
      return ExamModel.fromJson(res['ujian'] as Map<String, dynamic>);
    }
    throw Exception('Token verifikasi gagal atau respon tidak valid');
  }

  Future<List<QuestionModel>> fetchQuestions(int ujianId) async {
    final res = await _client.get(ApiEndpoints.examQuestions(ujianId));
    if (res is List) {
      return res
          .map((q) => QuestionModel.fromJson(q as Map<String, dynamic>, defaultUjianId: ujianId))
          .toList();
    }
    return [];
  }

  Future<bool> syncAnswers(int siswaId, int ujianId, List<AnswerModel> answers) async {
    final listPayload = answers.map((a) => a.toSyncJson()).toList();
    final res = await _client.post(
      ApiEndpoints.syncAnswers,
      data: {
        'siswa_id': siswaId,
        'ujian_id': ujianId,
        'jawaban_list': listPayload,
      },
    );
    return res is Map<String, dynamic>;
  }

  Future<ExamResultModel> submitExam(int siswaId, int ujianId) async {
    final res = await _client.post(
      ApiEndpoints.submitExam,
      data: {'siswa_id': siswaId, 'ujian_id': ujianId},
    );

    if (res is Map<String, dynamic> && res['hasil'] != null) {
      return ExamResultModel.fromJson(res['hasil'] as Map<String, dynamic>);
    }
    throw Exception('Gagal menyelesaikan ujian');
  }

  Future<List<ExamResultModel>> fetchResults(int siswaId) async {
    final res = await _client.get(ApiEndpoints.studentResults(siswaId));
    if (res is List) {
      return res.map((r) => ExamResultModel.fromJson(r as Map<String, dynamic>)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> reportViolation({
    required int siswaId,
    required int ujianId,
    required String violationType,
    String? description,
  }) async {
    final res = await _client.post(
      ApiEndpoints.reportViolation,
      data: {
        'siswa_id': siswaId,
        'ujian_id': ujianId,
        'violation_type': violationType,
        'description': description ?? 'Pelanggaran anti-cheat di aplikasi mobile',
      },
    );
    if (res is Map<String, dynamic>) {
      return res;
    }
    return {};
  }

  Future<Map<String, dynamic>> requestUnlock({
    required int siswaId,
    required int ujianId,
    required String reason,
  }) async {
    final res = await _client.post(
      ApiEndpoints.requestUnlock,
      data: {
        'siswa_id': siswaId,
        'ujian_id': ujianId,
        'reason': reason,
      },
    );
    if (res is Map<String, dynamic>) {
      return res;
    }
    return {};
  }

  Future<Map<String, dynamic>> checkUnlockStatus({
    required int ujianId,
    required int siswaId,
  }) async {
    final res = await _client.get(ApiEndpoints.unlockStatus(ujianId, siswaId));
    if (res is Map<String, dynamic>) {
      return res;
    }
    return {};
  }

  Future<StudentCardModel> fetchStudentCard() async {
    final res = await _client.get(ApiEndpoints.studentCard);
    if (res is Map<String, dynamic>) {
      final data = res['data'] is Map<String, dynamic>
          ? res['data'] as Map<String, dynamic>
          : res;
      return StudentCardModel.fromJson(data);
    }
    throw Exception('Gagal memuat kartu ujian');
  }

  Future<List<CertificateModel>> fetchCertificates() async {
    final res = await _client.get(ApiEndpoints.studentCertificates);
    if (res is Map<String, dynamic> && res['data'] is List) {
      final list = res['data'] as List<dynamic>;
      return list
          .map((c) => CertificateModel.fromJson(c as Map<String, dynamic>))
          .toList();
    } else if (res is List) {
      return res
          .map((c) => CertificateModel.fromJson(c as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  // Phase 9: Profile & Avatar Methods
  Future<UserProfileModel> fetchProfile() async {
    final res = await _client.get(ApiEndpoints.profile);
    if (res is Map<String, dynamic>) {
      final data = res['data'] is Map<String, dynamic>
          ? res['data'] as Map<String, dynamic>
          : res;
      return UserProfileModel.fromJson(data);
    }
    throw Exception('Gagal memuat profil pengguna');
  }

  Future<UserProfileModel> updateProfile({String? nama, String? email}) async {
    final res = await _client.put(
      ApiEndpoints.profile,
      data: {
        if (nama != null) 'nama': nama,
        if (email != null) 'email': email,
      },
    );
    if (res is Map<String, dynamic>) {
      final data = res['data'] is Map<String, dynamic>
          ? res['data'] as Map<String, dynamic>
          : res;
      return UserProfileModel.fromJson(data);
    }
    throw Exception('Gagal memperbarui profil pengguna');
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final res = await _client.post(
      ApiEndpoints.changePassword,
      data: {
        'current_password': currentPassword,
        'new_password': newPassword,
      },
    );
    if (res is Map<String, dynamic>) {
      return res['status'] == 'success';
    }
    return false;
  }

  Future<Map<String, dynamic>> uploadAvatar(String base64Image) async {
    final res = await _client.post(
      ApiEndpoints.uploadAvatar,
      data: {
        'image_data': base64Image,
      },
    );
    if (res is Map<String, dynamic>) {
      return res;
    }
    throw Exception('Gagal mengunggah foto profil');
  }

  Future<bool> deleteAvatar() async {
    final res = await _client.delete(ApiEndpoints.deleteAvatar);
    if (res is Map<String, dynamic>) {
      return res['status'] == 'success';
    }
    return false;
  }

  // Phase 10: In-App Notifications & Accessibility Preferences
  Future<List<AppNotificationModel>> fetchNotifications({int limit = 30}) async {
    final res = await _client.get('${ApiEndpoints.notifications}?limit=$limit');
    if (res is Map<String, dynamic> && res['data'] is List) {
      return (res['data'] as List)
          .map((n) => AppNotificationModel.fromJson(n as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<int> fetchUnreadNotificationCount() async {
    final res = await _client.get(ApiEndpoints.unreadNotifications);
    if (res is Map<String, dynamic> && res['data'] != null) {
      final d = res['data'];
      return d['unread_count'] is int
          ? d['unread_count']
          : int.tryParse(d['unread_count']?.toString() ?? '0') ?? 0;
    }
    return 0;
  }

  Future<bool> markNotificationRead(int id) async {
    final res = await _client.put(ApiEndpoints.markNotificationRead(id));
    if (res is Map<String, dynamic>) {
      return res['status'] == 'success';
    }
    return false;
  }

  Future<bool> markAllNotificationsRead() async {
    final res = await _client.put(ApiEndpoints.markAllNotificationsRead);
    if (res is Map<String, dynamic>) {
      return res['status'] == 'success';
    }
    return false;
  }

  Future<UserPreferenceModel> fetchUserPreferences() async {
    final res = await _client.get(ApiEndpoints.preferences);
    if (res is Map<String, dynamic> && res['data'] is Map<String, dynamic>) {
      return UserPreferenceModel.fromJson(res['data'] as Map<String, dynamic>);
    }
    return const UserPreferenceModel(userId: 0, theme: 'system', fontScale: 'normal', highContrast: false);
  }

  Future<UserPreferenceModel> updateUserPreferences({String? theme, String? fontScale, bool? highContrast}) async {
    final body = <String, dynamic>{};
    if (theme != null) body['theme'] = theme;
    if (fontScale != null) body['font_scale'] = fontScale;
    if (highContrast != null) body['high_contrast'] = highContrast ? 1 : 0;

    final res = await _client.put(ApiEndpoints.preferences, data: body);
    if (res is Map<String, dynamic> && res['data'] is Map<String, dynamic>) {
      return UserPreferenceModel.fromJson(res['data'] as Map<String, dynamic>);
    }
    return fetchUserPreferences();
  }
}
