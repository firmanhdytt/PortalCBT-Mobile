import 'package:flutter/material.dart';
import '../../domain/entities/student.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthController extends ChangeNotifier {
  final AuthRepository _repo;

  AuthController(this._repo);

  bool _isLoading = false;
  String? _errorMessage;
  Student? _currentStudent;

  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Student? get currentStudent => _currentStudent;
  bool get isAuthenticated => _currentStudent != null;

  String getServerIp() => _repo.getServerIp();

  Future<bool> setServerIp(String ip) async {
    final success = await _repo.setServerIp(ip);
    notifyListeners();
    return success;
  }

  Future<bool> checkSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final student = await _repo.getCurrentStudent();
      _currentStudent = student;
      _errorMessage = null;
      _isLoading = false;
      notifyListeners();
      return student != null;
    } catch (e) {
      _currentStudent = null;
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> login(String username, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final student = await _repo.login(username.trim(), password.trim());
      _currentStudent = student;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _currentStudent = null;
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      await _repo.logout();
    } catch (_) {}

    _currentStudent = null;
    _errorMessage = null;
    _isLoading = false;
    notifyListeners();
  }
}
