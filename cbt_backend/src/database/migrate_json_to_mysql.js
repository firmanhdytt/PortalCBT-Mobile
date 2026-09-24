require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const migrateSchema = require('./migrate');

const JSON_FILE = path.join(__dirname, '../../cbt_db.json');

function formatDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch (e) {
    return null;
  }
}

async function migrateData() {
  console.log('=== MEMULAI MIGRASI DATA DARI CBT_DB.JSON KE MYSQL ===');
  
  if (!fs.existsSync(JSON_FILE)) {
    console.error('File cbt_db.json tidak ditemukan di:', JSON_FILE);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(JSON_FILE, 'utf8');
  const jsonData = JSON.parse(rawJson);

  // 1. Jalankan skema tabel terlebih dahulu
  await migrateSchema();

  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    // 1. users
    if (Array.isArray(jsonData.users) && jsonData.users.length > 0) {
      console.log(`-> Migrasi users (${jsonData.users.length} baris)`);
      for (const u of jsonData.users) {
        await conn.query(
          `INSERT INTO users (id, username, password, email, role, avatar, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE username=VALUES(username), password=VALUES(password), role=VALUES(role)`,
          [u.id, u.username, u.password, u.email || `${u.username}@cbt.local`, u.role || 'siswa', u.avatar || null]
        );
      }
    }

    // 2. kelas
    if (Array.isArray(jsonData.kelas) && jsonData.kelas.length > 0) {
      console.log(`-> Migrasi kelas (${jsonData.kelas.length} baris)`);
      for (const k of jsonData.kelas) {
        await conn.query(
          `INSERT INTO kelas (id, nama_kelas, tingkat, jurusan, tahun_ajaran, status)
           VALUES (?, ?, ?, ?, ?, 'aktif')
           ON DUPLICATE KEY UPDATE nama_kelas=VALUES(nama_kelas)`,
          [k.id, k.nama_kelas, k.tingkat || 'XII', k.jurusan || 'Umum', k.tahun_ajaran || '2025/2026']
        );
      }
    }

    // 3. mata_pelajaran
    if (Array.isArray(jsonData.mata_pelajaran) && jsonData.mata_pelajaran.length > 0) {
      console.log(`-> Migrasi mata_pelajaran (${jsonData.mata_pelajaran.length} baris)`);
      for (const m of jsonData.mata_pelajaran) {
        await conn.query(
          `INSERT INTO mata_pelajaran (id, kode_mapel, nama_mapel, status)
           VALUES (?, ?, ?, 'aktif')
           ON DUPLICATE KEY UPDATE kode_mapel=VALUES(kode_mapel), nama_mapel=VALUES(nama_mapel)`,
          [m.id, m.kode_mapel || `MP-${m.id}`, m.nama_mapel]
        );
      }
    }

    // 4. guru
    if (Array.isArray(jsonData.guru) && jsonData.guru.length > 0) {
      console.log(`-> Migrasi guru (${jsonData.guru.length} baris)`);
      for (const g of jsonData.guru) {
        await conn.query(
          `INSERT INTO guru (id, user_id, nip, nama, email, status)
           VALUES (?, ?, ?, ?, ?, 'aktif')
           ON DUPLICATE KEY UPDATE nip=VALUES(nip), nama=VALUES(nama)`,
          [g.id, g.user_id, g.nip, g.nama, g.email || null]
        );
      }
    }

    // 5. siswa
    if (Array.isArray(jsonData.siswa) && jsonData.siswa.length > 0) {
      console.log(`-> Migrasi siswa (${jsonData.siswa.length} baris)`);
      for (const s of jsonData.siswa) {
        await conn.query(
          `INSERT INTO siswa (id, user_id, nis, nama, kelas_id, email, status)
           VALUES (?, ?, ?, ?, ?, ?, 'aktif')
           ON DUPLICATE KEY UPDATE nis=VALUES(nis), nama=VALUES(nama), kelas_id=VALUES(kelas_id)`,
          [s.id, s.user_id, s.nis, s.nama, s.kelas_id, s.email || null]
        );
      }
    }

    // 6. bank_soal
    if (Array.isArray(jsonData.bank_soal) && jsonData.bank_soal.length > 0) {
      console.log(`-> Migrasi bank_soal (${jsonData.bank_soal.length} baris)`);
      for (const b of jsonData.bank_soal) {
        await conn.query(
          `INSERT INTO bank_soal (id, mapel_id, guru_id, judul, deskripsi, status)
           VALUES (?, ?, ?, ?, ?, 'aktif')
           ON DUPLICATE KEY UPDATE judul=VALUES(judul)`,
          [b.id, b.mapel_id, b.guru_id, b.judul, b.deskripsi || null]
        );
      }
    }

    // 7. soal
    if (Array.isArray(jsonData.soal) && jsonData.soal.length > 0) {
      console.log(`-> Migrasi soal (${jsonData.soal.length} baris)`);
      for (const s of jsonData.soal) {
        await conn.query(
          `INSERT INTO soal (id, bank_soal_id, jenis_soal, teks_soal, gambar_url, bobot, tingkat_kesulitan, nomor_urut)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE teks_soal=VALUES(teks_soal), bobot=VALUES(bobot)`,
          [s.id, s.bank_soal_id, s.jenis_soal || 'PG', s.teks_soal, s.gambar_url || '', s.bobot || 1.0, s.tingkat_kesulitan || 'sedang', s.nomor_urut || 1]
        );
      }
    }

    // 8. pilihan_jawaban
    if (Array.isArray(jsonData.pilihan_jawaban) && jsonData.pilihan_jawaban.length > 0) {
      console.log(`-> Migrasi pilihan_jawaban (${jsonData.pilihan_jawaban.length} baris)`);
      for (const p of jsonData.pilihan_jawaban) {
        await conn.query(
          `INSERT INTO pilihan_jawaban (id, soal_id, teks_pilihan, label, is_kunci)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE teks_pilihan=VALUES(teks_pilihan), label=VALUES(label), is_kunci=VALUES(is_kunci)`,
          [p.id, p.soal_id, p.teks_pilihan, p.label, p.is_kunci ? 1 : 0]
        );
      }
    }

    // 9. ujian
    if (Array.isArray(jsonData.ujian) && jsonData.ujian.length > 0) {
      console.log(`-> Migrasi ujian (${jsonData.ujian.length} baris)`);
      for (const u of jsonData.ujian) {
        await conn.query(
          `INSERT INTO ujian (id, nama_ujian, deskripsi, bank_soal_id, kelas_id, token, durasi_menit, waktu_mulai, waktu_selesai, kkm, randomize_questions, randomize_options, allow_back_navigation, show_result, max_attempt, status, is_aktif)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1, 1, 1, 'ONGOING', ?)
           ON DUPLICATE KEY UPDATE nama_ujian=VALUES(nama_ujian), token=VALUES(token), is_aktif=VALUES(is_aktif)`,
          [
            u.id,
            u.nama_ujian,
            u.deskripsi || null,
            u.bank_soal_id,
            u.kelas_id,
            u.token,
            u.durasi_menit || 60,
            formatDate(u.waktu_mulai) || new Date().toISOString().slice(0, 19).replace('T', ' '),
            formatDate(u.waktu_selesai) || '2099-12-31 23:59:59',
            u.kkm || 70.0,
            u.is_aktif ? 1 : 0
          ]
        );
      }
    }

    // 10. jawaban_peserta
    if (Array.isArray(jsonData.jawaban_peserta) && jsonData.jawaban_peserta.length > 0) {
      console.log(`-> Migrasi jawaban_peserta (${jsonData.jawaban_peserta.length} baris)`);
      for (const j of jsonData.jawaban_peserta) {
        await conn.query(
          `INSERT INTO jawaban_peserta (id, siswa_id, ujian_id, soal_id, pilihan_jawaban_id, teks_jawaban_essay, is_ragu, nilai_manual, waktu_dijawab)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE pilihan_jawaban_id=VALUES(pilihan_jawaban_id), teks_jawaban_essay=VALUES(teks_jawaban_essay), nilai_manual=VALUES(nilai_manual)`,
          [
            j.id,
            j.siswa_id,
            j.ujian_id,
            j.soal_id,
            j.pilihan_jawaban_id || null,
            j.teks_jawaban_essay || '',
            j.is_ragu ? 1 : 0,
            j.nilai_manual || 0.0,
            formatDate(j.waktu_dijawab) || new Date().toISOString().slice(0, 19).replace('T', ' ')
          ]
        );
      }
    }

    // 11. hasil_ujian
    if (Array.isArray(jsonData.hasil_ujian) && jsonData.hasil_ujian.length > 0) {
      console.log(`-> Migrasi hasil_ujian (${jsonData.hasil_ujian.length} baris)`);
      for (const h of jsonData.hasil_ujian) {
        await conn.query(
          `INSERT INTO hasil_ujian (id, siswa_id, ujian_id, jumlah_benar, jumlah_salah, nilai_pg, nilai_essay, nilai_akhir, status_kelulusan, waktu_selesai)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE jumlah_benar=VALUES(jumlah_benar), jumlah_salah=VALUES(jumlah_salah), nilai_akhir=VALUES(nilai_akhir)`,
          [
            h.id,
            h.siswa_id,
            h.ujian_id,
            h.jumlah_benar || 0,
            h.jumlah_salah || 0,
            h.nilai_pg || 0.0,
            h.nilai_essay || 0.0,
            h.nilai_akhir || 0.0,
            h.nilai_akhir >= 70 ? 'LULUS' : 'REMIDI',
            formatDate(h.waktu_selesai) || new Date().toISOString().slice(0, 19).replace('T', ' ')
          ]
        );
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n=== VERIFIKASI JUMLAH DATA SETELAH MIGRASI ===');
    const tables = [
      'users', 'kelas', 'mata_pelajaran', 'guru', 'siswa',
      'bank_soal', 'soal', 'pilihan_jawaban', 'ujian',
      'jawaban_peserta', 'hasil_ujian'
    ];

    console.log('----------------------------------------------------');
    console.log('| Nama Tabel         | JSON Count   | MySQL Count  | Status   |');
    console.log('----------------------------------------------------');

    let allMatched = true;
    for (const t of tables) {
      const jsonCount = (jsonData[t] || []).length;
      const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      const mySqlCount = rows[0].cnt;
      const status = jsonCount === mySqlCount ? 'MATCH' : 'MISMATCH';
      console.log(`| ${t.padEnd(18)} | ${String(jsonCount).padEnd(12)} | ${String(mySqlCount).padEnd(12)} | [${status}] |`);
      if (jsonCount !== mySqlCount) allMatched = false;
    }
    console.log('----------------------------------------------------');

    if (allMatched) {
      console.log('VERIFIKASI BERHASIL: 100% data JSON tersalin utuh ke MySQL!');
    } else {
      console.warn('PERINGATAN: Terdapat perbedaan jumlah data pada beberapa tabel!');
    }

  } catch (error) {
    console.error('Migrasi data gagal:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  migrateData().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrateData;
