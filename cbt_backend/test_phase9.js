require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');
const profileService = require('./src/services/profileService');
const { app } = require('./server');

let testServer;
let port;
let studentToken;
let guruToken;
let adminToken;

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

function createDummyPngBuffer() {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);
}

function createDummyJpgBuffer() {
  const buf = Buffer.alloc(120);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  buf.write('JFIF', 6);
  buf[buf.length - 2] = 0xff;
  buf[buf.length - 1] = 0xd9;
  return buf;
}

async function runPhase9Tests() {
  console.log('====================================================');
  console.log('🧪 MEMULAI AUTOMATED TEST SUITE: PHASE 9');
  console.log('   (Profile & Avatar Management, Magic Bytes & Security)');
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
    testServer = app.listen(0);
    port = testServer.address().port;
    console.log(`📡 Test Server aktif di port ${port}`);

    // Login roles
    const loginSiswa = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    studentToken = loginSiswa.body.token || (loginSiswa.body.data && loginSiswa.body.data.token);

    const loginGuru = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'guru', password: 'guru' }
    });
    guruToken = loginGuru.body.token || (loginGuru.body.data && loginGuru.body.data.token);

    const loginAdmin = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'admin', password: 'admin' }
    });
    adminToken = loginAdmin.body.token || (loginAdmin.body.data && loginAdmin.body.data.token);

    assert(studentToken && guruToken && adminToken, 'Login multi-role (Siswa, Guru, Admin) berhasil memperoleh token JWT');

    // ----------------------------------------------------
    // SECTION A: UNIT TEST SERVICE & MAGIC BYTES
    // ----------------------------------------------------
    console.log('\n--- [Bagian A: Unit Test Fallback Inisial & Magic Bytes File Signature] ---');

    assert(profileService.getFallbackInitial('Ahmad Rifai') === 'AR', 'Fallback initial 2 kata ("Ahmad Rifai") menghasilkan "AR"');
    assert(profileService.getFallbackInitial('Budi') === 'BU', 'Fallback initial 1 kata ("Budi") menghasilkan "BU"');
    assert(profileService.getFallbackInitial('') === 'U', 'Fallback initial nama kosong menghasilkan "U"');

    const pngBuf = createDummyPngBuffer();
    const pngDetect = profileService.detectImageFormat(pngBuf);
    assert(pngDetect && pngDetect.ext === '.png' && pngDetect.mime === 'image/png', 'Magic bytes mendeteksi binary PNG asli dengan tepat');

    const jpgBuf = createDummyJpgBuffer();
    const jpgDetect = profileService.detectImageFormat(jpgBuf);
    assert(jpgDetect && jpgDetect.ext === '.jpg' && jpgDetect.mime === 'image/jpeg', 'Magic bytes mendeteksi binary JPEG asli dengan tepat');

    const fakeBuf = Buffer.from('<?php echo "malicious payload"; ?>');
    const fakeDetect = profileService.detectImageFormat(fakeBuf);
    assert(fakeDetect === null, 'Magic bytes menolak berkas non-gambar atau script terselubung');

    // ----------------------------------------------------
    // SECTION B: GET & PUT PROFILE
    // ----------------------------------------------------
    console.log('\n--- [Bagian B: API GET & PUT Profil Pengguna] ---');

    // 1. GET unauthenticated
    const getUnauth = await request('/api/profile');
    assert(getUnauth.status === 401, 'Akses GET /api/profile tanpa token ditolak (401 Unauthorized)');

    // 2. GET profil Siswa
    const getSiswa = await request('/api/profile', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(getSiswa.status === 200 && getSiswa.body.status === 'success', 'GET /api/profile sebagai siswa berhasil (200 OK)');
    assert(getSiswa.body.data.role === 'siswa' && getSiswa.body.data.nis !== undefined, 'Data profil siswa menyertakan atribut nis dan kelas');

    // 3. GET profil Guru
    const getGuru = await request('/api/profile', {
      headers: { Authorization: `Bearer ${guruToken}` }
    });
    assert(getGuru.status === 200 && getGuru.body.data.role === 'guru' && getGuru.body.data.nip !== undefined, 'Data profil guru menyertakan atribut nip');

    // 4. GET profil Admin
    const getAdmin = await request('/api/profile', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(getAdmin.status === 200 && getAdmin.body.data.role === 'admin', 'Data profil admin berhasil dimuat');

    // 5. PUT update profil dengan format email salah
    const putBadEmail = await request('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { email: 'invalid-email-format' }
    });
    assert(putBadEmail.status === 400, 'PUT /api/profile menolak format email yang tidak valid (400 Bad Request)');

    // 6. PUT update profil sukses
    const testNewName = 'Siswa Satu Updated';
    const testNewEmail = 'siswa1.cbt@sekolah.sch.id';
    const putSuccess = await request('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { nama: testNewName, email: testNewEmail }
    });
    assert(putSuccess.status === 200 && putSuccess.body.data.nama === testNewName, 'PUT /api/profile berhasil memperbarui nama dan email');

    // ----------------------------------------------------
    // SECTION C: AVATAR MANAGEMENT (UPLOAD, OVERSIZE, MAGIC BYTES, DELETE)
    // ----------------------------------------------------
    console.log('\n--- [Bagian C: Pengelolaan Avatar, Validasi Berkas & Storage] ---');

    // 1. Upload tanpa payload
    const uploadEmpty = await request('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {}
    });
    assert(uploadEmpty.status === 400, 'POST /api/profile/avatar tanpa data gambar ditolak (400 Bad Request)');

    // 2. Upload file fake (bukan gambar)
    const fakeBase64 = Buffer.from('INI BUKAN GAMBAR MELAINKAN TEKS BIASA').toString('base64');
    const uploadFake = await request('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { image_data: `data:image/png;base64,${fakeBase64}` }
    });
    assert(uploadFake.status === 400, 'POST /api/profile/avatar menolak file palsu dengan magic bytes tidak sesuai (400 Bad Request)');

    // 3. Upload file melebihi 2MB
    const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0xff); // 2.5 MB
    const oversizedBase64 = oversizedBuffer.toString('base64');
    const uploadOversized = await request('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { image_data: oversizedBase64 }
    });
    assert(uploadOversized.status === 400, 'POST /api/profile/avatar menolak berkas > 2MB (400 Bad Request)');

    // 4. Upload gambar valid PNG
    const validPngBase64 = pngBuf.toString('base64');
    const uploadPng = await request('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { image_data: `data:image/png;base64,${validPngBase64}` }
    });
    assert(uploadPng.status === 200 && uploadPng.body.data.avatar.endsWith('.png'), 'POST /api/profile/avatar dengan PNG valid berhasil disimpan');

    const firstAvatarPath = path.join(__dirname, 'public', uploadPng.body.data.avatar);
    assert(fs.existsSync(firstAvatarPath), 'Berkas gambar avatar fisik benar-benar ada di storage lokal public/uploads/avatars');

    // 5. Upload gambar JPEG baru -> file PNG lama otomatis terhapus (safe replacement)
    const validJpgBase64 = jpgBuf.toString('base64');
    const uploadJpg = await request('/api/profile/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { image_data: `data:image/jpeg;base64,${validJpgBase64}` }
    });
    assert(uploadJpg.status === 200 && uploadJpg.body.data.avatar.endsWith('.jpg'), 'Penggantian avatar baru dengan JPEG valid berhasil');
    assert(!fs.existsSync(firstAvatarPath), 'Berkas avatar lama otomatis dihapus dari disk saat digantikan file baru');

    const secondAvatarPath = path.join(__dirname, 'public', uploadJpg.body.data.avatar);
    assert(fs.existsSync(secondAvatarPath), 'Berkas avatar baru tersimpan dengan baik di storage disk');

    // 6. DELETE avatar -> file fisik dihapus dan db kembali ke NULL
    const delAvatar = await request('/api/profile/avatar', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(delAvatar.status === 200 && delAvatar.body.data.avatar === null, 'DELETE /api/profile/avatar berhasil mengembalikan avatar ke NULL');
    assert(!fs.existsSync(secondAvatarPath), 'Berkas avatar di disk berhasil dihapus tuntas oleh perintah DELETE');

    // Verifikasi profil setelah delete avatar
    const getAfterDel = await request('/api/profile', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(getAfterDel.body.data.avatar === null && getAfterDel.body.data.fallback_initial, 'Profil setelah penghapusan avatar menampilkan fallback initial');

    // ----------------------------------------------------
    // SECTION D: CHANGE PASSWORD & RE-LOGIN VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- [Bagian D: Perubahan Kata Sandi & Verifikasi Login Ulang] ---');

    // 1. Password lama salah
    const changeWrongOld = await request('/api/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { current_password: 'wrong_current_password', new_password: 'newSecretPassword123' }
    });
    assert(changeWrongOld.status === 400, 'POST /api/profile/change-password menolak jika kata sandi lama salah');

    // 2. Password baru kurang dari 6 karakter
    const changeShortPwd = await request('/api/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { current_password: 'siswa', new_password: '123' }
    });
    assert(changeShortPwd.status === 400, 'POST /api/profile/change-password menolak password baru < 6 karakter');

    // 3. Ganti password berhasil
    const changeSuccess = await request('/api/profile/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { current_password: 'siswa', new_password: 'passwordBaru2026' }
    });
    assert(changeSuccess.status === 200, 'POST /api/profile/change-password berhasil memperbarui kata sandi');

    // 4. Verifikasi login lama gagal
    const loginOldFails = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    assert(loginOldFails.status === 401, 'Login dengan kata sandi lama berhasil dicegah (401)');

    // 5. Verifikasi login baru sukses
    const loginNewSuccess = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'passwordBaru2026' }
    });
    assert(loginNewSuccess.status === 200, 'Login dengan kata sandi baru yang telah dienkripsi bcrypt sukses');

    // 6. Kembalikan kata sandi siswa ke semula demi menjaga kebersihan lingkungan tes
    const bcrypt = require('bcryptjs');
    const origHash = await bcrypt.hash('siswa', 10);
    await db.query('UPDATE users SET password = ? WHERE username = ?', [origHash, 'siswa']);
    assert(true, 'Kata sandi siswa berhasil dinormalisasi kembali ke semula');

    // Pulihkan nama siswa juga
    await request('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { nama: 'Siswa Contoh', email: 'siswa@sekolah.sch.id' }
    });

    console.log('\n====================================================');
    console.log(`🎉 HASIL PENGUJIAN: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Terjadi error tak tertangani dalam test suite Phase 9:', err);
    process.exit(1);
  } finally {
    if (testServer) {
      testServer.close();
    }
    await db.pool.end();
  }
}

runPhase9Tests();