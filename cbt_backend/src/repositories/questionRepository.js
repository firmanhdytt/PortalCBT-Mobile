const db = require('../database/db');

class QuestionRepository {
  // --- BANK SOAL ---
  async findAllBankSoal() {
    return await db.query(`
      SELECT b.*, m.nama_mapel, g.nama as nama_guru
      FROM bank_soal b
      LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
      LEFT JOIN guru g ON b.guru_id = g.id
      ORDER BY b.id DESC
    `);
  }

  async findBankSoalById(id) {
    return await db.getOne(`
      SELECT b.*, m.nama_mapel, g.nama as nama_guru
      FROM bank_soal b
      LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
      LEFT JOIN guru g ON b.guru_id = g.id
      WHERE b.id = ?
    `, [id]);
  }

  async createBankSoal(data) {
    return await db.insert('bank_soal', data);
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
