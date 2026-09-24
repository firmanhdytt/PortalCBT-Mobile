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
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Terjadi kesalahan internal server';
  const code = err.code || (ERROR_CODES.INTERNAL_SERVER_ERROR || 'INTERNAL_SERVER_ERROR');

  console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    console.error(err.stack);
  }

  return ApiResponse.error(res, message, code, statusCode, err.details || null);
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
