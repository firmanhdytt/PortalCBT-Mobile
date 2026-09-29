require('dotenv').config();
const http = require('http');
const db = require('./src/database/db');
const studentCardService = require('./src/services/studentCardService');
const certificateService = require('./src/services/certificateService');
const certificateRepository = require('./src/repositories/certificateRepository');
const { app, server } = require('./server');

let testServer;
let port;
let studentToken;
let guruToken;
let testSiswaId;
let testKelasId;
let testUjianId;
let testHasilLulusId;
let testHasilRemidiId;
let testRemidiSiswaId;
let issuedCertNumber;

async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: port,
        path: path,
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

async function runPhase8Tests() {
  console.log('====================================================');
  console.log('🧪 MEMULAI AUTOMATED TEST SUITE: PHASE 8');
  console.log('   (Kartu Ujian & Sertifikat Digital Berbasis QR Code)');
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
    // Start temporary test server
    port = 3000;
    // Server is already listening on port from server.js

    // 1. Setup Test Data in MySQL
    console.log('1. Mengambil / Menyiapkan Data Pengujian...');
    
    // Login sebagai guru
    const loginGuruRes = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'guru', password: 'guru' }
    });
    const guruData = loginGuruRes.body.data || loginGuruRes.body;
    guruToken = guruData.token;
    assert(loginGuruRes.status === 200 && guruToken, 'Login Guru berhasil & menerima JWT token');

    // Login sebagai siswa
    const loginSiswaRes = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    const siswaData = loginSiswaRes.body.data || loginSiswaRes.body;
    studentToken = siswaData.token;
    testSiswaId = siswaData.profil ? siswaData.profil.id : (siswaData.user ? (siswaData.user.siswa_id || siswaData.user.id) : 1);
    testKelasId = siswaData.profil ? siswaData.profil.kelas_id : (siswaData.user ? (siswaData.user.kelas_id || 1) : 1);
    assert(loginSiswaRes.status === 200 && studentToken, `Login Siswa berhasil (ID: ${testSiswaId}, Kelas: ${testKelasId})`);

    // Pastikan ada kelas & siswa kedua untuk pengujian remidi
    const siswaList = await db.query('SELECT id, kelas_id FROM siswa LIMIT 2');
    if (siswaList.length > 1) {
      testRemidiSiswaId = siswaList[1].id;
    } else {
      testRemidiSiswaId = testSiswaId;
    }

    // Pastikan ada data ujian
    const ujianList = await db.query('SELECT id, kkm, nama_ujian FROM ujian LIMIT 1');
    assert(ujianList.length > 0, `Sesi ujian ditemukan (ID: ${ujianList[0].id}, Nama: "${ujianList[0].nama_ujian}", KKM: ${ujianList[0].kkm})`);
    testUjianId = ujianList[0].id;
    const testKkm = ujianList[0].kkm;

    // Bersihkan sertifikat lama untuk test isolation
    await db.query('DELETE FROM certificates WHERE ujian_id = ?', [testUjianId]);

    // Buat data hasil_ujian LULUS untuk testSiswaId
    await db.query('DELETE FROM hasil_ujian WHERE ujian_id = ? AND siswa_id = ?', [testUjianId, testSiswaId]);
    const insertLulus = await db.query(
      `INSERT INTO hasil_ujian (siswa_id, ujian_id, jumlah_benar, jumlah_salah, nilai_pg, nilai_essay, nilai_akhir, status_kelulusan, waktu_selesai)
       VALUES (?, ?, 10, 0, 100.00, 0.00, 100.00, 'LULUS', NOW())`,
      [testSiswaId, testUjianId]
    );
    testHasilLulusId = insertLulus.insertId;

    // Buat data hasil_ujian REMIDI untuk siswa kedua
    if (testRemidiSiswaId !== testSiswaId) {
      await db.query('DELETE FROM hasil_ujian WHERE ujian_id = ? AND siswa_id = ?', [testUjianId, testRemidiSiswaId]);
      const insertRemidi = await db.query(
        `INSERT INTO hasil_ujian (siswa_id, ujian_id, jumlah_benar, jumlah_salah, nilai_pg, nilai_essay, nilai_akhir, status_kelulusan, waktu_selesai)
         VALUES (?, ?, 2, 8, 20.00, 0.00, 20.00, 'REMIDI', NOW())`,
        [testRemidiSiswaId, testUjianId]
      );
      testHasilRemidiId = insertRemidi.insertId;
    }

    console.log('\n2. Pengujian Layanan Kartu Peserta Ujian (StudentCardService)...');
    // Unit Service: getStudentCardData
    const cardData = await studentCardService.getStudentCardData(testSiswaId);
    assert(cardData && cardData.no_peserta, `Nomor peserta terbentuk: ${cardData.no_peserta}`);
    assert(cardData.no_peserta.startsWith('KPU-'), 'Format nomor peserta diawali KPU-');
    assert(cardData.qr_data_url && cardData.qr_data_url.startsWith('data:image/png;base64,'), 'QR Code dihasilkan dalam format Base64 PNG Data URL');
    assert(Array.isArray(cardData.jadwal_ujian), 'Data jadwal ujian kelas terlampir dalam kartu');

    // Unit Service: getClassCardsData
    const classCards = await studentCardService.getClassCardsData(testKelasId);
    assert(Array.isArray(classCards) && classCards.length > 0, `Berhasil mengambil ${classCards.length} kartu siswa sekelas`);

    // Unit Service: renderCardHtml
    const cardHtml = studentCardService.renderCardHtml(cardData);
    assert(typeof cardHtml === 'string' && cardHtml.includes('KARTU TANDA PESERTA UJIAN'), 'Render layout cetak kartu peserta valid HTML');
    assert(cardHtml.includes('@media print'), 'Layout kartu mendukung media query print');

    console.log('\n3. Pengujian Endpoint REST Kartu Ujian (API HTTP)...');
    // API Siswa: GET /api/siswa/kartu-ujian
    const httpCardRes = await request('/api/siswa/kartu-ujian', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(httpCardRes.status === 200 && httpCardRes.body.status === 'success', 'GET /api/siswa/kartu-ujian mengembalikan 200 OK');
    assert(httpCardRes.body.data.nis === cardData.nis, 'Data identitas NIS siswa pada respon API sesuai');

    // API Siswa: GET /api/siswa/kartu-ujian/print (HTML View)
    const httpCardPrintRes = await request('/api/siswa/kartu-ujian/print', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(httpCardPrintRes.status === 200 && typeof httpCardPrintRes.body === 'string' && httpCardPrintRes.body.includes('KARTU TANDA PESERTA'), 'GET /api/siswa/kartu-ujian/print mengembalikan HTML siap cetak');

    // API Guru: GET /api/guru/kartu-ujian/kelas/:kelasId
    const httpClassCardsRes = await request(`/api/guru/kartu-ujian/kelas/${testKelasId}`, {
      headers: { Authorization: `Bearer ${guruToken}` }
    });
    assert(httpClassCardsRes.status === 200 && Array.isArray(httpClassCardsRes.body.data), 'GET /api/guru/kartu-ujian/kelas/:id mengembalikan daftar kartu sekelas');

    console.log('\n4. Pengujian Validasi Kelayakan & Penerbitan Sertifikat (CertificateService)...');
    // Rule: Siswa yang REMIDI TIDAK BISA diterbitkan sertifikat
    if (testRemidiSiswaId !== testSiswaId) {
      let remidiErrorCaught = false;
      try {
        await certificateService.issueCertificate(testUjianId, testRemidiSiswaId);
      } catch (e) {
        remidiErrorCaught = true;
        assert(e.statusCode === 400 && e.message.includes('LULUS'), `Validasi kelayakan kelulusan bekerja: ${e.message}`);
      }
      assert(remidiErrorCaught, 'Sertifikat DITOLAK untuk peserta dengan status REMIDI');
    }

    // Rule: Siswa yang LULUS dapat diterbitkan sertifikat
    const issueRes = await request('/api/guru/sertifikat/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guruToken}`
      },
      body: { ujian_id: testUjianId, siswa_id: testSiswaId }
    });
    assert(issueRes.status === 201 && issueRes.body.status === 'success', 'POST /api/guru/sertifikat/issue berhasil menerbitkan sertifikat (HTTP 201)');
    const cert = issueRes.body.data;
    issuedCertNumber = cert.certificate_number;
    assert(issuedCertNumber && issuedCertNumber.startsWith('CERT/CBT/'), `Nomor seri sertifikat terstandar: ${issuedCertNumber}`);
    assert(cert.qr_data_url && cert.qr_data_url.startsWith('data:image/png;base64,'), 'QR Code sertifikat memuat base64 data URL');
    assert(cert.verify_url && cert.verify_url.includes('verify.html?cert='), `URL verifikasi QR Code terkonfigurasi: ${cert.verify_url}`);

    // Rule: Idempotency (Penerbitan ulang mengembalikan sertifikat yang sama)
    const issueAgainRes = await request('/api/guru/sertifikat/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guruToken}`
      },
      body: { ujian_id: testUjianId, siswa_id: testSiswaId }
    });
    assert(issueAgainRes.body.data.certificate_number === issuedCertNumber, 'Idempotensi terverifikasi: nomor seri sertifikat tetap konsisten tanpa duplikasi');

    console.log('\n5. Pengujian API Siswa & Guru untuk Daftar Sertifikat...');
    // API Siswa: GET /api/siswa/sertifikat
    const studentCertsRes = await request('/api/siswa/sertifikat', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(studentCertsRes.status === 200 && Array.isArray(studentCertsRes.body.data), 'GET /api/siswa/sertifikat mengembalikan riwayat sertifikat');
    assert(studentCertsRes.body.data.some(c => c.certificate_number === issuedCertNumber), 'Sertifikat yang diterbitkan muncul pada daftar sertifikat siswa');

    // API Guru: GET /api/guru/sertifikat/ujian/:ujianId
    const examCertsRes = await request(`/api/guru/sertifikat/ujian/${testUjianId}`, {
      headers: { Authorization: `Bearer ${guruToken}` }
    });
    assert(examCertsRes.status === 200 && Array.isArray(examCertsRes.body.data), 'GET /api/guru/sertifikat/ujian/:id mengembalikan daftar sertifikat per ujian');

    console.log('\n6. Pengujian Verifikasi Publik Sertifikat (Unauthenticated & Audit Log)...');
    // Public Verify: Tanpa token auth!
    const verifyRes = await request(`/api/sertifikat/verify/${encodeURIComponent(issuedCertNumber)}`);
    assert(verifyRes.status === 200 && verifyRes.body.status === 'success', 'GET /api/sertifikat/verify/:cert (Public tanpa auth) mengembalikan 200 OK');
    const verifData = verifyRes.body.data;
    assert(verifData.valid === true, 'Status keabsahan: valid = true');
    assert(verifData.nama_siswa && verifData.nis_masked, `Data terverifikasi: ${verifData.nama_siswa} (NIS Masked: ${verifData.nis_masked})`);
    assert(!verifData.password && !verifData.user_id, 'Keamanan privasi: data sensitif (password/hash/id) TIDAK dibocorkan');
    assert(verifData.total_verifications >= 1, `Audit logging tercatat: diverifikasi ${verifData.total_verifications} kali`);

    // Public Verify untuk sertifikat yang tidak ada
    const invalidVerifyRes = await request('/api/sertifikat/verify/CERT-PALSU-999999');
    assert(invalidVerifyRes.status === 404 && invalidVerifyRes.body.data.valid === false, 'Verifikasi sertifikat palsu / tidak ada mengembalikan 404 & valid = false');

    console.log('\n7. Pengujian Render Halaman Cetak Sertifikat Digital (HTML View)...');
    // Print View: GET /sertifikat/print/:certNumber
    const printCertRes = await request(`/sertifikat/print/${encodeURIComponent(issuedCertNumber)}`);
    assert(printCertRes.status === 200 && typeof printCertRes.body === 'string' && printCertRes.body.includes('SERTIFIKAT KELULUSAN'), 'GET /sertifikat/print/:cert mengembalikan berkas HTML sertifikat kelulusan');
    assert(printCertRes.body.includes(issuedCertNumber), 'Nomor sertifikat tercetak dalam berkas HTML');
    assert(printCertRes.body.includes('@page') && printCertRes.body.includes('landscape'), 'Tata letak cetak sertifikat berformat A4 Landscape');

    console.log('\n====================================================');
    console.log(`HASIL TEST PHASE 8: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Exception saat menjalankan test suite:', err);
    process.exit(1);
  }
}

runPhase8Tests();
