require('dotenv').config();
const http = require('http');
const db = require('./src/database/db');
const { app } = require('./server');
const { createRateLimiter } = require('./src/middlewares/securityMiddleware');

let testServer;
let port;
let studentToken;

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

async function runSecurityAndErrorHandlingTests() {
  console.log('====================================================');
  console.log('🧪 MEMULAI AUTOMATED TEST SUITE: PHASE 23 & 24');
  console.log('   (Security Hardening & Standardized Error Handling)');
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

    // 1. Security HTTP Headers Tests
    console.log('\n--- 1. Testing Security HTTP Headers (Phase 23) ---');
    const healthRes = await request('/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
    assert(healthRes.headers['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options: nosniff present');
    assert(healthRes.headers['x-frame-options'] === 'SAMEORIGIN', 'Header X-Frame-Options: SAMEORIGIN present');
    assert(healthRes.headers['x-xss-protection'] === '1; mode=block', 'Header X-XSS-Protection present');
    assert(healthRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Header Referrer-Policy present');
    assert(healthRes.headers['content-security-policy'] !== undefined, 'Content-Security-Policy header present');

    // 2. Input Sanitization Engine Tests
    console.log('\n--- 2. Testing XSS & Input Sanitization Engine ---');
    const loginSanitizeRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        username: "siswa<script>alert('xss')</script>",
        password: 'siswa'
      }
    });
    assert(loginSanitizeRes.status === 401, 'Login with sanitized XSS username fails authentication cleanly (401)');
    assert(loginSanitizeRes.body.success === false, 'Standard error response success is false');
    assert(loginSanitizeRes.body.code === 'AUTH_INVALID', 'Error code is AUTH_INVALID');

    // Authenticate student user for protected endpoint tests
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'siswa', password: 'siswa' }
    });
    studentToken = loginRes.body.token;
    assert(studentToken !== undefined, 'Siswa logged in successfully for security tests');

    // 3. Rate Limiter Middleware Tests
    console.log('\n--- 3. Testing Rate Limiting Engine ---');
    const customLimiter = createRateLimiter({ windowMs: 10000, maxRequests: 3 });
    const dummyReq = { ip: '192.168.1.100', headers: {} };
    let rateLimitHit = false;
    const dummyRes = {
      status(code) {
        return {
          json(data) {
            if (code === 429) rateLimitHit = true;
            return data;
          }
        };
      }
    };
    const dummyNext = () => {};

    customLimiter(dummyReq, dummyRes, dummyNext); // 1
    customLimiter(dummyReq, dummyRes, dummyNext); // 2
    customLimiter(dummyReq, dummyRes, dummyNext); // 3
    customLimiter(dummyReq, dummyRes, dummyNext); // 4 (Trigger Rate Limit)
    assert(rateLimitHit === true, 'Rate limiter correctly triggers 429 TOO_MANY_REQUESTS when limit exceeded');

    // 4. Standardized Error Response Schema Tests (Phase 24)
    console.log('\n--- 4. Testing Standardized Error Response Schema (Phase 24) ---');

    // 4.1 404 Resource Not Found
    const notFoundRes = await request('/api/non-existent-route-path');
    assert(notFoundRes.status === 404, '404 HTTP status for unknown routes');
    assert(notFoundRes.body.success === false, '404 response success field is false');
    assert(notFoundRes.body.code === 'RESOURCE_NOT_FOUND', '404 code is RESOURCE_NOT_FOUND');
    assert(typeof notFoundRes.body.message === 'string', '404 message is descriptive string');
    assert(notFoundRes.body.stack === undefined, 'Stack trace is not leaked in 404 error response');

    // 4.2 401 Unauthorized (Missing Token)
    const noTokenRes = await request('/api/siswa/ujian/1');
    assert(noTokenRes.status === 401, '401 HTTP status for unauthenticated access');
    assert(noTokenRes.body.success === false, '401 response success field is false');
    assert(noTokenRes.body.code === 'AUTH_REQUIRED', '401 code is AUTH_REQUIRED');

    // 4.3 401 Invalid Token
    const invalidTokRes = await request('/api/siswa/ujian/1', {
      headers: { Authorization: 'Bearer token_palsu_rusak_123' }
    });
    assert(invalidTokRes.status === 401, '401 HTTP status for invalid JWT token');
    assert(invalidTokRes.body.code === 'AUTH_INVALID', '401 code is AUTH_INVALID');

    // 4.4 403 Forbidden Access (RBAC Violation)
    const forbiddenRes = await request('/api/admin/siswa', {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert(forbiddenRes.status === 403, '403 HTTP status for student accessing admin route');
    assert(forbiddenRes.body.success === false, '403 response success field is false');
    assert(forbiddenRes.body.code === 'FORBIDDEN', '403 code is FORBIDDEN');

    // 4.5 Malformed JSON Body (SyntaxError)
    const malformedJsonRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid_json_syntax: true,'
    });
    assert(malformedJsonRes.status === 400, '400 HTTP status for malformed JSON request body');
    assert(malformedJsonRes.body.success === false, '400 response success field is false');
    assert(malformedJsonRes.body.code === 'VALIDATION_ERROR', '400 code is VALIDATION_ERROR');

  } catch (err) {
    console.error('Fatal Error during security test execution:', err);
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

runSecurityAndErrorHandlingTests();
