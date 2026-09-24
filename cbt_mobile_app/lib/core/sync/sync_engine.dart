import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../data/datasources/exam_local_datasource.dart';
import '../../data/datasources/exam_remote_datasource.dart';
import '../../core/network/api_client.dart';
import '../../data/models/answer_model.dart';

enum SyncState {
  idle,
  syncing,
  synced,
  offline,
  error,
}

class SyncReport {
  final bool success;
  final int syncedCount;
  final String? errorMessage;
  final bool isOffline;

  const SyncReport({
    required this.success,
    this.syncedCount = 0,
    this.errorMessage,
    this.isOffline = false,
  });
}

class SyncEngine {
  final ExamLocalDataSource _local;
  final ExamRemoteDataSource _remote;
  final ApiClient _client;

  SyncEngine({
    required ExamLocalDataSource local,
    required ExamRemoteDataSource remote,
    required ApiClient client,
  })  : _local = local,
        _remote = remote,
        _client = client;

  final ValueNotifier<SyncState> stateNotifier = ValueNotifier<SyncState>(SyncState.idle);
  SyncState get currentState => stateNotifier.value;

  Timer? _periodicTimer;
  Timer? _backoffTimer;

  bool _isSyncRunning = false;
  int _consecutiveFailures = 0;
  static const int _baseDelayMs = 2000;
  static const int _maxDelayMs = 15000;

  int? _activeSiswaId;
  int? _activeUjianId;

  /// Start periodic synchronization (default every 15 seconds)
  void start({required int siswaId, required int ujianId, Duration interval = const Duration(seconds: 15)}) {
    _activeSiswaId = siswaId;
    _activeUjianId = ujianId;
    _periodicTimer?.cancel();
    _periodicTimer = Timer.periodic(interval, (_) => flush());
  }

  /// Stop background synchronization
  void stop() {
    _periodicTimer?.cancel();
    _backoffTimer?.cancel();
    _periodicTimer = null;
    _backoffTimer = null;
    stateNotifier.value = SyncState.idle;
  }

  /// Check connectivity to CBT server with short timeout
  Future<bool> checkConnectivity() async {
    try {
      final res = await _client.get('/health').timeout(const Duration(seconds: 3));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Flush pending outbox answers immediately with conflict resolution and exponential backoff
  Future<SyncReport> flush({int? siswaId, int? ujianId}) async {
    final sId = siswaId ?? _activeSiswaId;
    final uId = ujianId ?? _activeUjianId;

    if (sId == null || uId == null) {
      return const SyncReport(success: false, errorMessage: 'No active exam context for sync');
    }

    if (_isSyncRunning) {
      return const SyncReport(success: false, errorMessage: 'Sync already in progress');
    }

    _isSyncRunning = true;
    List<AnswerModel> pending = [];

    try {
      // 1. Retrieve all pending & previously failed answers
      pending = await _local.getUnsyncedAnswers();
      if (pending.isEmpty) {
        stateNotifier.value = SyncState.synced;
        _isSyncRunning = false;
        return const SyncReport(success: true, syncedCount: 0);
      }

      stateNotifier.value = SyncState.syncing;

      // 2. Mark queue items as 'syncing' locally to prevent duplicates
      await _local.markAnswersSyncing(pending);

      // 3. Test connectivity before transmission
      final isOnline = await checkConnectivity();
      if (!isOnline) {
        // Revert back to failed state and schedule backoff retry
        await _local.markAnswersSyncFailed(pending);
        stateNotifier.value = SyncState.offline;
        _scheduleBackoffRetry(sId, uId);
        _isSyncRunning = false;
        return const SyncReport(
          success: false,
          isOffline: true,
          errorMessage: 'Server tidak terjangkau (Offline)',
        );
      }

      // 4. Send outbox payload to server
      final isSuccess = await _remote.syncAnswers(sId, uId, pending);

      if (isSuccess) {
        // 5. Update local database state to 'synced'
        await _local.markAnswersAsSynced(pending);
        _consecutiveFailures = 0;
        stateNotifier.value = SyncState.synced;
        _isSyncRunning = false;
        return SyncReport(success: true, syncedCount: pending.length);
      } else {
        await _local.markAnswersSyncFailed(pending);
        stateNotifier.value = SyncState.error;
        _scheduleBackoffRetry(sId, uId);
        _isSyncRunning = false;
        return const SyncReport(success: false, errorMessage: 'Server menolak sinkronisasi');
      }
    } catch (e) {
      if (pending.isNotEmpty) {
        await _local.markAnswersSyncFailed(pending);
      }
      stateNotifier.value = SyncState.error;
      _scheduleBackoffRetry(sId, uId);
      _isSyncRunning = false;
      return SyncReport(success: false, errorMessage: e.toString());
    }
  }

  void _scheduleBackoffRetry(int siswaId, int ujianId) {
    _backoffTimer?.cancel();
    _consecutiveFailures++;

    // Exponential backoff: 2s, 4s, 8s, up to 15s max
    int delay = _baseDelayMs * (1 << (_consecutiveFailures - 1));
    if (delay > _maxDelayMs) delay = _maxDelayMs;

    _backoffTimer = Timer(Duration(milliseconds: delay), () {
      flush(siswaId: siswaId, ujianId: ujianId);
    });
  }

  void dispose() {
    stop();
    stateNotifier.dispose();
  }
}
