const db = require('../database/db');

class MasterRepository {
  // --- KELAS ---
  async findAllKelas() {
    return await db.query('SELECT * FROM kelas ORDER BY id ASC');
  }

  async findKelasById(id) {
    return await db.getById('kelas', id);
  }

  async findKelasByName(namaKelas) {
    return await db.getOne('SELECT * FROM kelas WHERE nama_kelas = ?', [namaKelas]);
  }

  async createKelas(data) {
    return await db.insert('kelas', data);
  }

  async deleteKelas(id) {
    return await db.delete('kelas', id);
  }

  // --- MATA PELAJARAN ---
  async findAllMapel() {
    return await db.query('SELECT * FROM mata_pelajaran ORDER BY id ASC');
  }

  async findMapelById(id) {
    return await db.getById('mata_pelajaran', id);
  }

  async findMapelByKode(kodeMapel) {
    return await db.getOne('SELECT * FROM mata_pelajaran WHERE kode_mapel = ?', [kodeMapel]);
  }

  async createMapel(data) {
    return await db.insert('mata_pelajaran', data);
  }

  async deleteMapel(id) {
    return await db.delete('mata_pelajaran', id);
  }
}

module.exports = new MasterRepository();
