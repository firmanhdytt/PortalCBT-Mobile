const examRepository = require('../repositories/examRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const questionRepository = require('../repositories/questionRepository');
const masterService = require('./masterService');
const analyticsService = require('./analyticsService');
const notificationService = require('./notificationService');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class ExamService {
  async getAllExams(user) {
    if (!user || user.role === 'admin') {
      return await examRepository.findAllExamsWithStats(null);
    }
    return await examRepository.findAllExamsWithStats(user.id);
  }

  async getExamDetail(id, user) {
    const exam = await examRepository.findExamById(id);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    if (user && user.role === 'guru') {
      await masterService.verifyWorkspaceAccess(user, exam.kelas_id, exam.mapel_id);
    }

    return exam;
  }

  async createExam(data, user) {
    if (!data.nama_ujian || !data.bank_soal_id || !data.kelas_id) {
      throw new ApiError('Semua field wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const bankSoal = await questionRepository.findBankSoalById(parseInt(data.bank_soal_id));
    if (!bankSoal) {
      throw new ApiError('Bank soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const targetKelasId = parseInt(data.kelas_id);
    const targetMapelId = bankSoal.mapel_id;

    if (bankSoal.kelas_id && bankSoal.kelas_id !== targetKelasId) {
      throw new ApiError('Bank soal yang dipilih dibuat untuk kelas yang berbeda dengan ujian ini!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify Guru Workspace Access
    if (user && user.role === 'guru') {
      await masterService.verifyWorkspaceAccess(user, targetKelasId, targetMapelId);
    }

    const payload = {
      nama_ujian: data.nama_ujian,
      deskripsi: data.deskripsi || null,
      bank_soal_id: parseInt(data.bank_soal_id),
      kelas_id: targetKelasId,
      token: (data.token || Math.random().toString(36).substring(2, 8)).toUpperCase(),
      durasi_menit: data.durasi_menit ? parseInt(data.durasi_menit) : 60,
      waktu_mulai: data.waktu_mulai || null,
      waktu_selesai: data.waktu_selesai || null,
      kkm: data.kkm ? parseFloat(data.kkm) : 70.00,
      randomize_questions: data.randomize_questions !== undefined ? (data.randomize_questions ? 1 : 0) : 1,
      randomize_options: data.randomize_options !== undefined ? (data.randomize_options ? 1 : 0) : 0,
      allow_back_navigation: data.allow_back_navigation !== undefined ? (data.allow_back_navigation ? 1 : 0) : 1,
      show_result: data.show_result !== undefined ? (data.show_result ? 1 : 0) : 1,
      max_attempt: data.max_attempt ? parseInt(data.max_attempt) : 1,
      max_violations: data.max_violations ? parseInt(data.max_violations) : 3,
      status: data.status || 'ONGOING',
      is_aktif: data.is_aktif !== undefined ? (data.is_aktif ? 1 : 0) : 1
    };

    const inserted = await examRepository.createExam(payload);
    const createdId = inserted.id || inserted;
    const created = await examRepository.findExamById(createdId);
    if (created && created.is_aktif) {
      notificationService.onExamPublished(created.id).catch(() => {});
    }
    return created;
  }

  async updateExam(id, data, user) {
    const existing = await this.getExamDetail(id, user);

    if (data.bank_soal_id || data.kelas_id) {
      const targetBankId = data.bank_soal_id ? parseInt(data.bank_soal_id) : existing.bank_soal_id;
      const targetKelasId = data.kelas_id ? parseInt(data.kelas_id) : existing.kelas_id;

      const bankSoal = await questionRepository.findBankSoalById(targetBankId);
      if (!bankSoal) {
        throw new ApiError('Bank soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
      }

      if (user && user.role === 'guru') {
        await masterService.verifyWorkspaceAccess(user, targetKelasId, bankSoal.mapel_id);
      }
    }

    await examRepository.updateExam(id, data);
    return await examRepository.findExamById(id);
  }

  async deleteExam(id, user) {
    await this.getExamDetail(id, user);
    await examRepository.deleteExam(id);
    return true;
  }

  async toggleExam(id, user) {
    await this.getExamDetail(id, user);
    const toggled = await examRepository.toggleExam(id);
    if (!toggled) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    if (toggled.is_aktif) {
      notificationService.onExamPublished(toggled.id).catch(() => {});
    }
    return toggled;
  }

  // Teacher Monitoring
  async getMonitoringData(ujianId, user) {
    const ujian = await this.getExamDetail(ujianId, user);

    const questions = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);
    const totalSoal = questions.length;

    const monitoringStudents = await examSessionRepository.findMonitoringData(ujianId, ujian.kelas_id);
    const enriched = monitoringStudents.map(s => ({
      ...s,
      total_soal: totalSoal
    }));

    return {
      nama_ujian: ujian.nama_ujian,
      token: ujian.token,
      siswa: enriched
    };
  }

  // Essay Grading
  async getEssayList(ujianId, user) {
    await this.getExamDetail(ujianId, user);
    return await examSessionRepository.findEssayAnswersByExam(ujianId);
  }

  async gradeEssay(arg1, arg2, arg3, reqUser) {
    let jawaban_id, nilai, catatan_guru;
    if (typeof arg1 === 'object' && arg1 !== null) {
      jawaban_id = arg1.jawaban_id;
      nilai = arg1.nilai;
      catatan_guru = arg1.catatan_guru;
      reqUser = arg2 || reqUser;
    } else {
      jawaban_id = arg1;
      nilai = arg2;
      catatan_guru = arg3;
    }

    if (!jawaban_id) {
      throw new ApiError('Jawaban ID wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const jp = await examSessionRepository.findAnswerById(jawaban_id);
    if (!jp) {
      throw new ApiError('Jawaban tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Verify workspace access for answer's exam
    await this.getExamDetail(jp.ujian_id, reqUser);

    const question = await questionRepository.findQuestionById(jp.soal_id);
    if (!question || question.jenis_soal !== 'ESSAY') {
      throw new ApiError('Soal ini bukan tipe essay!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const maxScore = parseFloat(question.bobot || 10.0);
    const numericScore = parseFloat(nilai || 0);

    if (isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
      throw new ApiError(`Nilai harus berupa angka valid antara 0 dan ${maxScore}!`, 400, ERROR_CODES.VALIDATION_ERROR);
    }

    await examSessionRepository.updateAnswer(jp.id, {
      nilai_manual: numericScore,
      catatan_guru: catatan_guru || null
    });

    const result = await analyticsService.recalculateResult(jp.attempt_id || jp.siswa_id, jp.ujian_id);

    return {
      success: true,
      jawaban_id: jp.id,
      nilai_manual: numericScore,
      catatan_guru: catatan_guru || null,
      recalculated_result: result
    };
  }

  // Rekapitulasi & Analytics
  async getExamRecap(ujianId, user) {
    await this.getExamDetail(ujianId, user);
    return await analyticsService.getExamRecap(ujianId);
  }

  async getItemAnalysis(ujianId, user) {
    await this.getExamDetail(ujianId, user);
    return await analyticsService.getItemAnalysis(ujianId);
  }

  async getClassAnalytics(ujianId, user) {
    await this.getExamDetail(ujianId, user);
    return await analyticsService.getClassAnalytics(ujianId);
  }
}

module.exports = new ExamService();
