import '../../core/storage/session_storage.dart';
import '../../domain/entities/student.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../datasources/exam_local_datasource.dart';
import '../models/student_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remote;
  final ExamLocalDataSource _local;
  final SessionStorage _session;

  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required ExamLocalDataSource local,
    required SessionStorage session,
  })  : _remote = remote,
        _local = local,
        _session = session;

  @override
  Future<Student> login(String username, String password) async {
    final res = await _remote.login(username, password);

    final token = res['token'] as String?;
    final refreshToken = res['refresh_token'] as String?;
    final student = res['student'] as StudentModel?;

    if (token != null) {
      await _session.setAuthToken(token);
    }
    if (refreshToken != null) {
      await _session.setRefreshToken(refreshToken);
    }

    if (student != null) {
      await _local.saveStudent(student);
      await _session.saveStudentData(student.toJson());
      return student;
    }

    throw Exception('Data profil siswa tidak ditemukan dalam respon login');
  }

  @override
  Future<void> logout() async {
    final refreshToken = _session.getRefreshToken();
    await _remote.logout(refreshToken);
    await _session.clearAuth();
    await _local.clearAll();
  }

  @override
  Future<Student?> getCurrentStudent() async {
    // 1. Try local SQLite
    final localStudent = await _local.getStudent();
    if (localStudent != null) return localStudent;

    // 2. Try SharedPreferences cache
    final cachedMap = _session.getStudentData();
    if (cachedMap != null) {
      return StudentModel.fromJson(cachedMap);
    }

    return null;
  }

  @override
  String getServerIp() {
    return _session.getServerIp();
  }

  @override
  Future<bool> setServerIp(String ip) {
    return _session.setServerIp(ip);
  }

  @override
  Future<bool> isLoggedIn() async {
    final token = _session.getAuthToken();
    if (token == null || token.isEmpty) return false;
    final student = await getCurrentStudent();
    return student != null;
  }
}
