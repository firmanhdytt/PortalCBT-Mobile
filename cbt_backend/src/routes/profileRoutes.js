const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middlewares/authMiddleware');
const { validateBody } = require('../middlewares/validator');

// Seluruh route profil mewajibkan otentikasi JWT (Siswa, Guru, Admin)
router.use(authenticate);

// Ambil profil pengguna yang login
router.get('/', (req, res, next) => profileController.getProfile(req, res, next));

// Update nama & email
router.put('/', (req, res, next) => profileController.updateProfile(req, res, next));

// Upload / update foto profil avatar
router.post('/avatar', (req, res, next) => profileController.uploadAvatar(req, res, next));

// Hapus foto profil avatar (fallback to initials)
router.delete('/avatar', (req, res, next) => profileController.deleteAvatar(req, res, next));

// Ganti password
router.post(
  '/change-password',
  validateBody({
    current_password: { required: true },
    new_password: { required: true }
  }),
  (req, res, next) => profileController.changePassword(req, res, next)
);

module.exports = router;
