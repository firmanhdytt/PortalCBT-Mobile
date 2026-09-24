require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./src/database/db');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

// Setup test express app on test port
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const TEST_PORT = 3100;
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 CBT BACKEND PHASE 2 REFACTORING TEST SUITE');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Verify Repositories
  console.log('\n--- 1. TESTING REPOSITORIES ---');
  try {
    const userRepo = require('./src/repositories/userRepository');
    const adminUser = await userRepo.findByUsername('admin');
    assert(adminUser && adminUser.username === 'admin', 'userRepository.findByUsername(admin) works');

    const masterRepo = require('./src/repositories/masterRepository');
    const classes = await masterRepo.findAllKelas();
    assert(Array.isArray(classes) && classes.length >= 2, `masterRepository.findAllKelas() found ${classes.length} classes`);

    const qRepo = require('./src/repositories/questionRepository');
    const banks = await qRepo.findAllBankSoal();
    assert(Array.isArray(banks) && banks.length >= 2, `questionRepository.findAllBankSoal() found ${banks.length} banks`);

    const examRepo = require('./src/repositories/examRepository');
    const exams = await examRepo.findAllExamsWithStats();
    assert(Array.isArray(exams) && exams.length >= 6, `examRepository.findAllExamsWithStats() found ${exams.length} exams`);

    const sessionRepo = require('./src/repositories/examSessionRepository');
    const studentResults = await sessionRepo.findResultsByStudent(1);
    assert(Array.isArray(studentResults), `examSessionRepository.findResultsByStudent(1) works`);
  } catch (err) {
    assert(false, `Repositories threw error: ${err.message}`);
  }

  // 2. Start HTTP Server for API Contract & Middleware Tests
  console.log('\n--- 2. STARTING SERVER FOR ENDPOINT CONTRACT TESTS ---');
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`Test server running at http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  try {
    // Health check
    const rHealth = await request('GET', '/api/health');
    assert(rHealth.status === 200 && rHealth.data.status === 'ok', 'GET /api/health -> 200 ok');

    // 404 Handler Check
    const rNotFound = await request('GET', '/api/invalid-endpoint-xyz');
    assert(rNotFound.status === 404 && rNotFound.data.success === false && rNotFound.data.code === 'RESOURCE_NOT_FOUND', '404 handler returns structured error response');

    // Validation Middleware Check
    const rBadLogin = await request('POST', '/api/login', {});
    assert(rBadLogin.status === 400 && rBadLogin.data.success === false && rBadLogin.data.code === 'VALIDATION_ERROR', 'Validation middleware catches missing login fields');

    // Authentication: Admin Login
    const rAdminLogin = await request('POST', '/api/login', { username: 'admin', password: 'admin' });
    assert(rAdminLogin.status === 200 && rAdminLogin.data.user && rAdminLogin.data.user.role === 'admin', 'POST /api/login (admin) succeeds with { message, user, profil }');

    // Authentication: Guru Login
    const rGuruLogin = await request('POST', '/api/login', { username: 'guru', password: 'guru' });
    assert(rGuruLogin.status === 200 && rGuruLogin.data.user && rGuruLogin.data.user.role === 'guru', 'POST /api/login (guru) succeeds');

    // Authentication: Siswa Login by username
    const rSiswaLogin = await request('POST', '/api/login', { username: 'siswa', password: 'siswa' });
    assert(rSiswaLogin.status === 200 && rSiswaLogin.data.user && rSiswaLogin.data.profil && rSiswaLogin.data.profil.nis === '2026001', 'POST /api/login (siswa by username) returns user + profil');

    // Authentication: Siswa Login by NIS
    const rSiswaByNis = await request('POST', '/api/login', { username: '2026001', password: 'siswa' });
    assert(rSiswaByNis.status === 200 && rSiswaByNis.data.profil && rSiswaByNis.data.profil.nis === '2026001', 'POST /api/login (siswa by NIS) returns user + profil');

    // Authentication: Wrong Password
    const rWrongPass = await request('POST', '/api/login', { username: 'siswa', password: 'wrongpassword' });
    assert(rWrongPass.status === 401 && rWrongPass.data.success === false, 'POST /api/login (wrong password) -> 401 UNAUTHORIZED');

    // Siswa: Get Active Exams (Flutter contract: List<dynamic>)
    const rActiveExams = await request('GET', '/api/siswa/ujian/1');
    assert(rActiveExams.status === 200 && Array.isArray(rActiveExams.data), 'GET /api/siswa/ujian/1 returns Array (Flutter contract preserved)');

    // Siswa: Token Verification
    const firstExam = rActiveExams.data[0];
    if (firstExam) {
      const rVerify = await request('POST', '/api/siswa/ujian/verifikasi-token', {
        ujian_id: firstExam.id,
        token: firstExam.token
      });
      assert(rVerify.status === 200 && rVerify.data.ujian, `POST /api/siswa/ujian/verifikasi-token valid with token "${firstExam.token}"`);

      const rVerifyBad = await request('POST', '/api/siswa/ujian/verifikasi-token', {
        ujian_id: firstExam.id,
        token: 'WRONGTOKEN'
      });
      assert(rVerifyBad.status === 400 && rVerifyBad.data.success === false, 'POST /api/siswa/ujian/verifikasi-token invalid token returns error');

      // Siswa: Get Questions (Flutter contract: List<dynamic>, options stripped of is_kunci)
      const rQuestions = await request('GET', `/api/siswa/ujian/soal/${firstExam.id}`);
      assert(rQuestions.status === 200 && Array.isArray(rQuestions.data), `GET /api/siswa/ujian/soal/${firstExam.id} returns Array`);
      if (rQuestions.data.length > 0) {
        const sampleQ = rQuestions.data[0];
        const hasKey = sampleQ.pilihan && sampleQ.pilihan.some(o => o.is_kunci !== undefined);
        assert(!hasKey, 'Security: Student question choices do NOT leak is_kunci');
      }

      // Siswa: Real-time sync auto-save
      const rSync = await request('POST', '/api/siswa/ujian/sync', {
        siswa_id: 1,
        ujian_id: firstExam.id,
        jawaban_list: [
          { soal_id: 1, pilihan_jawaban_id: 1, teks_jawaban_essay: '', is_ragu: 0 }
        ]
      });
      assert(rSync.status === 200 && rSync.data.message.includes('disinkronkan'), 'POST /api/siswa/ujian/sync works');

      // Siswa: Submit exam
      const rSubmit = await request('POST', '/api/siswa/ujian/submit', {
        siswa_id: 1,
        ujian_id: firstExam.id
      });
      assert(rSubmit.status === 200 && rSubmit.data.hasil && rSubmit.data.hasil.nilai_akhir !== undefined, 'POST /api/siswa/ujian/submit calculates and returns score');
    }

    // Siswa: Riwayat Hasil (Flutter contract: List<dynamic>)
    const rStudentResults = await request('GET', '/api/siswa/hasil/1');
    assert(rStudentResults.status === 200 && Array.isArray(rStudentResults.data), 'GET /api/siswa/hasil/1 returns Array (Flutter contract preserved)');

    // Guru: Bank Soal
    const rBankSoal = await request('GET', '/api/guru/bank-soal');
    assert(rBankSoal.status === 200 && Array.isArray(rBankSoal.data), 'GET /api/guru/bank-soal returns Array');

    // Guru: Soal by Bank
    const rSoal = await request('GET', '/api/guru/soal/1');
    assert(rSoal.status === 200 && Array.isArray(rSoal.data), 'GET /api/guru/soal/1 returns questions with choices');

    // Guru: Ujian list
    const rUjianList = await request('GET', '/api/guru/ujian');
    assert(rUjianList.status === 200 && Array.isArray(rUjianList.data), 'GET /api/guru/ujian returns exams with statistics');

    // Guru: Monitoring
    const rMon = await request('GET', '/api/guru/monitoring/1');
    assert(rMon.status === 200 && rMon.data.siswa && Array.isArray(rMon.data.siswa), 'GET /api/guru/monitoring/1 returns live student monitoring');

    // Guru: Nilai Essay List
    const rEssayList = await request('GET', '/api/guru/nilai-essay/list/1');
    assert(rEssayList.status === 200 && Array.isArray(rEssayList.data), 'GET /api/guru/nilai-essay/list/1 returns essay questions');

    // Guru: Rekap Nilai
    const rRekap = await request('GET', '/api/guru/rekap-nilai/1');
    assert(rRekap.status === 200 && Array.isArray(rRekap.data), 'GET /api/guru/rekap-nilai/1 returns recap');

    // Admin: Siswa CRUD
    const rAdminSiswa = await request('GET', '/api/admin/siswa');
    assert(rAdminSiswa.status === 200 && Array.isArray(rAdminSiswa.data), 'GET /api/admin/siswa returns Array');

    // Admin: Kelas
    const rAdminKelas = await request('GET', '/api/admin/kelas');
    assert(rAdminKelas.status === 200 && Array.isArray(rAdminKelas.data), 'GET /api/admin/kelas returns Array');

    // Admin: Mapel
    const rAdminMapel = await request('GET', '/api/admin/mapel');
    assert(rAdminMapel.status === 200 && Array.isArray(rAdminMapel.data), 'GET /api/admin/mapel returns Array');

    // Web Static File Check
    const rWebIndex = await request('GET', '/');
    assert(rWebIndex.status === 200 && typeof rWebIndex.data === 'string' && rWebIndex.data.includes('CBT'), 'GET / serves Web Portal index.html');

  } catch (err) {
    assert(false, `API test failed with exception: ${err.message}`);
  } finally {
    if (server) {
      server.close();
      console.log('Test server closed.');
    }
    if (typeof db.closePool === 'function') {
      await db.closePool();
    }
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
