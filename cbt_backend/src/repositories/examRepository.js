const db = require('../database/db');

class ExamRepository {
  async findAllExamsWithStats() {
    const exams = await db.query(`
      SELECT u.*, k.nama_kelas, b.judul as judul_bank_soal
      FROM ujian u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      LEFT JOIN bank_soal b ON u.bank_soal_id = b.id
      ORDER BY u.id DESC
    `);

    // Attach student completion statistics
    for (const u of exams) {
      const totalRows = await db.query('SELECT COUNT(*) as cnt FROM siswa WHERE kelas_id = ?', [u.kelas_id]);
      const selesaiRows = await db.query('SELECT COUNT(*) as cnt FROM hasil_ujian WHERE ujian_id = ?', [u.id]);
      
      u.total_siswa = totalRows && totalRows[0] ? totalRows[0].cnt : 0;
      u.selesai_siswa = selesaiRows && selesaiRows[0] ? selesaiRows[0].cnt : 0;
      u.is_aktif = u.is_aktif === 1 || u.is_aktif === true;
    }

    return exams;
  }

  async findExamById(id) {
    return await db.getOne(`
      SELECT u.*, k.nama_kelas, b.judul as judul_bank_soal
      FROM ujian u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      LEFT JOIN bank_soal b ON u.bank_soal_id = b.id
      WHERE u.id = ?
    `, [id]);
  }

  async findActiveExamsByKelas(kelasId, siswaId = null) {
    let sql = `
      SELECT u.*, k.nama_kelas
      FROM ujian u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE u.kelas_id = ? AND u.is_aktif = 1
    `;
    const params = [kelasId];

    if (siswaId) {
      sql += ' AND u.id NOT IN (SELECT ujian_id FROM hasil_ujian WHERE siswa_id = ?)';
      params.push(siswaId);
    }

    sql += ' ORDER BY u.id DESC';
    const rows = await db.query(sql, params);
    return rows.map(r => ({
      ...r,
      is_aktif: r.is_aktif === 1 || r.is_aktif === true
    }));
  }

  async createExam(data) {
    return await db.insert('ujian', data);
  }

  async updateExam(id, data) {
    return await db.update('ujian', id, data);
  }

  async deleteExam(id) {
    return await db.delete('ujian', id);
  }

  async toggleExam(id) {
    const exam = await this.findExamById(id);
    if (!exam) return null;
    const newStatus = exam.is_aktif ? 0 : 1;
    await db.update('ujian', id, { is_aktif: newStatus });
    return { ...exam, is_aktif: newStatus === 1 };
  }
}

module.exports = new ExamRepository();
