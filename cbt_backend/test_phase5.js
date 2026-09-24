require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');

const db = require('./src/database/db');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middlewares/errorHandler');
const authService = require('./src/services/authService');
const studentExamService = require('./src/services/studentExamService');
const examSessionRepository = require('./src/repositories/examSessionRepository');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);
app.use(errorHandler);

async function runPhase5BackendTests() {
  console.log('====================================================');
  console.log('🧪 CBT BACKEND PHASE 5 CONFLICT RESOLUTION TEST SUITE');
  console.log('====================================================\n');

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

  try {
    const siswaId = 1;
    const ujianId = 1;
    const soalId = 1;

    // Reset previous answers for question 1
    await db.query(
      'DELETE FROM jawaban_peserta WHERE siswa_id = ? AND ujian_id = ? AND soal_id = ?',
      [siswaId, ujianId, soalId]
    );

    console.log('--- 1. TESTING FIRST SYNC (INITIAL ANSWER) ---');
    const timeT1 = new Date('2026-09-24T10:00:00.000Z');
    const sync1 = await studentExamService.syncAnswers(siswaId, ujianId, [
      {
        soal_id: soalId,
        pilihan_jawaban_id: 1, // Option A
        teks_jawaban_essay: '',
        is_ragu: false,
        waktu_dijawab: timeT1.toISOString()
      }
    ]);
    assert(sync1.success === true, 'Sync 1 berhasil dijalankan');
    assert(sync1.synced_count === 1, 'Sync 1 menyimpan 1 jawaban');
    assert(sync1.conflicts_ignored === 0, 'Sync 1 tidak ada konflik');

    const ansT1 = await examSessionRepository.findSingleAnswer(siswaId, ujianId, soalId);
    assert(ansT1 && ansT1.pilihan_jawaban_id === 1, 'Jawaban di DB adalah Option A (ID: 1)');

    console.log('\n--- 2. TESTING NEWER UPDATE (LAST-WRITE-WINS) ---');
    const timeT2 = new Date('2026-09-24T10:05:00.000Z'); // 5 minutes later
    const sync2 = await studentExamService.syncAnswers(siswaId, ujianId, [
      {
        soal_id: soalId,
        pilihan_jawaban_id: 2, // Changed to Option B
        teks_jawaban_essay: '',
        is_ragu: true,
        waktu_dijawab: timeT2.toISOString()
      }
    ]);
    assert(sync2.success === true, 'Sync 2 berhasil dijalankan');
    assert(sync2.synced_count === 1, 'Sync 2 memperbarui jawaban');

    const ansT2 = await examSessionRepository.findSingleAnswer(siswaId, ujianId, soalId);
    assert(ansT2 && ansT2.pilihan_jawaban_id === 2, 'Jawaban terupdate menjadi Option B (ID: 2)');
    assert(ansT2 && ansT2.is_ragu === 1, 'Flag is_ragu terupdate menjadi 1');

    console.log('\n--- 3. TESTING STALE PACKET ARRIVING LATE (CONFLICT RESOLUTION) ---');
    const timeStale = new Date('2026-09-24T10:02:00.000Z'); // Older than 10:05!
    const syncStale = await studentExamService.syncAnswers(siswaId, ujianId, [
      {
        soal_id: soalId,
        pilihan_jawaban_id: 1, // Stale Option A
        teks_jawaban_essay: '',
        is_ragu: false,
        waktu_dijawab: timeStale.toISOString()
      }
    ]);
    assert(syncStale.success === true, 'Sync stale request diproses');
    assert(syncStale.conflicts_ignored === 1, 'Stale packet terdeteksi dan diabaikan (conflicts_ignored: 1)');
    assert(syncStale.synced_count === 0, 'Stale packet tidak menimpa data baru (synced_count: 0)');

    const ansAfterStale = await examSessionRepository.findSingleAnswer(siswaId, ujianId, soalId);
    assert(
      ansAfterStale && ansAfterStale.pilihan_jawaban_id === 2,
      'Jawaban di DB tetap Option B (ID: 2) tidak tertimpa oleh paket basi!'
    );

    console.log('\n--- 4. TESTING HTTP ENDPOINT CONTRACT FOR SYNC ---');
    const server = http.createServer(app);
    await new Promise(r => server.listen(3333, r));

    // Get auth token for student
    const loginRes = await authService.login('siswa', 'siswa');
    const token = loginRes.token;

    const payload = JSON.stringify({
      siswa_id: siswaId,
      ujian_id: ujianId,
      jawaban_list: [
        {
          soal_id: soalId,
          pilihan_jawaban_id: 2,
          teks_jawaban_essay: '',
          is_ragu: false,
          waktu_dijawab: new Date('2026-09-24T10:10:00.000Z').toISOString()
        }
      ]
    });

    const httpRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3333,
        path: '/api/siswa/ujian/sync',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert(httpRes.status === 200, 'POST /api/siswa/ujian/sync returns HTTP 200');
    assert(httpRes.data.message !== undefined, 'Response contains message');
    assert(httpRes.data.synced_count === 1, 'Response contains synced_count: 1');
    assert(httpRes.data.server_time !== undefined, 'Response contains server_time timestamp');

    await new Promise(r => server.close(r));

    console.log('\n====================================================');
    console.log(`PHASE 5 BACKEND TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runPhase5BackendTests();
