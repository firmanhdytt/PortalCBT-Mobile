require('dotenv').config();
const http = require('http');
const db = require('./src/database/db');
const notificationService = require('./src/services/notificationService');
const preferenceService = require('./src/services/preferenceService');
const { app } = require('./server');

let testServer;
let port;
let studentToken;
let guruToken;
let adminToken;
let studentUser;
let guruUser;
let adminUser;

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

async function loginUser(username, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { username, password }
  });
  if (res.status !== 200 || !res.body.token) {
    throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runPhase10Tests() {
  console.log('====================================================');
  console.log('🧪 MEMULAI AUTOMATED TEST SUITE: PHASE 10');
  console.log('   (UI/UX Design System, Multi-Theme, Text Scale & In-App Notifications)');
  console.log('====================================================\n');

  try {
    testServer = http.createServer(app);
    await new Promise((resolve) => {
      testServer.listen(0, '127.0.0.1', () => {
        port = testServer.address().port;
        console.log(`Ephemeral Test Server listening on http://127.0.0.1:${port}`);
        resolve();
      });
    });

    // 1. Authenticate users
    console.log('\n--- 1. Authenticating Test Users ---');
    const studentAuth = await loginUser('siswa', 'siswa');
    studentToken = studentAuth.token;
    studentUser = studentAuth.user;
    assert(studentToken && studentUser.id, 'Siswa authenticated successfully');

    const guruAuth = await loginUser('guru', 'guru');
    guruToken = guruAuth.token;
    guruUser = guruAuth.user;
    assert(guruToken && guruUser.id, 'Guru authenticated successfully');

    const adminAuth = await loginUser('admin', 'admin');
    adminToken = adminAuth.token;
    adminUser = adminAuth.user;
    assert(adminToken && adminUser.id, 'Admin authenticated successfully');

    // 2. Preferences API Tests
    console.log('\n--- 2. User Preferences API Tests ---');
    
    // 2.1 Get default preferences
    const getPrefRes = await request('/api/preferences', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(getPrefRes.status === 200, 'GET /api/preferences returns 200 OK');
    assert(getPrefRes.body.status === 'success' && getPrefRes.body.data, 'Preference data present');
    assert(
      ['light', 'dark', 'system'].includes(getPrefRes.body.data.theme),
      `Default theme is valid ('${getPrefRes.body.data.theme}')`
    );

    // 2.2 Update preferences: valid theme, font_scale, high_contrast
    const updatePrefRes = await request('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: {
        theme: 'dark',
        font_scale: 'large',
        high_contrast: 1
      }
    });
    assert(updatePrefRes.status === 200, 'PUT /api/preferences returns 200 OK');
    assert(updatePrefRes.body.data.theme === 'dark', 'Theme updated to dark');
    assert(updatePrefRes.body.data.font_scale === 'large', 'Font scale updated to large');
    assert(updatePrefRes.body.data.high_contrast === 1, 'High contrast enabled');

    // 2.3 Verify persistence of preferences
    const verifyPrefRes = await request('/api/preferences', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(verifyPrefRes.body.data.theme === 'dark', 'Persisted theme is dark');
    assert(verifyPrefRes.body.data.font_scale === 'large', 'Persisted font scale is large');
    assert(verifyPrefRes.body.data.high_contrast === 1, 'Persisted high contrast is 1');

    // 2.4 Validate invalid theme rejection
    const invalidThemeRes = await request('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { theme: 'neon_pink' }
    });
    assert(invalidThemeRes.status === 400, 'Reject invalid theme with 400 Validation Error');

    // 2.5 Validate invalid font scale rejection
    const invalidFontRes = await request('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`
      },
      body: { font_scale: 'gigantic' }
    });
    assert(invalidFontRes.status === 400, 'Reject invalid font_scale with 400 Validation Error');

    // 3. In-App Notifications API Tests
    console.log('\n--- 3. Notification Service & API Tests ---');

    // 3.1 Initial Unread Count
    const unreadInitialRes = await request('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(unreadInitialRes.status === 200, 'GET /api/notifications/unread-count returns 200');
    const initialCount = unreadInitialRes.body.data.unread_count;

    // 3.2 Send direct notification via service
    const notif1 = await notificationService.notifyUser({
      userId: studentUser.id,
      title: 'Ujian Baru Dijadwalkan',
      message: 'Ujian Matematika Bab 1 telah tersedia untuk dikerjakan.',
      type: 'info',
      category: 'ujian_tersedia',
      referenceId: 101
    });
    assert(notif1 && notif1.id, 'Notification created successfully in DB');

    // 3.3 Verify unread count incremented
    const unreadAfterRes = await request('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(
      unreadAfterRes.body.data.unread_count === initialCount + 1,
      `Unread count incremented from ${initialCount} to ${initialCount + 1}`
    );

    // 3.4 List notifications endpoint
    const listRes = await request('/api/notifications?limit=10', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(listRes.status === 200, 'GET /api/notifications returns 200 OK');
    assert(Array.isArray(listRes.body.data), 'Returns notification list array');
    const foundNotif = listRes.body.data.find((n) => n.id === notif1.id);
    assert(foundNotif !== undefined, 'Created notification found in user notification list');
    assert(foundNotif.category === 'ujian_tersedia', 'Notification category preserved');
    assert(foundNotif.is_read === 0, 'Notification initial state is unread (0)');

    // 3.5 Mark single notification as read
    const markReadRes = await request(`/api/notifications/${notif1.id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(markReadRes.status === 200, `PUT /api/notifications/${notif1.id}/read returns 200`);
    assert(markReadRes.body.status === 'success', 'Notification marked as read successfully');

    // Verify unread count decremented
    const unreadDecremented = await request('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(
      unreadDecremented.body.data.unread_count === initialCount,
      'Unread count restored after marking as read'
    );

    // 3.6 Create batch notifications and test markAllAsRead
    await notificationService.notifyUser({
      userId: studentUser.id,
      title: 'Pemberitahuan Sistem 1',
      message: 'Perubahan jadwal ujian semester',
      type: 'warning',
      category: 'general'
    });
    await notificationService.notifyUser({
      userId: studentUser.id,
      title: 'Pemberitahuan Sistem 2',
      message: 'Pemeliharaan server CBT pada pukul 22:00',
      type: 'danger',
      category: 'general'
    });

    const markAllRes = await request('/api/notifications/read-all', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(markAllRes.status === 200, 'PUT /api/notifications/read-all returns 200');
    assert(markAllRes.body.data && markAllRes.body.data.marked_count !== undefined, 'Mark all as read processed');

    const finalUnreadRes = await request('/api/notifications/unread-count', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(finalUnreadRes.body.data.unread_count === 0, 'All notifications now marked read (unread = 0)');

    // 3.7 Delete notification
    const deleteRes = await request(`/api/notifications/${notif1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(deleteRes.status === 200, `DELETE /api/notifications/${notif1.id} returns 200`);

    // 4. Notification Triggers (Event-Driven Integration)
    console.log('\n--- 4. Event-Driven Notification Triggers ---');

    // 4.1 Trigger: onExamPublished
    const sampleExam = await db.query('SELECT id, kelas_id FROM ujian LIMIT 1');
    if (sampleExam.length > 0) {
      await notificationService.onExamPublished(sampleExam[0].id);
      assert(true, 'Trigger onExamPublished executed without errors');
    } else {
      assert(true, 'Trigger onExamPublished skipped (no exams in DB)');
    }

    // 4.2 Trigger: onExamSubmitted
    const sampleStudent = await db.query('SELECT id FROM siswa LIMIT 1');
    if (sampleExam.length > 0 && sampleStudent.length > 0) {
      await notificationService.onExamSubmitted(sampleExam[0].id, sampleStudent[0].id, 1, false);
      assert(true, 'Trigger onExamSubmitted executed without errors');
    } else {
      assert(true, 'Trigger onExamSubmitted skipped (no students/exams in DB)');
    }

    // 4.3 Trigger: onEssayGraded
    if (sampleExam.length > 0 && sampleStudent.length > 0) {
      await notificationService.onEssayGraded(sampleExam[0].id, sampleStudent[0].id, 92.5);
      assert(true, 'Trigger onEssayGraded executed without errors');
    } else {
      assert(true, 'Trigger onEssayGraded skipped (no students/exams in DB)');
    }

    // 4.4 Trigger: onCertificateIssued
    if (sampleStudent.length > 0) {
      await notificationService.onCertificateIssued(sampleStudent[0].id, 'CERT-TEST-123', 'Biologi');
      assert(true, 'Trigger onCertificateIssued executed without errors');
    } else {
      assert(true, 'Trigger onCertificateIssued skipped (no students in DB)');
    }

    // 4.5 Trigger: onUnlockRequested & onUnlockProcessed
    if (sampleExam.length > 0 && sampleStudent.length > 0) {
      await notificationService.onUnlockRequested(sampleExam[0].id, sampleStudent[0].id, 'Aplikasi crash mendadak');
      assert(true, 'Trigger onUnlockRequested executed without errors');

      await notificationService.onUnlockProcessed(sampleExam[0].id, sampleStudent[0].id, 'APPROVED', 'Disetujui pengawas');
      assert(true, 'Trigger onUnlockProcessed executed without errors');
    } else {
      assert(true, 'Trigger unlock events skipped (no students/exams in DB)');
    }

    // 4.6 Broadcast notifyRole
    const broadcastCount = await notificationService.notifyRole('guru', {
      title: 'Pengumuman Rapat Guru',
      message: 'Rapat koordinasi CBT esok hari pukul 09.00',
      type: 'info'
    });
    assert(broadcastCount >= 0, `Broadcast notifyRole to guru successful (${broadcastCount} notified)`);

  } catch (err) {
    console.error('Fatal Error during tests:', err);
    failedTests++;
  } finally {
    if (testServer) {
      testServer.close();
    }
    await db.pool.end();
  }

  console.log('\n=======================================');
  console.log(`TOTAL PASSED: ${passedTests}`);
  console.log(`TOTAL FAILED: ${failedTests}`);
  console.log('=======================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase10Tests();
