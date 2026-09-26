require('dotenv').config();
const { pool } = require('../config/database');

async function migratePhase7() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE PHASE 7 (SCORING & ANALYTICS) ===');
  const conn = await pool.getConnection();

  try {
    // 1. Tambahkan catatan_guru pada jawaban_peserta jika belum ada
    console.log('-> Memeriksa kolom catatan_guru pada tabel jawaban_peserta...');
    const [cols] = await conn.query("SHOW COLUMNS FROM jawaban_peserta LIKE 'catatan_guru'");
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE jawaban_peserta ADD COLUMN catatan_guru TEXT NULL AFTER nilai_manual;
      `);
      console.log('  -> Kolom catatan_guru berhasil ditambahkan ke tabel jawaban_peserta.');
    } else {
      console.log('  -> Kolom catatan_guru sudah ada pada tabel jawaban_peserta.');
    }

    // 2. Pastikan indeks performa untuk pencarian hasil dan jawaban
    console.log('-> Memeriksa indeks performa analitik pada jawaban_peserta dan hasil_ujian...');
    try {
      await conn.query(`ALTER TABLE jawaban_peserta ADD INDEX idx_jawaban_ujian_soal (ujian_id, soal_id)`);
    } catch (e) {
      // Indeks mungkin sudah ada, abaikan error duplikasi
    }
    try {
      await conn.query(`ALTER TABLE hasil_ujian ADD INDEX idx_hasil_ujian_status (ujian_id, status_kelulusan)`);
    } catch (e) {
      // Indeks mungkin sudah ada, abaikan error duplikasi
    }

    console.log('=== MIGRASI SKEMA PHASE 7 BERHASIL! ===');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi skema Phase 7:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migratePhase7()
    .then(() => {
      console.log('Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migratePhase7;
