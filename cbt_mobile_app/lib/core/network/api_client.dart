import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../errors/exceptions.dart';
import '../storage/session_storage.dart';

class ApiClient {
  final http.Client _client;
  final SessionStorage _session;
  static const Duration timeoutDuration = Duration(seconds: 12);

  ApiClient({http.Client? client, required SessionStorage session})
      : _client = client ?? http.Client(),
        _session = session;

  String get baseUrl => 'http://${_session.getServerIp()}/api';

  Map<String, String> _buildHeaders({bool isJson = true}) {
    final headers = <String, String>{};
    if (isJson) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    }
    final token = _session.getAuthToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  dynamic _processResponse(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    String message = 'Terjadi kesalahan pada server';
    String? code;
    if (body is Map<String, dynamic>) {
      message = body['message']?.toString() ?? message;
      code = body['code']?.toString();
    }

    if (response.statusCode == 401) {
      throw AuthException(message: message, code: code, statusCode: 401);
    } else if (response.statusCode == 403) {
      throw AuthException(message: message, code: code, statusCode: 403);
    } else {
      throw ServerException(
        message: message,
        code: code,
        statusCode: response.statusCode,
      );
    }
  }

  Future<dynamic> get(String endpoint) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final res = await _client
          .get(uri, headers: _buildHeaders(isJson: false))
          .timeout(timeoutDuration);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw NetworkException(message: 'Koneksi gagal: ${e.message}');
    } on TimeoutException {
      throw const NetworkException(message: 'Waktu koneksi habis (timeout). Periksa IP server.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException(message: 'Terjadi kesalahan jaringan: $e');
    }
  }

  Future<dynamic> post(String endpoint, {Map<String, dynamic>? data}) async {
    try {
      final uri = Uri.parse('$baseUrl$endpoint');
      final res = await _client
          .post(
            uri,
            headers: _buildHeaders(isJson: true),
            body: data != null ? jsonEncode(data) : null,
          )
          .timeout(timeoutDuration);
      return _processResponse(res);
    } on SocketException catch (e) {
      throw NetworkException(message: 'Koneksi gagal: ${e.message}');
    } on TimeoutException {
      throw const NetworkException(message: 'Waktu koneksi habis (timeout). Periksa IP server.');
    } on AppException {
      rethrow;
    } catch (e) {
      throw NetworkException(message: 'Terjadi kesalahan jaringan: $e');
    }
  }
}
