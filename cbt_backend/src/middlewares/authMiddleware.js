const { verifyAccessToken } = require('../utils/jwt');
const ApiResponse = require('../utils/response');
const ERROR_CODES = require('../utils/errorCodes');

/**
 * Authentication Middleware
 * Enforces valid Bearer JWT on protected endpoints
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];

  if (!authHeader) {
    return ApiResponse.error(
      res,
      'Autentikasi dibutuhkan. Silakan sertakan token!',
      ERROR_CODES.AUTH_REQUIRED,
      401
    );
  }

  let token = authHeader;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    return ApiResponse.error(
      res,
      'Format token tidak valid!',
      ERROR_CODES.AUTH_INVALID,
      401
    );
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.error(
        res,
        'Sesi token telah kedaluwarsa, silakan login kembali.',
        ERROR_CODES.AUTH_EXPIRED,
        401
      );
    }
    return ApiResponse.error(
      res,
      'Token otentikasi tidak valid atau telah rusak!',
      ERROR_CODES.AUTH_INVALID,
      401
    );
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * @param {Array<String>|String} roles - Allowed roles, e.g. ['admin'], ['guru', 'admin']
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(
        res,
        'Autentikasi dibutuhkan sebelum otorisasi!',
        ERROR_CODES.AUTH_REQUIRED,
        401
      );
    }

    if (!allowed.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        `Akses ditolak: role '${req.user.role}' tidak memiliki hak akses untuk endpoint ini.`,
        ERROR_CODES.FORBIDDEN,
        403
      );
    }

    next();
  };
}

/**
 * Optional Authentication Middleware
 * Attaches req.user if a valid token is present, but does not block if missing
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
  if (!authHeader) return next();

  let token = authHeader;
  if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
  } catch (e) {
    // Ignore invalid tokens in optional auth
  }

  next();
}

module.exports = {
  authenticate,
  requireRole,
  optionalAuth
};
