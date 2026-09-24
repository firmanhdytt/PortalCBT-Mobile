require('dotenv').config();
const { pool, testConnection } = require('./src/config/database');

/**
 * In-Memory cache synchronized directly with MySQL.
 * All mutations are persisted immediately into MySQL using prepared statements.
 */
let cache = {
  users: [],
  kelas: [],
  mata_pelajaran: [],
  guru: [],
  siswa: [],
  bank_soal: [],
  soal: [],
  pilihan_jawaban: [],
  ujian: [],
  jawaban_peserta: [],
  hasil_ujian: [],
  exam_attempts: [],
  exam_violations: [],
  unlock_requests: [],
  activity_logs: [],
  certificates: [],
  notifications: []
};

let isInitialized = false;

// Load all tables from MySQL into memory cache
async function initFromMySQL() {
  try {
    await testConnection();
    const tables = Object.keys(cache);
    
    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
        // Normalize boolean fields for backwards compatibility with existing UI
        cache[table] = rows.map(r => {
          const item = { ...r };
          if ('is_kunci' in item) item.is_kunci = item.is_kunci === 1 || item.is_kunci === true;
          if ('is_aktif' in item) item.is_aktif = item.is_aktif === 1 || item.is_aktif === true;
          if ('is_ragu' in item) item.is_ragu = item.is_ragu === 1 || item.is_ragu === true;
          return item;
        });
      } catch (err) {
        // Table might be created later
        cache[table] = [];
      }
    }
    isInitialized = true;
    console.log('[DB-MySQL] Cache terinisialisasi dari MySQL database cbt_system.');
  } catch (error) {
    console.error('[DB-MySQL] Gagal memuat data dari MySQL:', error.message);
  }
}

// Initial sync
initFromMySQL();

const db = {
  pool,
  initFromMySQL,

  getAll: (table) => {
    return cache[table] || [];
  },

  getById: (table, id) => {
    const rows = cache[table] || [];
    return rows.find(r => r.id === parseInt(id));
  },

  insert: (table, record) => {
    if (!cache[table]) cache[table] = [];
    
    // Auto-increment ID if not provided
    if (!record.id) {
      const maxId = cache[table].reduce((max, r) => r.id > max ? r.id : max, 0);
      record.id = maxId + 1;
    }

    cache[table].push(record);

    // Persist asynchronously to MySQL
    (async () => {
      try {
        const keys = Object.keys(record);
        const values = Object.values(record).map(v => {
          if (typeof v === 'boolean') return v ? 1 : 0;
          return v;
        });
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})
                     ON DUPLICATE KEY UPDATE ${keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(', ')}`;
        await pool.query(sql, values);
      } catch (err) {
        console.error(`[MySQL-INSERT-ERROR] Gagal menyimpan ke tabel ${table}:`, err.message);
      }
    })();

    return record;
  },

  update: (table, id, newFields) => {
    const rows = cache[table] || [];
    const index = rows.findIndex(r => r.id === parseInt(id));
    if (index !== -1) {
      rows[index] = { ...rows[index], ...newFields, id: parseInt(id) };
      cache[table] = rows;

      // Persist asynchronously to MySQL
      (async () => {
        try {
          const keys = Object.keys(newFields);
          if (keys.length === 0) return;
          const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
          const values = Object.values(newFields).map(v => {
            if (typeof v === 'boolean') return v ? 1 : 0;
            return v;
          });
          const sql = `UPDATE \`${table}\` SET ${setClause} WHERE id = ?`;
          await pool.query(sql, [...values, parseInt(id)]);
        } catch (err) {
          console.error(`[MySQL-UPDATE-ERROR] Gagal memperbarui tabel ${table} id ${id}:`, err.message);
        }
      })();

      return rows[index];
    }
    return null;
  },

  delete: (table, id) => {
    const rows = cache[table] || [];
    cache[table] = rows.filter(r => r.id !== parseInt(id));

    // Persist asynchronously to MySQL
    (async () => {
      try {
        await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [parseInt(id)]);
      } catch (err) {
        console.error(`[MySQL-DELETE-ERROR] Gagal menghapus dari tabel ${table} id ${id}:`, err.message);
      }
    })();

    return true;
  },

  query: (table, filterFn) => {
    const rows = cache[table] || [];
    return rows.filter(filterFn);
  },

  // Modern async queries for repositories
  async rawQuery(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async rawExecute(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result;
  }
};

module.exports = db;
