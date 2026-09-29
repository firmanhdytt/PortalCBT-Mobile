require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function migratePhase9() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE PHASE 9 (PROFILE & AVATAR) ===');
  const conn = await pool.getConnection();

  try {
    // 1. Pastikan direktori uploads/avatars ada pada folder public
    const uploadsDir = path.join(__dirname, '../../public/uploads/avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`  ✅ Direktori upload avatar dibuat: ${uploadsDir}`);
    } else {
      console.log(`  ℹ️ Direktori upload avatar sudah ada: ${uploadsDir}`);
    }

    // 2. Verifikasi kolom avatar & email pada tabel users, guru, siswa
    const tables = ['users', 'guru', 'siswa'];
    for (const table of tables) {
      const [avatarCol] = await conn.query(`SHOW COLUMNS FROM ?? LIKE 'avatar'`, [table]);
      if (avatarCol.length === 0) {
        await conn.query(`ALTER TABLE ?? ADD COLUMN avatar VARCHAR(255) NULL`, [table]);
        console.log(`  ✅ Kolom avatar ditambahkan ke tabel ${table}`);
      } else {
        console.log(`  ℹ️ Kolom avatar sudah ada pada tabel ${table}`);
      }

      const [emailCol] = await conn.query(`SHOW COLUMNS FROM ?? LIKE 'email'`, [table]);
      if (emailCol.length === 0) {
        await conn.query(`ALTER TABLE ?? ADD COLUMN email VARCHAR(150) NULL`, [table]);
        console.log(`  ✅ Kolom email ditambahkan ke tabel ${table}`);
      } else {
        console.log(`  ℹ️ Kolom email sudah ada pada tabel ${table}`);
      }
    }

    console.log('=== MIGRASI SKEMA PHASE 9 BERHASIL SELESAI ===');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi skema Phase 9:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase9()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migratePhase9;
