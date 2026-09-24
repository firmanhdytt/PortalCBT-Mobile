require('dotenv').config();
const { pool } = require('../config/database');

/**
 * Modern MySQL Database Access Layer with Connection Pooling
 */
const db = {
  pool,

  async testConnection() {
    try {
      const [rows] = await pool.query('SELECT 1 as val');
      return rows && rows.length > 0;
    } catch (e) {
      return false;
    }
  },

  async closePool() {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  },

  // Direct raw query with parameters
  async query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  // Direct raw execution (INSERT, UPDATE, DELETE)
  async execute(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result;
  },

  // Get single row
  async getOne(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  // Get all rows from table
  async getAll(table, orderBy = 'id ASC') {
    return await this.query(`SELECT * FROM ?? ORDER BY ${orderBy}`, [table]);
  },

  // Get row by ID
  async getById(table, id) {
    return await this.getOne('SELECT * FROM ?? WHERE id = ?', [table, id]);
  },

  // Generic insert
  async insert(table, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ?? (${keys.map(k => `\`${k}\``).join(', ')}) VALUES (${placeholders})`;
    
    const [result] = await pool.query(sql, [table, ...values]);
    return { id: result.insertId, ...data };
  },

  // Generic update by ID
  async update(table, id, data) {
    const keys = Object.keys(data);
    if (keys.length === 0) return null;
    
    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    const values = Object.values(data);
    const sql = `UPDATE ?? SET ${setClause} WHERE id = ?`;
    
    await pool.query(sql, [table, ...values, id]);
    return await this.getById(table, id);
  },

  // Generic delete by ID
  async delete(table, id) {
    const [result] = await pool.query('DELETE FROM ?? WHERE id = ?', [table, id]);
    return result.affectedRows > 0;
  },

  // Generic find where condition
  async findWhere(table, conditions = {}, orderBy = 'id ASC') {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return await this.getAll(table, orderBy);

    const whereClause = keys.map(k => `\`${k}\` = ?`).join(' AND ');
    const values = Object.values(conditions);
    const sql = `SELECT * FROM ?? WHERE ${whereClause} ORDER BY ${orderBy}`;
    
    return await this.query(sql, [table, ...values]);
  },

  // Transaction helper
  async transaction(callback) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
};

module.exports = db;
