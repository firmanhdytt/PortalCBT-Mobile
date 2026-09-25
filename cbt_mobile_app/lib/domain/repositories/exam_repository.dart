import '../entities/exam.dart';
import '../entities/question.dart';
import '../entities/answer.dart';
import '../entities/exam_result.dart';

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
}
