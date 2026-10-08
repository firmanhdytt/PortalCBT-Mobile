import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../../core/constants/api_endpoints.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/session_storage.dart';
import '../../core/utils/type_parser.dart';
import '../../domain/entities/student.dart';
import '../../domain/entities/exam.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/entities/user_preference.dart';
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
  UserProfile? _userProfile;
  int _unreadNotifCount = 0;
  UserPreference? _userPreference;
  List<AppNotification> _notificationsList = [];
  bool _isInitialized = false;
  int _currentBottomIndex = 0; // 0: Ujian, 1: Kartu Ujian, 2: Sertifikat, 3: Notifikasi, 4: Profil

  @override
  void initState() {
    super.initState();
    _initStudentAndController();
  }

  void _initStudentAndController() async {
    if (widget.student != null) {
      _currentStudent = widget.student!;
    } else {
      final s = widget.siswa!;
      _currentStudent = Student(
        id: s['id'] is int ? s['id'] : int.tryParse(s['id']?.toString() ?? '0') ?? 0,
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
    try {
      final p = await _examRepo.getProfile();
      if (mounted) {
        setState(() {
          _userProfile = p;
        });
      }
    } catch (_) {}
    try {
      final unread = await _examRepo.getUnreadNotificationCount();
      final pref = await _examRepo.getUserPreferences();
      final notifs = await _examRepo.getNotifications();
      if (mounted) {
        setState(() {
          _unreadNotifCount = unread;
          _userPreference = pref;
          _notificationsList = notifs;
        });
      }
    } catch (_) {}
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
      id: TypeParser.parseIntOr(_resumableExam!['id'], 0),
      namaUjian: _resumableExam!['nama_ujian']?.toString() ?? '',
      durasiMenit: TypeParser.parseIntOr(_resumableExam!['durasi_menit'], 60),
      token: _resumableExam!['token']?.toString() ?? '',
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
                                Expanded(child: Text('Token ujian salah atau sudah tidak berlaku!')),
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
      Navigator.pop(context);
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

  Widget _buildAvatarWidget({double size = 52, double fontSize = 20}) {
    if (_userProfile != null && _userProfile!.hasAvatar) {
      final avatarUrl = _userProfile!.avatar!;
      final fullUrl = avatarUrl.startsWith('http')
          ? avatarUrl
          : 'http://${ApiEndpoints.defaultHost}$avatarUrl';
      return Image.network(
        fullUrl,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, stack) => Center(
          child: Text(
            _userProfile?.fallbackInitial ?? _getInitial(_currentStudent.nama),
            style: TextStyle(color: Colors.white, fontSize: fontSize, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }
    return Center(
      child: Text(
        _userProfile?.fallbackInitial ?? _getInitial(_currentStudent.nama),
        style: TextStyle(color: Colors.white, fontSize: fontSize, fontWeight: FontWeight.bold),
      ),
    );
  }

  // --- PHOTO UPLOAD MODAL FEATURE ---
  void _showUploadAvatarDialog() {
    String? selectedBase64;
    String? previewDataUrl;
    bool isUploading = false;
    String? errorMessage;

    // Sample high-resolution character preset avatar base64 data URLs
    final List<Map<String, String>> presets = [
      {
        'title': 'Siswa L',
        'data': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAG1JREFUeNrs2CEOgDAUBVD2/odmVZ2gKCwI/mKSuWbNms3X9v7Y67Fvn9eN58/j4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pz/wd4BwBsG2uW6BfKygAAAABJRU5ErkJggg=='
      },
      {
        'title': 'Siswa P',
        'data': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAG1JREFUeNrs2CEKACAMBVD3/od2c4Ki0CD4CybNmnXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr1q1bt27dunXr/wd4BwB3wWteYl2eJAAAAABJRU5ErkJggg=='
      },
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.add_a_photo_rounded, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Unggah Foto Profil', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Pilih foto karakter preset atau masukkan data gambar avatar profil Anda:',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),

                // Preview Avatar
                Center(
                  child: Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 3),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.2),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: previewDataUrl != null
                        ? Image.memory(
                            base64Decode(previewDataUrl!.split(',').last),
                            fit: BoxFit.cover,
                          )
                        : _buildAvatarWidget(size: 88, fontSize: 32),
                  ),
                ),
                const SizedBox(height: 16),

                if (errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Text(
                      errorMessage!,
                      style: const TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),

                const Text('Pilih Karakter Preset Avatar:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 10),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: presets.map((p) {
                    final isSel = selectedBase64 == p['data'];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: InkWell(
                        onTap: () {
                          setDialogState(() {
                            selectedBase64 = p['data'];
                            previewDataUrl = p['data'];
                            errorMessage = null;
                          });
                        },
                        borderRadius: BorderRadius.circular(30),
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isSel ? AppColors.primary : Colors.grey.shade300,
                              width: isSel ? 3 : 1,
                            ),
                          ),
                          child: CircleAvatar(
                            radius: 22,
                            backgroundColor: AppColors.primaryLight,
                            child: Text(p['title']!, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),

                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),

                // Custom Base64 Image String Input Dialog
                OutlinedButton.icon(
                  icon: const Icon(Icons.code_rounded, size: 18),
                  label: const Text('Input Berkas / Base64 Kustom'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 42),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    _showCustomBase64InputDialog((inputVal) {
                      setDialogState(() {
                        selectedBase64 = inputVal;
                        previewDataUrl = inputVal;
                        errorMessage = null;
                      });
                    });
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: (selectedBase64 == null || isUploading)
                  ? null
                  : () async {
                      setDialogState(() => isUploading = true);
                      try {
                        await _examRepo.uploadAvatar(selectedBase64!);
                        await _loadData();
                        if (mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Foto profil berhasil diunggah!'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (err) {
                        setDialogState(() {
                          isUploading = false;
                          errorMessage = err.toString().replaceAll('Exception: ', '');
                        });
                      }
                    },
              child: isUploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Simpan Foto'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCustomBase64InputDialog(Function(String) onConfirm) {
    final textCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Input Data Base64 / Data URL', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: textCtrl,
          maxLines: 4,
          style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
          decoration: InputDecoration(
            hintText: 'Tempelkan data:image/png;base64,... disini',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () {
              final v = textCtrl.text.trim();
              if (v.isNotEmpty) {
                onConfirm(v);
                Navigator.pop(ctx);
              }
            },
            child: const Text('Gunakan'),
          ),
        ],
      ),
    );
  }

  // --- DELETE NOTIFICATION FEATURE ---
  Future<void> _deleteNotification(int id) async {
    try {
      final ok = await _examRepo.deleteNotification(id);
      if (ok) {
        final unread = await _examRepo.getUnreadNotificationCount();
        final updatedList = await _examRepo.getNotifications();
        if (mounted) {
          setState(() {
            _unreadNotifCount = unread;
            _notificationsList = updatedList;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Notifikasi berhasil dihapus.'),
              backgroundColor: AppColors.success,
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal menghapus notifikasi: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  Future<void> _deleteAllReadNotifications() async {
    final readList = _notificationsList.where((n) => n.isRead).toList();
    if (readList.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tidak ada notifikasi terbaca untuk dihapus.'),
          backgroundColor: AppColors.textSecondary,
        ),
      );
      return;
    }

    int count = 0;
    for (final n in readList) {
      try {
        final ok = await _examRepo.deleteNotification(n.id);
        if (ok) count++;
      } catch (_) {}
    }

    final unread = await _examRepo.getUnreadNotificationCount();
    final updatedList = await _examRepo.getNotifications();
    if (mounted) {
      setState(() {
        _unreadNotifCount = unread;
        _notificationsList = updatedList;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$count notifikasi terbaca berhasil dihapus.'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  void _showChangePasswordDialog() {
    final curCtrl = TextEditingController();
    final newCtrl = TextEditingController();
    final confCtrl = TextEditingController();
    bool isLoading = false;
    String? errorText;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Row(
            children: [
              Icon(Icons.vpn_key_rounded, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Ganti Kata Sandi', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (errorText != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Text(
                      errorText!,
                      style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ),
                TextField(
                  controller: curCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Password Saat Ini',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: newCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Password Baru (min 6 karakter)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Konfirmasi Password Baru',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: isLoading
                  ? null
                  : () async {
                      final cur = curCtrl.text.trim();
                      final neu = newCtrl.text.trim();
                      final conf = confCtrl.text.trim();

                      if (cur.isEmpty || neu.isEmpty) {
                        setDialogState(() => errorText = 'Semua kolom kata sandi wajib diisi!');
                        return;
                      }
                      if (neu.length < 6) {
                        setDialogState(() => errorText = 'Kata sandi baru minimal 6 karakter!');
                        return;
                      }
                      if (neu != conf) {
                        setDialogState(() => errorText = 'Konfirmasi kata sandi tidak cocok!');
                        return;
                      }

                      setDialogState(() {
                        isLoading = true;
                        errorText = null;
                      });

                      final nav = Navigator.of(ctx);
                      final messenger = ScaffoldMessenger.of(context);

                      try {
                        final success = await _examRepo.changePassword(
                          currentPassword: cur,
                          newPassword: neu,
                        );
                        if (success) {
                          if (mounted) {
                            nav.pop();
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Kata sandi berhasil diperbarui!'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          }
                        } else {
                          setDialogState(() {
                            isLoading = false;
                            errorText = 'Gagal mengubah kata sandi.';
                          });
                        }
                      } catch (err) {
                        setDialogState(() {
                          isLoading = false;
                          errorText = err.toString().replaceAll('Exception: ', '');
                        });
                      }
                    },
              child: isLoading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
  }

  void _showThemePreferencesDialog() {
    String currentTheme = _userPreference?.theme ?? 'system';
    bool highContrast = _userPreference?.highContrast ?? false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.palette_outlined, color: AppColors.primary),
              SizedBox(width: 8),
              Text('Tema & Tampilan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<String>(
                title: const Text('☀️ Mode Terang (Light)'),
                value: 'light',
                groupValue: currentTheme,
                onChanged: (val) => setDialogState(() => currentTheme = val!),
              ),
              RadioListTile<String>(
                title: const Text('🌙 Mode Gelap (Dark)'),
                value: 'dark',
                groupValue: currentTheme,
                onChanged: (val) => setDialogState(() => currentTheme = val!),
              ),
              RadioListTile<String>(
                title: const Text('💻 Mengikuti Sistem (System)'),
                value: 'system',
                groupValue: currentTheme,
                onChanged: (val) => setDialogState(() => currentTheme = val!),
              ),
              const Divider(),
              SwitchListTile(
                title: const Text('👁️ Kontras Tinggi'),
                subtitle: const Text('Perjelas garis tepi dan ketebalan teks', style: TextStyle(fontSize: 11)),
                value: highContrast,
                onChanged: (val) => setDialogState(() => highContrast = val),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () async {
                try {
                  final updated = await _examRepo.updateUserPreferences(
                    theme: currentTheme,
                    highContrast: highContrast,
                  );
                  if (mounted) {
                    setState(() {
                      _userPreference = updated;
                    });
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Preferensi tampilan berhasil disimpan!'),
                        backgroundColor: AppColors.success,
                      ),
                    );
                  }
                } catch (_) {}
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
  }

  // --- TAB 0: BERANDA UJIAN (HOME EXAMS) ---
  Widget _buildHomeExamsTab() {
    return RefreshIndicator(
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
                InkWell(
                  onTap: () => setState(() => _currentBottomIndex = 4),
                  borderRadius: BorderRadius.circular(26),
                  child: Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white.withOpacity(0.5), width: 2),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _buildAvatarWidget(),
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
                      // Scrollable Row for NIS and Kelas to completely avoid overflow
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
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
                      ),
                      const SizedBox(height: 10),
                      // Scrollable Action Buttons Row to completely avoid overflow on any mobile screen
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            InkWell(
                              onTap: () => setState(() => _currentBottomIndex = 1),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.1),
                                      blurRadius: 4,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.badge_rounded, size: 14, color: AppColors.primary),
                                    SizedBox(width: 4),
                                    Text(
                                      'Kartu Ujian',
                                      style: TextStyle(
                                        color: AppColors.primary,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => setState(() => _currentBottomIndex = 2),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.white.withOpacity(0.4)),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.workspace_premium_rounded, size: 14, color: Colors.white),
                                    SizedBox(width: 4),
                                    Text(
                                      'Sertifikat',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () => setState(() => _currentBottomIndex = 4),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.2),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.white.withOpacity(0.4)),
                                ),
                                child: const Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.manage_accounts_rounded, size: 14, color: Colors.white),
                                    SizedBox(width: 4),
                                    Text(
                                      'Profil',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
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
    );
  }

  // --- TAB 1: KARTU PESERTA UJIAN (STUDENT EXAM CARD) ---
  Widget _buildStudentCardTab() {
    final card = _controller.studentCard;

    if (_controller.isLoadingCard) {
      return const LoadingIndicator(message: 'Memuat Kartu Peserta Ujian...');
    }

    if (card == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.badge_outlined, size: 64, color: Colors.grey),
              const SizedBox(height: 16),
              const Text('Kartu Ujian Belum Tersedia', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              const Text('Ketuk tombol di bawah untuk memuat kartu ujian dari server.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Muat Kartu Ujian'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () => _controller.loadStudentCard(),
              ),
            ],
          ),
        ),
      );
    }

    Widget qrWidget;
    try {
      final base64String = card.qrDataUrl.contains(',')
          ? card.qrDataUrl.split(',').last
          : card.qrDataUrl;
      final bytes = base64Decode(base64String);
      qrWidget = Image.memory(bytes, width: 120, height: 120, fit: BoxFit.contain);
    } catch (_) {
      qrWidget = Container(
        width: 120,
        height: 120,
        color: const Color(0xFFF1F5F9),
        child: const Icon(Icons.qr_code_2_rounded, size: 64, color: AppColors.primary),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Card Box Container
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 1.5),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // School Header
                Container(
                  padding: const EdgeInsets.all(16),
                  color: AppColors.primary,
                  child: Row(
                    children: [
                      const CircleAvatar(
                        backgroundColor: Colors.white,
                        radius: 20,
                        child: Icon(Icons.school_rounded, color: AppColors.primary, size: 24),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'KARTU PESERTA CBT RESMI',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 0.5),
                            ),
                            Text(
                              'TAHUN AJARAN ${card.tahunAjaran}',
                              style: const TextStyle(color: Colors.white70, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      // QR & Student Info
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: qrWidget,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.primaryLight,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    card.noPeserta,
                                    style: const TextStyle(
                                      fontFamily: 'monospace',
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                      color: AppColors.primary,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  card.nama,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text('NIS: ${card.nis}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                Text('Kelas: ${card.kelas}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                Text('Lokasi: ${card.ruang} / ${card.sesi}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primaryDark)),
                              ],
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),
                      const Divider(),
                      const SizedBox(height: 12),

                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Jadwal Ujian Terdaftar:',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                        ),
                      ),
                      const SizedBox(height: 10),

                      if (card.jadwalUjian.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text('Tidak ada jadwal ujian aktif.', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.grey)),
                        )
                      else
                        ...card.jadwalUjian.map((ex) => Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(ex.namaMapel, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                        Text(ex.namaUjian, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryLight,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      '${ex.durasiMenit} Menit',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                                    ),
                                  ),
                                ],
                              ),
                            )),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- TAB 2: SERTIFIKAT DIGITAL (DIGITAL CERTIFICATES) ---
  Widget _buildCertificatesTab() {
    final certs = _controller.certificates;

    if (_controller.isLoadingCerts) {
      return const LoadingIndicator(message: 'Memuat Sertifikat Kompetensi Digital...');
    }

    if (certs.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.workspace_premium_outlined, size: 72, color: Colors.grey),
              const SizedBox(height: 16),
              const Text('Belum Ada Sertifikat Kelulusan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 8),
              const Text(
                'Sertifikat kompetensi digital akan diterbitkan secara otomatis setelah Anda dinyatakan LULUS ujian oleh guru pengampu.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Muat Ulang'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                onPressed: () => _controller.loadCertificates(),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: certs.length,
      itemBuilder: (context, idx) {
        final c = certs[idx];
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF86EFAC), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.green.withOpacity(0.06),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      c.certificateNumber,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: Color(0xFF15803D),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Skor Akhir: ${c.nilaiAkhir}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: Color(0xFF15803D),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                c.namaMapel,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
              ),
              Text(
                c.namaUjian,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_rounded, color: Color(0xFF166534), size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Status: ${c.statusKelulusan} (Batas KKM ${c.kkm})',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF166534), fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // --- TAB 3: PUSAT NOTIFIKASI & FITUR HAPUS (NOTIFICATIONS & DELETE) ---
  Widget _buildNotificationsTab() {
    return Column(
      children: [
        // Action Bar Top
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          color: Colors.white,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total: ${_notificationsList.length} Notifikasi',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
              ),
              Row(
                children: [
                  TextButton.icon(
                    icon: const Icon(Icons.done_all_rounded, size: 16),
                    label: const Text('Tandai Dibaca', style: TextStyle(fontSize: 11)),
                    onPressed: () async {
                      try {
                        await _examRepo.markAllNotificationsAsRead();
                        _loadData();
                      } catch (_) {}
                    },
                  ),
                  TextButton.icon(
                    icon: const Icon(Icons.delete_sweep_rounded, size: 16, color: AppColors.danger),
                    label: const Text('Hapus Dibaca', style: TextStyle(fontSize: 11, color: AppColors.danger)),
                    onPressed: _deleteAllReadNotifications,
                  ),
                ],
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // Notifications List
        Expanded(
          child: _notificationsList.isEmpty
              ? const EmptyStateWidget(
                  title: 'Tidak Ada Notifikasi',
                  description: 'Pemberitahuan hasil ujian dan pengumuman akan muncul di sini.',
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: _notificationsList.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, idx) {
                    final notif = _notificationsList[idx];
                    IconData icon;
                    Color iconColor;
                    switch (notif.type) {
                      case 'success':
                        icon = Icons.check_circle_rounded;
                        iconColor = AppColors.success;
                        break;
                      case 'warning':
                        icon = Icons.warning_rounded;
                        iconColor = AppColors.warning;
                        break;
                      case 'danger':
                        icon = Icons.error_rounded;
                        iconColor = AppColors.danger;
                        break;
                      case 'info':
                      default:
                        icon = Icons.info_rounded;
                        iconColor = AppColors.primary;
                    }

                    return ListTile(
                      tileColor: notif.isRead ? Colors.transparent : AppColors.primary.withOpacity(0.05),
                      leading: CircleAvatar(
                        backgroundColor: iconColor.withOpacity(0.12),
                        child: Icon(icon, color: iconColor, size: 22),
                      ),
                      title: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              notif.title,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: notif.isRead ? FontWeight.normal : FontWeight.bold,
                              ),
                            ),
                          ),
                          if (!notif.isRead)
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(left: 6),
                              decoration: const BoxDecoration(
                                color: AppColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(notif.message, style: const TextStyle(fontSize: 12)),
                          const SizedBox(height: 4),
                          if (notif.createdAt != null)
                            Text(
                              notif.createdAt!,
                              style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                            ),
                        ],
                      ),
                      // Individual Delete Notification Icon
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, color: Colors.grey, size: 20),
                        tooltip: 'Hapus Notifikasi',
                        onPressed: () => _deleteNotification(notif.id),
                      ),
                      onTap: () async {
                        if (!notif.isRead) {
                          await _examRepo.markNotificationAsRead(notif.id);
                          _loadData();
                        }
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }

  // --- TAB 4: PROFIL SISWA & UPLOAD FOTO PROFIL (PROFILE & AVATAR UPLOAD) ---
  Widget _buildProfileTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          // Large Profile Card Header
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                // Avatar with Camera Icon Overlay
                Stack(
                  children: [
                    Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 3),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withOpacity(0.2),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: _buildAvatarWidget(size: 90, fontSize: 34),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: InkWell(
                        onTap: _showUploadAvatarDialog,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  _userProfile?.nama ?? _currentStudent.nama,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  'NIS: ${_userProfile?.nis ?? _currentStudent.nis} • Kelas: ${_userProfile?.namaKelas ?? _currentStudent.namaKelas}',
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                if (_userProfile?.email != null && _userProfile!.email.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _userProfile!.email,
                    style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600),
                  ),
                ],
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 12),

                // Upload & Remove Photo Buttons
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.upload_rounded, size: 18),
                        label: const Text('Unggah Foto'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _showUploadAvatarDialog,
                      ),
                    ),
                    if (_userProfile != null && _userProfile!.hasAvatar) ...[
                      const SizedBox(width: 10),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                        label: const Text('Hapus Foto', style: TextStyle(color: AppColors.danger)),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: AppColors.danger),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () async {
                          try {
                            await _examRepo.deleteAvatar();
                            await _loadData();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Foto profil berhasil dihapus.'),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Gagal menghapus avatar: $e'),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          }
                        },
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Menu Options Group
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.vpn_key_rounded, color: AppColors.primary),
                  title: const Text('Ganti Kata Sandi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: const Text('Perbarui kata sandi akun CBT Anda', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: _showChangePasswordDialog,
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.palette_outlined, color: AppColors.primary),
                  title: const Text('Tema & Tampilan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: Text(
                    'Tema: ${_userPreference?.theme.toUpperCase() ?? "SYSTEM"} | Kontras: ${_userPreference?.highContrast == true ? "TINGGI" : "NORMAL"}',
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: _showThemePreferencesDialog,
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.badge_outlined, color: AppColors.primary),
                  title: const Text('Kartu Peserta Ujian', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  subtitle: const Text('Buka kartu peserta CBT resmi Anda', style: TextStyle(fontSize: 12)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => setState(() => _currentBottomIndex = 1),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Logout Button Card
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.logout_rounded, size: 20),
              label: const Text('Keluar dari Akun (Logout)', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.danger,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: _handleLogout,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    String titleText = AppStrings.appName;
    if (_currentBottomIndex == 1) titleText = 'Kartu Peserta Ujian';
    if (_currentBottomIndex == 2) titleText = 'Sertifikat Kelulusan';
    if (_currentBottomIndex == 3) titleText = 'Pusat Notifikasi';
    if (_currentBottomIndex == 4) titleText = 'Profil Siswa';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.assignment_turned_in_rounded, size: 24, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                titleText,
                style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5),
                overflow: TextOverflow.ellipsis,
              ),
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

      // IndexedStack for Bottom Navigation Tabs
      body: IndexedStack(
        index: _currentBottomIndex,
        children: [
          _buildHomeExamsTab(),
          _buildStudentCardTab(),
          _buildCertificatesTab(),
          _buildNotificationsTab(),
          _buildProfileTab(),
        ],
      ),

      // Clean, Modern Bottom Navigation Bar
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 16,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentBottomIndex,
          onTap: (index) {
            setState(() {
              _currentBottomIndex = index;
            });
            if (index == 1) _controller.loadStudentCard();
            if (index == 2) _controller.loadCertificates();
            if (index == 3) _loadData();
          },
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textSecondary,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold),
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.assignment_outlined),
              activeIcon: Icon(Icons.assignment_rounded, color: AppColors.primary),
              label: 'Ujian',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.badge_outlined),
              activeIcon: Icon(Icons.badge_rounded, color: AppColors.primary),
              label: 'Kartu Ujian',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.workspace_premium_outlined),
              activeIcon: Icon(Icons.workspace_premium_rounded, color: AppColors.primary),
              label: 'Sertifikat',
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications_outlined),
                  if (_unreadNotifCount > 0)
                    Positioned(
                      right: -4,
                      top: -4,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          _unreadNotifCount > 9 ? '9+' : '$_unreadNotifCount',
                          style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              activeIcon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications_rounded, color: AppColors.primary),
                  if (_unreadNotifCount > 0)
                    Positioned(
                      right: -4,
                      top: -4,
                      child: Container(
                        padding: const EdgeInsets.all(2),
                        decoration: const BoxDecoration(
                          color: AppColors.danger,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                        child: Text(
                          _unreadNotifCount > 9 ? '9+' : '$_unreadNotifCount',
                          style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              label: 'Notifikasi',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded, color: AppColors.primary),
              label: 'Profil',
            ),
          ],
        ),
      ),
    );
  }
}
