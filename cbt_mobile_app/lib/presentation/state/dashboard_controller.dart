import 'package:flutter/material.dart';
import '../../domain/entities/exam.dart';
import '../../domain/repositories/exam_repository.dart';

class DashboardController extends ChangeNotifier {
  final ExamRepository _repo;

  DashboardController(this._repo);

  List<Exam> _exams = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<Exam> get exams => _exams;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isEmpty => _exams.isEmpty && !_isLoading;

  Future<void> loadExams(int kelasId, int siswaId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final list = await _repo.getActiveExams(kelasId, siswaId);
      _exams = list;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Exam?> verifyToken(int ujianId, String token) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final exam = await _repo.verifyExamToken(ujianId, token.trim().toUpperCase());
      _isLoading = false;
      notifyListeners();
      return exam;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }
}
