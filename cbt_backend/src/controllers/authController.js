const authService = require('../services/authService');
const { ApiResponse } = require('../utils/response');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const meta = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      const result = await authService.login(username, password, meta);

      // Contract preservation: Mobile & Web expect { message, user, profil }
      // Phase 3 addition: includes token & refresh_token
      return res.status(200).json({
        message: 'Login berhasil!',
        token: result.token,
        refresh_token: result.refresh_token,
        user: result.user,
        profil: result.profil
      });
    } catch (err) {
      next(err);
    }
  }

  async registerSiswa(req, res, next) {
    try {
      const result = await authService.registerSiswa(req.body);
      return res.status(201).json({
        message: 'Registrasi berhasil!',
        token: result.token,
        refresh_token: result.refresh_token,
        user: result.user,
        profil: result.profil
      });
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refresh_token } = req.body;
      const meta = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
      };
      const result = await authService.refreshToken(refresh_token, meta);
      return res.status(200).json({
        message: 'Token berhasil diperbarui!',
        token: result.token,
        refresh_token: result.refresh_token
      });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      const result = await authService.getMe(req.user.id);
      return ApiResponse.raw(res, result);
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res, next) {
    try {
      const { refresh_token } = req.body;
      await authService.logout(refresh_token);
      return res.status(200).json({
        message: 'Logout berhasil!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
