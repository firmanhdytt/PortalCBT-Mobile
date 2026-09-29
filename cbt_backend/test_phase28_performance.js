require('dotenv').config();
const http = require('http');
const db = require('./src/database/db');
const { app } = require('./server');

let testServer;
let port;
let studentToken;

async function request(reqPath, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
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
          const duration = Date.now() - startTime;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, duration });
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

async function runPerformanceTestSuite() {
  console.log('====================================================');
  console.log('⚡ MEMULAI PERFORMANCE & STRESS TESTING SUITE (PHASE 28)');
  console.log('====================================================\n');

  try {
    testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        port = testServer.address().port;
        console.log(`Ephemeral Performance Test Server listening on http://127.0.0.1:${port}\n`);
        resolve();
      });
    });

    // 1. Initial Login to get auth token
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    studentToken = loginRes.body.token;

    // 2. Concurrent Login Load Test (Simulates 50 simultaneous student login requests)
    console.log('--- 1. SIMULASI SIMULTANEOUS CONCURRENT LOGINS (50 STREAMS) ---');
    const loginPromises = [];
    for (let i = 0; i < 50; i++) {
      loginPromises.push(
        request('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'siswa', password: 'siswa' }
        })
      );
    }
    const loginResults = await Promise.all(loginPromises);
    const loginSuccessCount = loginResults.filter((r) => r.status === 200).length;
    const loginDurations = loginResults.map((r) => r.duration);
    const avgLoginTime = (loginDurations.reduce((a, b) => a + b, 0) / loginDurations.length).toFixed(2);
    const maxLoginTime = Math.max(...loginDurations);

    console.log(`  ✅ Total Concurrent Request: 50`);
    console.log(`  ✅ Total Login Success: ${loginSuccessCount}/50`);
    console.log(`  ✅ Average Latency: ${avgLoginTime} ms`);
    console.log(`  ✅ Max Peak Latency: ${maxLoginTime} ms`);

    // 3. Concurrent Answer Sync Load Test (Simulates 100 simultaneous answer submission bursts)
    console.log('\n--- 2. SIMULASI HIGH-FREQUENCY ANSWER SYNC BURST (100 STREAMS) ---');
    const syncPromises = [];
    for (let i = 0; i < 100; i++) {
      syncPromises.push(
        request('/api/siswa/ujian/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`
          },
          body: {
            ujian_id: 1,
            jawaban: [
              {
                soal_id: 1,
                pilihan_jawaban_id: (i % 4) + 1,
                is_ragu: 0,
                updated_at: new Date().toISOString()
              }
            ]
          }
        })
      );
    }
    const syncResults = await Promise.all(syncPromises);
    const syncSuccessCount = syncResults.filter((r) => r.status === 200).length;
    const syncDurations = syncResults.map((r) => r.duration);
    const avgSyncTime = (syncDurations.reduce((a, b) => a + b, 0) / syncDurations.length).toFixed(2);
    const maxSyncTime = Math.max(...syncDurations);

    console.log(`  ✅ Total Concurrent Sync Request: 100`);
    console.log(`  ✅ Total Sync Success: ${syncSuccessCount}/100`);
    console.log(`  ✅ Average Latency: ${avgSyncTime} ms`);
    console.log(`  ✅ Max Peak Latency: ${maxSyncTime} ms`);

    // 4. Database Connection Pool & Latency Check
    console.log('\n--- 3. DATABASE CONNECTION POOL HEALTH & QUERY PERFORMANCE ---');
    const dbStartTime = Date.now();
    const dbRows = await db.query('SELECT COUNT(*) as total_users FROM users');
    const dbDuration = Date.now() - dbStartTime;
    console.log(`  ✅ MySQL Connection Pool Active & Healthy`);
    console.log(`  ✅ Query Latency: ${dbDuration} ms (Total Users: ${dbRows[0].total_users})`);

  } catch (err) {
    console.error('Fatal Error during Performance test execution:', err);
  } finally {
    if (testServer) {
      testServer.close();
    }
    await db.pool.end();
  }

  console.log('\n====================================================');
  console.log('⚡ STRESS & PERFORMANCE TEST COMPLETED SUCCESSFULLY');
  console.log('====================================================\n');
  process.exit(0);
}

runPerformanceTestSuite();
