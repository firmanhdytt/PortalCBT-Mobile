import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/db_helper.dart';
import 'login_page.dart';
import 'exam_page.dart';

class DashboardPage extends StatefulWidget {
  final Map<String, dynamic> siswa;
  const DashboardPage({super.key, required this.siswa});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  List<dynamic> _ujianList = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadUjian();
  }

  Future<void> _loadUjian() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchUjianList(widget.siswa['kelas_id'], widget.siswa['id']);
    if (mounted) {
      setState(() {
        _ujianList = list;
        _isLoading = false;
      });
    }
  }

  void _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            SizedBox(width: 8),
            Text("Konfirmasi Keluar", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text("Apakah Anda yakin ingin keluar dari akun siswa ini?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Batal", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Keluar"),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await DbHelper.clearAll();
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const LoginPage()),
        );
      }
    }
  }

  void _showTokenDialog(Map<String, dynamic> ujian) async {
    final tokenController = TextEditingController();
    bool isVerifying = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            ujian['nama_ujian'],
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Masukkan token ujian 6 karakter yang diberikan oleh pengawas/guru untuk memulai pengerjaan.",
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
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
                  color: Color(0xFF2563EB),
                ),
                decoration: InputDecoration(
                  labelText: "TOKEN UJIAN",
                  hintText: "INF123",
                  hintStyle: TextStyle(letterSpacing: 4, color: Colors.grey.shade400, fontSize: 18),
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF2563EB), width: 2),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Batal", style: TextStyle(color: Colors.grey)),
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
                    label: const Text("MULAI UJIAN"),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      final token = tokenController.text.trim().toUpperCase();
                      if (token.isEmpty) return;

                      setDialogState(() => isVerifying = true);
                      final res = await ApiService.verifyToken(ujian['id'], token);
                      setDialogState(() => isVerifying = false);

                      if (!context.mounted) return;
                      if (res != null) {
                        Navigator.pop(context); // Tutup dialog
                        _startExamSession(ujian);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Row(
                              children: [
                                Icon(Icons.error_outline, color: Colors.white, size: 20),
                                SizedBox(width: 8),
                                Text("Token ujian salah atau sudah tidak berlaku!"),
                              ],
                            ),
                            backgroundColor: const Color(0xFFEF4444),
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

  void _startExamSession(Map<String, dynamic> ujian) async {
    setState(() => _isLoading = true);
    // Unduh soal dari server
    final soalList = await ApiService.fetchSoalList(ujian['id']);
    
    if (soalList.isEmpty) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text("Gagal mengunduh soal ujian dari server!"),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
      return;
    }

    // Simpan ke SQLite lokal
    await DbHelper.saveUjian(ujian);
    await DbHelper.saveSoalList(soalList, ujian['id']);
    setState(() => _isLoading = false);

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ExamPage(
            ujian: ujian,
            siswa: widget.siswa,
          ),
        ),
      );
    }
  }

  String _getInitial(String name) {
    if (name.isEmpty) return "S";
    final parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return "${parts[0][0]}${parts[1][0]}".toUpperCase();
    }
    return name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final namaSiswa = widget.siswa['nama'] ?? 'Siswa';
    final nisSiswa = widget.siswa['nis'] ?? '-';
    final kelasSiswa = widget.siswa['nama_kelas'] ?? '-';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.assignment_turned_in_rounded, size: 24, color: Colors.white),
            SizedBox(width: 8),
            Text(
              "CBT Mobile",
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: "Perbarui Data",
            onPressed: _loadUjian,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: "Keluar Akun",
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadUjian,
        color: const Color(0xFF2563EB),
        child: Column(
          children: [
            // Banner Header Profil Siswa
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
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
                  // Avatar Initial Circle
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
                        _getInitial(namaSiswa),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  
                  // Info Text
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          namaSiswa,
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
                                "NIS: $nisSiswa",
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
                                "Kelas: $kelasSiswa",
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

            // Main Content Area
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(color: Color(0xFF2563EB)),
                          SizedBox(height: 12),
                          Text("Memuat jadwal ujian...", style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                        ],
                      ),
                    )
                  : _ujianList.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.15),
                            Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(20),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEFF6FF),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.event_available_rounded,
                                      size: 54,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  const Text(
                                    "Tidak Ada Ujian Aktif Hari Ini",
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 40),
                                    child: Text(
                                      "Belum ada sesi ujian yang dirilis untuk kelas Anda. Tarik layar ke bawah untuk memperbarui data.",
                                      textAlign: TextAlign.center,
                                      style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                                    ),
                                  ),
                                  const SizedBox(height: 20),
                                  OutlinedButton.icon(
                                    icon: const Icon(Icons.refresh_rounded, size: 18),
                                    label: const Text("Perbarui Halaman"),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFF2563EB),
                                      side: const BorderSide(color: Color(0xFF93C5FD)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    ),
                                    onPressed: _loadUjian,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(20),
                          itemCount: _ujianList.length,
                          itemBuilder: (context, index) {
                            final u = _ujianList[index];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
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
                                            u['nama_ujian'],
                                            style: const TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.bold,
                                              color: Color(0xFF0F172A),
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
                                              CircleAvatar(radius: 3, backgroundColor: Color(0xFF10B981)),
                                              SizedBox(width: 4),
                                              Text(
                                                "AKTIF",
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
                                              const Icon(Icons.timer_outlined, size: 14, color: Color(0xFF64748B)),
                                              const SizedBox(width: 4),
                                              Text(
                                                "${u['durasi_menit']} Menit",
                                                style: const TextStyle(
                                                  color: Color(0xFF334155),
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
                                              Icon(Icons.assignment_outlined, size: 14, color: Color(0xFF64748B)),
                                              SizedBox(width: 4),
                                              Text(
                                                "PG & Essay",
                                                style: TextStyle(
                                                  color: Color(0xFF334155),
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
                                        onPressed: () => _showTokenDialog(u),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF2563EB),
                                          foregroundColor: Colors.white,
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          elevation: 2,
                                          shadowColor: const Color(0xFF2563EB).withOpacity(0.3),
                                        ),
                                        child: const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              "IKUTI UJIAN",
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
