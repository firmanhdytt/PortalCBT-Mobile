require('dotenv').config();
const http = require('http');
const db = require('./src/database/db');
const { app } = require('./server');

let testServer;
let port;
let studentToken;
let guruToken;
let adminToken;

const blackBoxResults = [];

function recordTest(no, modul, skenario, input, expectedResult, actualResult, isPassed) {
  blackBoxResults.push({
    no,
    modul,
    skenario,
    input,
    expectedResult,
    actualResult,
    status: isPassed ? 'PASS' : 'FAIL'
  });
  const icon = isPassed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${no}] ${modul} | ${skenario} -> ${icon}`);
}

async function request(reqPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: reqPath,
        method: options.method || 'GET',
        headers: options.headers || {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runBlackBoxTestSuite() {
  console.log('====================================================');
  console.log('🧪 MEMULAI BLACK BOX TEST SUITE (PHASE 26 QA MATRIX)');
  console.log('====================================================\n');

  try {
    testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        port = testServer.address().port;
        console.log(`Ephemeral Test Server listening on http://127.0.0.1:${port}\n`);
        resolve();
      });
    });

    let testNo = 1;

    // 1. AUTHENTICATION MODULE TESTS
    console.log('--- 1. MODUL AUTHENTICATION ---');

    // 1.1 Login Valid
    const loginValidRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    studentToken = loginValidRes.body.token;
    recordTest(
      testNo++,
      'AUTHENTICATION',
      'Login Valid',
      'username: siswa, password: ***',
      'HTTP 200 & JWT Token diterima',
      `HTTP ${loginValidRes.status} - ${loginValidRes.body.message || 'OK'}`,
      loginValidRes.status === 200 && studentToken !== undefined
    );

    // Login Guru & Admin for subsequent role tests
    const guruAuth = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'guru', password: 'guru' }
    });
    guruToken = guruAuth.body.token;
    if (!guruToken) console.error('GURU LOGIN FAILED:', guruAuth.body);

    const adminAuth = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'admin', password: 'admin' }
    });
    adminToken = adminAuth.body.token;
    if (!adminToken) console.error('ADMIN LOGIN FAILED:', adminAuth.body);

    // 1.2 Login Password Salah
    const wrongPassRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'wrongpassword' }
    });
    recordTest(
      testNo++,
      'AUTHENTICATION',
      'Password Salah',
      'username: siswa, password: wrong',
      'HTTP 401 & Code AUTH_INVALID',
      `HTTP ${wrongPassRes.status} - Code: ${wrongPassRes.body.code}`,
      wrongPassRes.status === 401 && wrongPassRes.body.code === 'AUTH_INVALID'
    );

    // 1.3 User Tidak Ditemukan
    const notFoundUserRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'user_unknown_999', password: 'password' }
    });
    recordTest(
      testNo++,
      'AUTHENTICATION',
      'User Tidak Ditemukan',
      'username: user_unknown_999',
      'HTTP 401 & Code AUTH_INVALID',
      `HTTP ${notFoundUserRes.status} - Code: ${notFoundUserRes.body.code}`,
      notFoundUserRes.status === 401 && notFoundUserRes.body.code === 'AUTH_INVALID'
    );

    // 1.4 Role Unauthorized (Siswa -> Admin Endpoint)
    const unauthRoleRes = await request('/api/admin/siswa', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    recordTest(
      testNo++,
      'AUTHENTICATION',
      'Role Tidak Berhak',
      'Token Siswa -> GET /api/admin/siswa',
      'HTTP 403 & Code FORBIDDEN',
      `HTTP ${unauthRoleRes.status} - Code: ${unauthRoleRes.body.code}`,
      unauthRoleRes.status === 403 && unauthRoleRes.body.code === 'FORBIDDEN'
    );

    // 2. MASTER DATA MODULE TESTS
    console.log('\n--- 2. MODUL MASTER DATA ---');

    // 2.1 Get Master Kelas
    const masterKelasRes = await request('/api/admin/kelas', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    recordTest(
      testNo++,
      'MASTER DATA',
      'Lihat Daftar Kelas',
      'GET /api/admin/kelas',
      'HTTP 200 & Array Data Kelas',
      `HTTP ${masterKelasRes.status} - Items: ${Array.isArray(masterKelasRes.body.data) ? masterKelasRes.body.data.length : 0}`,
      masterKelasRes.status === 200 && Array.isArray(masterKelasRes.body.data)
    );

    // 2.2 Add Master Kelas
    const addKelasRes = await request('/api/admin/kelas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        nama_kelas: 'XII-QA-TEST',
        tingkat: 'XII',
        jurusan: 'TKJ',
        tahun_ajaran: '2025/2026'
      }
    });
    const newKelasId = addKelasRes.body.data ? addKelasRes.body.data.id : null;
    recordTest(
      testNo++,
      'MASTER DATA',
      'Tambah Kelas Baru',
      'nama_kelas: XII-QA-TEST',
      'HTTP 201 & ID kelas baru',
      `HTTP ${addKelasRes.status} - ID: ${newKelasId}`,
      addKelasRes.status === 201 && newKelasId !== null
    );

    // 3. BANK SOAL MODULE TESTS
    console.log('\n--- 3. MODUL BANK SOAL ---');

    const getBankRes = await request('/api/guru/bank-soal', {
      headers: { Authorization: `Bearer ${guruToken}` }
    });
    recordTest(
      testNo++,
      'BANK SOAL',
      'Lihat Bank Soal Guru',
      'GET /api/guru/bank-soal',
      'HTTP 200 & Array Bank Soal',
      `HTTP ${getBankRes.status} - Count: ${Array.isArray(getBankRes.body.data) ? getBankRes.body.data.length : 0}`,
      getBankRes.status === 200 && Array.isArray(getBankRes.body.data)
    );

    // 4. EXAM MANAGEMENT & ENGINE TESTS
    console.log('\n--- 4. MODUL EXAM ENGINE & MANAGEMENT ---');

    // Token Verifikasi Valid
    const verifyTokenRes = await request('/api/siswa/ujian/verifikasi-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { token: 'PHASE7' }
    });
    recordTest(
      testNo++,
      'EXAM MANAGEMENT',
      'Verifikasi Token Valid',
      'token: PHASE7',
      'HTTP 200 & verified: true',
      `HTTP ${verifyTokenRes.status} - ${verifyTokenRes.body.message || 'OK'}`,
      verifyTokenRes.status === 200
    );

    // Token Verifikasi Salah
    const verifyWrongTokenRes = await request('/api/siswa/ujian/verifikasi-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { token: 'WRONG_TOKEN' }
    });
    recordTest(
      testNo++,
      'EXAM MANAGEMENT',
      'Verifikasi Token Salah',
      'token: WRONG_TOKEN',
      'HTTP 400 & Error message',
      `HTTP ${verifyWrongTokenRes.status} - ${verifyWrongTokenRes.body.message}`,
      verifyWrongTokenRes.status === 400
    );

    // 5. PROCTORING & UNLOCK WORKFLOW TESTS
    console.log('\n--- 5. MODUL PROCTORING & UNLOCK ---');

    const recordViolationRes = await request('/api/siswa/ujian/violation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        ujian_id: 1,
        violation_type: 'TAB_SWITCH',
        description: 'Blackbox test tab switch violation'
      }
    });
    recordTest(
      testNo++,
      'PROCTORING',
      'Pencatatan Pelanggaran (Strike)',
      'violation_type: TAB_SWITCH',
      'HTTP 200 & Response strike count',
      `HTTP ${recordViolationRes.status} - Strike: ${recordViolationRes.body.data ? recordViolationRes.body.data.current_strikes : 'N/A'}`,
      recordViolationRes.status === 200
    );

    // 6. REPORTING & CERTIFICATES TESTS
    console.log('\n--- 6. MODUL REPORTING & CERTIFICATE ---');

    const verifyCertRes = await request('/api/sertifikat/verify/CERT/CBT/2026/000001');
    recordTest(
      testNo++,
      'CERTIFICATE',
      'Verifikasi Publik QR Sertifikat',
      'GET /api/sertifikat/verify/CERT/CBT/2026/000001',
      'HTTP 200 & valid: true',
      `HTTP ${verifyCertRes.status} - Valid: ${verifyCertRes.body.data ? verifyCertRes.body.data.valid : false}`,
      verifyCertRes.status === 200 && verifyCertRes.body.data && verifyCertRes.body.data.valid === true
    );

    const verifyInvalidCertRes = await request('/api/sertifikat/verify/CERT_FAKE_INVALID_999');
    recordTest(
      testNo++,
      'CERTIFICATE',
      'Verifikasi QR Sertifikat Palsu',
      'GET /api/sertifikat/verify/CERT_FAKE_INVALID_999',
      'HTTP 404 & valid: false',
      `HTTP ${verifyInvalidCertRes.status} - Valid: ${verifyInvalidCertRes.body.data ? verifyInvalidCertRes.body.data.valid : false}`,
      verifyInvalidCertRes.status === 404 && verifyInvalidCertRes.body.data && verifyInvalidCertRes.body.data.valid === false
    );

  } catch (err) {
    console.error('Fatal Error during Black Box execution:', err);
  } finally {
    if (testServer) {
      testServer.close();
    }
    await db.pool.end();
  }

  // Print Summary Matrix
  console.log('\n========================================================================================');
  console.log('📋 SUMMARY QA BLACK BOX MATRIX (PHASE 26)');
  console.log('========================================================================================');
  console.log('| No | Modul | Skenario | Input | Expected Result | Status |');
  console.log('|---|---|---|---|---|---|');
  for (const r of blackBoxResults) {
    console.log(`| ${r.no} | ${r.modul} | ${r.skenario} | ${r.input} | ${r.expectedResult} | ${r.status} |`);
  }
  console.log('========================================================================================\n');

  const failedCount = blackBoxResults.filter((r) => r.status === 'FAIL').length;
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBlackBoxTestSuite();
