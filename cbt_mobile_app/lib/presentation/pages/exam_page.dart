import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/session_storage.dart';
import '../../core/sync/sync_engine.dart';
import '../../domain/entities/student.dart';
import '../../domain/entities/exam.dart';
import '../../domain/entities/exam_result.dart';
import '../../data/datasources/exam_remote_datasource.dart';
import '../../data/datasources/exam_local_datasource.dart';
import '../../data/repositories/exam_repository_impl.dart';
import '../state/exam_controller.dart';
import '../widgets/loading_indicator.dart';
import '../widgets/error_state_widget.dart';
import 'dashboard_page.dart';

class ExamPage extends StatefulWidget {
  final Exam? exam;
  final Student? student;
  final Map<String, dynamic>? ujian; // Backwards compatible
  final Map<String, dynamic>? siswa; // Backwards compatible

  const ExamPage({
    super.key,
    this.exam,
    this.student,
    this.ujian,
    this.siswa,
  }) : assert((exam != null || ujian != null) && (student != null || siswa != null),
            'Must provide either typed entities or map parameters');

  @override
  State<ExamPage> createState() => _ExamPageState();
}

class _ExamPageState extends State<ExamPage> {
  late Exam _currentExam;
  late Student _currentStudent;
  late ExamController _controller;
  late ExamLocalDataSource _localDataSource;
  late SyncEngine _syncEngine;
  final TextEditingController _essayController = TextEditingController();
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _initExamAndController();
  }

  void _initExamAndController() async {
    // Resolve Exam
    if (widget.exam != null) {
      _currentExam = widget.exam!;
    } else {
      final u = widget.ujian!;
      _currentExam = Exam(
        id: u['id'] is int ? u['id'] : int.tryParse(u['id'].toString()) ?? 0,
        namaUjian: u['nama_ujian']?.toString() ?? 'Ujian',
        durasiMenit: u['durasi_menit'] is int
            ? u['durasi_menit']
            : int.tryParse(u['durasi_menit']?.toString() ?? '60') ?? 60,
        token: u['token']?.toString() ?? '',
        status: u['status']?.toString() ?? 'aktif',
      );
    }

    // Resolve Student
    if (widget.student != null) {
      _currentStudent = widget.student!;
    } else {
      final s = widget.siswa!;
      _currentStudent = Student(
        id: s['id'] is int ? s['id'] : int.tryParse(s['id'].toString()) ?? 0,
        nama: s['nama']?.toString() ?? 'Siswa',
        nis: s['nis']?.toString() ?? '-',
        kelasId: s['kelas_id'] is int ? s['kelas_id'] : int.tryParse(s['kelas_id']?.toString() ?? '0') ?? 0,
        namaKelas: s['nama_kelas']?.toString() ?? '-',
        username: s['username']?.toString() ?? '',
      );
    }

    final session = await SessionStorage.init();
    final client = ApiClient(session: session);
    final remote = ExamRemoteDataSource(client);
    _localDataSource = ExamLocalDataSource();
    final repo = ExamRepositoryImpl(remote: remote, local: _localDataSource);

    _syncEngine = SyncEngine(
      local: _localDataSource,
      remote: remote,
      client: client,
    );

    _controller = ExamController(
      repo: repo,
      local: _localDataSource,
      syncEngine: _syncEngine,
      exam: _currentExam,
      siswaId: _currentStudent.id,
    );

    _controller.addListener(_onControllerChanged);
    await _controller.initExam();

    _updateEssayController();

    if (mounted) {
      setState(() => _isInitialized = true);
    }
  }

  void _onControllerChanged() {
    _updateEssayController();
    if (mounted) setState(() {});
  }

  void _updateEssayController() {
    final currentQ = _controller.currentQuestion;
    if (currentQ != null && currentQ.isEssay) {
      final ans = _controller.getAnswerForQuestion(currentQ.id);
      final text = ans?.teksJawabanEssay ?? '';
      if (_essayController.text != text) {
        _essayController.value = TextEditingValue(
          text: text,
          selection: TextSelection.collapsed(offset: text.length),
        );
      }
    }
  }

  @override
  void dispose() {
    _essayController.dispose();
    if (_isInitialized) {
      _controller.removeListener(_onControllerChanged);
      _controller.dispose();
    }
    super.dispose();
  }

  void _showExitConfirmationDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tinggalkan Ujian?'),
        content: const Text(
          'Ujian masih berlangsung. Seluruh progres dan lembar jawaban tersimpan aman di basis data lokal terenkripsi, dan dapat dilanjutkan nanti.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _exitExam(keepSession: true);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Simpan & Keluar'),
          ),
        ],
      ),
    );
  }

  void _confirmFinishExam() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Konfirmasi Selesai'),
        content: const Text(
          'Apakah Anda yakin ingin mengakhiri ujian? Semua jawaban Anda akan disinkronisasikan dan disimpan secara permanen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _handleFinalSubmit();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            child: const Text('Ya, Selesai'),
          ),
        ],
      ),
    );
  }

  void _handleFinalSubmit() async {
    final result = await _controller.submitExam();
    if (!mounted) return;

    if (result != null) {
      _showResultDialog(result);
    } else {
      _exitExam(keepSession: false);
    }
  }

  void _showResultDialog(ExamResult result) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_outline, color: AppColors.success, size: 28),
            SizedBox(width: 8),
            Text(AppStrings.examFinished, style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  const Text('Skor Pilihan Ganda', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text(
                    '${result.nilaiAkhir}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 32, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Column(
                  children: [
                    const Text('Benar PG', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    const SizedBox(height: 4),
                    Text('${result.jumlahBenar}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.success)),
                  ],
                ),
                Column(
                  children: [
                    const Text('Salah PG', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    const SizedBox(height: 4),
                    Text('${result.jumlahSalah}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.danger)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text(
              '*Skor akhir akan digabungkan setelah guru selesai memberikan penilaian untuk soal Essay.',
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _exitExam(keepSession: false);
              },
              child: const Text('Kembali ke Beranda'),
            ),
          ),
        ],
      ),
    );
  }

  void _exitExam({bool keepSession = false}) async {
    if (!keepSession) {
      await _localDataSource.clearAll();
    }
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => DashboardPage(student: _currentStudent),
        ),
      );
    }
  }

  Widget _buildSyncStatusChip() {
    switch (_controller.syncState) {
      case SyncState.syncing:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
            ),
            SizedBox(width: 6),
            Text('Menyimpan...', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600)),
          ],
        );
      case SyncState.synced:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_done_rounded, size: 14, color: AppColors.success),
            SizedBox(width: 4),
            Text('Tersinkron', style: TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600)),
          ],
        );
      case SyncState.offline:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded, size: 14, color: AppColors.warning),
            SizedBox(width: 4),
            Text('Offline (Tersimpan Lokal)',
                style: TextStyle(fontSize: 11, color: AppColors.warning, fontWeight: FontWeight.w600)),
          ],
        );
      case SyncState.error:
        return const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.sync_problem_rounded, size: 14, color: AppColors.danger),
            SizedBox(width: 4),
            Text('Menunggu Sinyal...',
                style: TextStyle(fontSize: 11, color: AppColors.danger, fontWeight: FontWeight.w600)),
          ],
        );
      case SyncState.idle:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _controller.isLoading) {
      return const Scaffold(
        body: LoadingIndicator(message: 'Menyiapkan lembar ujian...'),
      );
    }

    if (_controller.errorMessage != null && _controller.questions.isEmpty) {
      return Scaffold(
        body: ErrorStateWidget(
          message: _controller.errorMessage!,
          onRetry: () => _controller.initExam(),
        ),
      );
    }

    final q = _controller.currentQuestion;
    if (q == null) {
      return const Scaffold(
        body: Center(child: Text('Tidak ada soal.')),
      );
    }

    final currentAnswer = _controller.getAnswerForQuestion(q.id);
    final selectedOptionId = currentAnswer?.pilihanJawabanId;
    final isRagu = currentAnswer?.isRagu ?? false;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _showExitConfirmationDialog();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          title: Text('Soal ${_controller.currentIndex + 1} dari ${_controller.totalQuestions}'),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          actions: [
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 15.0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.red.shade100,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.timer_outlined, size: 14, color: AppColors.danger),
                      const SizedBox(width: 4),
                      Text(
                        _controller.formattedRemainingTime,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.danger, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        drawer: Drawer(
          child: Column(
            children: [
              const DrawerHeader(
                decoration: BoxDecoration(color: AppColors.primary),
                child: Center(
                  child: Text(
                    'Navigasi Soal',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildLegendItem(AppColors.primary, 'Aktif'),
                    _buildLegendItem(AppColors.success, 'Dijawab'),
                    _buildLegendItem(AppColors.doubtful, 'Ragu'),
                    _buildLegendItem(Colors.grey.shade400, 'Belum'),
                  ],
                ),
              ),
              const Divider(),
              Expanded(
                child: GridView.builder(
                  padding: const EdgeInsets.all(15),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                  ),
                  itemCount: _controller.totalQuestions,
                  itemBuilder: (context, index) {
                    final itemSoal = _controller.questions[index];
                    final isCurrent = index == _controller.currentIndex;
                    final status = _controller.getQuestionStatus(itemSoal.id);

                    Color bgColor = Colors.white;
                    Color fgColor = AppColors.textPrimary;

                    if (isCurrent) {
                      bgColor = AppColors.primary;
                      fgColor = Colors.white;
                    } else if (status == 'doubtful') {
                      bgColor = AppColors.doubtful;
                      fgColor = Colors.white;
                    } else if (status == 'answered') {
                      bgColor = AppColors.success;
                      fgColor = Colors.white;
                    }

                    return ElevatedButton(
                      onPressed: () {
                        _controller.jumpToQuestion(index);
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: bgColor,
                        foregroundColor: fgColor,
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: AppColors.border),
                        ),
                      ),
                      child: Text(
                        '${index + 1}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        body: Column(
          children: [
            // Sub-status bar with live sync indicator
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: Colors.white,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Tipe: ${q.jenisSoal}',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                  _buildSyncStatusChip(),
                  Text('Bobot: ${q.bobot}',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                ],
              ),
            ),

            // Area Soal & Opsi
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Question Box
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        q.teksSoal,
                        style: const TextStyle(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Multiple Choice Options or Essay Input
                    if (q.isMultipleChoice)
                      Column(
                        children: q.pilihan.map((opt) {
                          final isSelected = selectedOptionId == opt.id;
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primaryLight : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: ListTile(
                              leading: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: isSelected ? AppColors.primary : const Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    opt.label,
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : AppColors.textPrimary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                              title: Text(opt.teksPilihan),
                              onTap: () {
                                _controller.selectOption(q.id, opt.id);
                              },
                            ),
                          );
                        }).toList(),
                      )
                    else
                      TextField(
                        controller: _essayController,
                        maxLines: 6,
                        decoration: InputDecoration(
                          hintText: 'Ketikkan jawaban Anda disini...',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                        onChanged: (val) {
                          _controller.updateEssay(q.id, val);
                        },
                      ),
                  ],
                ),
              ),
            ),

            // Bottom Navigation Controls
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton(
                    onPressed: _controller.hasPrev ? () => _controller.prevQuestion() : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      elevation: 0,
                    ),
                    child: const Text('Sebelum'),
                  ),
                  Row(
                    children: [
                      Checkbox(
                        value: isRagu,
                        activeColor: AppColors.doubtful,
                        onChanged: (_) {
                          _controller.toggleDoubt(q.id);
                        },
                      ),
                      const Text(
                        'Ragu-ragu',
                        style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.doubtful),
                      ),
                    ],
                  ),
                  ElevatedButton(
                    onPressed: _controller.hasNext
                        ? () => _controller.nextQuestion()
                        : () => _confirmFinishExam(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                    ),
                    child: Text(_controller.hasNext ? 'Lanjut' : 'Selesai'),
                  ),
                ],
              ),
            ),

            // Open Question Grid Button
            Builder(
              builder: (ctx) => Container(
                width: double.infinity,
                color: const Color(0xFFF1F5F9),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: ElevatedButton.icon(
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                  icon: const Icon(Icons.grid_on),
                  label: const Text('Buka Panel Nomor Soal'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.textPrimary,
                    elevation: 0,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ],
    );
  }
}
