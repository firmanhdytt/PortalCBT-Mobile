const db = require('../database/db');

class MasterRepository {
  // --- KELAS ---
  async findAllKelas() {
    return await db.query(`
      SELECT k.*, 
        (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id) as total_siswa,
        (SELECT COUNT(DISTINCT gkm.mapel_id) FROM guru_kelas_mapel gkm WHERE gkm.kelas_id = k.id) as total_mapel,
        (SELECT COUNT(DISTINCT gkm.guru_id) FROM guru_kelas_mapel gkm WHERE gkm.kelas_id = k.id) as total_guru
      FROM kelas k 
      ORDER BY k.id ASC
    `);
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

  async updateKelas(id, data) {
    return await db.update('kelas', id, data);
  }

  async deleteKelas(id) {
    return await db.delete('kelas', id);
  }

  async getKelasDetail(id) {
    const kelas = await this.findKelasById(id);
    if (!kelas) return null;

    const siswa = await db.query(`
      SELECT s.id, s.nis, s.nama, s.email, s.status, s.user_id, s.avatar
      FROM siswa s
      WHERE s.kelas_id = ?
      ORDER BY s.nama ASC
    `, [id]);

    const penempatanGuru = await db.query(`
      SELECT gkm.id as assignment_id, g.id as guru_id, g.nama as nama_guru, g.nip,
             m.id as mapel_id, m.nama_mapel, m.kode_mapel
      FROM guru_kelas_mapel gkm
      JOIN guru g ON gkm.guru_id = g.id
      JOIN mata_pelajaran m ON gkm.mapel_id = m.id
      WHERE gkm.kelas_id = ?
      ORDER BY m.nama_mapel ASC
    `, [id]);

    const mapelList = await db.query(`
      SELECT DISTINCT m.id, m.kode_mapel, m.nama_mapel
      FROM guru_kelas_mapel gkm
      JOIN mata_pelajaran m ON gkm.mapel_id = m.id
      WHERE gkm.kelas_id = ?
      ORDER BY m.nama_mapel ASC
    `, [id]);

    return {
      ...kelas,
      total_siswa: siswa.length,
      siswa_list: siswa,
      mapel_list: mapelList,
      penempatan_guru: penempatanGuru
    };
  }

  // --- MATA PELAJARAN ---
  async findAllMapel() {
    return await db.query(`
      SELECT m.*,
        (SELECT COUNT(DISTINCT gkm.kelas_id) FROM guru_kelas_mapel gkm WHERE gkm.mapel_id = m.id) as total_kelas,
        (SELECT COUNT(DISTINCT gkm.guru_id) FROM guru_kelas_mapel gkm WHERE gkm.mapel_id = m.id) as total_guru,
        (SELECT COUNT(*) FROM bank_soal b WHERE b.mapel_id = m.id) as total_bank_soal
      FROM mata_pelajaran m
      ORDER BY m.id ASC
    `);
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

  async updateMapel(id, data) {
    return await db.update('mata_pelajaran', id, data);
  }

  async deleteMapel(id) {
    return await db.delete('mata_pelajaran', id);
  }

  async getMapelDetail(id) {
    const mapel = await this.findMapelById(id);
    if (!mapel) return null;

    const kelasList = await db.query(`
      SELECT DISTINCT k.id, k.nama_kelas, k.tingkat, k.jurusan
      FROM guru_kelas_mapel gkm
      JOIN kelas k ON gkm.kelas_id = k.id
      WHERE gkm.mapel_id = ?
      ORDER BY k.nama_kelas ASC
    `, [id]);

    const guruList = await db.query(`
      SELECT DISTINCT g.id, g.nip, g.nama, g.email, k.nama_kelas
      FROM guru_kelas_mapel gkm
      JOIN guru g ON gkm.guru_id = g.id
      JOIN kelas k ON gkm.kelas_id = k.id
      WHERE gkm.mapel_id = ?
      ORDER BY g.nama ASC
    `, [id]);

    const bankSoalList = await db.query(`
      SELECT b.id, b.judul, b.deskripsi, k.nama_kelas, g.nama as nama_guru,
             (SELECT COUNT(*) FROM soal s WHERE s.bank_soal_id = b.id) as total_soal
      FROM bank_soal b
      LEFT JOIN kelas k ON b.kelas_id = k.id
      LEFT JOIN guru g ON b.guru_id = g.id
      WHERE b.mapel_id = ?
      ORDER BY b.id DESC
    `, [id]);

    return {
      ...mapel,
      kelas_list: kelasList,
      guru_list: guruList,
      bank_soal_list: bankSoalList
    };
  }

  // --- GURU ---
  async findAllGuru() {
    const guruList = await db.query(`
      SELECT g.id, g.user_id, g.nip, g.nama, g.email, g.status, g.created_at, u.username,
             (SELECT COUNT(*) FROM guru_kelas_mapel gkm WHERE gkm.guru_id = g.id) as total_assignments
      FROM guru g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.id DESC
    `);

    for (const g of guruList) {
      g.assignments = await this.getGuruAssignments(g.id);
    }
    return guruList;
  }

  async findGuruById(id) {
    const g = await db.getOne(`
      SELECT g.*, u.username, u.avatar
      FROM guru g
      JOIN users u ON g.user_id = u.id
      WHERE g.id = ?
    `, [id]);
    if (g) {
      g.assignments = await this.getGuruAssignments(g.id);
    }
    return g;
  }

  async getGuruDetail(id) {
    const guru = await this.findGuruById(id);
    if (!guru) return null;

    const bankSoalList = await db.query(`
      SELECT b.id, b.judul, b.deskripsi, m.nama_mapel, k.nama_kelas,
             (SELECT COUNT(*) FROM soal s WHERE s.bank_soal_id = b.id) as total_soal
      FROM bank_soal b
      LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
      LEFT JOIN kelas k ON b.kelas_id = k.id
      WHERE b.guru_id = ? OR (b.kelas_id IN (SELECT kelas_id FROM guru_kelas_mapel WHERE guru_id = ?) AND b.mapel_id IN (SELECT mapel_id FROM guru_kelas_mapel WHERE guru_id = ?))
      ORDER BY b.id DESC
    `, [id, id, id]);

    const ujianList = await db.query(`
      SELECT u.id, u.nama_ujian, u.token, u.durasi_menit, u.status, u.is_aktif, k.nama_kelas, b.judul as judul_bank_soal
      FROM ujian u
      LEFT JOIN kelas k ON u.kelas_id = k.id
      LEFT JOIN bank_soal b ON u.bank_soal_id = b.id
      WHERE u.kelas_id IN (SELECT kelas_id FROM guru_kelas_mapel WHERE guru_id = ?)
      ORDER BY u.id DESC
    `, [id]);

    return {
      ...guru,
      bank_soal_list: bankSoalList,
      ujian_list: ujianList
    };
  }

  async findGuruByUserId(userId) {
    const g = await db.getOne('SELECT * FROM guru WHERE user_id = ?', [userId]);
    if (g) {
      g.assignments = await this.getGuruAssignments(g.id);
    }
    return g;
  }

  async createGuru(guruData) {
    return await db.insert('guru', guruData);
  }

  async updateGuru(id, data) {
    return await db.update('guru', id, data);
  }

  async deleteGuru(id) {
    return await db.delete('guru', id);
  }

  // --- SISWA ---
  async getSiswaDetail(id) {
    const student = await db.getOne(`
      SELECT s.*, k.nama_kelas, k.tingkat, k.jurusan, u.username, u.avatar
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [id]);

    if (!student) return null;

    const hasilUjianList = await db.query(`
      SELECT h.*, u.nama_ujian, u.kkm, k.nama_kelas
      FROM hasil_ujian h
      JOIN ujian u ON h.ujian_id = u.id
      LEFT JOIN kelas k ON u.kelas_id = k.id
      WHERE h.siswa_id = ?
      ORDER BY h.id DESC
    `, [id]);

    const certificates = await db.query(`
      SELECT c.*, u.nama_ujian
      FROM certificates c
      JOIN ujian u ON c.ujian_id = u.id
      WHERE c.siswa_id = ?
      ORDER BY c.id DESC
    `, [id]);

    return {
      ...student,
      hasil_ujian_list: hasilUjianList,
      certificates: certificates
    };
  }

  // --- PENETAPAN GURU (GURU_KELAS_MAPEL) ---
  async getGuruAssignments(guruId) {
    return await db.query(`
      SELECT gkm.id as assignment_id, gkm.guru_id, gkm.kelas_id, k.nama_kelas, gkm.mapel_id, m.nama_mapel, m.kode_mapel
      FROM guru_kelas_mapel gkm
      JOIN kelas k ON gkm.kelas_id = k.id
      JOIN mata_pelajaran m ON gkm.mapel_id = m.id
      WHERE gkm.guru_id = ?
      ORDER BY k.nama_kelas ASC, m.nama_mapel ASC
    `, [guruId]);
  }

  async getGuruAssignmentsByUserId(userId) {
    return await db.query(`
      SELECT gkm.id as assignment_id, gkm.guru_id, gkm.kelas_id, k.nama_kelas, gkm.mapel_id, m.nama_mapel, m.kode_mapel
      FROM guru_kelas_mapel gkm
      JOIN guru g ON gkm.guru_id = g.id
      JOIN kelas k ON gkm.kelas_id = k.id
      JOIN mata_pelajaran m ON gkm.mapel_id = m.id
      WHERE g.user_id = ?
      ORDER BY k.nama_kelas ASC, m.nama_mapel ASC
    `, [userId]);
  }

  async addGuruAssignment(guruId, kelasId, mapelId) {
    const existing = await db.getOne(`
      SELECT * FROM guru_kelas_mapel WHERE guru_id = ? AND kelas_id = ? AND mapel_id = ?
    `, [guruId, kelasId, mapelId]);
    if (existing) return existing;

    return await db.insert('guru_kelas_mapel', {
      guru_id: parseInt(guruId),
      kelas_id: parseInt(kelasId),
      mapel_id: parseInt(mapelId)
    });
  }

  async removeGuruAssignment(assignmentId) {
    return await db.delete('guru_kelas_mapel', assignmentId);
  }

  async clearGuruAssignments(guruId) {
    return await db.query('DELETE FROM guru_kelas_mapel WHERE guru_id = ?', [guruId]);
  }

  async isGuruAssigned(guruUserId, kelasId, mapelId) {
    if (!guruUserId || !kelasId || !mapelId) return false;
    const row = await db.getOne(`
      SELECT gkm.id 
      FROM guru_kelas_mapel gkm
      JOIN guru g ON gkm.guru_id = g.id
      WHERE g.user_id = ? AND gkm.kelas_id = ? AND gkm.mapel_id = ?
    `, [parseInt(guruUserId), parseInt(kelasId), parseInt(mapelId)]);
    return !!row;
  }
}

module.exports = new MasterRepository();
