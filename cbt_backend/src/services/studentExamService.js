const examRepository = require('../repositories/examRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const questionRepository = require('../repositories/questionRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class StudentExamService {
  async getActiveExams(kelasId, siswaId) {
    if (!kelasId) {
      throw new ApiError('Kelas ID tidak valid!', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return await examRepository.findActiveExamsByKelas(parseInt(kelasId), siswaId ? parseInt(siswaId) : null);
  }

  async verifyToken(ujianId, token) {
    if (!ujianId || !token) {
      throw new ApiError('Data ujian atau token tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const ujian = await examRepository.findExamById(ujianId);
    if (!ujian) {
      throw new ApiError('Sesi ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const cleanInputToken = token.toString().trim().toUpperCase();
    const cleanUjianToken = ujian.token ? ujian.token.toString().trim().toUpperCase() : '';

    if (cleanUjianToken !== cleanInputToken) {
      throw new ApiError('Token ujian salah!', 400, ERROR_CODES.INVALID_EXAM_TOKEN);
    }

    return ujian;
  }

  async getExamQuestions(ujianId) {
    const ujian = await examRepository.findExamById(ujianId);
    if (!ujian) {
      throw new ApiError('Sesi ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const questions = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);
    const responseList = [];

    for (const q of questions) {
      const options = await questionRepository.findOptionsByQuestionId(q.id);
      // Strip is_kunci for student security!
      const safeOptions = options.map(o => ({
        id: o.id,
        label: o.label,
        teks_pilihan: o.teks_pilihan
      }));

      responseList.push({
        id: q.id,
        jenis_soal: q.jenis_soal,
        teks_soal: q.teks_soal,
        gambar_url: q.gambar_url || '',
        bobot: q.bobot,
        pilihan: safeOptions
      });
    }

    // Acak urutan soal
    const shuffled = responseList.sort(() => Math.random() - 0.5);

    // Berikan nomor urut baru setelah diacak
    return shuffled.map((s, idx) => ({
      ...s,
      nomor_urut: idx + 1
    }));
  }

  async syncAnswers(siswaId, ujianId, jawabanList) {
    if (!siswaId || !ujianId || !Array.isArray(jawabanList)) {
      throw new ApiError('Data kiriman tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const now = new Date();
    for (const j of jawabanList) {
      await examSessionRepository.saveOrUpdateAnswer({
        siswa_id: parseInt(siswaId),
        ujian_id: parseInt(ujianId),
        soal_id: parseInt(j.soal_id),
        pilihan_jawaban_id: j.pilihan_jawaban_id ? parseInt(j.pilihan_jawaban_id) : null,
        teks_jawaban_essay: j.teks_jawaban_essay || '',
        is_ragu: j.is_ragu ? 1 : 0,
        waktu_dijawab: now
      });
    }

    return true;
  }

  async submitExam(siswaId, ujianId) {
    if (!siswaId || !ujianId) {
      throw new ApiError('Data submit tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const ujian = await examRepository.findExamById(ujianId);
    if (!ujian) {
      throw new ApiError('Sesi ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const sId = parseInt(siswaId);
    const uId = parseInt(ujianId);

    const jawabanSiswa = await examSessionRepository.findStudentAnswers(sId, uId);
    const soalList = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);

    let benar = 0;
    let salah = 0;
    let nilaiPG = 0;
    let totalNilai = 0;

    for (const s of soalList) {
      if (s.jenis_soal === 'PG') {
        const jawaban = jawabanSiswa.find(j => j.soal_id === s.id);
        if (jawaban && jawaban.pilihan_jawaban_id) {
          const options = await questionRepository.findOptionsByQuestionId(s.id);
          const kunci = options.find(o => o.is_kunci === 1 || o.is_kunci === true);
          if (kunci && kunci.id === jawaban.pilihan_jawaban_id) {
            benar++;
            nilaiPG += parseFloat(s.bobot || 1.0);
          } else {
            salah++;
          }
        } else {
          salah++; // Tidak dijawab dihitung salah
        }
      }
    }

    totalNilai = nilaiPG;

    // Pertahankan nilai essay yang telah dinilai guru jika ada
    for (const s of soalList) {
      if (s.jenis_soal === 'ESSAY') {
        const j = jawabanSiswa.find(jw => jw.soal_id === s.id);
        if (j && j.nilai_manual) {
          totalNilai += parseFloat(j.nilai_manual || 0);
        }
      }
    }

    const hasilFields = {
      siswa_id: sId,
      ujian_id: uId,
      jumlah_benar: benar,
      jumlah_salah: salah,
      nilai_akhir: totalNilai,
      waktu_selesai: new Date()
    };

    await examSessionRepository.saveOrUpdateResult(hasilFields);

    return hasilFields;
  }

  async getStudentResults(siswaId) {
    if (!siswaId) {
      throw new ApiError('Siswa ID tidak valid!', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return await examSessionRepository.findResultsByStudent(parseInt(siswaId));
  }
}

module.exports = new StudentExamService();
