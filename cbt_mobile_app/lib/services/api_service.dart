import 'package:flutter/foundation.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String defaultIp = "10.0.2.2:3000"; // Loopback Android Emulator ke Localhost PC
  
  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final ip = prefs.getString('server_ip') ?? defaultIp;
    return "http://$ip/api";
  }

  static Future<void> setServerIp(String ip) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_ip', ip);
  }

  static Future<String> getServerIp() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_ip') ?? defaultIp;
  }

  static const Duration timeoutDuration = Duration(seconds: 10);

  // Helper untuk membuat header HTTP dengan Bearer Token
  static Future<Map<String, String>> getHeaders({bool isJson = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final headers = <String, String>{};
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  // Clear session token
  static Future<void> clearAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('refresh_token');
  }

  // 1. Login
  static Future<Map<String, dynamic>?> login(String username, String password) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      ).timeout(timeoutDuration);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final prefs = await SharedPreferences.getInstance();
        if (data['token'] != null) {
          await prefs.setString('auth_token', data['token']);
        }
        if (data['refresh_token'] != null) {
          await prefs.setString('refresh_token', data['refresh_token']);
        }
        return data;
      }
    } catch (e) {
      debugPrint("Error Login API: $e");
    }
    return null;
  }


  // 2. Load Daftar Ujian
  static Future<List<dynamic>> fetchUjianList(int kelasId, int siswaId) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: false);
      final res = await http
          .get(Uri.parse('$baseUrl/siswa/ujian/$kelasId?siswa_id=$siswaId'), headers: headers)
          .timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Error Fetch Ujian: $e");
    }
    return [];
  }

  // 3. Verifikasi Token
  static Future<Map<String, dynamic>?> verifyToken(int ujianId, String token) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: true);
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/verifikasi-token'),
        headers: headers,
        body: jsonEncode({'ujian_id': ujianId, 'token': token}),
      ).timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Error Verifikasi Token: $e");
    }
    return null;
  }

  // 4. Download Soal
  static Future<List<dynamic>> fetchSoalList(int ujianId) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: false);
      final res = await http
          .get(Uri.parse('$baseUrl/siswa/ujian/soal/$ujianId'), headers: headers)
          .timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Error Fetch Soal: $e");
    }
    return [];
  }

  // 5. Sinkronisasi Jawaban (Auto-Save)
  static Future<bool> syncJawaban(int siswaId, int ujianId, List<Map<String, dynamic>> jawabanList) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: true);
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/sync'),
        headers: headers,
        body: jsonEncode({
          'siswa_id': siswaId,
          'ujian_id': ujianId,
          'jawaban_list': jawabanList,
        }),
      ).timeout(timeoutDuration);
      return res.statusCode == 200;
    } catch (e) {
      debugPrint("Error Sync Jawaban: $e");
    }
    return false;
  }

  // 6. Submit Ujian Final (Selesai Ujian)
  static Future<Map<String, dynamic>?> submitUjian(int siswaId, int ujianId) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: true);
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/submit'),
        headers: headers,
        body: jsonEncode({
          'siswa_id': siswaId,
          'ujian_id': ujianId,
        }),
      ).timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Error Submit Ujian: $e");
    }
    return null;
  }

  // 7. Riwayat Hasil Ujian
  static Future<List<dynamic>> fetchHasilList(int siswaId) async {
    final baseUrl = await getBaseUrl();
    try {
      final headers = await getHeaders(isJson: false);
      final res = await http
          .get(Uri.parse('$baseUrl/siswa/hasil/$siswaId'), headers: headers)
          .timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      debugPrint("Error Fetch Hasil: $e");
    }
    return [];
  }
}


