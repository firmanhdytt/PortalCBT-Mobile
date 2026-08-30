const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'cbt_db.json');

// Struktur Database Awal (Seeding)
const defaultData = {
  users: [
    { id: 1, username: 'admin', password: 'admin', role: 'admin' },
    { id: 2, username: 'guru', password: 'guru', role: 'guru' },
    { id: 3, username: 'siswa', password: 'siswa', role: 'siswa' },
    { id: 4, username: 'siswa2', password: 'siswa2', role: 'siswa' }
  ],
  kelas: [
    { id: 1, nama_kelas: 'XII RPL 1' },
    { id: 2, nama_kelas: 'XII RPL 2' }
  ],
  mata_pelajaran: [
    { id: 1, kode_mapel: 'INF-12', nama_mapel: 'Informatika' },
    { id: 2, kode_mapel: 'MAT-12', nama_mapel: 'Matematika' }
  ],
  siswa: [
    { id: 1, user_id: 3, nis: '2026001', nama: 'Ahmad Rifai', kelas_id: 1, nama_kelas: 'XII RPL 1' },
    { id: 2, user_id: 4, nis: '2026002', nama: 'Siti Aminah', kelas_id: 1, nama_kelas: 'XII RPL 1' }
  ],
  guru: [
    { id: 1, user_id: 2, nip: '1928392183', nama: 'Budi Santoso, M.Pd.' }
  ],
  bank_soal: [
    { id: 1, mapel_id: 1, guru_id: 1, judul: 'Soal UAS Informatika Kelas XII' }
  ],
  soal: [
    { id: 1, bank_soal_id: 1, jenis_soal: 'PG', teks_soal: 'Manakah di bawah ini yang merupakan bahasa pemrograman utama untuk pengembangan aplikasi Flutter?', gambar_url: '', bobot: 20 },
    { id: 2, bank_soal_id: 1, jenis_soal: 'PG', teks_soal: 'Database lokal yang sering digunakan pada aplikasi mobile Flutter untuk menyimpan data secara luring (offline) adalah...', gambar_url: '', bobot: 20 },
    { id: 3, bank_soal_id: 1, jenis_soal: 'PG', teks_soal: 'Widget dalam Flutter yang berfungsi untuk menata elemen secara vertikal dari atas ke bawah adalah...', gambar_url: '', bobot: 20 },
    { id: 4, bank_soal_id: 1, jenis_soal: 'ESSAY', teks_soal: 'Jelaskan secara singkat apa keuntungan menggunakan Flutter untuk membuat aplikasi mobile!', gambar_url: '', bobot: 40 }
  ],
  pilihan_jawaban: [
    { id: 1, soal_id: 1, teks_pilihan: 'Python', label: 'A', is_kunci: false },
    { id: 2, soal_id: 1, teks_pilihan: 'Java', label: 'B', is_kunci: false },
    { id: 3, soal_id: 1, teks_pilihan: 'Dart', label: 'C', is_kunci: true },
    { id: 4, soal_id: 1, teks_pilihan: 'Swift', label: 'D', is_kunci: false },
    { id: 5, soal_id: 1, teks_pilihan: 'Kotlin', label: 'E', is_kunci: false },
    
    { id: 6, soal_id: 2, teks_pilihan: 'MySQL', label: 'A', is_kunci: false },
    { id: 7, soal_id: 2, teks_pilihan: 'MongoDB', label: 'B', is_kunci: false },
    { id: 8, soal_id: 2, teks_pilihan: 'SQLite', label: 'C', is_kunci: true },
    { id: 9, soal_id: 2, teks_pilihan: 'Redis', label: 'D', is_kunci: false },
    { id: 10, soal_id: 2, teks_pilihan: 'Oracle', label: 'E', is_kunci: false },

    { id: 11, soal_id: 3, teks_pilihan: 'Row', label: 'A', is_kunci: false },
    { id: 12, soal_id: 3, teks_pilihan: 'Column', label: 'B', is_kunci: true },
    { id: 13, soal_id: 3, teks_pilihan: 'Stack', label: 'C', is_kunci: false },
    { id: 14, soal_id: 3, teks_pilihan: 'ListView', label: 'D', is_kunci: false },
    { id: 15, soal_id: 3, teks_pilihan: 'Container', label: 'E', is_kunci: false }
  ],
  ujian: [
    { id: 1, nama_ujian: 'Ujian Akhir Informatika', bank_soal_id: 1, kelas_id: 1, token: 'INF123', durasi_menit: 60, waktu_mulai: '2026-07-26 08:00', waktu_selesai: '2099-12-31 23:59', is_aktif: true }
  ],
  jawaban_peserta: [],
  hasil_ujian: []
};

// Baca basis data dari file JSON
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDB(defaultData);
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    if (!raw.trim()) {
      return defaultData;
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error("Error reading database file:", error);
    return defaultData;
  }
}

// Simpan data ke basis data JSON secara atomik
function writeDB(data) {
  const tmpFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (error) {
    console.error("Error writing database file:", error);
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

// Helper Query Database (Simulasi SQL sederhana)
const db = {
  getAll: (table) => {
    const data = readDB();
    return data[table] || [];
  },
  
  getById: (table, id) => {
    const data = readDB();
    const rows = data[table] || [];
    return rows.find(r => r.id === parseInt(id));
  },
  
  insert: (table, record) => {
    const data = readDB();
    if (!data[table]) data[table] = [];
    
    // Generate Auto-Increment ID
    const maxId = data[table].reduce((max, r) => r.id > max ? r.id : max, 0);
    record.id = maxId + 1;
    
    data[table].push(record);
    writeDB(data);
    return record;
  },
  
  update: (table, id, newFields) => {
    const data = readDB();
    const rows = data[table] || [];
    const index = rows.findIndex(r => r.id === parseInt(id));
    if (index !== -1) {
      rows[index] = { ...rows[index], ...newFields, id: parseInt(id) };
      data[table] = rows;
      writeDB(data);
      return rows[index];
    }
    return null;
  },
  
  delete: (table, id) => {
    const data = readDB();
    const rows = data[table] || [];
    const filtered = rows.filter(r => r.id !== parseInt(id));
    data[table] = filtered;
    writeDB(data);
    return true;
  },

  query: (table, filterFn) => {
    const data = readDB();
    return (data[table] || []).filter(filterFn);
  }
};

module.exports = db;
