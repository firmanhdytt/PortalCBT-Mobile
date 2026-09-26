require('dotenv').config();
const db = require('./src/database/db');
const studentExamService = require('./src/services/studentExamService');
const examService = require('./src/services/examService');
const analyticsService = require('./src/services/analyticsService');

async function runPhase7Tests() {
  console.log('====================================================');
  console.log('🧪 CBT BACKEND PHASE 7 SCORING, ESSAY & ANALYTICS TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: PSYCHOMETRIC ANALYTICS UNIT TESTS
    // ----------------------------------------------------
    console.log('--- 1. PSYCHOMETRIC ITEM ANALYSIS (P & D INDEX) ---');
    
    // Simulate 10 students: 5 upper, 5 lower
    const sampleOptions = [
      { id: 1, label: 'A', teks_pilihan: 'Option A', is_kunci: 1 },
      { id: 2, label: 'B', teks_pilihan: 'Option B', is_kunci: 0 },
      { id: 3, label: 'C', teks_pilihan: 'Option C', is_kunci: 0 },
      { id: 4, label: 'D', teks_pilihan: 'Option D', is_kunci: 0 }
    ];

    // Q1: Upper all correct (5/5), Lower 1 correct (1/5) -> Good discriminator
    const q1Answers = [
      { siswa_id: 1, pilihan_jawaban_id: 1, is_correct: 1 },
      { siswa_id: 2, pilihan_jawaban_id: 1, is_correct: 1 },
      { siswa_id: 3, pilihan_jawaban_id: 1, is_correct: 1 },
      { siswa_id: 4, pilihan_jawaban_id: 1, is_correct: 1 },
      { siswa_id: 5, pilihan_jawaban_id: 1, is_correct: 1 },
      { siswa_id: 6, pilihan_jawaban_id: 2, is_correct: 0 },
      { siswa_id: 7, pilihan_jawaban_id: 3, is_correct: 0 },
      { siswa_id: 8, pilihan_jawaban_id: 4, is_correct: 0 },
      { siswa_id: 9, pilihan_jawaban_id: 2, is_correct: 0 },
      { siswa_id: 10, pilihan_jawaban_id: 1, is_correct: 1 }
    ];

    const studentRanks = [
      { siswa_id: 1, nilai_akhir: 90 },
      { siswa_id: 2, nilai_akhir: 85 },
      { siswa_id: 3, nilai_akhir: 80 },
      { siswa_id: 4, nilai_akhir: 75 },
      { siswa_id: 5, nilai_akhir: 70 },
      { siswa_id: 6, nilai_akhir: 60 },
      { siswa_id: 7, nilai_akhir: 55 },
      { siswa_id: 8, nilai_akhir: 50 },
      { siswa_id: 9, nilai_akhir: 45 },
      { siswa_id: 10, nilai_akhir: 40 }
    ];

    const pResult = analyticsService.calculateDifficultyIndex(q1Answers, 10);
    assert(pResult.index === 0.6, `Tingkat Kesukaran P = 0.60 (Expected 0.60, got ${pResult.index})`);
    assert(pResult.kategori === 'Sedang', `Kategori Kesukaran: Sedang (${pResult.kategori})`);

    const dResult = analyticsService.calculateDiscriminationIndex(q1Answers, 10, studentRanks);
    assert(dResult.index > 0.4, `Daya Pembeda D > 0.40 (Got ${dResult.index})`);
    assert(dResult.kategori === 'Sangat Baik', `Kategori Daya Pembeda: Sangat Baik (${dResult.kategori})`);

    const distResult = analyticsService.analyzeDistractors(q1Answers, sampleOptions, 10);
    assert(distResult.length === 4, `Menganalisis 4 pilihan distraktor (${distResult.length})`);
    const keyDist = distResult.find(d => d.is_kunci);
    assert(keyDist && keyDist.label === 'A' && keyDist.count === 6, `Kunci A dipilih oleh 6 siswa (${keyDist ? keyDist.count : 0})`);

    const rec = analyticsService.getRecommendation(pResult.index, dResult.index, 'PG');
    assert(rec === 'Diterima', `Rekomendasi butir berkualitas baik: Diterima (${rec})`);

    // ----------------------------------------------------
    // TEST SUITE 2: CLASS AGGREGATE ANALYTICS
    // ----------------------------------------------------
    console.log('\n--- 2. CLASS AGGREGATE STATISTICAL ANALYTICS ---');
    const classResults = [
      { nilai_akhir: 90, status_kelulusan: 'LULUS' },
      { nilai_akhir: 80, status_kelulusan: 'LULUS' },
      { nilai_akhir: 70, status_kelulusan: 'REMIDI' },
      { nilai_akhir: 60, status_kelulusan: 'REMIDI' }
    ];
    const classAnalytics = await analyticsService.calculateClassAnalytics(classResults, 75);
    assert(classAnalytics.total_peserta === 4, `Total peserta: 4 (${classAnalytics.total_peserta})`);
    assert(classAnalytics.mean === 75, `Nilai rata-rata (Mean): 75 (${classAnalytics.mean})`);
    assert(classAnalytics.median === 75, `Nilai median: 75 (${classAnalytics.median})`);
    assert(classAnalytics.highest === 90, `Nilai tertinggi: 90 (${classAnalytics.highest})`);
    assert(classAnalytics.lowest === 60, `Nilai terendah: 60 (${classAnalytics.lowest})`);
    assert(classAnalytics.passing_rate === 50, `Persentase kelulusan: 50% (${classAnalytics.passing_rate}%)`);
    assert(classAnalytics.grade_distribution.A === 1, `Distribusi Nilai A: 1 siswa (${classAnalytics.grade_distribution.A})`);

    // ----------------------------------------------------
    // TEST SUITE 3: CSV RECAP EXPORT RFC 4180
    // ----------------------------------------------------
    console.log('\n--- 3. RFC 4180 COMPLIANT CSV EXPORT ---');
    const dummyRecap = [
      {
        nis: '1001',
        nama_siswa: 'Budi "The Ace" Santoso',
        nama_kelas: 'X-RPL-1',
        jumlah_benar: 15,
        jumlah_salah: 5,
        nilai_pg: 75,
        nilai_essay: 20,
        nilai_akhir: 95,
        kkm: 75,
        status_kelulusan: 'LULUS',
        waktu_selesai: '2026-09-26 10:00:00'
      }
    ];
    const csvContent = analyticsService.generateRecapCSV(dummyRecap, { nama_ujian: 'Ujian Akhir Semester' });
    assert(csvContent.includes('"No","NIS","Nama Siswa"'), 'CSV memuat baris header yang valid');
    assert(csvContent.includes('""The Ace""'), 'Karakter kutip ganda di-escape secara valid sesuai RFC 4180');
    assert(csvContent.includes('LULUS'), 'Status kelulusan tertera dalam berkas CSV');

    // ----------------------------------------------------
    // TEST SUITE 4: END-TO-END SCORING & ESSAY GRADING IN DATABASE
    // ----------------------------------------------------
    console.log('\n--- 4. END-TO-END SCORING & ESSAY GRADING (DB INTEGRATION) ---');
    
    const siswaList = await db.query('SELECT id, kelas_id FROM siswa LIMIT 1');
    const siswaId = siswaList[0].id;
    const kelasId = siswaList[0].kelas_id;
    const guruList = await db.query('SELECT id FROM guru LIMIT 1');
    const guruId = guruList[0].id;

    // Create Bank Soal
    const bankRes = await db.execute(
      'INSERT INTO bank_soal (judul, deskripsi, mapel_id, guru_id) VALUES (?, ?, (SELECT id FROM mata_pelajaran LIMIT 1), ?)',
      ['Bank Soal Phase 7 Testing', 'Testing Bank Soal', guruId]
    );
    const bankId = bankRes.insertId;

    // Insert 1 PG Question (bobot 40)
    const soalPgRes = await db.execute(
      'INSERT INTO soal (bank_soal_id, jenis_soal, teks_soal, bobot) VALUES (?, "PG", "Apa ibukota Indonesia?", 40)',
      [bankId]
    );
    const soalPgId = soalPgRes.insertId;
    const optARes = await db.execute(
      'INSERT INTO pilihan_jawaban (soal_id, label, teks_pilihan, is_kunci) VALUES (?, "A", "Nusantara", 1)',
      [soalPgId]
    );
    const optAId = optARes.insertId;
    await db.execute(
      'INSERT INTO pilihan_jawaban (soal_id, label, teks_pilihan, is_kunci) VALUES (?, "B", "Bandung", 0)',
      [soalPgId]
    );

    // Insert 1 Essay Question (bobot 60)
    const soalEssayRes = await db.execute(
      'INSERT INTO soal (bank_soal_id, jenis_soal, teks_soal, bobot) VALUES (?, "ESSAY", "Jelaskan prinsip Clean Architecture!", 60)',
      [bankId]
    );
    const soalEssayId = soalEssayRes.insertId;

    // Create Ujian with KKM = 75
    const ujianRes = await db.execute(
      'INSERT INTO ujian (nama_ujian, bank_soal_id, kelas_id, durasi_menit, token, kkm, is_aktif) VALUES (?, ?, ?, 60, "PHASE7", 75, 1)',
      ['Ujian Phase 7 End-to-End Test', bankId, kelasId]
    );
    const ujianId = ujianRes.insertId;

    // Save student answers: PG correct (A), Essay answered (nilai_manual = NULL)
    await db.execute(
      'INSERT INTO jawaban_peserta (ujian_id, siswa_id, soal_id, pilihan_jawaban_id, is_ragu) VALUES (?, ?, ?, ?, 0)',
      [ujianId, siswaId, soalPgId, optAId]
    );
    const ansEssayRes = await db.execute(
      'INSERT INTO jawaban_peserta (ujian_id, siswa_id, soal_id, teks_jawaban_essay, nilai_manual, is_ragu) VALUES (?, ?, ?, "Separation of concerns dan dependency inversion.", NULL, 0)',
      [ujianId, siswaId, soalEssayId]
    );
    const essayJawabanId = ansEssayRes.insertId;

    // Student submits exam
    const submitResult = await studentExamService.submitExam(siswaId, ujianId);
    assert(submitResult.jumlah_benar === 1, `PG Benar: 1 (${submitResult.jumlah_benar})`);
    assert(submitResult.nilai_pg === 40, `Nilai PG dihitung proporsional: 40 (${submitResult.nilai_pg})`);
    assert(submitResult.status_kelulusan === 'PENDING', `Status awal ujian dengan essay: PENDING (${submitResult.status_kelulusan})`);

    // Fetch essay list for teacher
    const essayList = await examService.getEssayList(ujianId);
    assert(essayList.length === 1, `Guru dapat melihat daftar essay yang perlu dikoreksi (${essayList.length})`);
    assert(essayList[0].jawaban_id === essayJawabanId, 'ID jawaban essay sesuai');

    // Test Validation: Score exceeds bobot (bobot 60, grade 70 -> should fail)
    let gradeExceededFailed = false;
    try {
      await examService.gradeEssay(essayJawabanId, 70, 'Nilai melampaui');
    } catch (err) {
      gradeExceededFailed = true;
    }
    assert(gradeExceededFailed, 'Sistem menolak input nilai yang melampaui bobot maksimal');

    // Teacher grades essay with 45 points (Total 40 + 45 = 85 >= KKM 75 -> LULUS)
    const gradeResult = await examService.gradeEssay(essayJawabanId, 45, 'Analisis Clean Architecture sangat baik dan tepat.');
    assert(gradeResult.recalculated_result.nilai_essay === 45, `Nilai essay terakumulasi: 45 (${gradeResult.recalculated_result.nilai_essay})`);
    assert(gradeResult.recalculated_result.nilai_akhir === 85, `Nilai akhir terakumulasi (PG 40 + Essay 45 = 85): ${gradeResult.recalculated_result.nilai_akhir}`);
    assert(gradeResult.recalculated_result.status_kelulusan === 'LULUS', `Status kelulusan otomatis bertransisi ke LULUS (${gradeResult.recalculated_result.status_kelulusan})`);

    // Verify catatan_guru saved
    const savedNoteRes = await db.query('SELECT catatan_guru FROM jawaban_peserta WHERE id = ?', [essayJawabanId]);
    assert(savedNoteRes[0].catatan_guru.includes('sangat baik'), `Catatan guru tersimpan: "${savedNoteRes[0].catatan_guru}"`);

    // Fetch Recap from examService
    const recap = await examService.getExamRecap(ujianId);
    assert(recap.length === 1, `Rekap memuat hasil 1 peserta (${recap.length})`);
    assert(recap[0].status_kelulusan === 'LULUS', `Status di rekap sesuai: LULUS`);

    // Clean up test data
    await db.query('DELETE FROM jawaban_peserta WHERE ujian_id = ?', [ujianId]);
    await db.query('DELETE FROM hasil_ujian WHERE ujian_id = ?', [ujianId]);
    await db.query('DELETE FROM ujian WHERE id = ?', [ujianId]);
    await db.query('DELETE FROM pilihan_jawaban WHERE soal_id IN (?, ?)', [soalPgId, soalEssayId]);
    await db.query('DELETE FROM soal WHERE bank_soal_id = ?', [bankId]);
    await db.query('DELETE FROM bank_soal WHERE id = ?', [bankId]);

  } catch (err) {
    console.error('💥 UNEXPECTED ERROR IN TEST:', err);
    failed++;
  } finally {
    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runPhase7Tests();
