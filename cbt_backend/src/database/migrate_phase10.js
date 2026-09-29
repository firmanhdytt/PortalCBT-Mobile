require('dotenv').config();
const { pool } = require('../config/database');

async function migratePhase10() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE PHASE 10 (DESIGN SYSTEM, PREFERENCES & NOTIFICATIONS) ===');
  const conn = await pool.getConnection();

  try {
    // 1. Verifikasi dan perbarui tabel notifications
    const [cols] = await conn.query(`SHOW COLUMNS FROM notifications LIKE 'category'`);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE notifications ADD COLUMN category VARCHAR(50) NULL AFTER type`);
      console.log('  ✅ Kolom category ditambahkan ke tabel notifications');
    } else {
      console.log('  ℹ️ Kolom category sudah ada pada tabel notifications');
    }

    const [refCols] = await conn.query(`SHOW COLUMNS FROM notifications LIKE 'reference_id'`);
    if (refCols.length === 0) {
      await conn.query(`ALTER TABLE notifications ADD COLUMN reference_id INT NULL AFTER category`);
      console.log('  ✅ Kolom reference_id ditambahkan ke tabel notifications');
    } else {
      console.log('  ℹ️ Kolom reference_id sudah ada pada tabel notifications');
    }

    // 2. Buat tabel user_preferences untuk menyimpan preferensi tema & aksesibilitas
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INT PRIMARY KEY,
        theme VARCHAR(20) DEFAULT 'system',
        font_scale VARCHAR(20) DEFAULT 'normal',
        high_contrast TINYINT(1) DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('  ✅ Tabel user_preferences terverifikasi / dibuat');

    // 3. Tambahkan default preferences untuk user yang belum memiliki baris preferensi
    await conn.query(`
      INSERT IGNORE INTO user_preferences (user_id, theme, font_scale, high_contrast)
      SELECT id, 'system', 'normal', 0 FROM users
    `);
    console.log('  ✅ Default user preferences diinisialisasi untuk seluruh akun');

    console.log('=== MIGRASI SKEMA PHASE 10 BERHASIL SELESAI ===');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi skema Phase 10:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase10()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migratePhase10;