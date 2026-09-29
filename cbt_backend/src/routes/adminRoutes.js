const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../middlewares/validator');

// Proteksi seluruh rute admin: Wajib Login & Role Admin
router.use(authenticate, requireRole(['admin']));

// --- SISWA ---
router.get('/siswa', (req, res, next) => masterController.getAllSiswa(req, res, next));
router.get('/siswa/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.getSiswaById(req, res, next));
router.post(
  '/siswa',
  validateBody({
    nis: { required: true },
    nama: { required: true },
    kelas_id: { required: true }
  }),
  (req, res, next) => masterController.createSiswa(req, res, next)
);
router.put('/siswa/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.updateSiswa(req, res, next));
router.delete('/siswa/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.deleteSiswa(req, res, next));

// --- GURU ---
router.get('/guru', (req, res, next) => masterController.getAllGuru(req, res, next));
router.get('/guru/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.getGuruById(req, res, next));
router.post(
  '/guru',
  validateBody({
    nip: { required: true },
    nama: { required: true }
  }),
  (req, res, next) => masterController.createGuru(req, res, next)
);
router.put('/guru/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.updateGuru(req, res, next));
router.delete('/guru/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.deleteGuru(req, res, next));
router.post('/guru/:id/assign', validateParams({ id: { required: true } }), (req, res, next) => masterController.assignGuru(req, res, next));

// --- KELAS ---
router.get('/kelas', (req, res, next) => masterController.getAllKelas(req, res, next));
router.get('/kelas/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.getKelasDetail(req, res, next));
router.post(
  '/kelas',
  validateBody({
    nama_kelas: { required: true }
  }),
  (req, res, next) => masterController.createKelas(req, res, next)
);
router.put('/kelas/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.updateKelas(req, res, next));
router.delete('/kelas/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.deleteKelas(req, res, next));

// --- MATA PELAJARAN ---
router.get('/mapel', (req, res, next) => masterController.getAllMapel(req, res, next));
router.get('/mapel/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.getMapelDetail(req, res, next));
router.post(
  '/mapel',
  validateBody({
    nama_mapel: { required: true }
  }),
  (req, res, next) => masterController.createMapel(req, res, next)
);
router.put('/mapel/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.updateMapel(req, res, next));
router.delete('/mapel/:id', validateParams({ id: { required: true } }), (req, res, next) => masterController.deleteMapel(req, res, next));

module.exports = router;
