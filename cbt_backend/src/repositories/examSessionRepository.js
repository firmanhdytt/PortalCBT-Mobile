const db = require('../database/db');

class ExamSessionRepository {
  // --- JAWABAN PESERTA ---
  async findStudentAnswers(siswaId, ujianId) {
    return await db.query(
      'SELECT * FROM jawaban_peserta WHERE siswa_id = ? AND ujian_id = ?',
      [siswaId, ujianId]
    );
  }

  async findSingleAnswer(siswaId, ujianId, soalId) {
    return await db.getOne(
      'SELECT * FROM jawaban_peserta WHERE siswa_id = ? AND ujian_id = ? AND soal_id = ?',
      [siswaId, ujianId, soalId]
    );
  }

  async saveOrUpdateAnswer(data) {
    const existing = await this.findSingleAnswer(data.siswa_id, data.ujian_id, data.soal_id);
    const incomingWaktu = data.waktu_dijawab ? new Date(data.waktu_dijawab) : new Date();

    if (existing) {
      // Conflict Resolution: Last-Write-Wins based on client timestamp
      if (existing.waktu_dijawab) {
        const existingWaktu = new Date(existing.waktu_dijawab);
        if (existingWaktu.getTime() > incomingWaktu.getTime()) {
          // Stale answer packet arrived after newer answer was already recorded.
          return {
            id: existing.id,
            status: 'conflict_ignored',
            existing_time: existingWaktu.toISOString(),
            incoming_time: incomingWaktu.toISOString()
          };
        }
      }

      await db.update('jawaban_peserta', existing.id, {
        pilihan_jawaban_id: data.pilihan_jawaban_id || null,
        teks_jawaban_essay: data.teks_jawaban_essay || '',
        is_ragu: data.is_ragu ? 1 : 0,
        waktu_dijawab: incomingWaktu
      });

      return { id: existing.id, status: 'updated' };
    } else {
      const inserted = await db.insert('jawaban_peserta', {
        siswa_id: data.siswa_id,
        ujian_id: data.ujian_id,
        soal_id: data.soal_id,
        pilihan_jawaban_id: data.pilihan_jawaban_id || null,
        teks_jawaban_essay: data.teks_jawaban_essay || '',
        is_ragu: data.is_ragu ? 1 : 0,
        waktu_dijawab: incomingWaktu
      });

      return { id: inserted.insertId, status: 'inserted' };
    }
  }

  // --- HASIL UJIAN ---
  async findResultsByStudent(siswaId) {
    return await db.query(`
      SELECT 
        h.*, 
        u.nama_ujian, 
        u.kkm, 
        u.show_result, 
        u.durasi_menit
      FROM hasil_ujian h
      LEFT JOIN ujian u ON h.ujian_id = u.id
      WHERE h.siswa_id = ?
      ORDER BY h.id DESC
    `, [siswaId]);
  }

  async findResultByStudentAndExam(siswaId, ujianId) {
    return await db.getOne(
      'SELECT * FROM hasil_ujian WHERE siswa_id = ? AND ujian_id = ?',
      [siswaId, ujianId]
    );
  }

  async saveOrUpdateResult(data) {
    const existing = await this.findResultByStudentAndExam(data.siswa_id, data.ujian_id);
    if (existing) {
      return await db.update('hasil_ujian', existing.id, data);
    } else {
      return await db.insert('hasil_ujian', data);
    }
  }

  // --- ESSAY GRADING ---
  async findEssayAnswersByExam(ujianId) {
    return await db.query(`
      SELECT 
        j.id as jawaban_id,
        s.id as siswa_id,
        s.nama as siswa_nama,
        s.nis,
        q.id as soal_id,
        q.nomor_urut,
        q.teks_soal as soal_teks,
        q.bobot as soal_bobot,
        j.teks_jawaban_essay as jawaban_teks,
        j.nilai_manual,
        j.catatan_guru,
        j.waktu_dijawab,
        IF(j.nilai_manual IS NOT NULL, 1, 0) as is_graded
      FROM jawaban_peserta j
      JOIN soal q ON j.soal_id = q.id
      JOIN siswa s ON j.siswa_id = s.id
      WHERE j.ujian_id = ? AND q.jenis_soal = 'ESSAY'
      ORDER BY (j.nilai_manual IS NULL) DESC, s.nama ASC, q.nomor_urut ASC
    `, [ujianId]);
  }

