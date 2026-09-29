const db = require('../database/db');

class QuestionRepository {
  // --- BANK SOAL ---
  async findAllBankSoal(guruUserId = null) {
    if (!guruUserId) {
      return await db.query(`
        SELECT b.*, m.nama_mapel, k.nama_kelas, g.nama as nama_guru
        FROM bank_soal b
        LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
        LEFT JOIN kelas k ON b.kelas_id = k.id
        LEFT JOIN guru g ON b.guru_id = g.id
        ORDER BY b.id DESC
      `);
    }

    return await db.query(`
      SELECT b.*, m.nama_mapel, k.nama_kelas, g.nama as nama_guru
      FROM bank_soal b
      JOIN mata_pelajaran m ON b.mapel_id = m.id
      JOIN kelas k ON b.kelas_id = k.id
      JOIN guru g ON b.guru_id = g.id
      JOIN guru_kelas_mapel gkm ON (gkm.guru_id = g.id AND gkm.kelas_id = b.kelas_id AND gkm.mapel_id = b.mapel_id)
      WHERE g.user_id = ?
      ORDER BY b.id DESC
    `, [guruUserId]);
  }

  async findBankSoalById(id) {
    return await db.getOne(`
      SELECT b.*, m.nama_mapel, m.kode_mapel, k.nama_kelas, g.nama as nama_guru, g.user_id as guru_user_id
      FROM bank_soal b
      LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
      LEFT JOIN kelas k ON b.kelas_id = k.id
      LEFT JOIN guru g ON b.guru_id = g.id
      WHERE b.id = ?
    `, [id]);
  }

  async createBankSoal(data) {
    return await db.insert('bank_soal', data);
  }

  async updateBankSoal(id, data) {
    return await db.update('bank_soal', id, data);
  }

  async deleteBankSoal(id) {
    return await db.delete('bank_soal', id);
  }

  // --- SOAL ---
  async findQuestionsByBankId(bankSoalId) {
    return await db.query('SELECT * FROM soal WHERE bank_soal_id = ? ORDER BY nomor_urut ASC, id ASC', [bankSoalId]);
  }

  async findQuestionById(id) {
    return await db.getById('soal', id);
  }

  async createQuestion(data) {
    return await db.insert('soal', data);
  }

  async updateQuestion(id, data) {
    return await db.update('soal', id, data);
  }

  async deleteQuestion(id) {
    return await db.delete('soal', id);
  }

  // --- PILIHAN JAWABAN ---
  async findOptionsByQuestionId(soalId) {
    return await db.query('SELECT * FROM pilihan_jawaban WHERE soal_id = ? ORDER BY label ASC', [soalId]);
  }

  async createOption(data) {
    return await db.insert('pilihan_jawaban', data);
  }

  async deleteOptionsByQuestionId(soalId) {
    return await db.execute('DELETE FROM pilihan_jawaban WHERE soal_id = ?', [soalId]);
  }
}

module.exports = new QuestionRepository();
