const studentExamService = require('../services/studentExamService');
const { ApiResponse } = require('../utils/response');

class StudentExamController {
  async getActiveExams(req, res, next) {
    try {
      const kelasId = req.params.kelasId;
      const siswaId = req.query.siswaId;
      const data = await studentExamService.getActiveExams(kelasId, siswaId);
      // Contract: Flutter expects raw List<dynamic>
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async verifyToken(req, res, next) {
    try {
      const { ujian_id, token } = req.body;
      const ujian = await studentExamService.verifyToken(ujian_id, token);
      return res.status(200).json({
        message: 'Token valid! Anda diizinkan masuk.',
        ujian
      });
    } catch (err) {
      next(err);
    }
  }

  async getExamQuestions(req, res, next) {
    try {
      const ujianId = req.params.ujianId;
      const siswaId = req.query.siswa_id || req.query.siswaId || req.user?.id;
      const questions = await studentExamService.getExamQuestions(ujianId, siswaId);
      // Contract: Flutter expects raw List<dynamic>
      return ApiResponse.raw(res, questions);
    } catch (err) {
      next(err);
    }
  }

  async syncAnswers(req, res, next) {
    try {
      const { siswa_id, ujian_id, jawaban_list } = req.body;
      const result = await studentExamService.syncAnswers(siswa_id, ujian_id, jawaban_list);
      return res.status(200).json({
        message: 'Jawaban disinkronkan ke server!',
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  async submitExam(req, res, next) {
    try {
      const { siswa_id, ujian_id } = req.body;
      const hasil = await studentExamService.submitExam(siswa_id, ujian_id);
      return res.status(200).json({
        message: 'Ujian berhasil disimpan! Nilai PG otomatis dihitung.',
        hasil
      });
    } catch (err) {
      next(err);
    }
  }

  async getStudentResults(req, res, next) {
    try {
      const siswaId = req.params.siswaId;
      const data = await studentExamService.getStudentResults(siswaId);
      // Contract: Flutter expects raw List<dynamic>
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StudentExamController();
