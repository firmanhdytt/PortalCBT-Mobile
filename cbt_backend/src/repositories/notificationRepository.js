const db = require('../database/db');

class NotificationRepository {
  /**
   * Buat notifikasi tunggal untuk pengguna tertentu
   */
  async create({ userId, title, message, type = 'info', category = 'general', referenceId = null }) {
    const res = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, category, reference_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
      [userId, title, message, type, category, referenceId]
    );
    return res.insertId;
  }

  /**
   * Buat notifikasi massal (misal: untuk seluruh siswa di suatu kelas)
   */
  async createBatch(notifications) {
    if (!notifications || notifications.length === 0) return 0;

    const values = [];
    const placeholders = [];

    for (const n of notifications) {
      placeholders.push('(?, ?, ?, ?, ?, ?, 0, NOW())');
      values.push(
        n.userId,
        n.title,
        n.message,
        n.type || 'info',
        n.category || 'general',
        n.referenceId || null
      );
    }

    const sql = `INSERT INTO notifications (user_id, title, message, type, category, reference_id, is_read, created_at)
                 VALUES ${placeholders.join(', ')}`;
    const res = await db.query(sql, values);
    return res.affectedRows;
  }

  /**
   * Ambil daftar notifikasi untuk suatu pengguna dengan pagination & filter
   */
  async findByUserId(userId, { limit = 30, unreadOnly = false } = {}) {
    let sql = `SELECT id, user_id, title, message, type, category, reference_id, is_read, created_at
               FROM notifications
               WHERE user_id = ?`;
    const params = [userId];

    if (unreadOnly) {
      sql += ` AND is_read = 0`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(Number(limit));

    const rows = await db.query(sql, params);
    return rows;
  }

  /**
   * Hitung total notifikasi yang belum dibaca
   */
  async getUnreadCount(userId) {
    const rows = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return rows[0] ? Number(rows[0].count) : 0;
  }

  /**
   * Tandai satu notifikasi sebagai sudah dibaca
   */
  async markAsRead(id, userId) {
    const res = await db.query(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return res.affectedRows > 0;
  }

  /**
   * Tandai seluruh notifikasi milik pengguna sebagai sudah dibaca
   */
  async markAllAsRead(userId) {
    const res = await db.query(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return res.affectedRows;
  }

  /**
   * Hapus notifikasi tertentu
   */
  async deleteById(id, userId) {
    const res = await db.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return res.affectedRows > 0;
  }
}

module.exports = new NotificationRepository();