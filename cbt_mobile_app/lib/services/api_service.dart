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
        return jsonDecode(res.body);
      }
    } catch (e) {
      print("Error Login API: $e");
    }
    return null;
  }

  // 2. Load Daftar Ujian
  static Future<List<dynamic>> fetchUjianList(int kelasId, int siswaId) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/siswa/ujian/$kelasId?siswa_id=$siswaId'))
          .timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      print("Error Fetch Ujian: $e");
    }
    return [];
  }

  // 3. Verifikasi Token
  static Future<Map<String, dynamic>?> verifyToken(int ujianId, String token) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/verifikasi-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'ujian_id': ujianId, 'token': token}),
      ).timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      print("Error Verifikasi Token: $e");
    }
    return null;
  }

  // 4. Download Soal
  static Future<List<dynamic>> fetchSoalList(int ujianId) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/siswa/ujian/soal/$ujianId'))
          .timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      print("Error Fetch Soal: $e");
    }
    return [];
  }

  // 5. Sinkronisasi Jawaban (Auto-Save)
  static Future<bool> syncJawaban(int siswaId, int ujianId, List<Map<String, dynamic>> jawabanList) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/sync'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'siswa_id': siswaId,
          'ujian_id': ujianId,
          'jawaban_list': jawabanList,
        }),
      ).timeout(timeoutDuration);
      return res.statusCode == 200;
    } catch (e) {
      print("Error Sync Jawaban: $e");
    }
    return false;
  }

  // 6. Submit Ujian Final (Selesai Ujian)
  static Future<Map<String, dynamic>?> submitUjian(int siswaId, int ujianId) async {
    final baseUrl = await getBaseUrl();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/siswa/ujian/submit'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'siswa_id': siswaId,
          'ujian_id': ujianId,
        }),
      ).timeout(timeoutDuration);
      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (e) {
      print("Error Submit Ujian: $e");
    }
    return null;
  }
}
