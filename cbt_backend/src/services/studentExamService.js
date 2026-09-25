const examRepository = require('../repositories/examRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const questionRepository = require('../repositories/questionRepository');
const proctoringRepository = require('../repositories/proctoringRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

function deterministicShuffle(array, seed) {
  const arr = [...array];
  let s = (Math.abs(seed) || 1) % 2147483647;
  if (s <= 0) s += 2147483646;

  function random() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

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

  async getExamQuestions(ujianId, siswaId = null) {
    const ujian = await examRepository.findExamById(ujianId);
    if (!ujian) {
      throw new ApiError('Sesi ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const sId = siswaId ? parseInt(siswaId) : null;
    let attempt = null;

    if (sId) {
      attempt = await proctoringRepository.findOrCreateAttempt(ujian.id, sId, ujian.durasi_menit);
      if (attempt.status === 'LOCKED') {
        throw new ApiError(
          'Ujian Anda terkunci oleh pengawas anti-cheat. Silakan minta pembukaan kunci kepada guru pengawas!',
          403,
          ERROR_CODES.EXAM_LOCKED
        );
      }
    }

    const questions = await questionRepository.findQuestionsByBankId(ujian.bank_soal_id);
    let orderedQuestions = [...questions];

    // Acak Urutan Soal (Deterministic Fisher-Yates per-siswa)
    if (ujian.randomize_questions) {
      if (attempt && attempt.shuffled_question_order) {
        try {
          const savedIds = JSON.parse(attempt.shuffled_question_order);
          const qMap = new Map(questions.map(q => [q.id, q]));
          const reordered = [];
          for (const id of savedIds) {
            if (qMap.has(id)) reordered.push(qMap.get(id));
          }
          // Tambahkan soal baru jika ada
          for (const q of questions) {
            if (!savedIds.includes(q.id)) reordered.push(q);
          }
          orderedQuestions = reordered;
        } catch (e) {
          orderedQuestions = deterministicShuffle(questions, (sId || 1) * 37 + ujian.id * 19);
        }
      } else {
        const seed = (sId || 1) * 37 + ujian.id * 19;
        orderedQuestions = deterministicShuffle(questions, seed);
        if (attempt) {
          const ids = orderedQuestions.map(q => q.id);
          await proctoringRepository.updateAttemptQuestionOrder(attempt.id, JSON.stringify(ids));
        }
      }
    } else {
      orderedQuestions.sort((a, b) => (a.nomor_urut || 0) - (b.nomor_urut || 0));
    }

    const responseList = [];
    for (let idx = 0; idx < orderedQuestions.length; idx++) {
      const q = orderedQuestions[idx];
      let options = await questionRepository.findOptionsByQuestionId(q.id);

      // Acak Pilihan Jawaban jika opsi aktif
      if (ujian.randomize_options) {
        const optSeed = (sId || 1) * 13 + q.id * 7;
        options = deterministicShuffle(options, optSeed);
      }

      // Strip is_kunci for student security!
      const safeOptions = options.map((o, optIdx) => ({
        id: o.id,
        label: String.fromCharCode(65 + optIdx),
        teks_pilihan: o.teks_pilihan
      }));

      responseList.push({
        id: q.id,
        jenis_soal: q.jenis_soal,
        teks_soal: q.teks_soal,
        gambar_url: q.gambar_url || '',
        bobot: q.bobot,
        nomor_urut: idx + 1,
        pilihan: safeOptions
      });
    }

    return responseList;
  }

  async syncAnswers(siswaId, ujianId, jawabanList) {
    if (!siswaId || !ujianId || !Array.isArray(jawabanList)) {
      throw new ApiError('Data kiriman tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const sId = parseInt(siswaId);
    const uId = parseInt(ujianId);

    // Periksa status terkunci anti-cheat
    const attempt = await proctoringRepository.findAttempt(uId, sId);
    if (attempt && attempt.status === 'LOCKED') {
      throw new ApiError('Ujian Anda terkunci oleh pengawas anti-cheat!', 403, ERROR_CODES.EXAM_LOCKED);
    }

    let syncedCount = 0;
    let conflictCount = 0;

    for (const j of jawabanList) {
      const clientWaktu = j.waktu_dijawab ? new Date(j.waktu_dijawab) : new Date();
      const res = await examSessionRepository.saveOrUpdateAnswer({
        siswa_id: sId,
        ujian_id: uId,
        soal_id: parseInt(j.soal_id),
        pilihan_jawaban_id: j.pilihan_jawaban_id ? parseInt(j.pilihan_jawaban_id) : null,
        teks_jawaban_essay: j.teks_jawaban_essay || '',
        is_ragu: j.is_ragu ? 1 : 0,
        waktu_dijawab: clientWaktu
      });

      if (res && res.status === 'conflict_ignored') {
        conflictCount++;
      } else {
        syncedCount++;
      }
    }

    return {
      success: true,
      synced_count: syncedCount,
      conflicts_ignored: conflictCount,
      server_time: new Date().toISOString()
    };
  }

  async submitExam(siswaId, ujianId) {
    if (!siswaId || !ujianId) {
      throw new ApiError('Data submit tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const sId = parseInt(siswaId);
    const uId = parseInt(ujianId);

    // Periksa status terkunci anti-cheat
    const attempt = await proctoringRepository.findAttempt(uId, sId);
    if (attempt && attempt.status === 'LOCKED') {
      throw new ApiError('Ujian Anda terkunci oleh pengawas anti-cheat!', 403, ERROR_CODES.EXAM_LOCKED);
    }

    const ujian = await examRepository.findExamById(uId);
    if (!ujian) {
      throw new ApiError('Sesi ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

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

    if (attempt) {
      await proctoringRepository.updateAttemptStatus(attempt.id, 'SUBMITTED');
    }

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
