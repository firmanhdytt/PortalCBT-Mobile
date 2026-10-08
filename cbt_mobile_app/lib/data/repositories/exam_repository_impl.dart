import '../../domain/entities/exam.dart';
import '../../domain/entities/question.dart';
import '../../domain/entities/answer.dart';
import '../../domain/entities/exam_result.dart';
import '../../domain/entities/student_card.dart';
import '../../domain/entities/certificate.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/entities/user_preference.dart';
import '../../domain/repositories/exam_repository.dart';
import '../datasources/exam_remote_datasource.dart';
import '../datasources/exam_local_datasource.dart';
import '../models/answer_model.dart';

class ExamRepositoryImpl implements ExamRepository {
  final ExamRemoteDataSource _remote;
  final ExamLocalDataSource _local;

  ExamRepositoryImpl({
    required ExamRemoteDataSource remote,
    required ExamLocalDataSource local,
  })  : _remote = remote,
        _local = local;

  @override
  Future<List<Exam>> getActiveExams(int kelasId, int siswaId) async {
    return await _remote.fetchActiveExams(kelasId, siswaId);
  }

  @override
  Future<Exam> verifyExamToken(int ujianId, String token) async {
    final exam = await _remote.verifyToken(ujianId, token);
    await _local.saveExam(exam);
    return exam;
  }

  @override
  Future<List<Question>> getExamQuestions(int ujianId) async {
    // 1. Try local cache first (Offline resilience)
    final localQuestions = await _local.getQuestions(ujianId);
    if (localQuestions.isNotEmpty) {
      return localQuestions;
    }

    // 2. Fetch from remote API and cache locally
    final remoteQuestions = await _remote.fetchQuestions(ujianId);
    if (remoteQuestions.isNotEmpty) {
      await _local.saveQuestions(remoteQuestions, ujianId);
    }
    return remoteQuestions;
  }

  @override
  Future<void> saveAnswerLocally(Answer answer) async {
    final model = AnswerModel.fromEntity(answer);
    await _local.saveAnswer(model);
  }

  @override
  Future<Answer?> getAnswer(int soalId) async {
    return await _local.getAnswer(soalId);
  }

  @override
  Future<List<Answer>> getUnsyncedAnswers() async {
    return await _local.getUnsyncedAnswers();
  }

  @override
  Future<bool> syncAnswers(int siswaId, int ujianId, List<Answer> answers) async {
    if (answers.isEmpty) return true;

    final models = answers.map((a) => AnswerModel.fromEntity(a)).toList();
    final isSuccess = await _remote.syncAnswers(siswaId, ujianId, models);

    if (isSuccess) {
      await _local.markAnswersAsSynced(models);
    }
    return isSuccess;
  }

  @override
  Future<ExamResult> submitExam(int siswaId, int ujianId) async {
    // 1. Push any remaining unsynced answers before final submit
    final unsynced = await _local.getUnsyncedAnswers();
    if (unsynced.isNotEmpty) {
      try {
        await syncAnswers(siswaId, ujianId, unsynced);
      } catch (_) {
        // Attempt submit even if auto-sync had intermittent failure
      }
    }

    // 2. Submit to server
    return await _remote.submitExam(siswaId, ujianId);
  }

  @override
  Future<List<ExamResult>> getStudentResults(int siswaId) async {
    return await _remote.fetchResults(siswaId);
  }

  @override
  Future<Map<int, String>> getAnswerStatusMap(int ujianId) async {
    return await _local.getAnswerStatusMap(ujianId);
  }

  @override
  Future<Map<String, dynamic>> reportViolation({
    required int siswaId,
    required int ujianId,
    required String violationType,
    String? description,
  }) async {
    return await _remote.reportViolation(
      siswaId: siswaId,
      ujianId: ujianId,
      violationType: violationType,
      description: description,
    );
  }

  @override
  Future<Map<String, dynamic>> requestUnlock({
    required int siswaId,
    required int ujianId,
    required String reason,
  }) async {
    return await _remote.requestUnlock(
      siswaId: siswaId,
      ujianId: ujianId,
      reason: reason,
    );
  }

  @override
  Future<Map<String, dynamic>> checkUnlockStatus({
    required int ujianId,
    required int siswaId,
  }) async {
    return await _remote.checkUnlockStatus(
      ujianId: ujianId,
      siswaId: siswaId,
    );
  }

  @override
  Future<StudentCard> getStudentCard() async {
    return await _remote.fetchStudentCard();
  }

  @override
  Future<List<Certificate>> getCertificates() async {
    return await _remote.fetchCertificates();
  }

  @override
  Future<UserProfile> getProfile() async {
    return await _remote.fetchProfile();
  }

  @override
  Future<UserProfile> updateProfile({String? nama, String? email}) async {
    return await _remote.updateProfile(nama: nama, email: email);
  }

  @override
  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    return await _remote.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
  }

  @override
  Future<Map<String, dynamic>> uploadAvatar(String base64Image) async {
    return await _remote.uploadAvatar(base64Image);
  }

  @override
  Future<bool> deleteAvatar() async {
    return await _remote.deleteAvatar();
  }

  // Phase 10: In-App Notifications & Preferences
  @override
  Future<List<AppNotification>> getNotifications() async {
    return await _remote.fetchNotifications();
  }

  @override
  Future<int> getUnreadNotificationCount() async {
    return await _remote.fetchUnreadNotificationCount();
  }

  @override
  Future<bool> markNotificationAsRead(int id) async {
    return await _remote.markNotificationRead(id);
  }

  @override
  Future<bool> markAllNotificationsAsRead() async {
    return await _remote.markAllNotificationsRead();
  }

  @override
  Future<bool> deleteNotification(int id) async {
    return await _remote.deleteNotification(id);
  }

  @override
  Future<UserPreference> getUserPreferences() async {
    return await _remote.fetchUserPreferences();
  }

  @override
  Future<UserPreference> updateUserPreferences({String? theme, String? fontScale, bool? highContrast}) async {
    return await _remote.updateUserPreferences(theme: theme, fontScale: fontScale, highContrast: highContrast);
  }
}
