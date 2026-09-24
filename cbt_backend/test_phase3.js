require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = require('./src/database/db');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const TEST_PORT = 3200;
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
  console.log('🧪 CBT BACKEND PHASE 3 AUTH & AUTHORIZATION TEST SUITE');
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

  // 1. Database Bcrypt Hash Verification
  console.log('\n--- 1. TESTING DATABASE PASSWORD HASHES ---');
  try {
    const users = await db.query('SELECT username, password FROM users');
    let allHashed = true;
    for (const u of users) {
      if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
        allHashed = false;
        break;
      }
    }
    assert(allHashed, `Semua ${users.length} akun pengguna di MySQL tersimpan dalam format bcrypt hash ($2a$/$2b$)`);
  } catch (err) {
    assert(false, `Gagal memverifikasi hash database: ${err.message}`);
  }

  // 2. Start HTTP Test Server
  console.log('\n--- 2. STARTING SERVER FOR AUTH & RBAC TESTS ---');
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`Test server running at http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  try {
    let adminToken, adminRefreshToken;
    let guruToken, guruRefreshToken;
    let siswaToken, siswaRefreshToken;

    // A. Authentication Tests
    console.log('\n--- A. AUTHENTICATION & TOKEN ISSUANCE ---');
    // Admin Login
    const rAdmin = await request('POST', '/api/login', { username: 'admin', password: 'admin' });
    assert(rAdmin.status === 200 && rAdmin.data.token && rAdmin.data.refresh_token, 'POST /api/login (admin) mengembalikan Access Token & Refresh Token');
    adminToken = rAdmin.data.token;
    adminRefreshToken = rAdmin.data.refresh_token;

    // Guru Login
    const rGuru = await request('POST', '/api/login', { username: 'guru', password: 'guru' });
    assert(rGuru.status === 200 && rGuru.data.token && rGuru.data.user.role === 'guru', 'POST /api/login (guru) mengembalikan JWT dengan role guru');
    guruToken = rGuru.data.token;
    guruRefreshToken = rGuru.data.refresh_token;

    // Siswa Login
    const rSiswa = await request('POST', '/api/login', { username: 'siswa', password: 'siswa' });
    assert(rSiswa.status === 200 && rSiswa.data.token && rSiswa.data.user.role === 'siswa' && rSiswa.data.profil, 'POST /api/login (siswa) mengembalikan JWT dengan role siswa dan profil');
    siswaToken = rSiswa.data.token;
    siswaRefreshToken = rSiswa.data.refresh_token;

    // Wrong Password Rejection
    const rBadPass = await request('POST', '/api/login', { username: 'admin', password: 'wrongpassword' });
    assert(rBadPass.status === 401 && rBadPass.data.code === 'AUTH_INVALID', 'Login password salah ditolak dengan HTTP 401 (AUTH_INVALID)');

    // B. Token Verification & Middleware Tests
    console.log('\n--- B. AUTHENTICATION MIDDLEWARE ENFORCEMENT ---');
    // Missing Token -> 401 AUTH_REQUIRED
    const rNoToken = await request('GET', '/api/admin/siswa');
    assert(rNoToken.status === 401 && rNoToken.data.code === 'AUTH_REQUIRED', 'Akses rute privat tanpa token ditolak dengan HTTP 401 (AUTH_REQUIRED)');

    // Invalid Token -> 401 AUTH_INVALID
    const rInvalidToken = await request('GET', '/api/admin/siswa', null, {
      'Authorization': 'Bearer invalid.token.payload.xyz'
    });
    assert(rInvalidToken.status === 401 && rInvalidToken.data.code === 'AUTH_INVALID', 'Akses rute privat dengan token palsu/rusak ditolak dengan HTTP 401 (AUTH_INVALID)');

    // Expired Token -> 401 AUTH_EXPIRED
    const expiredSecret = process.env.JWT_SECRET || 'cbt_super_secure_jwt_access_secret_key_2026_antigravity';
    const expiredToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, expiredSecret, { expiresIn: '0s' });
    const rExpiredToken = await request('GET', '/api/admin/siswa', null, {
      'Authorization': `Bearer ${expiredToken}`
    });
    assert(rExpiredToken.status === 401 && rExpiredToken.data.code === 'AUTH_EXPIRED', 'Akses dengan token kedaluwarsa ditolak dengan HTTP 401 (AUTH_EXPIRED)');

    // C. Role-Based Access Control (RBAC) Tests
    console.log('\n--- C. ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT ---');
    // Siswa attempting to access Admin endpoint -> 403 FORBIDDEN
    const rSiswaToAdmin = await request('GET', '/api/admin/siswa', null, {
      'Authorization': `Bearer ${siswaToken}`
    });
    assert(rSiswaToAdmin.status === 403 && rSiswaToAdmin.data.code === 'FORBIDDEN', 'Siswa mengakses endpoint Admin ditolak dengan HTTP 403 (FORBIDDEN)');

    // Siswa attempting to access Guru endpoint -> 403 FORBIDDEN
    const rSiswaToGuru = await request('GET', '/api/guru/bank-soal', null, {
      'Authorization': `Bearer ${siswaToken}`
    });
    assert(rSiswaToGuru.status === 403 && rSiswaToGuru.data.code === 'FORBIDDEN', 'Siswa mengakses endpoint Guru ditolak dengan HTTP 403 (FORBIDDEN)');

    // Guru attempting to access Admin endpoint -> 403 FORBIDDEN
    const rGuruToAdmin = await request('GET', '/api/admin/kelas', null, {
      'Authorization': `Bearer ${guruToken}`
    });
    assert(rGuruToAdmin.status === 403 && rGuruToAdmin.data.code === 'FORBIDDEN', 'Guru mengakses endpoint Admin ditolak dengan HTTP 403 (FORBIDDEN)');

    // Siswa accessing Siswa endpoint -> 200 OK
    const rSiswaAllowed = await request('GET', '/api/siswa/ujian/1', null, {
      'Authorization': `Bearer ${siswaToken}`
    });
    assert(rSiswaAllowed.status === 200 && Array.isArray(rSiswaAllowed.data), 'Siswa dengan token valid berhasil mengakses endpoint Siswa (HTTP 200)');

    // Guru accessing Guru endpoint -> 200 OK
    const rGuruAllowed = await request('GET', '/api/guru/ujian', null, {
      'Authorization': `Bearer ${guruToken}`
    });
    assert(rGuruAllowed.status === 200 && Array.isArray(rGuruAllowed.data), 'Guru dengan token valid berhasil mengakses endpoint Guru (HTTP 200)');

    // Admin accessing Admin endpoint -> 200 OK
    const rAdminAllowed = await request('GET', '/api/admin/siswa', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(rAdminAllowed.status === 200 && Array.isArray(rAdminAllowed.data), 'Admin dengan token valid berhasil mengakses endpoint Admin (HTTP 200)');

    // Admin accessing Guru endpoint -> 200 OK (Admin has supervisor access)
    const rAdminToGuru = await request('GET', '/api/guru/bank-soal', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(rAdminToGuru.status === 200 && Array.isArray(rAdminToGuru.data), 'Admin berhak mengakses endpoint Guru (HTTP 200)');

    // D. Current User Profile & Refresh Token Rotation
    console.log('\n--- D. CURRENT USER & REFRESH TOKEN ROTATION ---');
    // GET /api/auth/me with Bearer token
    const rMe = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${siswaToken}`
    });
    assert(rMe.status === 200 && rMe.data.user && rMe.data.profil && rMe.data.profil.nis === '2026001', 'GET /api/auth/me mengembalikan identitas dan profil pengguna terotentikasi');

    // POST /api/auth/refresh with valid refresh_token
    const rRefresh = await request('POST', '/api/auth/refresh', {
      refresh_token: siswaRefreshToken
    });
    assert(rRefresh.status === 200 && rRefresh.data.token && rRefresh.data.refresh_token, 'POST /api/auth/refresh berhasil merotasi dan menerbitkan Access Token baru');
    const newSiswaToken = rRefresh.data.token;
    const newSiswaRefreshToken = rRefresh.data.refresh_token;

    // Use newly refreshed token to make an API call
    const rNewTokenCall = await request('GET', '/api/siswa/ujian/1', null, {
      'Authorization': `Bearer ${newSiswaToken}`
    });
    assert(rNewTokenCall.status === 200, 'Access Token hasil refresh valid dan dapat digunakan untuk request');

    // Logout and token revocation
    const rLogout = await request('POST', '/api/auth/logout', {
      refresh_token: newSiswaRefreshToken
    }, {
      'Authorization': `Bearer ${newSiswaToken}`
    });
    assert(rLogout.status === 200, 'POST /api/auth/logout berhasil mencabut refresh token');

    // Attempting to refresh with revoked token -> 401 AUTH_INVALID
    const rRevokedRefresh = await request('POST', '/api/auth/refresh', {
      refresh_token: newSiswaRefreshToken
    });
    assert(rRevokedRefresh.status === 401, 'Refresh token yang telah dicabut (revoked) ditolak');

  } catch (err) {
    assert(false, `Test suite exception: ${err.message}`);
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
  console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