  async findAnswerById(id) {
    return await db.getById('jawaban_peserta', id);
  }

  async updateAnswer(id, data) {
    return await db.update('jawaban_peserta', id, data);
  }

  // --- REKAPITULASI HASIL & ANALYTICS ---
  async findExamRecap(ujianId) {
    return await db.query(`
      SELECT 
        s.id as siswa_id,
        s.nis,
        s.nama,
        k.nama_kelas,
        h.jumlah_benar,
        h.jumlah_salah,
        h.nilai_pg,
        h.nilai_essay,
        h.nilai_akhir,
        h.status_kelulusan,
        u.kkm,
        h.waktu_selesai
      FROM hasil_ujian h
      JOIN siswa s ON h.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      JOIN ujian u ON h.ujian_id = u.id
      WHERE h.ujian_id = ?
      ORDER BY h.nilai_akhir DESC, s.nama ASC
    `, [ujianId]);
  }

  async findAllAnswersByExam(ujianId) {
    return await db.query(`
      SELECT 
        j.*,
        s.nis,
        s.nama,
        q.jenis_soal,
        q.bobot,
        q.nomor_urut
      FROM jawaban_peserta j
      JOIN siswa s ON j.siswa_id = s.id
      JOIN soal q ON j.soal_id = q.id
      WHERE j.ujian_id = ?
    `, [ujianId]);
  }

  // --- LIVE MONITORING ---
  async findMonitoringData(ujianId, kelasId) {
    const students = await db.query(`
      SELECT id, nis, nama 
      FROM siswa 
      WHERE kelas_id = ? 
      ORDER BY nama ASC
    `, [kelasId]);

    const monitoring = [];
    for (const s of students) {
      const answers = await db.query(
        'SELECT id, waktu_dijawab FROM jawaban_peserta WHERE siswa_id = ? AND ujian_id = ? ORDER BY waktu_dijawab ASC',
        [s.id, ujianId]
      );
      const result = await this.findResultByStudentAndExam(s.id, ujianId);
      const attempt = await db.getOne(
        'SELECT * FROM exam_attempts WHERE siswa_id = ? AND ujian_id = ? ORDER BY id DESC LIMIT 1',
        [s.id, ujianId]
      );
      const strikesRow = await db.query(
        'SELECT COUNT(*) as cnt FROM exam_violations WHERE siswa_id = ? AND ujian_id = ?',
        [s.id, ujianId]
      );
      const strikes = strikesRow && strikesRow[0] ? strikesRow[0].cnt : 0;
      const pendingUnlock = await db.getOne(
        'SELECT * FROM unlock_requests WHERE siswa_id = ? AND ujian_id = ? AND status = "PENDING" ORDER BY id DESC LIMIT 1',
        [s.id, ujianId]
      );

      let status = 'Belum Mulai';
      if (result) {
        status = 'Selesai';
      } else if (attempt && attempt.status === 'LOCKED') {
        status = 'Terkunci (Anti-Cheat)';
      } else if (answers.length > 0 || (attempt && attempt.status === 'IN_PROGRESS')) {
        status = 'Sedang Mengerjakan';
      }

      monitoring.push({
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        soal_terjawab: answers.length,
        status,
        strikes,
        is_locked: attempt ? attempt.status === 'LOCKED' : false,
        pending_unlock_id: pendingUnlock ? pendingUnlock.id : null,
        pending_unlock_reason: pendingUnlock ? pendingUnlock.reason : null,
        waktu_update: answers.length > 0 ? answers[answers.length - 1].waktu_dijawab : '-'
      });
    }

    return monitoring;
  }
}

module.exports = new ExamSessionRepository();
