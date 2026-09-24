import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/session_storage.dart';
import '../../domain/entities/student.dart';
import '../../domain/entities/exam.dart';
import '../../data/datasources/exam_remote_datasource.dart';
import '../../data/datasources/exam_local_datasource.dart';
import '../../data/repositories/exam_repository_impl.dart';
import '../state/dashboard_controller.dart';
import '../widgets/loading_indicator.dart';
import '../widgets/empty_state_widget.dart';
import '../widgets/error_state_widget.dart';
import 'login_page.dart';
import 'exam_page.dart';

class DashboardPage extends StatefulWidget {
  final Student? student;
  final Map<String, dynamic>? siswa; // Backwards-compatible fallback

  const DashboardPage({
    super.key,
    this.student,
    this.siswa,
  }) : assert(student != null || siswa != null, 'Either student or siswa must be provided');

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late Student _currentStudent;
  late DashboardController _controller;
  late ExamRepositoryImpl _examRepo;
  late ExamLocalDataSource _localDataSource;
  Map<String, dynamic>? _resumableExam;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _initStudentAndController();
  }

  void _initStudentAndController() async {
    // Resolve Student object
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
    _examRepo = ExamRepositoryImpl(remote: remote, local: _localDataSource);

    _controller = DashboardController(_examRepo);
    _controller.addListener(_onControllerChanged);

    // Check if there is an interrupted exam session that can be resumed
    final savedExam = await _localDataSource.getActiveIncompleteExam();

    if (mounted) {
      setState(() {
        _resumableExam = savedExam;
        _isInitialized = true;
      });
    }

    _loadData();
  }

  void _onControllerChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    if (_isInitialized) {
      _controller.removeListener(_onControllerChanged);
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    final savedExam = await _localDataSource.getActiveIncompleteExam();
    if (mounted) {
      setState(() {
        _resumableExam = savedExam;
      });
    }
    await _controller.loadExams(_currentStudent.kelasId, _currentStudent.id);
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: AppColors.danger),
            SizedBox(width: 8),
            Text(AppStrings.confirmLogout, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text(AppStrings.logoutConfirmMsg),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _localDataSource.clearAll();
      final session = await SessionStorage.init();
      await session.clearSession();
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const LoginPage()),
        );
      }
    }
  }

  void _resumeSavedSession() {
    if (_resumableExam == null) return;

    final exam = Exam(
      id: _resumableExam!['id'] as int,
      namaUjian: _resumableExam!['nama_ujian'].toString(),
      durasiMenit: _resumableExam!['durasi_menit'] as int? ?? 60,
      token: _resumableExam!['token'].toString(),
      status: _resumableExam!['status']?.toString() ?? 'aktif',
    );

    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (context) => ExamPage(
          exam: exam,
          student: _currentStudent,
        ),
      ),
    );
  }

  void _discardSavedSession() async {
    await _localDataSource.clearAll();
    await _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sesi ujian sebelumnya telah dibatalkan.'),
          backgroundColor: AppColors.textSecondary,
        ),
      );
    }
  }

  void _showTokenDialog(Exam exam) {
    final tokenController = TextEditingController();
    bool isVerifying = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            exam.namaUjian,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Masukkan token ujian 6 karakter yang diberikan oleh pengawas/guru untuk memulai pengerjaan.',
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 18),
              TextField(
                controller: tokenController,
                textAlign: TextAlign.center,
                textCapitalization: TextCapitalization.characters,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                  letterSpacing: 6,
                  color: AppColors.primary,
                ),
                decoration: InputDecoration(
                  labelText: 'TOKEN UJIAN',
                  hintText: 'INF123',
                  hintStyle: TextStyle(letterSpacing: 4, color: Colors.grey.shade400, fontSize: 18),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
            ),
            isVerifying
                ? const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2.5),
                    ),
                  )
                : ElevatedButton.icon(
                    icon: const Icon(Icons.play_arrow_rounded, size: 20),
                    label: const Text('MULAI UJIAN'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      final token = tokenController.text.trim().toUpperCase();
                      if (token.isEmpty) return;

                      setDialogState(() => isVerifying = true);
                      final verified = await _controller.verifyToken(exam.id, token);
                      setDialogState(() => isVerifying = false);

                      if (!ctx.mounted) return;
                      if (verified != null) {
                        Navigator.pop(ctx);
                        _startExamSession(exam);
                      } else {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(
                            content: const Row(
                              children: [
                                Icon(Icons.error_outline, color: Colors.white, size: 20),
                                SizedBox(width: 8),
                                Text('Token ujian salah atau sudah tidak berlaku!'),
                              ],
                            ),
                            backgroundColor: AppColors.danger,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        );
                      }
                    },
                  ),
          ],
        ),
      ),
    );
  }

  void _startExamSession(Exam exam) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(color: AppColors.primary),
                SizedBox(height: 16),
                Text('Menyiapkan soal ujian & basis data lokal...'),
              ],
            ),
          ),
        ),
      ),
    );

    try {
      final questions = await _examRepo.getExamQuestions(exam.id);
      if (!mounted) return;
      Navigator.pop(context); // Close loading modal

      if (questions.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tidak ada soal yang tersedia untuk ujian ini!'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ExamPage(
            exam: exam,
            student: _currentStudent,
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // Close loading modal
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal menyiapkan soal: ${e.toString().replaceFirst('Exception: ', '')}'),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _getInitial(String name) {
    if (name.isEmpty) return 'S';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.assignment_turned_in_rounded, size: 24, color: Colors.white),
            SizedBox(width: 8),
            Text(
              AppStrings.appName,
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5),
            ),
          ],
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Perbarui Data',
            onPressed: _loadData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: AppStrings.btnLogout,
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: Column(
          children: [
            // Student Profile Header Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryDark],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(28),
                  bottomRight: Radius.circular(28),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x332563EB),
                    blurRadius: 16,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withOpacity(0.4), width: 2),
                    ),
                    child: Center(
                      child: Text(
                        _getInitial(_currentStudent.nama),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _currentStudent.nama,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'NIS: ${_currentStudent.nis}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Kelas: ${_currentStudent.namaKelas}',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Interrupted Session Recovery Card (if any)
            if (_resumableExam != null)
              Container(
                margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFF59E0B)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.amber.withOpacity(0.1),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.history_toggle_off_rounded, color: Color(0xFFD97706), size: 22),
                        SizedBox(width: 8),
                        Text(
                          'Sesi Ujian Sedang Berjalan',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF92400E)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Ujian "${_resumableExam!['nama_ujian']}" belum selesai. Jawaban offline Anda tersimpan aman.',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF78350F)),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            icon: const Icon(Icons.play_circle_fill, size: 18),
                            label: const Text('LANJUTKAN UJIAN'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _resumeSavedSession,
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: _discardSavedSession,
                          child: const Text('Batalkan', style: TextStyle(color: Color(0xFF92400E))),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            // Main Content Area
            Expanded(
              child: _controller.isLoading
                  ? const LoadingIndicator(message: 'Memuat jadwal ujian...')
                  : _controller.errorMessage != null
                      ? ErrorStateWidget(
                          message: _controller.errorMessage!,
                          onRetry: _loadData,
                        )
                      : _controller.isEmpty
                          ? EmptyStateWidget(
                              title: AppStrings.noExamsAvailable,
                              description:
                                  'Belum ada sesi ujian yang dirilis untuk kelas Anda. Tarik layar ke bawah untuk memperbarui data.',
                              onAction: _loadData,
                              actionText: 'Perbarui Halaman',
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(20),
                              itemCount: _controller.exams.length,
                              itemBuilder: (context, index) {
                                final exam = _controller.exams[index];
                                return Container(
                                  margin: const EdgeInsets.only(bottom: 16),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: AppColors.border),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF0F172A).withOpacity(0.04),
                                        blurRadius: 12,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Expanded(
                                              child: Text(
                                                exam.namaUjian,
                                                style: const TextStyle(
                                                  fontSize: 17,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.textPrimary,
                                                  letterSpacing: -0.3,
                                                ),
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFECFDF5),
                                                borderRadius: BorderRadius.circular(20),
                                                border: Border.all(color: const Color(0xFFA7F3D0)),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  CircleAvatar(radius: 3, backgroundColor: AppColors.success),
                                                  SizedBox(width: 4),
                                                  Text(
                                                    'AKTIF',
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.w800,
                                                      color: Color(0xFF047857),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 12),
                                        Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF1F5F9),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Icon(Icons.timer_outlined, size: 14, color: AppColors.textSecondary),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    '${exam.durasiMenit} Menit',
                                                    style: const TextStyle(
                                                      color: AppColors.textPrimary,
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF1F5F9),
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                              child: const Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.assignment_outlined, size: 14, color: AppColors.textSecondary),
                                                  SizedBox(width: 4),
                                                  Text(
                                                    'PG & Essay',
                                                    style: TextStyle(
                                                      color: AppColors.textPrimary,
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 18),
                                        SizedBox(
                                          width: double.infinity,
                                          height: 46,
                                          child: ElevatedButton(
                                            onPressed: () => _showTokenDialog(exam),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: AppColors.primary,
                                              foregroundColor: Colors.white,
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(12),
                                              ),
                                              elevation: 2,
                                              shadowColor: AppColors.primary.withOpacity(0.3),
                                            ),
                                            child: const Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Text(
                                                  'IKUTI UJIAN',
                                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                                ),
                                                SizedBox(width: 6),
                                                Icon(Icons.arrow_forward_rounded, size: 18),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
