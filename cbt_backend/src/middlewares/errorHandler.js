const ApiResponse = require('../utils/response');
const ERROR_CODES = require('../utils/errorCodes');

function notFoundHandler(req, res, next) {
  return ApiResponse.error(
    res,
    `Rute ${req.method} ${req.originalUrl} tidak ditemukan`,
    ERROR_CODES.RESOURCE_NOT_FOUND || 'RESOURCE_NOT_FOUND',
    404
  );
}

function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan internal pada server.';
  let code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let details = err.details || null;

  // 1. JSON Syntax Error handling (Malformed JSON body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Format JSON request tidak valid atau rusak.';
  }

  // 2. JWT Error Handling
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = ERROR_CODES.AUTH_INVALID;
    message = 'Token otentikasi tidak valid atau telah rusak!';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = ERROR_CODES.AUTH_EXPIRED;
    message = 'Sesi token telah kedaluwarsa, silakan login kembali.';
  }

  // 3. MySQL Database Errors
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    code = ERROR_CODES.CONFLICT;
    message = 'Data sudah terdaftar dalam sistem (Duplikasi Data).';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Relasi data yang dirujuk tidak ditemukan di database.';
  }

  // 4. File Upload Limits Error Handling
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    code = ERROR_CODES.FILE_TOO_LARGE;
    message = 'Ukuran berkas melebihi batas maksimal yang diperbolehkan.';
  }

  // Log Error (Silent in production)
  console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production' && err.stack && !(err.name === 'ApiError')) {
    console.error(err.stack);
  }

  return ApiResponse.error(res, message, code, statusCode, details);
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
