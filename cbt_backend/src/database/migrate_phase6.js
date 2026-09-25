require('dotenv').config();
const { pool } = require('../config/database');

async function migratePhase6() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE PHASE 6 (EXAMINATION ENGINE & PROCTORING) ===');
  const conn = await pool.getConnection();

  try {
    // 1. Periksa kolom max_violations pada tabel ujian
    console.log('-> Memeriksa kolom max_violations pada tabel ujian...');
    const [cols] = await conn.query("SHOW COLUMNS FROM ujian LIKE 'max_violations'");
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE ujian ADD COLUMN max_violations INT NOT NULL DEFAULT 3 AFTER max_attempt;
      `);
      console.log('  -> Kolom max_violations berhasil ditambahkan ke tabel ujian.');
    } else {
      console.log('  -> Kolom max_violations sudah ada pada tabel ujian.');
    }

    // 2. Pastikan tabel exam_attempts memiliki kolom status yang mendukung 'LOCKED'
    console.log('-> Memeriksa status ENUM pada exam_attempts...');
    await conn.query(`
      ALTER TABLE exam_attempts 
      MODIFY COLUMN status ENUM('IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'TIMED_OUT') NOT NULL DEFAULT 'IN_PROGRESS';
    `);

    // 3. Pastikan indeks performa untuk proctoring monitoring
    console.log('-> Memeriksa indeks pada exam_violations dan unlock_requests...');
    try {
      await conn.query(`ALTER TABLE exam_violations ADD INDEX idx_violation_attempt (attempt_id)`);
    } catch (e) {
      // Indeks mungkin sudah ada, abaikan error duplikasi
    }
    try {
      await conn.query(`ALTER TABLE unlock_requests ADD INDEX idx_unlock_attempt (attempt_id)`);
    } catch (e) {
      // Indeks mungkin sudah ada, abaikan error duplikasi
    }

    console.log('=== MIGRASI SKEMA PHASE 6 BERHASIL! ===');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi skema Phase 6:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase6()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migratePhase6;
