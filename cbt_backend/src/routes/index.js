const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const guruRoutes = require('./guruRoutes');
const siswaRoutes = require('./siswaRoutes');
const profileRoutes = require('./profileRoutes');
const notificationRoutes = require('./notificationRoutes');
const preferenceRoutes = require('./preferenceRoutes');
const authController = require('../controllers/authController');
const certificateController = require('../controllers/certificateController');
const { validateBody } = require('../middlewares/validator');

// Public Certificate Verification & Print (Unauthenticated)
router.get('/sertifikat/verify/:certificateNumber', (req, res, next) =>
  certificateController.verifyPublicCertificate(req, res, next)
);
router.get('/sertifikat/print/:certificateNumber', (req, res, next) =>
  certificateController.printCertificateHtml(req, res, next)
);

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
router.use('/profile', profileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/preferences', preferenceRoutes);

module.exports = router;
