import 'package:flutter/material.dart';
import '../../domain/entities/exam.dart';
import '../../domain/repositories/exam_repository.dart';

import '../../domain/entities/student_card.dart';
import '../../domain/entities/certificate.dart';

class DashboardController extends ChangeNotifier {
  final ExamRepository _repo;

  DashboardController(this._repo);

  List<Exam> _exams = [];
  bool _isLoading = false;
  String? _errorMessage;

  StudentCard? _studentCard;
  bool _isLoadingCard = false;

  List<Certificate> _certificates = [];
  bool _isLoadingCerts = false;

  List<Exam> get exams => _exams;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isEmpty => _exams.isEmpty && !_isLoading;

  StudentCard? get studentCard => _studentCard;
  bool get isLoadingCard => _isLoadingCard;

  List<Certificate> get certificates => _certificates;
  bool get isLoadingCerts => _isLoadingCerts;

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

  Future<void> loadStudentCard() async {
    _isLoadingCard = true;
    notifyListeners();

    try {
      _studentCard = await _repo.getStudentCard();
      _isLoadingCard = false;
      notifyListeners();
    } catch (e) {
      _isLoadingCard = false;
      notifyListeners();
    }
  }

  Future<void> loadCertificates() async {
    _isLoadingCerts = true;
    notifyListeners();

    try {
      _certificates = await _repo.getCertificates();
      _isLoadingCerts = false;
      notifyListeners();
    } catch (e) {
      _isLoadingCerts = false;
      notifyListeners();
    }
  }
}
