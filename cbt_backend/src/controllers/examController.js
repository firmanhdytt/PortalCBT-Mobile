const examService = require('../services/examService');
const { ApiResponse } = require('../utils/response');

class ExamController {
  async getExams(req, res, next) {
    try {
      const data = await examService.getAllExams(req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createExam(req, res, next) {
    try {
      const data = await examService.createExam(req.body, req.user);
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
      const data = await examService.toggleExam(req.params.id, req.user);
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
      await examService.deleteExam(req.params.id, req.user);
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
      const data = await examService.getMonitoringData(req.params.ujianId, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Essay Grading
  async getEssayList(req, res, next) {
    try {
      const data = await examService.getEssayList(req.params.ujianId, req.user);
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
      }, req.user);
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
      const data = await examService.getExamRecap(req.params.ujianId, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Analisis Butir Soal (Difficulty & Discrimination)
  async getItemAnalysis(req, res, next) {
    try {
      const data = await examService.getItemAnalysis(req.params.ujianId, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Analisis Statistik Kelas
  async getClassAnalytics(req, res, next) {
    try {
      const data = await examService.getClassAnalytics(req.params.ujianId, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Ekspor Rekap Nilai (CSV)
  async exportRecap(req, res, next) {
    try {
      const data = await examService.getExamRecap(req.params.ujianId, req.user);
      const format = req.query.format || 'csv';
      if (format.toLowerCase() === 'csv') {
        const csvRows = ['No,NIS,Nama Siswa,Kelas,Nilai PG,Nilai Essay,Nilai Akhir,Status'];
        (data || []).forEach((row, i) => {
          csvRows.push(`${i+1},"${row.nis || ''}","${row.nama || ''}","${row.nama_kelas || ''}",${row.nilai_pg || 0},${row.nilai_essay || 0},${row.nilai_akhir || 0},"${row.status_kelulusan || 'PENDING'}"`);
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="rekap_nilai_ujian_${req.params.ujianId}.csv"`);
        return res.status(200).send(csvRows.join('\n'));
      } else {
        return ApiResponse.raw(res, data);
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExamController();
