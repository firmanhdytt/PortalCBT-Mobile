const express = require('express');
const router = express.Router();
const preferenceController = require('../controllers/preferenceController');
const { authenticate } = require('../middlewares/authMiddleware');

// Seluruh route preferensi mewajibkan otentikasi JWT
router.use(authenticate);

// Ambil preferensi pengguna (tema, font scale, high contrast)
router.get('/', (req, res, next) => preferenceController.getPreferences(req, res, next));

// Simpan / update preferensi pengguna
router.put('/', (req, res, next) => preferenceController.updatePreferences(req, res, next));

module.exports = router;