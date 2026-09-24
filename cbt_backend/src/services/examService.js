const examRepository = require('../repositories/examRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const questionRepository = require('../repositories/questionRepository');
const db = require('../database/db');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class ExamService {
  async getAllExams() {
    return await examRepository.findAllExamsWithStats();
  }

  async getExamById(id) {
    const exam = await examRepository.findExamById(id);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return exam;
  }

  async createExam({ nama_ujian, bank_soal_id, kelas_id, token, durasi_menit }) {
    if (!nama_ujian || !bank_soal_id || !kelas_id) {
      throw new ApiError('Data ujian tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const generatedToken = token && token.trim() 
      ? token.trim().toUpperCase() 
      : Math.random().toString(36).substring(2, 8).toUpperCase();

    const now = new Date();
    const waktuSelesai = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newId = await examRepository.createExam({
      nama_ujian: nama_ujian.trim(),
      bank_soal_id: parseInt(bank_soal_id),
      kelas_id: parseInt(kelas_id),
      token: generatedToken,
      durasi_menit: parseInt(durasi_menit || 60),
      waktu_mulai: now,
      waktu_selesai: waktuSelesai,
      is_aktif: 1
    });

    return await examRepository.findExamById(newId);
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

  async gradeEssay({ jawaban_id, nilai }) {
    if (!jawaban_id) {
      throw new ApiError('Jawaban ID wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const jp = await examSessionRepository.findAnswerById(jawaban_id);
    if (!jp) {
      throw new ApiError('Jawaban tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const numericScore = parseFloat(nilai || 0);
    await examSessionRepository.updateAnswer(jp.id, { nilai_manual: numericScore });

    // Recalculate student final score
    const existingHasil = await examSessionRepository.findResultByStudentAndExam(jp.siswa_id, jp.ujian_id);
    if (existingHasil) {
      const ujian = await examRepository.findExamById(jp.ujian_id);
      if (ujian) {
        const questions = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);
        const studentAnswers = await examSessionRepository.findStudentAnswers(jp.siswa_id, jp.ujian_id);

        let newTotal = 0;
        for (const q of questions) {
          const ans = studentAnswers.find(j => j.soal_id === q.id);
          if (ans) {
            if (q.jenis_soal === 'PG' && ans.pilihan_jawaban_id) {
              const options = await questionRepository.findOptionsByQuestionId(q.id);
              const kunci = options.find(o => o.is_kunci === 1 || o.is_kunci === true);
              if (kunci && kunci.id === ans.pilihan_jawaban_id) {
                newTotal += parseFloat(q.bobot || 1.0);
              }
            } else if (q.jenis_soal === 'ESSAY') {
              newTotal += parseFloat(ans.nilai_manual || 0);
            }
          }
        }

        await examSessionRepository.saveOrUpdateResult({
          siswa_id: jp.siswa_id,
          ujian_id: jp.ujian_id,
          jumlah_benar: existingHasil.jumlah_benar,
          jumlah_salah: existingHasil.jumlah_salah,
          nilai_akhir: newTotal,
          waktu_selesai: existingHasil.waktu_selesai
        });
      }
    }

    return true;
  }

  // Rekapitulasi Nilai
  async getExamRecap(ujianId) {
    const exam = await examRepository.findExamById(ujianId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return await examSessionRepository.findExamRecap(ujianId);
  }
}

module.exports = new ExamService();
