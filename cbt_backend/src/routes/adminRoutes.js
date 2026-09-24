const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { validateBody, validateParams } = require('../middlewares/validator');

// Siswa
router.get('/siswa', (req, res, next) => masterController.getAllSiswa(req, res, next));

router.post(
  '/siswa',
  validateBody({
    nis: { required: true },
    nama: { required: true },
    kelas_id: { required: true }
  }),
  (req, res, next) => masterController.createSiswa(req, res, next)
);

router.delete(
  '/siswa/:id',
  validateParams({
    id: { required: true }
  }),
  (req, res, next) => masterController.deleteSiswa(req, res, next)
);

// Kelas
router.get('/kelas', (req, res, next) => masterController.getAllKelas(req, res, next));

router.post(
  '/kelas',
  validateBody({
    nama_kelas: { required: true }
  }),
  (req, res, next) => masterController.createKelas(req, res, next)
);

// Mata Pelajaran
router.get('/mapel', (req, res, next) => masterController.getAllMapel(req, res, next));

router.post(
  '/mapel',
  validateBody({
    nama_mapel: { required: true }
  }),
  (req, res, next) => masterController.createMapel(req, res, next)
);

module.exports = router;
