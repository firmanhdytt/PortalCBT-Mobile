class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class ApiResponse {
  static success(res, data = null, message = 'Sukses', statusCode = 200, extra = {}) {
    const payload = {
      success: true,
      message,
      data,
      ...extra
    };
    return res.status(statusCode).json(payload);
  }

  static raw(res, data, statusCode = 200) {
    return res.status(statusCode).json(data);
  }

  static error(res, message = 'Terjadi kesalahan sistem', code = 'INTERNAL_SERVER_ERROR', statusCode = 500, details = null) {
    const payload = {
      success: false,
      message,
      code
    };
    if (details) {
      payload.details = details;
    }
    return res.status(statusCode).json(payload);
  }
}

ApiResponse.ApiResponse = ApiResponse;
ApiResponse.ApiError = ApiError;
module.exports = ApiResponse;
module.exports.ApiResponse = ApiResponse;
module.exports.ApiError = ApiError;
