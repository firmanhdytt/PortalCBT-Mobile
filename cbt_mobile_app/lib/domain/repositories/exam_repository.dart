import '../entities/exam.dart';
import '../entities/question.dart';
import '../entities/answer.dart';
import '../entities/exam_result.dart';

import '../entities/student_card.dart';
import '../entities/certificate.dart';
import '../entities/user_profile.dart';
import '../entities/app_notification.dart';
import '../entities/user_preference.dart';

abstract class ExamRepository {
  Future<List<Exam>> getActiveExams(int kelasId, int siswaId);
  Future<Exam> verifyExamToken(int ujianId, String token);
  Future<List<Question>> getExamQuestions(int ujianId);
  Future<void> saveAnswerLocally(Answer answer);
  Future<Answer?> getAnswer(int soalId);
  Future<List<Answer>> getUnsyncedAnswers();
  Future<bool> syncAnswers(int siswaId, int ujianId, List<Answer> answers);
  Future<ExamResult> submitExam(int siswaId, int ujianId);
  Future<List<ExamResult>> getStudentResults(int siswaId);
  Future<Map<int, String>> getAnswerStatusMap(int ujianId);
  Future<Map<String, dynamic>> reportViolation({
    required int siswaId,
    required int ujianId,
    required String violationType,
    String? description,
  });
  Future<Map<String, dynamic>> requestUnlock({
    required int siswaId,
    required int ujianId,
    required String reason,
  });
  Future<Map<String, dynamic>> checkUnlockStatus({
    required int ujianId,
    required int siswaId,
  });
  Future<StudentCard> getStudentCard();
  Future<List<Certificate>> getCertificates();
  Future<UserProfile> getProfile();
  Future<UserProfile> updateProfile({String? nama, String? email});
  Future<bool> changePassword({required String currentPassword, required String newPassword});
  Future<Map<String, dynamic>> uploadAvatar(String base64Image);
  Future<bool> deleteAvatar();

  // Phase 10: Notifications & Accessibility Preferences
  Future<List<AppNotification>> getNotifications();
  Future<int> getUnreadNotificationCount();
  Future<bool> markNotificationAsRead(int id);
  Future<bool> markAllNotificationsAsRead();
  Future<UserPreference> getUserPreferences();
  Future<UserPreference> updateUserPreferences({String? theme, String? fontScale, bool? highContrast});
}
