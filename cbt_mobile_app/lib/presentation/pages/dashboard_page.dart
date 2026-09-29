import 'dart:convert';
import '../../core/utils/type_parser.dart';
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
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/entities/user_preference.dart';
import '../../core/constants/api_endpoints.dart';
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
      if (mounted) {
        setState(() {
          _unreadNotifCount = unread;
          _userPreference = pref;
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

  void _showStudentCardDialog() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(strokeWidth: 2.5),
                SizedBox(width: 16),
                Text('Memuat Kartu Ujian...'),
              ],
            ),
          ),
        ),
      ),
    );

    await _controller.loadStudentCard();
    if (!mounted) return;
    Navigator.pop(context); // Close loading

    final card = _controller.studentCard;
    if (card == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Gagal memuat kartu ujian dari server.'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    // Decode QR Code Base64
    Widget qrWidget;
    try {
      final base64String = card.qrDataUrl.contains(',')
          ? card.qrDataUrl.split(',').last
          : card.qrDataUrl;
      final bytes = base64Decode(base64String);
      qrWidget = Image.memory(bytes, width: 110, height: 110, fit: BoxFit.contain);
    } catch (_) {
      qrWidget = Container(
        width: 110,
        height: 110,
        color: const Color(0xFFF1F5F9),
        child: const Icon(Icons.qr_code_2_rounded, size: 60, color: AppColors.primary),
      );
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.all(20),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.school_rounded, color: AppColors.primary, size: 28),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'KARTU PESERTA CBT',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: AppColors.primaryDark,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              'TA ${card.tahunAjaran}',
                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: qrWidget,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            card.noPeserta,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            card.nama,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text('NIS: ${card.nis}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Text('Kelas: ${card.kelas}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Text('${card.ruang} / ${card.sesi}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Jadwal Ujian Terdaftar:',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                  ),
                ),
                const SizedBox(height: 8),
                if (card.jadwalUjian.isEmpty)
                  const Text('Tidak ada jadwal ujian aktif.', style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: Colors.grey))
                else
                  ...card.jadwalUjian.map((ex) => Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                '${ex.namaMapel} (${ex.namaUjian})',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Text(
                              '${ex.durasiMenit} mnt',
                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      )),
              ],
            ),
          ),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
  }

  void _showCertificatesDialog() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(20),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(strokeWidth: 2.5),
                SizedBox(width: 16),
                Text('Memuat Sertifikat...'),
              ],
            ),
          ),
        ),
      ),
    );

    await _controller.loadCertificates();
    if (!mounted) return;
    Navigator.pop(context); // Close loading

    final certs = _controller.certificates;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.workspace_premium_rounded, color: Color(0xFFD97706), size: 24),
            SizedBox(width: 8),
            Text('Sertifikat Kelulusan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: certs.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.info_outline_rounded, size: 48, color: Colors.grey),
                      SizedBox(height: 12),
                      Text(
                        'Belum Ada Sertifikat',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Sertifikat digital diterbitkan secara otomatis setelah Anda dinyatakan LULUS ujian oleh guru.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  itemCount: certs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final c = certs[idx];
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                c.certificateNumber,
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.bold,
                                  fontSize: 11,
                                  color: Color(0xFF15803D),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'Skor: ${c.nilaiAkhir}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 11,
                                    color: Color(0xFF15803D),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            c.namaMapel,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          Text(
                            c.namaUjian,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Status: ${c.statusKelulusan} (KKM ${c.kkm})',
                            style: const TextStyle(fontSize: 10, color: Color(0xFF166534), fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup'),
          ),
        ],
      ),
    );
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

  void _showProfileDialog() async {
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.account_circle_rounded, color: AppColors.primary, size: 28),
              SizedBox(width: 8),
              Text('Profil Siswa', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary.withOpacity(0.3), width: 2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _buildAvatarWidget(size: 76, fontSize: 28),
                ),
                const SizedBox(height: 12),
                Text(
                  _userProfile?.nama ?? _currentStudent.nama,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
                Text(
                  'NIS: ${_userProfile?.nis ?? _currentStudent.nis} • Kelas: ${_userProfile?.namaKelas ?? _currentStudent.namaKelas}',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
                if (_userProfile?.email != null && _userProfile!.email.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _userProfile!.email,
                    style: const TextStyle(fontSize: 11, color: AppColors.primary),
                  ),
                ],
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 8),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.lock_reset_rounded, color: AppColors.primary),
                  title: const Text('Ganti Kata Sandi', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  subtitle: const Text('Perbarui kata sandi akun CBT Anda', style: TextStyle(fontSize: 11)),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showChangePasswordDialog();
                  },
                ),
                if (_userProfile != null && _userProfile!.hasAvatar)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.delete_outline_rounded, color: AppColors.danger),
                    title: const Text('Hapus Foto Profil', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600, fontSize: 13)),
                    subtitle: const Text('Kembali ke inisial nama standar', style: TextStyle(fontSize: 11)),
                    onTap: () async {
                      final nav = Navigator.of(ctx);
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        await _examRepo.deleteAvatar();
                        await _loadData();
                        if (mounted) {
                          nav.pop();
                          messenger.showSnackBar(
                            const SnackBar(
                              content: Text('Foto profil berhasil dihapus.'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text('Gagal menghapus avatar: $e'),
                              backgroundColor: AppColors.danger,
                            ),
                          );
                        }
                      }
                    },
                  ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.palette_outlined, color: AppColors.primary),
                  title: const Text('Tema & Aksesibilitas', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text(
                    'Tema: ${_userPreference?.theme.toUpperCase() ?? "SYSTEM"} | Kontras: ${_userPreference?.highContrast == true ? "TINGGI" : "NORMAL"}',
                    style: const TextStyle(fontSize: 11),
                  ),
                  trailing: const Icon(Icons.chevron_right, size: 20),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showThemePreferencesDialog();
                  },
                ),
              ],
            ),
          ),
          actions: [
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Tutup'),
            ),
          ],
        ),
      ),
    );
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

  void _showNotificationBottomSheet() async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          height: MediaQuery.of(context).size.height * 0.75,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.notifications_active_rounded, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text('Pusat Notifikasi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    TextButton(
                      onPressed: () async {
                        try {
                          await _examRepo.markAllNotificationsAsRead();
                          final unread = await _examRepo.getUnreadNotificationCount();
                          setSheetState(() {});
                          if (mounted) {
                            setState(() {
                              _unreadNotifCount = unread;
                            });
                          }
                        } catch (_) {}
                      },
                      child: const Text('Tandai Dibaca', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                ),
              ),

              // Content List
              Expanded(
                child: FutureBuilder<List<AppNotification>>(
                  future: _examRepo.getNotifications(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final list = snapshot.data ?? [];
                    if (list.isEmpty) {
                      return const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.notifications_off_outlined, size: 48, color: Colors.grey),
                            SizedBox(height: 12),
                            Text('Tidak Ada Notifikasi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            SizedBox(height: 4),
                            Text('Pemberitahuan ujian dan nilai akan muncul di sini.',
                                style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        ),
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: list.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, idx) {
                        final notif = list[idx];
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
                            child: Icon(icon, color: iconColor, size: 20),
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
                          onTap: () async {
                            if (!notif.isRead) {
                              await _examRepo.markNotificationAsRead(notif.id);
                              final unread = await _examRepo.getUnreadNotificationCount();
                              setSheetState(() {});
                              if (mounted) {
                                setState(() {
                                  _unreadNotifCount = unread;
                                });
                              }
                            }
                          },
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
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
          // In-App Notification Center (Phase 10)
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                tooltip: 'Pusat Notifikasi',
                onPressed: _showNotificationBottomSheet,
              ),
              if (_unreadNotifCount > 0)
                Positioned(
                  right: 8,
                  top: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      _unreadNotifCount > 9 ? '9+' : '$_unreadNotifCount',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
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
                  InkWell(
                    onTap: _showProfileDialog,
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
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            InkWell(
                              onTap: _showStudentCardDialog,
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
                              onTap: _showCertificatesDialog,
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
                              onTap: _showProfileDialog,
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
