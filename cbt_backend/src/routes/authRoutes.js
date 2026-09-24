const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateBody } = require('../middlewares/validator');

router.post(
  '/login',
  validateBody({
    username: { required: true },
    password: { required: true }
  }),
  (req, res, next) => authController.login(req, res, next)
);

router.post(
  '/register',
  validateBody({
    nis: { required: true },
    nama: { required: true },
    kelas_id: { required: true }
  }),
  (req, res, next) => authController.registerSiswa(req, res, next)
);

router.post(
  '/refresh',
  validateBody({
    refresh_token: { required: true }
  }),
  (req, res, next) => authController.refreshToken(req, res, next)
);

router.get(
  '/me',
  authenticate,
  (req, res, next) => authController.getMe(req, res, next)
);

router.post(
  '/logout',
  authenticate,
  (req, res, next) => authController.logout(req, res, next)
);

module.exports = router;
