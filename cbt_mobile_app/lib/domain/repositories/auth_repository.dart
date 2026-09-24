import '../entities/student.dart';

abstract class AuthRepository {
  Future<Student> login(String username, String password);
  Future<void> logout();
  Future<Student?> getCurrentStudent();
  String getServerIp();
  Future<bool> setServerIp(String ip);
  Future<bool> isLoggedIn();
}
