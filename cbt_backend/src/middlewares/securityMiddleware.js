const ApiResponse = require('../utils/response');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Phase 23: Security HTTP Headers Middleware
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com;"
  );
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
}

/**
 * Helper to recursively sanitize strings against XSS & Null Bytes
 */
function cleanValue(val) {
  if (typeof val === 'string') {
    return val
      .replace(/\0/g, '') // Strip null bytes
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''); // Strip script tags
  }
  if (Array.isArray(val)) {
    return val.map(cleanValue);
  }
  if (val !== null && typeof val === 'object') {
    const cleaned = {};
    for (const key of Object.keys(val)) {
      cleaned[cleanValue(key)] = cleanValue(val[key]);
    }
    return cleaned;
  }
  return val;
}

/**
 * Phase 23: XSS & Payload Sanitization Middleware
 */
function sanitizeInputs(req, res, next) {
  if (req.body) req.body = cleanValue(req.body);
  if (req.query) req.query = cleanValue(req.query);
  if (req.params) req.params = cleanValue(req.params);
  next();
}

/**
 * In-Memory Rate Limiter Store
 */
const rateLimitMap = new Map();

/**
 * Phase 23: General Rate Limiter Middleware
 * @param {Object} options - { windowMs, maxRequests, message }
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const maxRequests = options.maxRequests || 100;
  const message = options.message || 'Terlalu banyak permintaan API. Silakan coba beberapa saat lagi.';

  return (req, res, next) => {
    const key = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();
    let record = rateLimitMap.get(key);

    if (!record || now - record.startTime > windowMs) {
      record = { startTime: now, count: 1 };
    } else {
      record.count++;
    }

    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      return ApiResponse.error(
        res,
        message,
        ERROR_CODES.RATE_LIMITED || 'RATE_LIMITED',
        429,
        { retry_after_seconds: Math.ceil((record.startTime + windowMs - now) / 1000) }
      );
    }

    next();
  };
}

module.exports = {
  securityHeaders,
  sanitizeInputs,
  createRateLimiter
};
