require('dotenv').config();
const { pool } = require('../config/database');

async function migratePhase3() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE PHASE 3 (AUTH & TOKENS) ===');
  const conn = await pool.getConnection();

  try {
    // 1. Pastikan kolom password pada tabel users bertipe VARCHAR(255)
    console.log('-> Memeriksa kolom password pada tabel users...');
    await conn.query(`
      ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NOT NULL;
    `);

    // 2. Buat tabel user_tokens untuk manajemen refresh token & revocations
    console.log('-> Migrasi tabel: user_tokens');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        refresh_token VARCHAR(500) NOT NULL,
        ip_address VARCHAR(50) NULL,
        user_agent TEXT NULL,
        is_revoked TINYINT(1) NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_token_user (user_id),
        INDEX idx_token_revoked (is_revoked),
        INDEX idx_refresh_token (refresh_token(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('=== MIGRASI SKEMA PHASE 3 BERHASIL! ===');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi skema Phase 3:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase3()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migratePhase3;
