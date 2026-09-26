const examService = require('../services/examService');
const { ApiResponse } = require('../utils/response');

class ExamController {
  async getExams(req, res, next) {
    try {
      const data = await examService.getAllExams();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createExam(req, res, next) {
    try {
      const data = await examService.createExam(req.body);
      return res.status(200).json({
        message: 'Jadwal ujian berhasil dibuat!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async toggleExam(req, res, next) {
    try {
      const data = await examService.toggleExam(req.params.id);
      return res.status(200).json({
        message: 'Status ujian berhasil diubah!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteExam(req, res, next) {
    try {
      await examService.deleteExam(req.params.id);
      return res.status(200).json({
        message: 'Ujian berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }

  // Monitoring
  async getMonitoring(req, res, next) {
    try {
      const data = await examService.getMonitoringData(req.params.ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Essay Grading
  async getEssayList(req, res, next) {
    try {
      const data = await examService.getEssayList(req.params.ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async gradeEssay(req, res, next) {
    try {
      const { jawaban_id, nilai, catatan_guru } = req.body;
      const result = await examService.gradeEssay({
        jawaban_id,
        nilai,
        catatan_guru
      });
      return res.status(200).json({
        message: 'Nilai essay berhasil disimpan dan nilai akhir peserta berhasil diperbarui!',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // Rekap Nilai
  async getExamRecap(req, res, next) {
    try {
      const data = await examService.getExamRecap(req.params.ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Analisis Butir Soal (Difficulty & Discrimination)
  async getItemAnalysis(req, res, next) {
    try {
      const data = await examService.getItemAnalysis(req.params.ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Analisis Statistik Kelas
  async getClassAnalytics(req, res, next) {
    try {
      const data = await examService.getClassAnalytics(req.params.ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Ekspor Rekap Nilai (CSV)
  async exportRecap(req, res, next) {
    try {
      const format = req.query.format || 'csv';
      if (format.toLowerCase() === 'csv') {
        const csv = await examService.exportRecapCSV(req.params.ujianId);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="rekap_nilai_ujian_${req.params.ujianId}.csv"`);
        return res.status(200).send(csv);
      } else {
        const data = await examService.getExamRecap(req.params.ujianId);
        return ApiResponse.raw(res, data);
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExamController();
