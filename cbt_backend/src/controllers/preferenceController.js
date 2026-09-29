const preferenceService = require('../services/preferenceService');

class PreferenceController {
  /**
   * Ambil preferensi pengguna (tema, font scale, high contrast)
   */
  async getPreferences(req, res, next) {
    try {
      const preferences = await preferenceService.getPreferences(req.user.id);
      return res.json({
        status: 'success',
        data: preferences
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update preferensi pengguna
   */
  async updatePreferences(req, res, next) {
    try {
      const { theme, font_scale, fontScale, high_contrast, highContrast } = req.body;
      const updated = await preferenceService.updatePreferences(req.user.id, {
        theme,
        font_scale,
        fontScale,
        high_contrast,
        highContrast
      });
      return res.json({
        status: 'success',
        message: 'Preferensi tampilan berhasil disimpan.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PreferenceController();