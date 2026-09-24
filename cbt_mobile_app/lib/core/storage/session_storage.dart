import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_endpoints.dart';

class SessionStorage {
  static const String _keyServerIp = 'server_ip';
  static const String _keyAuthToken = 'auth_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyStudentData = 'student_data';

  final SharedPreferences _prefs;

  SessionStorage(this._prefs);

  static Future<SessionStorage> init() async {
    final prefs = await SharedPreferences.getInstance();
    return SessionStorage(prefs);
  }

  // Server IP
  String getServerIp() {
    return _prefs.getString(_keyServerIp) ?? ApiEndpoints.defaultHost;
  }

  Future<bool> setServerIp(String ip) async {
    return await _prefs.setString(_keyServerIp, ip.trim());
  }

  // JWT Auth Token
  String? getAuthToken() {
    return _prefs.getString(_keyAuthToken);
  }

  Future<bool> setAuthToken(String token) async {
    return await _prefs.setString(_keyAuthToken, token);
  }

  // JWT Refresh Token
  String? getRefreshToken() {
    return _prefs.getString(_keyRefreshToken);
  }

  Future<bool> setRefreshToken(String token) async {
    return await _prefs.setString(_keyRefreshToken, token);
  }

  // Clear Session
  Future<void> clearAuth() async {
    await _prefs.remove(_keyAuthToken);
    await _prefs.remove(_keyRefreshToken);
    await _prefs.remove(_keyStudentData);
  }

  Future<void> clearSession() async {
    await clearAuth();
  }

  // Cached Student Profile Map
  Map<String, dynamic>? getStudentData() {
    final str = _prefs.getString(_keyStudentData);
    if (str == null || str.isEmpty) return null;
    try {
      return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<bool> saveStudentData(Map<String, dynamic> data) async {
    return await _prefs.setString(_keyStudentData, jsonEncode(data));
  }
}
