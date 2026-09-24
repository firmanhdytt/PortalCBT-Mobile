import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/exam_model.dart';
import '../models/question_model.dart';
import '../models/answer_model.dart';
import '../models/exam_result_model.dart';

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
}
