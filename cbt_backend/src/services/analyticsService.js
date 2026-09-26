const examRepository = require('../repositories/examRepository');
const questionRepository = require('../repositories/questionRepository');
const examSessionRepository = require('../repositories/examSessionRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class AnalyticsService {
  async calculateItemAnalysis(ujianId) {
    const uId = parseInt(ujianId);
    const exam = await examRepository.findExamById(uId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const questions = await questionRepository.findQuestionsByBankId(exam.bank_soal_id);
    const allAnswers = await examSessionRepository.findAllAnswersByExam(uId);
    const recap = await examSessionRepository.findExamRecap(uId);

    const totalPeserta = recap.length;
    // Map hasil akhir per siswa
    const studentScores = new Map(recap.map(r => [r.siswa_id, parseFloat(r.nilai_akhir || 0)]));

    // Urutkan siswa berdasarkan nilai akhir tertinggi untuk kalkulasi Daya Pembeda (D)
    const sortedStudents = [...recap].sort((a, b) => parseFloat(b.nilai_akhir || 0) - parseFloat(a.nilai_akhir || 0));
    
    // Kelompok Atas (Upper Group) dan Kelompok Bawah (Lower Group) - 27% rule
    const groupSize = Math.max(1, Math.round(totalPeserta * 0.27));
    const upperStudentIds = new Set(sortedStudents.slice(0, groupSize).map(s => s.siswa_id));
    const lowerStudentIds = new Set(sortedStudents.slice(-groupSize).map(s => s.siswa_id));

    const itemAnalysis = [];

    for (const q of questions) {
      const answersForQ = allAnswers.filter(a => a.soal_id === q.id);
      const bobot = parseFloat(q.bobot || 1.0);

      if (q.jenis_soal === 'PG') {
        const options = await questionRepository.findOptionsByQuestionId(q.id);
        const kunci = options.find(o => o.is_kunci === 1 || o.is_kunci === true);
        const kunciId = kunci ? kunci.id : null;

        let totalBenar = 0;
        let upperBenar = 0;
        let lowerBenar = 0;

        for (const ans of answersForQ) {
          const isBenar = kunciId && ans.pilihan_jawaban_id === kunciId;
          if (isBenar) {
            totalBenar++;
            if (upperStudentIds.has(ans.siswa_id)) upperBenar++;
            if (lowerStudentIds.has(ans.siswa_id)) lowerBenar++;
          }
        }

        // 1. Tingkat Kesukaran (P)
        const pIndex = totalPeserta > 0 ? parseFloat((totalBenar / totalPeserta).toFixed(2)) : 0;
        let kesukaranLabel = 'Sedang';
        if (pIndex > 0.70) kesukaranLabel = 'Mudah';
        else if (pIndex < 0.30) kesukaranLabel = 'Sukar';

        // 2. Daya Pembeda (D)
        const pUpper = groupSize > 0 ? (upperBenar / groupSize) : 0;
        const pLower = groupSize > 0 ? (lowerBenar / groupSize) : 0;
        const dIndex = parseFloat((pUpper - pLower).toFixed(2));

        let pembedaLabel = 'Cukup';
        if (dIndex >= 0.40) pembedaLabel = 'Sangat Baik';
        else if (dIndex >= 0.30) pembedaLabel = 'Baik';
        else if (dIndex < 0.20) pembedaLabel = 'Buruk / Perlu Revisi';

        // 3. Distribusi Pilihan Jawaban & Efektivitas Distraktor
        const distractorAnalysis = options.map(opt => {
          const count = answersForQ.filter(a => a.pilihan_jawaban_id === opt.id).length;
          const pct = totalPeserta > 0 ? parseFloat(((count / totalPeserta) * 100).toFixed(1)) : 0;
          const isKunci = opt.id === kunciId;

          let efektivitas = 'Kurang Efektif';
          if (isKunci) {
            efektivitas = 'Kunci Jawaban';
          } else if (count === 0) {
            efektivitas = 'Tidak Berfungsi (0%)';
          } else if (pct >= 5.0) {
            efektivitas = 'Berfungsi Baik';
          }

          return {
            option_id: opt.id,
            label: opt.label,
            teks_pilihan: opt.teks_pilihan,
            is_kunci: isKunci,
            pemilih_count: count,
            pemilih_persen: pct,
            efektivitas
          };
        });

        itemAnalysis.push({
          soal_id: q.id,
          nomor_urut: q.nomor_urut,
          jenis_soal: 'PG',
          teks_soal: q.teks_soal,
          bobot,
          total_menjawab: answersForQ.length,
          total_benar: totalBenar,
          total_salah: totalPeserta - totalBenar,
          tingkat_kesukaran: {
            index: pIndex,
            label: kesukaranLabel
          },
          daya_pembeda: {
            index: dIndex,
            label: pembedaLabel,
            p_upper: parseFloat(pUpper.toFixed(2)),
            p_lower: parseFloat(pLower.toFixed(2))
          },
          distribusi_opsi: distractorAnalysis
        });
      } else {
        // ESSAY
        const graded = answersForQ.filter(a => a.nilai_manual !== null && a.nilai_manual !== undefined);
        let sumScore = 0;
        graded.forEach(g => {
          sumScore += parseFloat(g.nilai_manual || 0);
        });

        const avgScore = graded.length > 0 ? parseFloat((sumScore / graded.length).toFixed(2)) : 0;
        const pIndex = bobot > 0 ? parseFloat((avgScore / bobot).toFixed(2)) : 0;
        let kesukaranLabel = 'Sedang';
        if (pIndex > 0.70) kesukaranLabel = 'Mudah';
        else if (pIndex < 0.30) kesukaranLabel = 'Sukar';

        itemAnalysis.push({
          soal_id: q.id,
          nomor_urut: q.nomor_urut,
          jenis_soal: 'ESSAY',
          teks_soal: q.teks_soal,
          bobot,
          total_menjawab: answersForQ.length,
          sudah_dinilai: graded.length,
          belum_dinilai: answersForQ.length - graded.length,
          rata_rata_skor: avgScore,
          tingkat_kesukaran: {
            index: pIndex,
            label: kesukaranLabel
          }
        });
      }
    }

    return {
      ujian_id: exam.id,
      nama_ujian: exam.nama_ujian,
      total_soal: questions.length,
      total_peserta: totalPeserta,
      analisis_butir: itemAnalysis
    };
  }

  // 1. Difficulty Index (Tingkat Kesukaran P)
  calculateDifficultyIndex(answersForQ, totalPeserta) {
    if (!totalPeserta || totalPeserta <= 0) {
      return { index: 0, kategori: 'Sedang', label: 'Sedang' };
    }
    const totalBenar = answersForQ.filter(a => a.is_correct === 1 || a.is_correct === true).length;
    const pIndex = parseFloat((totalBenar / totalPeserta).toFixed(2));
    let kategori = 'Sedang';
    if (pIndex > 0.70) kategori = 'Mudah';
    else if (pIndex < 0.30) kategori = 'Sukar';

    return {
      index: pIndex,
      kategori,
      label: kategori,
      total_benar: totalBenar,
      total_peserta: totalPeserta
    };
  }

  // 2. Discrimination Index (Daya Pembeda D) - 27% upper & lower group rule
  calculateDiscriminationIndex(answersForQ, totalPeserta, studentRanks) {
    if (!totalPeserta || totalPeserta <= 0 || !studentRanks || studentRanks.length === 0) {
      return { index: 0, kategori: 'Cukup', label: 'Cukup' };
    }
    const sorted = [...studentRanks].sort((a, b) => parseFloat(b.nilai_akhir || 0) - parseFloat(a.nilai_akhir || 0));
    const groupSize = Math.max(1, Math.round(totalPeserta * 0.27));
    const upperIds = new Set(sorted.slice(0, groupSize).map(s => s.siswa_id));
    const lowerIds = new Set(sorted.slice(-groupSize).map(s => s.siswa_id));

    let upperBenar = 0;
    let lowerBenar = 0;

    for (const ans of answersForQ) {
      const isCorrect = ans.is_correct === 1 || ans.is_correct === true;
      if (isCorrect) {
        if (upperIds.has(ans.siswa_id)) upperBenar++;
        if (lowerIds.has(ans.siswa_id)) lowerBenar++;
      }
    }

    const pUpper = groupSize > 0 ? (upperBenar / groupSize) : 0;
    const pLower = groupSize > 0 ? (lowerBenar / groupSize) : 0;
    const dIndex = parseFloat((pUpper - pLower).toFixed(2));

    let kategori = 'Cukup';
    if (dIndex >= 0.40) kategori = 'Sangat Baik';
    else if (dIndex >= 0.30) kategori = 'Baik';
    else if (dIndex < 0.20) kategori = 'Buruk';

    return {
      index: dIndex,
      kategori,
      label: kategori,
      p_upper: parseFloat(pUpper.toFixed(2)),
      p_lower: parseFloat(pLower.toFixed(2))
    };
  }

  // 3. Distractor Efficiency Analysis
  analyzeDistractors(answersForQ, options, totalPeserta) {
    const kunci = options.find(o => o.is_kunci === 1 || o.is_kunci === true);
    const kunciId = kunci ? kunci.id : null;

    return options.map(opt => {
      const count = answersForQ.filter(a => a.pilihan_jawaban_id === opt.id).length;
      const pct = totalPeserta > 0 ? parseFloat(((count / totalPeserta) * 100).toFixed(1)) : 0;
      const isKunci = opt.id === kunciId;

      let efektivitas = 'Kurang Efektif';
      if (isKunci) {
        efektivitas = 'Kunci Jawaban';
      } else if (count === 0) {
        efektivitas = 'Tidak Berfungsi (0%)';
      } else if (pct >= 5.0) {
        efektivitas = 'Berfungsi Baik';
      }

      return {
        option_id: opt.id,
        label: opt.label,
        teks_pilihan: opt.teks_pilihan,
        is_kunci: isKunci,
        count,
        percentage: pct,
        pemilih_count: count,
        pemilih_persen: pct,
        efektivitas
      };
    });
  }

  // 4. Recommendation for question quality
  getRecommendation(pIndex, dIndex, jenisSoal) {
    if (jenisSoal === 'ESSAY') {
      return pIndex >= 0.20 && pIndex <= 0.85 ? 'Diterima' : 'Direvisi';
    }
    if (dIndex >= 0.30 && pIndex >= 0.25 && pIndex <= 0.80) {
      return 'Diterima';
    } else if (dIndex >= 0.20) {
      return 'Direvisi';
    } else {
      return 'Dibuang';
    }
  }

  // Pure statistical aggregation
  calculateStatistics(scores, kkm = 70.0, resultsList = []) {
    const totalPeserta = scores.length;
    if (totalPeserta === 0) {
      return {
        total_peserta: 0,
        mean: 0,
        median: 0,
        highest: 0,
        lowest: 0,
        std_dev: 0,
        passing_rate: 0,
        grade_distribution: { A: 0, B: 0, C: 0, D: 0, E: 0 }
      };
    }

    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const mean = parseFloat((sum / totalPeserta).toFixed(2));
    const sortedScores = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(totalPeserta / 2);
    const median = totalPeserta % 2 !== 0 ? sortedScores[mid] : parseFloat(((sortedScores[mid - 1] + sortedScores[mid]) / 2).toFixed(2));
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    const variance = scores.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / totalPeserta;
    const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));

    let lulusCount = 0;
    const gradeDist = { A: 0, B: 0, C: 0, D: 0, E: 0 };

    resultsList.forEach(r => {
      const s = typeof r === 'number' ? r : parseFloat(r.nilai_akhir || 0);
      const isLulus = typeof r === 'object' && r.status_kelulusan ? r.status_kelulusan === 'LULUS' : s >= kkm;
      if (isLulus) lulusCount++;

      if (s >= 90) gradeDist.A++;
      else if (s >= 80) gradeDist.B++;
      else if (s >= 70) gradeDist.C++;
      else if (s >= 60) gradeDist.D++;
      else gradeDist.E++;
    });

    const passingRate = parseFloat(((lulusCount / totalPeserta) * 100).toFixed(1));

    return {
      total_peserta: totalPeserta,
      mean,
      median,
      highest,
      lowest,
      std_dev: stdDev,
      passing_rate: passingRate,
      grade_distribution: gradeDist
    };
  }

  async calculateClassAnalytics(target, customKkm = 70.0) {
    if (Array.isArray(target)) {
      const scores = target.map(r => typeof r === 'number' ? r : parseFloat(r.nilai_akhir || 0));
      const stats = this.calculateStatistics(scores, customKkm, target);
      return {
        kkm: customKkm,
        ...stats,
        statistik: {
          rata_rata: stats.mean,
          nilai_tertinggi: stats.highest,
          nilai_terendah: stats.lowest,
          standar_deviasi: stats.std_dev,
          persentase_kelulusan: stats.passing_rate
        },
        distribusi_grade: stats.grade_distribution
      };
    }

    const uId = parseInt(target);
    const exam = await examRepository.findExamById(uId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const recap = await examSessionRepository.findExamRecap(uId);
    const kkm = parseFloat(exam.kkm || 70.0);
    const scores = recap.map(r => parseFloat(r.nilai_akhir || 0));
    const stats = this.calculateStatistics(scores, kkm, recap);

    return {
      ujian_id: exam.id,
      nama_ujian: exam.nama_ujian,
      kkm,
      ...stats,
      statistik: {
        rata_rata: stats.mean,
        nilai_tertinggi: stats.highest,
        nilai_terendah: stats.lowest,
        standar_deviasi: stats.std_dev,
        persentase_kelulusan: stats.passing_rate
      },
      distribusi_grade: stats.grade_distribution
    };
  }

  generateRecapCSV(recapData, examInfo = {}) {
    const headers = [
      'No',
      'NIS',
      'Nama Siswa',
      'Kelas',
      'Jumlah Benar',
      'Jumlah Salah',
      'Nilai PG',
      'Nilai Essay',
      'Nilai Akhir',
      'KKM',
      'Status Kelulusan',
      'Waktu Selesai'
    ];

    const rows = (recapData || []).map((r, idx) => {
      const waktu = r.waktu_selesai ? new Date(r.waktu_selesai).toISOString().replace('T', ' ').substring(0, 19) : '-';
      const escape = (val) => `"${(val !== null && val !== undefined ? val.toString() : '').replace(/"/g, '""')}"`;

      return [
        idx + 1,
        escape(r.nis),
        escape(r.nama_siswa || r.nama),
        escape(r.nama_kelas || '-'),
        r.jumlah_benar || 0,
        r.jumlah_salah || 0,
        r.nilai_pg !== null && r.nilai_pg !== undefined ? parseFloat(r.nilai_pg).toFixed(2) : '0.00',
        r.nilai_essay !== null && r.nilai_essay !== undefined ? parseFloat(r.nilai_essay).toFixed(2) : '0.00',
        r.nilai_akhir !== null && r.nilai_akhir !== undefined ? parseFloat(r.nilai_akhir).toFixed(2) : '0.00',
        r.kkm !== null && r.kkm !== undefined ? parseFloat(r.kkm).toFixed(2) : '70.00',
        escape(r.status_kelulusan || 'PENDING'),
        escape(waktu)
      ].join(',');
    });

    return [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  }

  async exportExamRecapCSV(ujianId) {
    const uId = parseInt(ujianId);
    const exam = await examRepository.findExamById(uId);
    if (!exam) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const recap = await examSessionRepository.findExamRecap(uId);
    return this.generateRecapCSV(recap, exam);
  }
}

module.exports = new AnalyticsService();
