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

  void _loadUjian() async {
    setState(() => _isLoading = true);
    final list = await ApiService.fetchUjianList(widget.siswa['kelas_id'], widget.siswa['id']);
    setState(() {
      _ujianList = list;
      _isLoading = false;
    });
  }

  void _handleLogout() async {
    await DbHelper.clearAll();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginPage()),
      );
    }
  }

  void _showTokenDialog(Map<String, dynamic> ujian) async {
    final tokenController = TextEditingController();
    bool isVerifying = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(ujian['nama_ujian']),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Masukkan token ujian yang dibagikan oleh guru untuk memulai pengerjaan.",
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: tokenController,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, letterSpacing: 3),
                decoration: const InputDecoration(
                  labelText: "TOKEN UJIAN",
                  hintText: "Contoh: INF123",
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Batal"),
            ),
            isVerifying
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : ElevatedButton(
                    onPressed: () async {
                      final token = tokenController.text.trim().toUpperCase();
                      if (token.isEmpty) return;

                      setDialogState(() => isVerifying = true);
                      final res = await ApiService.verifyToken(ujian['id'], token);
                      setDialogState(() => isVerifying = false);

                      if (res != null && mounted) {
                        Navigator.pop(context); // Tutup dialog token
                        _startExamSession(ujian);
                      } else {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Token ujian salah!")),
                          );
                        }
                      }
                    },
                    child: const Text("Mulai"),
                  ),
          ],
        ),
      ),
    );
  }

  void _startExamSession(Map<String, dynamic> ujian) async {
    setState(() => _isLoading = true);
    // Download soal
    final soalList = await ApiService.fetchSoalList(ujian['id']);
    
    if (soalList.isEmpty) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Gagal mengunduh soal ujian!")),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: const Text("CBT Mobile", style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E88E5),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadUjian,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner Profil Siswa
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Color(0xFF1E88E5),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(24),
                bottomRight: Radius.circular(24),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.siswa['nama'],
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "NIS: ${widget.siswa['nis']} | Kelas: ${widget.siswa['nama_kelas']}",
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),

          // Daftar Ujian
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _ujianList.isEmpty
                    ? const Center(
                        child: Text(
                          "Tidak ada ujian aktif saat ini.",
                          style: TextStyle(color: Colors.grey),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: _ujianList.length,
                        itemBuilder: (context, index) {
                          final u = _ujianList[index];
                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 15),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: const BorderSide(color: Color(0xFFE2E8F0)),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(18),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    u['nama_ujian'],
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(Icons.timer_outlined, size: 16, color: Colors.grey),
                                      const SizedBox(width: 6),
                                      Text(
                                        "${u['durasi_menit']} Menit",
                                        style: const TextStyle(color: Colors.grey, fontSize: 13),
                                      ),
                                      const SizedBox(width: 20),
                                      const Icon(Icons.assignment_outlined, size: 16, color: Colors.grey),
                                      const SizedBox(width: 6),
                                      const Text(
                                        "PG & Essay",
                                        style: TextStyle(color: Colors.grey, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 16),
                                  ElevatedButton(
                                    onPressed: () => _showTokenDialog(u),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF1E88E5),
                                      foregroundColor: Colors.white,
                                      minimumSize: const Size(double.infinity, 44),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      elevation: 0,
                                    ),
                                    child: const Text("Ikuti Ujian"),
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
}
