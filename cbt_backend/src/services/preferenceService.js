const preferenceRepository = require('../repositories/preferenceRepository');

class PreferenceService {
  /**
   * Ambil preferensi pengguna (tema, font_scale, high_contrast)
   */
  async getPreferences(userId) {
    if (!userId) {
      const err = new Error('User ID wajib disertakan');
      err.statusCode = 400;
      throw err;
    }
    return await preferenceRepository.findByUserId(userId);
  }

  /**
   * Simpan atau update preferensi pengguna
   */
  async updatePreferences(userId, { theme, font_scale, fontScale, high_contrast, highContrast }) {
    if (!userId) {
      const err = new Error('User ID wajib disertakan');
      err.statusCode = 400;
      throw err;
    }

    const current = await preferenceRepository.findByUserId(userId);

    // Validasi tema
    let targetTheme = theme !== undefined ? theme : current.theme;
    if (targetTheme && !['light', 'dark', 'system'].includes(targetTheme.toLowerCase())) {
      const err = new Error('Nilai tema tidak valid. Pilihan: light, dark, system');
      err.statusCode = 400;
      throw err;
    }
    targetTheme = targetTheme ? targetTheme.toLowerCase() : 'system';

    // Validasi font scale
    let targetFontScale = (font_scale !== undefined ? font_scale : fontScale) || current.font_scale;
    if (targetFontScale && !['normal', 'medium', 'large'].includes(targetFontScale.toLowerCase())) {
      const err = new Error('Nilai ukuran font tidak valid. Pilihan: normal, medium, large');
      err.statusCode = 400;
      throw err;
    }
    targetFontScale = targetFontScale ? targetFontScale.toLowerCase() : 'normal';

    // Validasi high contrast
    let targetContrast = high_contrast !== undefined ? high_contrast : highContrast;
    if (targetContrast === undefined) {
      targetContrast = current.high_contrast;
    }
    const isHighContrast = (targetContrast === true || targetContrast === 1 || targetContrast === '1') ? 1 : 0;

    return await preferenceRepository.upsert(userId, {
      theme: targetTheme,
      fontScale: targetFontScale,
      highContrast: isHighContrast
    });
  }
}

module.exports = new PreferenceService();