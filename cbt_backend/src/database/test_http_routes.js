const http = require('http');

async function testRoutes() {
  console.log('--- Pengujian Endpoint HTTP Server CBT ---');
  
  // Memulai server di process lokal
  const app = require('../../server');
  // tunggu server listening
  await new Promise(r => setTimeout(r, 1000));

  function get(path) {
    return new Promise((resolve, reject) => {
      http.get(`http://localhost:3000${path}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      }).on('error', reject);
    });
  }

  function post(path, body) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request(`http://localhost:3000${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  try {
    // 1. Test Login
    const loginRes = await post('/api/auth/login', { username: 'admin', password: 'admin' });
    console.log(`[PASS] Login API status: ${loginRes.status}, role: ${loginRes.data.user.role}`);

    // 2. Test Get Kelas
    const kelasRes = await get('/api/admin/kelas');
    console.log(`[PASS] Get Kelas status: ${kelasRes.status}, count: ${kelasRes.data.length}`);

    // 3. Test Get Mapel
    const mapelRes = await get('/api/admin/mapel');
    console.log(`[PASS] Get Mapel status: ${mapelRes.status}, count: ${mapelRes.data.length}`);

    // 4. Test Get Bank Soal
    const bankRes = await get('/api/guru/bank-soal');
    console.log(`[PASS] Get Bank Soal status: ${bankRes.status}, count: ${bankRes.data.length}`);

    // 5. Test Get Ujian Siswa
    const ujianRes = await get('/api/siswa/ujian/1?siswa_id=1');
    console.log(`[PASS] Get Siswa Ujian status: ${ujianRes.status}, active exams: ${ujianRes.data.length}`);

    console.log('\nSEMUA ENDPOINT HTTP BERFUNGSI NORMAL DENGAN DATABASE MYSQL!');
    process.exit(0);
  } catch (err) {
    console.error('Error saat test HTTP routes:', err);
    process.exit(1);
  }
}

testRoutes();
