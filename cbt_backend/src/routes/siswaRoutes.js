const express = require('express');
const router = express.Router();
const studentExamController = require('../controllers/studentExamController');
const proctoringController = require('../controllers/proctoringController');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../middlewares/validator');

// Proteksi seluruh rute siswa: Wajib Login & Role Siswa atau Admin
router.use(authenticate, requireRole(['siswa', 'admin']));

// Daftar ujian aktif untuk kelas siswa
router.get(
  '/ujian/:kelasId',
  validateParams({ kelasId: { required: true } }),
  (req, res, next) => studentExamController.getActiveExams(req, res, next)
);

// Verifikasi token ujian
router.post(
  '/ujian/verifikasi-token',
  validateBody({
    ujian_id: { required: true },
    token: { required: true }
  }),
  (req, res, next) => studentExamController.verifyToken(req, res, next)
);

// Ambil soal ujian
router.get(
  '/ujian/soal/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => studentExamController.getExamQuestions(req, res, next)
);

// Realtime sync auto-save jawaban
router.post(
  '/ujian/sync',
  validateBody({
    siswa_id: { required: true },
    ujian_id: { required: true },
    jawaban_list: { required: true, type: 'array' }
  }),
  (req, res, next) => studentExamController.syncAnswers(req, res, next)
);

// Selesai ujian & auto-scoring
router.post(
  '/ujian/submit',
  validateBody({
    siswa_id: { required: true },
    ujian_id: { required: true }
  }),
  (req, res, next) => studentExamController.submitExam(req, res, next)
);

// Riwayat hasil ujian siswa
router.get(
  '/hasil/:siswaId',
  validateParams({ siswaId: { required: true } }),
  (req, res, next) => studentExamController.getStudentResults(req, res, next)
);

// --- PROCTORING & ANTI-CHEAT ---
// Catat pelanggaran integritas / strike
router.post(
  '/ujian/violation',
  validateBody({
    ujian_id: { required: true },
    violation_type: { required: true }
  }),
  (req, res, next) => proctoringController.recordViolation(req, res, next)
);

// Ajukan permohonan buka kunci ujian
router.post(
  '/ujian/unlock-request',
  validateBody({
    ujian_id: { required: true },
    reason: { required: true }
  }),
  (req, res, next) => proctoringController.requestUnlock(req, res, next)
);

// Cek status buka kunci ujian
router.get(
  '/ujian/unlock-status/:ujianId/:siswaId',
  validateParams({ ujianId: { required: true }, siswaId: { required: true } }),
  (req, res, next) => proctoringController.getUnlockStatus(req, res, next)
);

module.exports = router;
