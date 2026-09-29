const db = require('../database/db');

class PreferenceRepository {
  /**
   * Ambil preferensi pengguna (tema, font scale, high contrast)
   */
  async findByUserId(userId) {
    const rows = await db.query(
      `SELECT user_id, theme, font_scale, high_contrast, updated_at
       FROM user_preferences
       WHERE user_id = ?`,
      [userId]
    );

    if (rows.length > 0) {
      return rows[0];
    }

    // Default fallback
    return {
      user_id: userId,
      theme: 'system',
      font_scale: 'normal',
      high_contrast: 0
    };
  }

  /**
   * Simpan atau perbarui preferensi pengguna
   */
  async upsert(userId, { theme = 'system', fontScale = 'normal', highContrast = 0 }) {
    await db.query(
      `INSERT INTO user_preferences (user_id, theme, font_scale, high_contrast)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         theme = VALUES(theme),
         font_scale = VALUES(font_scale),
         high_contrast = VALUES(high_contrast),
         updated_at = NOW()`,
      [userId, theme, fontScale, highContrast ? 1 : 0]
    );

    return await this.findByUserId(userId);
  }
}

module.exports = new PreferenceRepository();