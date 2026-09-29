const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const examController = require('../controllers/examController');
const proctoringController = require('../controllers/proctoringController');
const certificateController = require('../controllers/certificateController');
const masterController = require('../controllers/masterController');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');
const { validateBody, validateParams } = require('../middlewares/validator');

// Proteksi seluruh rute guru: Wajib Login & Role Guru atau Admin
router.use(authenticate, requireRole(['guru', 'admin']));

// --- WORKSPACE GURU ---
router.get('/workspace', (req, res, next) => masterController.getWorkspace(req, res, next));

// --- BANK SOAL ---
router.get('/bank-soal', (req, res, next) => questionController.getBankSoal(req, res, next));

router.post(
  '/bank-soal',
  validateBody({
    judul: { required: true }
  }),
  (req, res, next) => questionController.createBankSoal(req, res, next)
);

router.put(
  '/bank-soal/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => questionController.updateBankSoal(req, res, next)
);

router.delete(
  '/bank-soal/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => questionController.deleteBankSoal(req, res, next)
);

// --- SOAL ---
router.get(
  '/soal/:bankSoalId',
  validateParams({ bankSoalId: { required: true } }),
  (req, res, next) => questionController.getQuestionsByBankId(req, res, next)
);

router.post(
  '/soal',
  validateBody({
    bank_soal_id: { required: true },
    jenis_soal: { required: true },
    teks_soal: { required: true }
  }),
  (req, res, next) => questionController.createQuestion(req, res, next)
);

router.get(
  '/soal/detail/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => questionController.getQuestionDetail(req, res, next)
);

router.put(
  '/soal/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => questionController.updateQuestion(req, res, next)
);

router.delete(
  '/soal/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => questionController.deleteQuestion(req, res, next)
);

// --- UJIAN & JADWAL ---
router.get('/ujian', (req, res, next) => examController.getExams(req, res, next));

router.post(
  '/ujian',
  validateBody({
    nama_ujian: { required: true },
    bank_soal_id: { required: true },
    kelas_id: { required: true }
  }),
  (req, res, next) => examController.createExam(req, res, next)
);

router.post(
  '/ujian/toggle/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => examController.toggleExam(req, res, next)
);

router.delete(
  '/ujian/:id',
  validateParams({ id: { required: true } }),
  (req, res, next) => examController.deleteExam(req, res, next)
);

// --- MONITORING ---
router.get(
  '/monitoring/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.getMonitoring(req, res, next)
);

// --- PENILAIAN ESSAY ---
router.get(
  '/nilai-essay/list/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.getEssayList(req, res, next)
);

router.post(
  '/nilai-essay/grade',
  validateBody({
    jawaban_id: { required: true },
    nilai: { required: true }
  }),
  (req, res, next) => examController.gradeEssay(req, res, next)
);

// --- REKAPITULASI HASIL & EKSPOR ---
router.get(
  '/rekap-nilai/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.getExamRecap(req, res, next)
);

router.get(
  '/rekap-nilai/:ujianId/export',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.exportRecap(req, res, next)
);

// --- ANALITIK & ANALISIS BUTIR SOAL ---
router.get(
  '/analisis-soal/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.getItemAnalysis(req, res, next)
);

router.get(
  '/analisis-kelas/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => examController.getClassAnalytics(req, res, next)
);

// --- PROCTORING & ANTI-CHEAT MONITORING ---
router.get(
  '/proctoring/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => proctoringController.getProctoringMonitoring(req, res, next)
);

router.post(
  '/proctoring/unlock/:requestId',
  validateParams({ requestId: { required: true } }),
  (req, res, next) => proctoringController.reviewUnlockRequest(req, res, next)
);

router.post(
  '/proctoring/reset-violations',
  validateBody({
    ujian_id: { required: true },
    siswa_id: { required: true }
  }),
  (req, res, next) => proctoringController.manualUnlock(req, res, next)
);

// --- SERTIFIKAT DIGITAL & KELULUSAN ---
router.post(
  '/sertifikat/issue',
  validateBody({
    ujian_id: { required: true },
    siswa_id: { required: true }
  }),
  (req, res, next) => certificateController.issueCertificate(req, res, next)
);

router.post(
  '/sertifikat/issue-batch',
  validateBody({
    ujian_id: { required: true }
  }),
  (req, res, next) => certificateController.issueBatchCertificates(req, res, next)
);

router.get(
  '/sertifikat/ujian/:ujianId',
  validateParams({ ujianId: { required: true } }),
  (req, res, next) => certificateController.getExamCertificates(req, res, next)
);

// --- KARTU PESERTA UJIAN (ADMIN / GURU) ---
router.get(
  '/kartu-ujian/kelas/:kelasId',
  validateParams({ kelasId: { required: true } }),
  (req, res, next) => certificateController.getClassCards(req, res, next)
);

router.get(
  '/kartu-ujian/kelas/:kelasId/print',
  validateParams({ kelasId: { required: true } }),
  (req, res, next) => certificateController.printClassCardsHtml(req, res, next)
);

router.get(
  '/kartu-ujian/student/:siswaId/print',
  validateParams({ siswaId: { required: true } }),
  (req, res, next) => certificateController.printStudentCardHtml(req, res, next)
);

module.exports = router;
