require('dotenv').config();
const { pool } = require('../config/database');

async function seed() {
  console.log('=== MEMULAI SEEDING DATA AWAL CBT ===');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. users
    console.log('-> Seeding users');
    await conn.query(`
      INSERT INTO users (id, username, password, email, role, is_active) VALUES
      (1, 'admin', 'admin', 'admin@cbt.local', 'admin', 1),
      (2, 'guru', 'guru', 'budi@cbt.local', 'guru', 1),
      (3, 'siswa', 'siswa', 'ahmad@cbt.local', 'siswa', 1),
      (4, 'siswa2', 'siswa2', 'siti@cbt.local', 'siswa', 1)
      ON DUPLICATE KEY UPDATE username=VALUES(username);
    `);

    // 2. kelas
    console.log('-> Seeding kelas');
    await conn.query(`
      INSERT INTO kelas (id, nama_kelas, tingkat, jurusan, tahun_ajaran, status) VALUES
      (1, 'XII RPL 1', 'XII', 'Rekayasa Perangkat Lunak', '2025/2026', 'aktif'),
      (2, 'XII RPL 2', 'XII', 'Rekayasa Perangkat Lunak', '2025/2026', 'aktif')
      ON DUPLICATE KEY UPDATE nama_kelas=VALUES(nama_kelas);
    `);

    // 3. mata_pelajaran
    console.log('-> Seeding mata_pelajaran');
    await conn.query(`
      INSERT INTO mata_pelajaran (id, kode_mapel, nama_mapel, status) VALUES
      (1, 'INF-12', 'Informatika', 'aktif'),
      (2, 'MAT-12', 'Matematika', 'aktif')
      ON DUPLICATE KEY UPDATE nama_mapel=VALUES(nama_mapel);
    `);

    // 4. guru
    console.log('-> Seeding guru');
    await conn.query(`
      INSERT INTO guru (id, user_id, nip, nama, email, status) VALUES
      (1, 2, '1928392183', 'Budi Santoso, M.Pd.', 'budi@cbt.local', 'aktif')
      ON DUPLICATE KEY UPDATE nama=VALUES(nama);
    `);

    // 5. siswa
    console.log('-> Seeding siswa');
    await conn.query(`
      INSERT INTO siswa (id, user_id, nis, nama, kelas_id, email, status) VALUES
      (1, 3, '2026001', 'Ahmad Rifai', 1, 'ahmad@cbt.local', 'aktif'),
      (2, 4, '2026002', 'Siti Aminah', 1, 'siti@cbt.local', 'aktif')
      ON DUPLICATE KEY UPDATE nama=VALUES(nama);
    `);

    // 6. bank_soal
    console.log('-> Seeding bank_soal');
    await conn.query(`
      INSERT INTO bank_soal (id, mapel_id, guru_id, judul, deskripsi, status) VALUES
      (1, 1, 1, 'Soal UAS Informatika Kelas XII', 'Bank soal standar UAS Informatika Flutter & Database', 'aktif')
      ON DUPLICATE KEY UPDATE judul=VALUES(judul);
    `);

    // 7. soal
    console.log('-> Seeding soal');
    await conn.query(`
      INSERT INTO soal (id, bank_soal_id, jenis_soal, teks_soal, gambar_url, bobot, tingkat_kesulitan, nomor_urut) VALUES
      (1, 1, 'PG', 'Manakah di bawah ini yang merupakan bahasa pemrograman utama untuk pengembangan aplikasi Flutter?', '', 20.00, 'sedang', 1),
      (2, 1, 'PG', 'Database lokal yang sering digunakan pada aplikasi mobile Flutter untuk menyimpan data secara luring (offline) adalah...', '', 20.00, 'sedang', 2),
      (3, 1, 'PG', 'Widget dalam Flutter yang berfungsi untuk menata elemen secara vertikal dari atas ke bawah adalah...', '', 20.00, 'mudah', 3),
      (4, 1, 'ESSAY', 'Jelaskan secara singkat apa keuntungan menggunakan Flutter untuk membuat aplikasi mobile!', '', 40.00, 'sedang', 4)
      ON DUPLICATE KEY UPDATE teks_soal=VALUES(teks_soal);
    `);

    // 8. pilihan_jawaban
    console.log('-> Seeding pilihan_jawaban');
    await conn.query(`
      INSERT INTO pilihan_jawaban (id, soal_id, teks_pilihan, label, is_kunci) VALUES
      (1, 1, 'Python', 'A', 0),
      (2, 1, 'Java', 'B', 0),
      (3, 1, 'Dart', 'C', 1),
      (4, 1, 'Swift', 'D', 0),
      (5, 1, 'Kotlin', 'E', 0),

      (6, 2, 'MySQL', 'A', 0),
      (7, 2, 'MongoDB', 'B', 0),
      (8, 2, 'SQLite', 'C', 1),
      (9, 2, 'Redis', 'D', 0),
      (10, 2, 'Oracle', 'E', 0),

      (11, 3, 'Row', 'A', 0),
      (12, 3, 'Column', 'B', 1),
      (13, 3, 'Stack', 'C', 0),
      (14, 3, 'ListView', 'D', 0),
      (15, 3, 'Container', 'E', 0)
      ON DUPLICATE KEY UPDATE teks_pilihan=VALUES(teks_pilihan);
    `);

    // 9. ujian
    console.log('-> Seeding ujian');
    await conn.query(`
      INSERT INTO ujian (id, nama_ujian, deskripsi, bank_soal_id, kelas_id, token, durasi_menit, waktu_mulai, waktu_selesai, kkm, randomize_questions, randomize_options, allow_back_navigation, show_result, max_attempt, status, is_aktif) VALUES
      (1, 'Ujian Akhir Informatika', 'Ujian Akhir Semester Genap', 1, 1, 'INF123', 60, NOW(), DATE_ADD(NOW(), INTERVAL 365 DAY), 70.00, 1, 0, 1, 1, 1, 'ONGOING', 1)
      ON DUPLICATE KEY UPDATE token=VALUES(token);
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('=== SEEDING BERHASIL DISELESAIKAN! ===');
  } catch (error) {
    console.error('Seeding gagal:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seed;
