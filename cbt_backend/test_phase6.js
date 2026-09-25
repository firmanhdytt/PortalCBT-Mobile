require('dotenv').config();
const db = require('./src/database/db');
const studentExamService = require('./src/services/studentExamService');
const proctoringService = require('./src/services/proctoringService');
const proctoringRepository = require('./src/repositories/proctoringRepository');
const { ERROR_CODES } = require('./src/utils/errorCodes');

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('🧪 CBT BACKEND PHASE 6 PROCTORING & EXAM ENGINE TEST');
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
    const siswaId = 1;
    const ujianId = 1;

    // Reset violations, unlock requests, and attempts for testing clean state
    await db.query('DELETE FROM exam_violations WHERE siswa_id = ? AND ujian_id = ?', [siswaId, ujianId]);
    await db.query('DELETE FROM unlock_requests WHERE siswa_id = ? AND ujian_id = ?', [siswaId, ujianId]);
    await db.query('DELETE FROM exam_attempts WHERE siswa_id = ? AND ujian_id = ?', [siswaId, ujianId]);

    console.log('--- 1. DETERMINISTIC QUESTION RANDOMIZATION ---');
    const q1 = await studentExamService.getExamQuestions(ujianId, siswaId);
    const q2 = await studentExamService.getExamQuestions(ujianId, siswaId);

    assert(Array.isArray(q1) && q1.length > 0, `Berhasil mengambil daftar soal (${q1.length} butir)`);
    assert(q1.length === q2.length, 'Jumlah soal konsisten');

    const order1 = q1.map(q => q.id).join(',');
    const order2 = q2.map(q => q.id).join(',');
    assert(order1 === order2, `Urutan soal deterministik konsisten (${order1})`);

    // Verify option labels are stripped of is_kunci
    let hasKunciLeaked = false;
    for (const q of q1) {
      for (const opt of q.pilihan) {
        if ('is_kunci' in opt) hasKunciLeaked = true;
      }
    }
    assert(!hasKunciLeaked, 'Kunci jawaban aman ter-strip dari pilihan untuk siswa');

    console.log('\n--- 2. ANTI-CHEAT STRIKES (VIOLATION RECORDING) ---');
    // Strike 1: App minimized
    const strike1 = await proctoringService.recordViolation({
      siswa_id: siswaId,
      ujian_id: ujianId,
      violation_type: 'APP_MINIMIZED',
      description: 'Siswa beralih ke aplikasi WhatsApp'
    });
    assert(strike1.strike_number === 1, 'Strike 1 tercatat dengan benar');
    assert(strike1.is_locked === false, 'Ujian belum terkunci pada strike 1');
    assert(strike1.remaining_strikes === 2, 'Sisa kesempatan strike = 2');

    // Strike 2: Screen switch
    const strike2 = await proctoringService.recordViolation({
      siswa_id: siswaId,
      ujian_id: ujianId,
      violation_type: 'SCREEN_SWITCH',
      description: 'Siswa membuka split screen'
    });
    assert(strike2.strike_number === 2, 'Strike 2 tercatat');
    assert(strike2.is_locked === false, 'Ujian masih aktif pada strike 2');
    assert(strike2.remaining_strikes === 1, 'Sisa kesempatan strike = 1');

    console.log('\n--- 3. ANTI-CHEAT LOCK THRESHOLD (STRIKE 3) ---');
    // Strike 3: Kiosk escape attempt -> Must trigger lock!
    const strike3 = await proctoringService.recordViolation({
      siswa_id: siswaId,
      ujian_id: ujianId,
      violation_type: 'KIOSK_ESCAPE_ATTEMPT',
      description: 'Upaya keluar dari immersive mode'
    });
    assert(strike3.strike_number === 3, 'Strike 3 tercatat');
    assert(strike3.is_locked === true, 'Ujian otomatis TERKUNCI pada strike ke-3!');

    // Check attempt status in DB
    const attempt = await proctoringRepository.findAttempt(ujianId, siswaId);
    assert(attempt && attempt.status === 'LOCKED', 'Status exam_attempts di database berstatus LOCKED');

    console.log('\n--- 4. ENFORCEMENT: REJECTION ON LOCKED ATTEMPT ---');
    let syncBlocked = false;
    try {
      await studentExamService.syncAnswers(siswaId, ujianId, [
        { soal_id: q1[0].id, pilihan_jawaban_id: 1, waktu_dijawab: new Date().toISOString() }
      ]);
    } catch (e) {
      if (e.code === ERROR_CODES.EXAM_LOCKED || e.errorCode === ERROR_CODES.EXAM_LOCKED) syncBlocked = true;
    }
    assert(syncBlocked, 'Sync jawaban ditolak saat sesi ujian TERKUNCI (EXAM_LOCKED)');

    let questionFetchBlocked = false;
    try {
      await studentExamService.getExamQuestions(ujianId, siswaId);
    } catch (e) {
      if (e.code === ERROR_CODES.EXAM_LOCKED || e.errorCode === ERROR_CODES.EXAM_LOCKED) questionFetchBlocked = true;
    }
    assert(questionFetchBlocked, 'Pengambilan soal ditolak saat ujian TERKUNCI');

    console.log('\n--- 5. UNLOCK REQUEST WORKFLOW ---');
    const unlockReq = await proctoringService.requestUnlock({
      siswa_id: siswaId,
      ujian_id: ujianId,
      reason: 'Tidak sengaja menekan notifikasi sistem'
    });
    assert(unlockReq.request && unlockReq.request.status === 'PENDING', 'Permohonan buka kunci dibuat dengan status PENDING');
    const reqId = unlockReq.request.id;

    // Check status API
    const statusResult = await proctoringService.getUnlockStatus(ujianId, siswaId);
    assert(statusResult.is_locked === true, 'Status siswa terkonfirmasi is_locked = true');
    assert(statusResult.strikes === 3, 'Jumlah total pelanggaran = 3');
    assert(statusResult.latest_request && statusResult.latest_request.status === 'PENDING', 'Latest request status adalah PENDING');

    console.log('\n--- 6. TEACHER PROCTORING MONITORING DASHBOARD ---');
    const monitoring = await proctoringService.getProctoringMonitoring(ujianId);
    assert(monitoring && monitoring.students.length > 0, 'Monitoring guru berhasil mengambil data');
    const studentEntry = monitoring.students.find(s => s.siswa_id === siswaId);
    assert(studentEntry && studentEntry.status === 'TERKUNCI', 'Siswa terdeteksi berstatus TERKUNCI di panel guru');
    assert(studentEntry && studentEntry.strikes === 3, 'Strikes terhitung 3 di panel pengawas guru');
    assert(studentEntry && studentEntry.pending_unlock != null, 'Pending unlock request terlihat di panel guru');

    console.log('\n--- 7. TEACHER APPROVAL & UNLOCK EXECUTION ---');
    const teacherReviewerId = 2; // Pak Budi (Guru)
    const reviewRes = await proctoringService.reviewUnlockRequest(reqId, 'APPROVE', teacherReviewerId);
    assert(reviewRes.status === 'APPROVED', 'Permohonan buka kunci disetujui guru (APPROVED)');

    // Verify attempt is unlocked
    const unlockedAttempt = await proctoringRepository.findAttempt(ujianId, siswaId);
    assert(unlockedAttempt.status === 'IN_PROGRESS', 'Status exam_attempts kembali ke IN_PROGRESS');

    console.log('\n--- 8. RESUME AFTER UNLOCK ---');
    // Student can now fetch questions and sync answers again
    const resumedQuestions = await studentExamService.getExamQuestions(ujianId, siswaId);
    assert(Array.isArray(resumedQuestions) && resumedQuestions.length > 0, 'Siswa dapat mengakses kembali soal setelah dibuka kuncinya');

    const resync = await studentExamService.syncAnswers(siswaId, ujianId, [
      { soal_id: resumedQuestions[0].id, pilihan_jawaban_id: 1, waktu_dijawab: new Date().toISOString() }
    ]);
    assert(resync.success === true, 'Jawaban berhasil disinkronkan setelah pembukaan kunci');

    console.log('\n--- 9. TEACHER MANUAL RESET OF VIOLATIONS ---');
    await proctoringService.manualUnlock(ujianId, siswaId);
    const strikesAfterReset = await proctoringRepository.countViolations(siswaId, ujianId);
    assert(strikesAfterReset === 0, 'Strikes berhasil direset menjadi 0');

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Error executing Phase 6 tests:', err);
    process.exit(1);
  }
}

runPhase6Tests();
