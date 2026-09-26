const examRepository = require('../repositories/examRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const questionRepository = require('../repositories/questionRepository');
const analyticsService = require('./analyticsService');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class ExamService {
  async getAllExams() {
    return await examRepository.findAllExamsWithStats();
  }

  async getExamDetail(id) {
    const exam = await examRepository.findExamById(id);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return exam;
  }

  async createExam(data) {
    if (!data.nama_ujian || !data.bank_soal_id || !data.kelas_id) {
      throw new ApiError('Semua field wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const payload = {
      nama_ujian: data.nama_ujian,
      deskripsi: data.deskripsi || null,
      bank_soal_id: parseInt(data.bank_soal_id),
      kelas_id: parseInt(data.kelas_id),
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
    return await examRepository.findExamById(inserted.id);
  }

  async updateExam(id, data) {
    const existing = await examRepository.findExamById(id);
    if (!existing) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    await examRepository.updateExam(id, data);
    return await examRepository.findExamById(id);
  }

  async deleteExam(id) {
    const existing = await examRepository.findExamById(id);
    if (!existing) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    await examRepository.deleteExam(id);
    return true;
  }

  async toggleExam(id) {
    const toggled = await examRepository.toggleExam(id);
    if (!toggled) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return toggled;
  }

  // Teacher Monitoring
  async getMonitoringData(ujianId) {
    const ujian = await examRepository.findExamById(ujianId);
    if (!ujian) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

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
  async getEssayList(ujianId) {
    const exam = await examRepository.findExamById(ujianId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return await examSessionRepository.findEssayAnswersByExam(ujianId);
  }

  async gradeEssay(arg1, arg2, arg3) {
    let jawaban_id, nilai, catatan_guru;
    if (typeof arg1 === 'object' && arg1 !== null) {
      jawaban_id = arg1.jawaban_id;
      nilai = arg1.nilai;
      catatan_guru = arg1.catatan_guru;
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
      catatan_guru: catatan_guru !== undefined ? catatan_guru : jp.catatan_guru
    });

    // Recalculate student final score
    const existingHasil = await examSessionRepository.findResultByStudentAndExam(jp.siswa_id, jp.ujian_id);
    let resultPayload = null;

    if (existingHasil) {
      const ujian = await examRepository.findExamById(jp.ujian_id);
      if (ujian) {
        const questions = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);
        const studentAnswers = await examSessionRepository.findStudentAnswers(jp.siswa_id, jp.ujian_id);

        let newNilaiPG = 0;
        let newNilaiEssay = 0;
        let allEssaysGraded = true;

        for (const q of questions) {
          const ans = studentAnswers.find(j => j.soal_id === q.id);
          if (q.jenis_soal === 'PG') {
            if (ans && ans.pilihan_jawaban_id) {
              const options = await questionRepository.findOptionsByQuestionId(q.id);
              const kunci = options.find(o => o.is_kunci === 1 || o.is_kunci === true);
              if (kunci && kunci.id === ans.pilihan_jawaban_id) {
                newNilaiPG += parseFloat(q.bobot || 1.0);
              }
            }
          } else if (q.jenis_soal === 'ESSAY') {
            if (ans && ans.id === jp.id) {
              newNilaiEssay += numericScore;
            } else if (ans && ans.nilai_manual !== null && ans.nilai_manual !== undefined) {
              newNilaiEssay += parseFloat(ans.nilai_manual);
            } else {
              allEssaysGraded = false;
            }
          }
        }

        const newTotal = parseFloat((newNilaiPG + newNilaiEssay).toFixed(2));
        const kkm = parseFloat(ujian.kkm || 70.0);
        const statusKelulusan = allEssaysGraded
          ? (newTotal >= kkm ? 'LULUS' : 'REMIDI')
          : 'PENDING';

        resultPayload = {
          siswa_id: jp.siswa_id,
          ujian_id: jp.ujian_id,
          jumlah_benar: existingHasil.jumlah_benar,
          jumlah_salah: existingHasil.jumlah_salah,
          nilai_pg: parseFloat(newNilaiPG.toFixed(2)),
          nilai_essay: parseFloat(newNilaiEssay.toFixed(2)),
          nilai_akhir: newTotal,
          status_kelulusan: statusKelulusan,
          waktu_selesai: existingHasil.waktu_selesai
        };

        await examSessionRepository.saveOrUpdateResult(resultPayload);
      }
    }

    return {
      jawaban_id: jp.id,
      nilai_manual: numericScore,
      catatan_guru: catatan_guru || null,
      recalculated_result: resultPayload
    };
  }

  // Rekapitulasi Nilai
  async getExamRecap(ujianId) {
    const exam = await examRepository.findExamById(ujianId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return await examSessionRepository.findExamRecap(ujianId);
  }

  // Analytics & Reporting
  async getItemAnalysis(ujianId) {
    return await analyticsService.calculateItemAnalysis(ujianId);
  }

  async getClassAnalytics(ujianId) {
    return await analyticsService.calculateClassAnalytics(ujianId);
  }

  async exportRecapCSV(ujianId) {
    return await analyticsService.exportExamRecapCSV(ujianId);
  }
}

module.exports = new ExamService();
