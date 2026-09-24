import 'dart:async';
import 'package:flutter/material.dart';
import '../../domain/entities/exam.dart';
import '../../domain/entities/question.dart';
import '../../domain/entities/answer.dart';
import '../../domain/entities/exam_result.dart';
import '../../domain/repositories/exam_repository.dart';
import '../../core/sync/sync_engine.dart';
import '../../data/datasources/exam_local_datasource.dart';

class ExamController extends ChangeNotifier {
  final ExamRepository _repo;
  final ExamLocalDataSource _local;
  final SyncEngine _syncEngine;
  final Exam exam;
  final int siswaId;

  ExamController({
    required ExamRepository repo,
    required ExamLocalDataSource local,
    required SyncEngine syncEngine,
    required this.exam,
    required this.siswaId,
  })  : _repo = repo,
        _local = local,
        _syncEngine = syncEngine;

  List<Question> _questions = [];
  int _currentIndex = 0;
  final Map<int, Answer> _answers = {}; // keyed by soalId
  bool _isLoading = false;
  String? _errorMessage;
  int _remainingSeconds = 0;
  Timer? _countdownTimer;
  bool _isSubmitting = false;

  List<Question> get questions => _questions;
  int get currentIndex => _currentIndex;
  Question? get currentQuestion => _questions.isNotEmpty && _currentIndex < _questions.length
      ? _questions[_currentIndex]
      : null;
  bool get isLoading => _isLoading;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;
  int get remainingSeconds => _remainingSeconds;
  int get totalQuestions => _questions.length;
  bool get hasNext => _currentIndex < _questions.length - 1;
  bool get hasPrev => _currentIndex > 0;
  SyncState get syncState => _syncEngine.currentState;

  String get formattedRemainingTime {
    final m = (_remainingSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (_remainingSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> initExam() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Check for previously saved incomplete session to resume remaining time
      final incompleteExam = await _local.getActiveIncompleteExam();
      if (incompleteExam != null && incompleteExam['id'] == exam.id && incompleteExam['sisa_detik'] != null) {
        final savedSeconds = incompleteExam['sisa_detik'] as int;
        _remainingSeconds = (savedSeconds > 0) ? savedSeconds : exam.durasiMenit * 60;
      } else {
        _remainingSeconds = exam.durasiMenit * 60;
      }

      // 2. Load questions (offline encrypted cache first)
      final qList = await _repo.getExamQuestions(exam.id);
      _questions = qList;

      // 3. Load existing answers from local SQLite
      for (final q in qList) {
        final existing = await _repo.getAnswer(q.id);
        if (existing != null) {
          _answers[q.id] = existing;
        }
      }

      // 4. Listen to sync engine events
      _syncEngine.stateNotifier.addListener(_onSyncStateChanged);
      _syncEngine.start(siswaId: siswaId, ujianId: exam.id);

      _startTimer();
      _isLoading = false;
      notifyListeners();

      // Flush any answers that were queued offline previously
      _syncEngine.flush(siswaId: siswaId, ujianId: exam.id);
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
    }
  }

  void _onSyncStateChanged() {
    notifyListeners();
  }

  void _startTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        _remainingSeconds--;
        // Save checkpoint every 10 seconds
        if (_remainingSeconds % 10 == 0) {
          _local.saveExamSessionCheckpoint(exam.id, _remainingSeconds);
        }
        notifyListeners();
      } else {
        timer.cancel();
        submitExam();
      }
    });
  }

  Answer? getAnswerForQuestion(int soalId) => _answers[soalId];

  Future<void> selectOption(int soalId, int optionId) async {
    final current = _answers[soalId];
    final updated = Answer(
      id: current?.id,
      siswaId: siswaId,
      ujianId: exam.id,
      soalId: soalId,
      pilihanJawabanId: optionId,
      teksJawabanEssay: current?.teksJawabanEssay ?? '',
      isRagu: current?.isRagu ?? false,
      waktuDijawab: DateTime.now(),
      syncStatus: 'pending',
    );

    _answers[soalId] = updated;
    await _repo.saveAnswerLocally(updated);
    notifyListeners();

    // Trigger immediate outbox sync
    _syncEngine.flush(siswaId: siswaId, ujianId: exam.id);
  }

  Future<void> updateEssay(int soalId, String text) async {
    final current = _answers[soalId];
    final updated = Answer(
      id: current?.id,
      siswaId: siswaId,
      ujianId: exam.id,
      soalId: soalId,
      pilihanJawabanId: current?.pilihanJawabanId,
      teksJawabanEssay: text,
      isRagu: current?.isRagu ?? false,
      waktuDijawab: DateTime.now(),
      syncStatus: 'pending',
    );

    _answers[soalId] = updated;
    await _repo.saveAnswerLocally(updated);
    notifyListeners();

    // Trigger immediate outbox sync
    _syncEngine.flush(siswaId: siswaId, ujianId: exam.id);
  }

  Future<void> toggleDoubt(int soalId) async {
    final current = _answers[soalId];
    final bool newRagu = !(current?.isRagu ?? false);

    final updated = Answer(
      id: current?.id,
      siswaId: siswaId,
      ujianId: exam.id,
      soalId: soalId,
      pilihanJawabanId: current?.pilihanJawabanId,
      teksJawabanEssay: current?.teksJawabanEssay ?? '',
      isRagu: newRagu,
      waktuDijawab: DateTime.now(),
      syncStatus: 'pending',
    );

    _answers[soalId] = updated;
    await _repo.saveAnswerLocally(updated);
    notifyListeners();

    // Trigger immediate outbox sync
    _syncEngine.flush(siswaId: siswaId, ujianId: exam.id);
  }

  void jumpToQuestion(int index) {
    if (index >= 0 && index < _questions.length) {
      _currentIndex = index;
      notifyListeners();
    }
  }

  void nextQuestion() {
    if (hasNext) {
      _currentIndex++;
      notifyListeners();
    }
  }

  void prevQuestion() {
    if (hasPrev) {
      _currentIndex--;
      notifyListeners();
    }
  }

  String getQuestionStatus(int soalId) {
    final ans = _answers[soalId];
    if (ans == null) return 'unanswered';
    if (ans.isRagu) return 'doubtful';
    if (ans.isAnswered) return 'answered';
    return 'unanswered';
  }

  Future<ExamResult?> submitExam() async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    _countdownTimer?.cancel();

    try {
      // 1. Flush any pending answers first
      await _syncEngine.flush(siswaId: siswaId, ujianId: exam.id);

      // 2. Mark exam submitted locally
      await _local.markExamSubmitted(exam.id);

      // 3. Final submit to backend
      final result = await _repo.submitExam(siswaId, exam.id);

      _syncEngine.stop();
      _isSubmitting = false;
      notifyListeners();
      return result;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
      _isSubmitting = false;
      notifyListeners();
      return null;
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _syncEngine.stateNotifier.removeListener(_onSyncStateChanged);
    _syncEngine.stop();
    super.dispose();
  }
}
