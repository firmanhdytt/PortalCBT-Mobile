require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cbt_system',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[DB] Terhubung ke MySQL server: ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'}/${process.env.DB_NAME || 'cbt_system'}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('[DB] Gagal terhubung ke MySQL:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  testConnection
};
