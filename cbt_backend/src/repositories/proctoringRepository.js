const db = require('../database/db');

class ProctoringRepository {
  // --- EXAM ATTEMPTS ---
  async findOrCreateAttempt(ujianId, siswaId, durasiMenit = 60) {
    const existing = await db.getOne(
      'SELECT * FROM exam_attempts WHERE ujian_id = ? AND siswa_id = ? ORDER BY attempt_number DESC LIMIT 1',
      [ujianId, siswaId]
    );

    if (existing) {
      return existing;
    }

    const inserted = await db.insert('exam_attempts', {
      ujian_id: ujianId,
      siswa_id: siswaId,
      attempt_number: 1,
      sisa_waktu_detik: durasiMenit * 60,
      status: 'IN_PROGRESS'
    });

    return await db.getById('exam_attempts', inserted.id);
  }

  async findAttempt(ujianId, siswaId) {
    return await db.getOne(
      'SELECT * FROM exam_attempts WHERE ujian_id = ? AND siswa_id = ? ORDER BY attempt_number DESC LIMIT 1',
      [ujianId, siswaId]
    );
  }

  async findAttemptById(attemptId) {
    return await db.getById('exam_attempts', attemptId);
  }

  async updateAttemptStatus(attemptId, status) {
    return await db.update('exam_attempts', attemptId, { status });
  }

  async updateAttemptQuestionOrder(attemptId, orderJson) {
    return await db.update('exam_attempts', attemptId, { shuffled_question_order: orderJson });
  }

  async updateAttemptRemainingTime(attemptId, sisaDetik) {
    return await db.update('exam_attempts', attemptId, { sisa_waktu_detik: sisaDetik });
  }

  // --- VIOLATIONS ---
  async recordViolation({ attempt_id, siswa_id, ujian_id, violation_type, description }) {
    // Hitung jumlah pelanggaran sebelumnya untuk attempt ini
    const countRow = await db.query(
      'SELECT COUNT(*) as count FROM exam_violations WHERE ujian_id = ? AND siswa_id = ?',
      [ujian_id, siswa_id]
    );
    const strikeNumber = (countRow && countRow[0] ? countRow[0].count : 0) + 1;

    const inserted = await db.insert('exam_violations', {
      attempt_id: attempt_id || null,
      siswa_id: siswa_id,
      ujian_id: ujian_id,
      strike_number: strikeNumber,
      violation_type: violation_type,
      description: description || 'Pelanggaran terdeteksi oleh sistem proctoring'
    });

    return {
      id: inserted.id,
      strike_number: strikeNumber,
      violation_type,
      description,
      recorded_at: new Date()
    };
  }

  async getViolationsByStudentAndExam(siswaId, ujianId) {
    return await db.query(
      'SELECT * FROM exam_violations WHERE siswa_id = ? AND ujian_id = ? ORDER BY strike_number ASC',
      [siswaId, ujianId]
    );
  }

  async countViolations(siswaId, ujianId) {
    const res = await db.query(
      'SELECT COUNT(*) as total FROM exam_violations WHERE siswa_id = ? AND ujian_id = ?',
      [siswaId, ujianId]
    );
    return res && res[0] ? res[0].total : 0;
  }

  // --- UNLOCK REQUESTS ---
  async createUnlockRequest({ attempt_id, siswa_id, ujian_id, reason }) {
    const inserted = await db.insert('unlock_requests', {
      attempt_id: attempt_id || null,
      siswa_id: siswa_id,
      ujian_id: ujian_id,
      reason: reason || 'Permohonan buka kunci ujian',
      status: 'PENDING'
    });

    return await db.getById('unlock_requests', inserted.id);
  }

  async findPendingUnlockRequest(siswaId, ujianId) {
    return await db.getOne(
      'SELECT * FROM unlock_requests WHERE siswa_id = ? AND ujian_id = ? AND status = "PENDING" ORDER BY id DESC LIMIT 1',
      [siswaId, ujianId]
    );
  }

  async findLatestUnlockRequest(siswaId, ujianId) {
    return await db.getOne(
      'SELECT * FROM unlock_requests WHERE siswa_id = ? AND ujian_id = ? ORDER BY id DESC LIMIT 1',
      [siswaId, ujianId]
    );
  }

  async findUnlockRequestById(requestId) {
    return await db.getById('unlock_requests', requestId);
  }

  async reviewUnlockRequest(requestId, status, reviewerId) {
    return await db.update('unlock_requests', requestId, {
      status,
      reviewed_by: reviewerId || null,
      reviewed_at: new Date()
    });
  }

  // --- PROCTORING MONITORING FOR TEACHER ---
  async getProctoringMonitoring(ujianId) {
    const exam = await db.getById('ujian', ujianId);
    if (!exam) return null;

    const students = await db.query(`
      SELECT 
        s.id as siswa_id,
        s.nis,
        s.nama,
        k.nama_kelas,
        a.id as attempt_id,
        a.status as attempt_status,
        a.sisa_waktu_detik,
        h.id as hasil_id,
        h.nilai_akhir
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN exam_attempts a ON a.siswa_id = s.id AND a.ujian_id = ?
      LEFT JOIN hasil_ujian h ON h.siswa_id = s.id AND h.ujian_id = ?
      WHERE s.kelas_id = ?
      ORDER BY s.nama ASC
    `, [ujianId, ujianId, exam.kelas_id]);

    const enriched = [];
    for (const st of students) {
      const violations = await this.getViolationsByStudentAndExam(st.siswa_id, ujianId);
      const pendingUnlock = await this.findPendingUnlockRequest(st.siswa_id, ujianId);

      let computedStatus = 'BELUM_MULAI';
      if (st.attempt_status === 'LOCKED') {
        computedStatus = 'TERKUNCI';
      } else if (st.attempt_status === 'SUBMITTED' || (st.hasil_id && st.attempt_status !== 'IN_PROGRESS')) {
        computedStatus = 'SELESAI';
      } else if (st.attempt_status === 'IN_PROGRESS') {
        computedStatus = 'SEDANG_MENGERJAKAN';
      }

      enriched.push({
        siswa_id: st.siswa_id,
        nis: st.nis,
        nama: st.nama,
        nama_kelas: st.nama_kelas,
        attempt_id: st.attempt_id,
        status: computedStatus,
        sisa_waktu_detik: st.sisa_waktu_detik || 0,
        strikes: violations.length,
        max_violations: exam.max_violations || 3,
        violations: violations,
        pending_unlock: pendingUnlock,
        nilai_akhir: st.nilai_akhir
      });
    }

    return {
      ujian_id: exam.id,
      nama_ujian: exam.nama_ujian,
      token: exam.token,
      max_violations: exam.max_violations || 3,
      students: enriched
    };
  }

  async resetViolationsAndUnlock(ujianId, siswaId) {
    // 1. Delete violations for this student and exam
    await db.query('DELETE FROM exam_violations WHERE ujian_id = ? AND siswa_id = ?', [ujianId, siswaId]);

    // 2. Mark any pending unlock request as APPROVED
    await db.query(
      'UPDATE unlock_requests SET status = "APPROVED", reviewed_at = NOW() WHERE ujian_id = ? AND siswa_id = ? AND status = "PENDING"',
      [ujianId, siswaId]
    );

    // 3. Unlock attempt back to IN_PROGRESS
    const attempt = await this.findAttempt(ujianId, siswaId);
    if (attempt) {
      await this.updateAttemptStatus(attempt.id, 'IN_PROGRESS');
    }

    return { success: true };
  }
}

module.exports = new ProctoringRepository();
