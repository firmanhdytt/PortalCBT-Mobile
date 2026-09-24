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
    if (existing) {
      return await db.update('jawaban_peserta', existing.id, {
        pilihan_jawaban_id: data.pilihan_jawaban_id || null,
        teks_jawaban_essay: data.teks_jawaban_essay || '',
        is_ragu: data.is_ragu ? 1 : 0,
        waktu_dijawab: data.waktu_dijawab || new Date()
      });
    } else {
      return await db.insert('jawaban_peserta', {
        siswa_id: data.siswa_id,
        ujian_id: data.ujian_id,
        soal_id: data.soal_id,
        pilihan_jawaban_id: data.pilihan_jawaban_id || null,
        teks_jawaban_essay: data.teks_jawaban_essay || '',
        is_ragu: data.is_ragu ? 1 : 0,
        waktu_dijawab: data.waktu_dijawab || new Date()
      });
    }
  }

  // --- HASIL UJIAN ---
  async findResultsByStudent(siswaId) {
    return await db.query(`
      SELECT h.*, u.nama_ujian 
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
        s.nama as siswa_nama,
        j.siswa_id,
        q.teks_soal as soal_teks,
        q.bobot as soal_bobot,
        j.teks_jawaban_essay as jawaban_teks,
        j.nilai_manual
      FROM jawaban_peserta j
      JOIN soal q ON j.soal_id = q.id
      JOIN siswa s ON j.siswa_id = s.id
      WHERE j.ujian_id = ? AND q.jenis_soal = 'ESSAY'
      ORDER BY s.nama ASC, q.nomor_urut ASC
    `, [ujianId]);
  }

  async findAnswerById(id) {
    return await db.getById('jawaban_peserta', id);
  }

  async updateAnswer(id, data) {
    return await db.update('jawaban_peserta', id, data);
  }

  // --- REKAPITULASI HASIL ---
  async findExamRecap(ujianId) {
    return await db.query(`
      SELECT 
        s.nis,
        s.nama,
        k.nama_kelas,
        h.jumlah_benar,
        h.jumlah_salah,
        h.nilai_akhir,
        h.waktu_selesai
      FROM hasil_ujian h
      JOIN siswa s ON h.siswa_id = s.id
      LEFT JOIN kelas k ON s.kelas_id = k.id
      WHERE h.ujian_id = ?
      ORDER BY h.nilai_akhir DESC, s.nama ASC
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

      let status = 'Belum Mulai';
      if (result) {
        status = 'Selesai';
      } else if (answers.length > 0) {
        status = 'Sedang Mengerjakan';
      }

      monitoring.push({
        id: s.id,
        nis: s.nis,
        nama: s.nama,
        soal_terjawab: answers.length,
        status,
        waktu_update: answers.length > 0 ? answers[answers.length - 1].waktu_dijawab : '-'
      });
    }

    return monitoring;
  }
}

module.exports = new ExamSessionRepository();
