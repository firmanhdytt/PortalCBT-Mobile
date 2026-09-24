require('dotenv').config();
const { pool, testConnection } = require('../config/database');
const db = require('../../database');

async function runTest() {
  console.log('====================================================');
  console.log('   PENGUJIAN VALIDASI PHASE 1: MYSQL DATABASE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Uji Koneksi MySQL
  try {
    const isConnected = await testConnection();
    assert(isConnected === true, '1. Koneksi Pool MySQL berhasil terhubung');
  } catch (e) {
    assert(false, `1. Koneksi Pool MySQL gagal: ${e.message}`);
  }

  // 2. Uji Keberadaan Seluruh 18 Tabel
  const expectedTables = [
    'users', 'kelas', 'mata_pelajaran', 'guru', 'siswa',
    'bank_soal', 'soal', 'pilihan_jawaban', 'ujian',
    'exam_attempts', 'jawaban_peserta', 'hasil_ujian',
    'exam_violations', 'unlock_requests', 'activity_logs',
    'certificates', 'certificate_verifications', 'notifications'
  ];

  try {
    const [rows] = await pool.query('SHOW TABLES');
    const dbTables = rows.map(r => Object.values(r)[0]);
    
    let allTablesExist = true;
    for (const t of expectedTables) {
      if (!dbTables.includes(t)) {
        allTablesExist = false;
        console.error(`Tabel hilang: ${t}`);
      }
    }
    assert(allTablesExist, `2. Seluruh 18 Tabel DDL terverifikasi di MySQL (ditemukan: ${dbTables.length} tabel)`);
  } catch (e) {
    assert(false, `2. Gagal memeriksa tabel: ${e.message}`);
  }

  // 3. Uji Record Data Tersalin dari JSON
  try {
    const [uRows] = await pool.query('SELECT COUNT(*) as cnt FROM users');
    assert(uRows[0].cnt >= 6, `3. Tabel users memiliki ${uRows[0].cnt} data (ekspektasi >= 6)`);

    const [sRows] = await pool.query('SELECT COUNT(*) as cnt FROM soal');
    assert(sRows[0].cnt >= 11, `4. Tabel soal memiliki ${sRows[0].cnt} data (ekspektasi >= 11)`);

    const [pRows] = await pool.query('SELECT COUNT(*) as cnt FROM pilihan_jawaban');
    assert(pRows[0].cnt >= 45, `5. Tabel pilihan_jawaban memiliki ${pRows[0].cnt} data (ekspektasi >= 45)`);

    const [jRows] = await pool.query('SELECT COUNT(*) as cnt FROM jawaban_peserta');
    assert(jRows[0].cnt >= 41, `6. Tabel jawaban_peserta memiliki ${jRows[0].cnt} data (ekspektasi >= 41)`);

    const [hRows] = await pool.query('SELECT COUNT(*) as cnt FROM hasil_ujian');
    assert(hRows[0].cnt >= 8, `7. Tabel hasil_ujian memiliki ${hRows[0].cnt} data (ekspektasi >= 8)`);
  } catch (e) {
    assert(false, `3-7. Gagal query hitung data: ${e.message}`);
  }

  // 4. Uji Relasi Foreign Key & Query JOIN
  try {
    const [joinRows] = await pool.query(`
      SELECT s.id, s.nis, s.nama, k.nama_kelas, u.username
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      JOIN users u ON s.user_id = u.id
    `);
    assert(joinRows.length >= 4, `8. Relasi JOIN siswa -> kelas -> users valid (${joinRows.length} baris berelasi)`);
  } catch (e) {
    assert(false, `8. Gagal join relasi siswa: ${e.message}`);
  }

  // 5. Uji CRUD Layer pada database.js (dengan persistensi MySQL)
  try {
    // INSERT
    const testKelas = db.insert('kelas', {
      nama_kelas: 'TEST KELAS QA',
      tingkat: 'XII',
      jurusan: 'QA',
      tahun_ajaran: '2026/2027',
      status: 'aktif'
    });
    assert(testKelas && testKelas.id > 0, `9. CRUD Insert kelas via database layer berhasil (ID: ${testKelas.id})`);

    // Tunggu sejenak agar background async query ke MySQL commit
    await new Promise(r => setTimeout(r, 200));

    // READ FROM MYSQL DIRECTLY
    const [kRows] = await pool.query('SELECT * FROM kelas WHERE id = ?', [testKelas.id]);
    assert(kRows.length === 1 && kRows[0].nama_kelas === 'TEST KELAS QA', '10. Data insert terkonfirmasi tersimpan langsung di MySQL');

    // UPDATE
    db.update('kelas', testKelas.id, { nama_kelas: 'TEST KELAS QA UPDATED' });
    await new Promise(r => setTimeout(r, 200));
    const [kUpdated] = await pool.query('SELECT * FROM kelas WHERE id = ?', [testKelas.id]);
    assert(kUpdated[0].nama_kelas === 'TEST KELAS QA UPDATED', '11. CRUD Update kelas terkonfirmasi terupdate di MySQL');

    // DELETE
    db.delete('kelas', testKelas.id);
    await new Promise(r => setTimeout(r, 200));
    const [kDeleted] = await pool.query('SELECT * FROM kelas WHERE id = ?', [testKelas.id]);
    assert(kDeleted.length === 0, '12. CRUD Delete kelas terkonfirmasi terhapus dari MySQL');
  } catch (e) {
    assert(false, `9-12. Gagal pengujian CRUD: ${e.message}`);
  }

  console.log('====================================================');
  console.log(`HASIL AKHIR: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed === 0) {
    console.log('STATUS: VERIFIKASI PHASE 1 100% SUKSES!');
    process.exit(0);
  } else {
    console.error('STATUS: TERDAPAT PENGUJIAN YANG GAGAL!');
    process.exit(1);
  }
}

runTest();
