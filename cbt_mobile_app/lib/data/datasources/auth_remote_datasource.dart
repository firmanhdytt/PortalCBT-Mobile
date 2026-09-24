import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../models/student_model.dart';

class AuthRemoteDataSource {
  final ApiClient _client;

  AuthRemoteDataSource(this._client);

  Future<Map<String, dynamic>> login(String username, String password) async {
    final res = await _client.post(
      ApiEndpoints.login,
      data: {'username': username, 'password': password},
    );

    if (res is Map<String, dynamic>) {
      final token = res['token']?.toString();
      final refreshToken = res['refresh_token']?.toString();
      final profilMap = res['profil'] as Map<String, dynamic>?;

      StudentModel? student;
      if (profilMap != null) {
        student = StudentModel.fromJson(profilMap);
      }

      return {
        'token': token,
        'refresh_token': refreshToken,
        'user': res['user'],
        'student': student,
        'raw_profil': profilMap,
      };
    }

    throw Exception('Format respon login tidak valid');
  }

  Future<void> logout(String? refreshToken) async {
    try {
      await _client.post(
        ApiEndpoints.logout,
        data: refreshToken != null ? {'refresh_token': refreshToken} : null,
      );
    } catch (_) {
      // Ignore network errors during logout
    }
  }
}
