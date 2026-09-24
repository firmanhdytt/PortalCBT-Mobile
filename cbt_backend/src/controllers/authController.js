const authService = require('../services/authService');
const { ApiResponse } = require('../utils/response');

class AuthController {
  async login(req, res, next) {
    try {
      const { username, password, role } = req.body;
      const result = await authService.login(username, password, role);

      // Contract preservation: Mobile & Web expect { message, user, profil }
      return res.status(200).json({
        message: 'Login berhasil!',
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
      return res.status(200).json({
        message: 'Registrasi berhasil!',
        user: result.user,
        profil: result.profil
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
