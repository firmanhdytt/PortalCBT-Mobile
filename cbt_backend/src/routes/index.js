const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const guruRoutes = require('./guruRoutes');
const siswaRoutes = require('./siswaRoutes');
const authController = require('../controllers/authController');
const { validateBody } = require('../middlewares/validator');

// Legacy & Direct Auth Routes (/api/login & /api/register)
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

// Modular Sub-routers
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/guru', guruRoutes);
router.use('/siswa', siswaRoutes);

module.exports = router;
