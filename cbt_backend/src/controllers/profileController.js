const profileService = require('../services/profileService');

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

class ProfileController {
  /**
   * Ambil data profil lengkap pengguna yang sedang terotentikasi
   */
  async getProfile(req, res, next) {
    try {
      const profile = await profileService.getProfile(req.user.id, req.user.role);
      return res.json({
        status: 'success',
        data: profile
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update informasi nama dan email pengguna
   */
  async updateProfile(req, res, next) {
    try {
      const { nama, email } = req.body;
      const updated = await profileService.updateProfile(req.user.id, req.user.role, { nama, email });
      return res.json({
        status: 'success',
        message: 'Informasi profil berhasil diperbarui.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload / ganti avatar profil pengguna
   */
  async uploadAvatar(req, res, next) {
    try {
      const imagePayload = req.body.image_data || req.body.avatar || req.body.image;
      const baseUrl = getBaseUrl(req);
      const result = await profileService.uploadAvatar(req.user.id, req.user.role, imagePayload, baseUrl);
      return res.json({
        status: 'success',
        message: 'Foto profil berhasil diunggah.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Hapus avatar profil pengguna (reset ke inisial)
   */
  async deleteAvatar(req, res, next) {
    try {
      const result = await profileService.deleteAvatar(req.user.id, req.user.role);
      return res.json({
        status: 'success',
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ubah kata sandi pengguna
   */
  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      const result = await profileService.changePassword(req.user.id, { current_password, new_password });
      return res.json({
        status: 'success',
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProfileController();
