require('dotenv').config();
const { pool } = require('../config/database');

async function migrate() {
  console.log('=== MEMULAI MIGRASI SKEMA DATABASE MYSQL CBT ===');
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. users
    console.log('-> Migrasi tabel: users');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(150) NULL UNIQUE,
        role ENUM('admin', 'guru', 'siswa') NOT NULL DEFAULT 'siswa',
        avatar VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role (role),
        INDEX idx_users_username (username),
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. kelas
    console.log('-> Migrasi tabel: kelas');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS kelas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_kelas VARCHAR(100) NOT NULL UNIQUE,
        tingkat VARCHAR(20) NULL DEFAULT 'XII',
        jurusan VARCHAR(100) NULL DEFAULT 'Umum',
        tahun_ajaran VARCHAR(50) NULL DEFAULT '2025/2026',
        status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. mata_pelajaran
    console.log('-> Migrasi tabel: mata_pelajaran');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS mata_pelajaran (
        id INT AUTO_INCREMENT PRIMARY KEY,
        kode_mapel VARCHAR(50) NOT NULL UNIQUE,
        nama_mapel VARCHAR(150) NOT NULL,
        status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. guru
    console.log('-> Migrasi tabel: guru');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS guru (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        nip VARCHAR(50) NOT NULL UNIQUE,
        nama VARCHAR(150) NOT NULL,
        email VARCHAR(150) NULL,
        status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
        avatar VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_guru_nip (nip)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. siswa
    console.log('-> Migrasi tabel: siswa');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS siswa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        nis VARCHAR(50) NOT NULL UNIQUE,
        nama VARCHAR(150) NOT NULL,
        kelas_id INT NOT NULL,
        email VARCHAR(150) NULL,
        status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
        avatar VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE RESTRICT,
        INDEX idx_siswa_nis (nis),
        INDEX idx_siswa_kelas_id (kelas_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. bank_soal
    console.log('-> Migrasi tabel: bank_soal');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bank_soal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mapel_id INT NOT NULL,
        guru_id INT NOT NULL,
        judul VARCHAR(200) NOT NULL,
        deskripsi TEXT NULL,
        status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id) ON DELETE RESTRICT,
        FOREIGN KEY (guru_id) REFERENCES guru(id) ON DELETE RESTRICT,
        INDEX idx_bank_mapel (mapel_id),
        INDEX idx_bank_guru (guru_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. soal
    console.log('-> Migrasi tabel: soal');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS soal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bank_soal_id INT NOT NULL,
        jenis_soal ENUM('PG', 'ESSAY') NOT NULL DEFAULT 'PG',
        teks_soal TEXT NOT NULL,
        gambar_url VARCHAR(255) NULL,
        bobot DECIMAL(5,2) NOT NULL DEFAULT 1.00,
        tingkat_kesulitan ENUM('mudah', 'sedang', 'sulit') NOT NULL DEFAULT 'sedang',
        nomor_urut INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (bank_soal_id) REFERENCES bank_soal(id) ON DELETE CASCADE,
        INDEX idx_soal_bank (bank_soal_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. pilihan_jawaban
    console.log('-> Migrasi tabel: pilihan_jawaban');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS pilihan_jawaban (
        id INT AUTO_INCREMENT PRIMARY KEY,
        soal_id INT NOT NULL,
        teks_pilihan TEXT NOT NULL,
        label VARCHAR(5) NOT NULL,
        is_kunci TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (soal_id) REFERENCES soal(id) ON DELETE CASCADE,
        INDEX idx_pilihan_soal (soal_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. ujian
    console.log('-> Migrasi tabel: ujian');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ujian (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama_ujian VARCHAR(200) NOT NULL,
        deskripsi TEXT NULL,
        bank_soal_id INT NOT NULL,
        kelas_id INT NOT NULL,
        token VARCHAR(20) NOT NULL,
        durasi_menit INT NOT NULL DEFAULT 60,
        waktu_mulai DATETIME NULL,
        waktu_selesai DATETIME NULL,
        kkm DECIMAL(5,2) NOT NULL DEFAULT 70.00,
        randomize_questions TINYINT(1) NOT NULL DEFAULT 1,
        randomize_options TINYINT(1) NOT NULL DEFAULT 0,
        allow_back_navigation TINYINT(1) NOT NULL DEFAULT 1,
        show_result TINYINT(1) NOT NULL DEFAULT 1,
        max_attempt INT NOT NULL DEFAULT 1,
        max_violations INT NOT NULL DEFAULT 3,
        status ENUM('DRAFT', 'SCHEDULED', 'ONGOING', 'FINISHED') NOT NULL DEFAULT 'ONGOING',
        is_aktif TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (bank_soal_id) REFERENCES bank_soal(id) ON DELETE RESTRICT,
        FOREIGN KEY (kelas_id) REFERENCES kelas(id) ON DELETE RESTRICT,
        INDEX idx_ujian_kelas (kelas_id),
        INDEX idx_ujian_token (token),
        INDEX idx_ujian_waktu (waktu_mulai, waktu_selesai),
        INDEX idx_ujian_status (status, is_aktif)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. exam_attempts
    console.log('-> Migrasi tabel: exam_attempts');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS exam_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ujian_id INT NOT NULL,
        siswa_id INT NOT NULL,
        attempt_number INT NOT NULL DEFAULT 1,
        waktu_mulai DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        waktu_selesai DATETIME NULL,
        sisa_waktu_detik INT NOT NULL DEFAULT 3600,
        status ENUM('IN_PROGRESS', 'SUBMITTED', 'LOCKED', 'TIMED_OUT') NOT NULL DEFAULT 'IN_PROGRESS',
        shuffled_question_order TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        INDEX idx_attempt_ujian_siswa (ujian_id, siswa_id),
        INDEX idx_attempt_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. jawaban_peserta
    console.log('-> Migrasi tabel: jawaban_peserta');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS jawaban_peserta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NULL,
        siswa_id INT NOT NULL,
        ujian_id INT NOT NULL,
        soal_id INT NOT NULL,
        pilihan_jawaban_id INT NULL,
        teks_jawaban_essay TEXT NULL,
        is_ragu TINYINT(1) NOT NULL DEFAULT 0,
        nilai_manual DECIMAL(5,2) NULL DEFAULT 0.00,
        waktu_dijawab DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE SET NULL,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        FOREIGN KEY (soal_id) REFERENCES soal(id) ON DELETE CASCADE,
        FOREIGN KEY (pilihan_jawaban_id) REFERENCES pilihan_jawaban(id) ON DELETE SET NULL,
        INDEX idx_jawaban_siswa_ujian (siswa_id, ujian_id),
        INDEX idx_jawaban_soal (soal_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. hasil_ujian
    console.log('-> Migrasi tabel: hasil_ujian');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS hasil_ujian (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NULL,
        siswa_id INT NOT NULL,
        ujian_id INT NOT NULL,
        jumlah_benar INT NOT NULL DEFAULT 0,
        jumlah_salah INT NOT NULL DEFAULT 0,
        nilai_pg DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        nilai_essay DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        nilai_akhir DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        status_kelulusan ENUM('LULUS', 'REMIDI', 'PENDING') NOT NULL DEFAULT 'PENDING',
        waktu_selesai DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE SET NULL,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        INDEX idx_hasil_siswa_ujian (siswa_id, ujian_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 13. exam_violations
    console.log('-> Migrasi tabel: exam_violations');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS exam_violations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NULL,
        siswa_id INT NOT NULL,
        ujian_id INT NOT NULL,
        strike_number INT NOT NULL DEFAULT 1,
        violation_type VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        INDEX idx_violation_siswa_ujian (siswa_id, ujian_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 14. unlock_requests
    console.log('-> Migrasi tabel: unlock_requests');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS unlock_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attempt_id INT NULL,
        siswa_id INT NOT NULL,
        ujian_id INT NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_unlock_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 15. activity_logs
    console.log('-> Migrasi tabel: activity_logs');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        module VARCHAR(100) NOT NULL,
        description TEXT NULL,
        ip_address VARCHAR(50) NULL,
        user_agent TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_activity_user (user_id),
        INDEX idx_activity_action (action)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 16. certificates
    console.log('-> Migrasi tabel: certificates');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        certificate_number VARCHAR(100) NOT NULL UNIQUE,
        siswa_id INT NOT NULL,
        ujian_id INT NOT NULL,
        hasil_ujian_id INT NOT NULL,
        qr_code_url VARCHAR(255) NULL,
        file_path VARCHAR(255) NULL,
        issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (siswa_id) REFERENCES siswa(id) ON DELETE CASCADE,
        FOREIGN KEY (ujian_id) REFERENCES ujian(id) ON DELETE CASCADE,
        FOREIGN KEY (hasil_ujian_id) REFERENCES hasil_ujian(id) ON DELETE CASCADE,
        INDEX idx_cert_number (certificate_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 17. certificate_verifications
    console.log('-> Migrasi tabel: certificate_verifications');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS certificate_verifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        certificate_id INT NOT NULL,
        verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(50) NULL,
        user_agent TEXT NULL,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 18. notifications
    console.log('-> Migrasi tabel: notifications');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'INFO',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notif_user (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('=== SEMUA 18 TABEL MYSQL BERHASIL DIMIGRASIKAN! ===');
  } catch (error) {
    console.error('Migrasi gagal:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrate;
