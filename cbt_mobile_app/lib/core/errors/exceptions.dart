class AppException implements Exception {
  final String message;
  final String? code;
  final int? statusCode;

  const AppException({required this.message, this.code, this.statusCode});

  @override
  String toString() => 'AppException(code: $code, statusCode: $statusCode, message: $message)';
}

class ServerException extends AppException {
  const ServerException({required super.message, super.code, super.statusCode});
}

class AuthException extends AppException {
  const AuthException({required super.message, super.code, super.statusCode});
}

class NetworkException extends AppException {
  const NetworkException({required super.message, super.code, super.statusCode});
}

class CacheException extends AppException {
  const CacheException({required super.message, super.code, super.statusCode});
}
