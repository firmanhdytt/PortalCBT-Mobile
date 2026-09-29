require('dotenv').config();
const { pool } = require('../config/database');

async function migratePhase11() {
  console.log('=== MEMULAI MIGRASI PHASE 11: GURU KELAS MAPEL & BANK SOAL KELAS ===');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. Tabel guru_kelas_mapel
    console.log('-> Migrasi tabel: guru_kelas_mapel');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS guru_kelas_mapel (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guru_id INT NOT NULL,
        kelas_id INT NOT NULL,
        mapel_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (guru_id) REFERENCES guru(id) ON DELETE CASCADE,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
        UNIQUE KEY uq_guru_kelas_mapel (guru_id, kelas_id, mapel_id),
        INDEX idx_gkm_guru (guru_id),
        INDEX idx_gkm_kelas_mapel (kelas_id, mapel_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Tambahkan kolom kelas_id ke tabel bank_soal (jika belum ada)
    console.log('-> Cek kolom kelas_id di tabel bank_soal');
    const [cols] = await conn.query(`SHOW COLUMNS FROM bank_soal LIKE 'kelas_id'`);
    if (cols.length === 0) {
      console.log('-> Menambahkan kolom kelas_id ke bank_soal...');
      await conn.query(`
        ALTER TABLE bank_soal 
        ADD COLUMN kelas_id INT NULL AFTER mapel_id,
        ADD CONSTRAINT fk_bank_soal_kelas FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE CASCADE,
        ADD INDEX idx_bank_kelas (kelas_id);
      `);

      const [firstKelas] = await conn.query(`SELECT id FROM kelas LIMIT 1`);
      const defaultKelasId = firstKelas.length > 0 ? firstKelas[0].id : 1;
      await conn.query(`UPDATE bank_soal SET kelas_id = ? WHERE kelas_id IS NULL`, [defaultKelasId]);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('=== MIGRASI PHASE 11 BERHASIL SELESAI! ===');
  } catch (error) {
    console.error('Migrasi Phase 11 gagal:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase11().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migratePhase11;
