import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/db_helper.dart';
import 'dashboard_page.dart';

class ExamPage extends StatefulWidget {
  final Map<String, dynamic> ujian;
  final Map<String, dynamic> siswa;

  const ExamPage({super.key, required this.ujian, required this.siswa});

  @override
  State<ExamPage> createState() => _ExamPageState();
}

class _ExamPageState extends State<ExamPage> {
  List<Map<String, dynamic>> _soalList = [];
  int _currentIndex = 0;
  bool _isLoading = true;
  bool _isSubmitting = false;
  
  // Penampung jawaban sementara lokal
  int? _selectedOpsiId;
  final _essayController = TextEditingController();
  bool _isRagu = false;

  // Status Jawaban Map untuk Navigation Drawer (soalId -> 'answered' | 'doubtful' | 'unanswered')
  Map<int, String> _statusMap = {};

  // Timer
  Timer? _timer;
  int _secondsRemaining = 0;

  // Background Sync Timer
  Timer? _syncTimer;

  @override
  void initState() {
    super.initState();
    _loadExamData();
    _startTimer(widget.ujian['durasi_menit'] ?? 60);
    _startBackgroundSync();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _syncTimer?.cancel();
    _essayController.dispose();
    super.dispose();
  }

  void _loadExamData() async {
    final list = await DbHelper.getSoalList(widget.ujian['id']);
    final map = await DbHelper.getJawabanStatusMap(widget.ujian['id']);
    setState(() {
      _soalList = list;
      _statusMap = map;
      _isLoading = false;
    });
    _loadCurrentQuestionAnswer();
  }

  void _refreshStatusMap() async {
    final map = await DbHelper.getJawabanStatusMap(widget.ujian['id']);
    if (mounted) {
      setState(() {
        _statusMap = map;
      });
    }
  }

  void _startTimer(int minutes) {
    _secondsRemaining = minutes * 60;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining <= 0) {
        _timer?.cancel();
        _forceSubmitExam();
      } else {
        if (mounted) {
          setState(() {
            _secondsRemaining--;
          });
        }
      }
    });
  }

  void _startBackgroundSync() {
    _syncTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      _syncAnswersToServer();
    });
  }

  void _syncAnswersToServer() async {
    final unsynced = await DbHelper.getUnsyncedJawaban();
    if (unsynced.isEmpty) return;

    List<Map<String, dynamic>> listToSend = unsynced.map((j) => {
      'soal_id': j['soal_id'],
      'pilihan_jawaban_id': j['pilihan_jawaban_id'],
      'teks_jawaban_essay': j['teks_jawaban_essay'],
      'is_ragu': j['is_ragu'] == 1,
    }).toList();

    final success = await ApiService.syncJawaban(widget.siswa['id'], widget.ujian['id'], listToSend);
    if (success) {
      await DbHelper.markAsSynced(unsynced);
    }
  }

  // Memuat jawaban untuk soal yang aktif saat ini
  void _loadCurrentQuestionAnswer() async {
    if (_soalList.isEmpty) return;
    final q = _soalList[_currentIndex];
    final ans = await DbHelper.getJawabanSingle(q['id']);

    if (ans != null) {
      setState(() {
        _selectedOpsiId = ans['pilihan_jawaban_id'];
        _essayController.text = ans['teks_jawaban_essay'] ?? '';
        _isRagu = ans['is_ragu'] == 1;
      });
    } else {
      setState(() {
        _selectedOpsiId = null;
        _essayController.text = '';
        _isRagu = false;
      });
    }
    _refreshStatusMap();
  }

  // Menyimpan jawaban ke basis data lokal (SQLite)
  void _saveAnswerLocally() async {
    if (_soalList.isEmpty) return;
    final q = _soalList[_currentIndex];
    
    await DbHelper.saveJawabanLokal(
      siswaId: widget.siswa['id'],
      ujianId: widget.ujian['id'],
      soalId: q['id'],
      pilihanId: _selectedOpsiId,
      essayText: q['jenis_soal'] == 'ESSAY' ? _essayController.text : null,
      isRagu: _isRagu,
    );
    _refreshStatusMap();
  }

  void _goToNext() {
    _saveAnswerLocally();
    if (_currentIndex < _soalList.length - 1) {
      setState(() {
        _currentIndex++;
      });
      _loadCurrentQuestionAnswer();
    } else {
      _confirmFinishExam();
    }
  }

  void _goToPrev() {
    _saveAnswerLocally();
    if (_currentIndex > 0) {
      setState(() {
        _currentIndex--;
      });
      _loadCurrentQuestionAnswer();
    }
  }

  void _jumpToQuestion(int index) {
    _saveAnswerLocally();
    setState(() {
      _currentIndex = index;
    });
    _loadCurrentQuestionAnswer();
    Navigator.pop(context); // Tutup drawer sidebar nomor soal
  }

  void _showExitConfirmationDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Tinggalkan Ujian?"),
        content: const Text("Ujian masih berlangsung. Jawaban Anda tersimpan secara lokal, tetapi timer akan tetap berjalan jika Anda keluar."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Batal"),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _exitExam();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text("Keluar Ujian"),
          ),
        ],
      ),
    );
  }

  void _confirmFinishExam() {
    _saveAnswerLocally();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Konfirmasi Selesai"),
        content: const Text("Apakah Anda yakin ingin mengakhiri ujian? Jawaban Anda akan disinkronisasikan dan disimpan secara permanen."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Batal"),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _submitExamFinal();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text("Ya, Selesai"),
          ),
        ],
      ),
    );
  }

  void _submitExamFinal() async {
    if (_isSubmitting) return;
    setState(() {
      _isSubmitting = true;
      _isLoading = true;
    });
    
    // Matikan timer
    _timer?.cancel();
    _syncTimer?.cancel();

    // 1. Ambil sisa jawaban pending dan sync ke server
    final pending = await DbHelper.getUnsyncedJawaban();
    if (pending.isNotEmpty) {
      List<Map<String, dynamic>> listToSend = pending.map((j) => {
        'soal_id': j['soal_id'],
        'pilihan_jawaban_id': j['pilihan_jawaban_id'],
        'teks_jawaban_essay': j['teks_jawaban_essay'],
        'is_ragu': j['is_ragu'] == 1,
      }).toList();
      await ApiService.syncJawaban(widget.siswa['id'], widget.ujian['id'], listToSend);
    }

    // 2. Submit Ujian
    final res = await ApiService.submitUjian(widget.siswa['id'], widget.ujian['id']);
    
    if (mounted) {
      setState(() => _isLoading = false);
    }

    if (res != null && mounted) {
      final hasil = res['hasil'];
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text("Ujian Selesai!"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline, color: Colors.green, size: 64),
              const SizedBox(height: 16),
              Text("Benar PG: ${hasil['jumlah_benar']}"),
              Text("Salah PG: ${hasil['jumlah_salah']}"),
              const SizedBox(height: 8),
              Text(
                "Skor PG: ${hasil['nilai_akhir']}",
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.blue),
              ),
              const SizedBox(height: 12),
              const Text(
                "*Skor akhir akan digabungkan setelah guru selesai memberikan penilaian untuk soal Essay.",
                style: TextStyle(fontSize: 10, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
            ],
          ),
          actions: [
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context); // Tutup dialog
                _exitExam();
              },
              child: const Text("Kembali ke Beranda"),
            ),
          ],
        ),
      );
    } else {
      _exitExam();
    }
  }

  void _forceSubmitExam() {
    if (!_isSubmitting) {
      _submitExamFinal();
    }
  }

  void _exitExam() async {
    await DbHelper.clearAll();
    // Kembalikan profil siswa
    await DbHelper.saveSiswa(widget.siswa);

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => DashboardPage(siswa: widget.siswa)),
      );
    }
  }

  String _formatTimer(int totalSeconds) {
    if (totalSeconds < 0) totalSeconds = 0;
    int m = totalSeconds ~/ 60;
    int s = totalSeconds % 60;
    return "${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}";
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final q = _soalList[_currentIndex];
    final pilihanList = (q['pilihan'] is List) ? (q['pilihan'] as List<dynamic>) : [];

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          _showExitConfirmationDialog();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F7FA),
        appBar: AppBar(
          title: Text("Soal ${_currentIndex + 1} dari ${_soalList.length}"),
          backgroundColor: const Color(0xFF1E88E5),
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
                  child: Text(
                    _formatTimer(_secondsRemaining),
                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red, fontSize: 14),
                  ),
                ),
              ),
            )
          ],
        ),
        drawer: Drawer(
          child: Column(
            children: [
              const DrawerHeader(
                decoration: BoxDecoration(color: Color(0xFF1E88E5)),
                child: Center(
                  child: Text(
                    "Navigasi Soal",
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildLegendItem(const Color(0xFF1E88E5), "Aktif"),
                    _buildLegendItem(Colors.green.shade600, "Dijawab"),
                    _buildLegendItem(Colors.orange.shade700, "Ragu"),
                    _buildLegendItem(Colors.grey.shade400, "Belum"),
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
                  itemCount: _soalList.length,
                  itemBuilder: (context, index) {
                    final itemSoal = _soalList[index];
                    final isCurrent = index == _currentIndex;
                    final status = _statusMap[itemSoal['id']] ?? 'unanswered';

                    Color bgColor = Colors.white;
                    Color fgColor = Colors.black87;

                    if (isCurrent) {
                      bgColor = const Color(0xFF1E88E5);
                      fgColor = Colors.white;
                    } else if (status == 'doubtful') {
                      bgColor = Colors.orange.shade700;
                      fgColor = Colors.white;
                    } else if (status == 'answered') {
                      bgColor = Colors.green.shade600;
                      fgColor = Colors.white;
                    }

                    return ElevatedButton(
                      onPressed: () => _jumpToQuestion(index),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: bgColor,
                        foregroundColor: fgColor,
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                      ),
                      child: Text(
                        "${index + 1}",
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
            // Sub-status bar
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              color: Colors.white,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text("Tipe: ${q['jenis_soal']}", style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                  Text("Bobot: ${q['bobot']}", style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
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
                    // Pertanyaan
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        q['teks_soal'] ?? '',
                        style: const TextStyle(fontSize: 15, height: 1.5, fontWeight: FontWeight.w500),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Area Pilihan PG atau Input Essay
                    if (q['jenis_soal'] == 'PG')
                      Column(
                        children: pilihanList.map((opt) {
                          final isSelected = _selectedOpsiId == opt['id'];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFEBF8FF) : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF1E88E5) : const Color(0xFFE2E8F0),
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: ListTile(
                              leading: Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF1E88E5) : const Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    opt['label'] ?? '',
                                    style: TextStyle(
                                      color: isSelected ? Colors.white : Colors.black87,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ),
                              title: Text(opt['teks_pilihan'] ?? ''),
                              onTap: () {
                                setState(() {
                                  _selectedOpsiId = opt['id'];
                                });
                                _saveAnswerLocally();
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
                          hintText: "Ketikkan jawaban Anda disini...",
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                        ),
                        onChanged: (val) => _saveAnswerLocally(),
                      ),
                  ],
                ),
              ),
            ),

            // Navigasi bawah
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ElevatedButton(
                    onPressed: _currentIndex > 0 ? _goToPrev : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black87,
                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                      elevation: 0,
                    ),
                    child: const Text("Sebelum"),
                  ),
                  Row(
                    children: [
                      Checkbox(
                        value: _isRagu,
                        activeColor: Colors.orange,
                        onChanged: (val) {
                          setState(() {
                            _isRagu = val ?? false;
                          });
                          _saveAnswerLocally();
                        },
                      ),
                      const Text("Ragu-ragu", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange)),
                    ],
                  ),
                  ElevatedButton(
                    onPressed: _goToNext,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1E88E5),
                      foregroundColor: Colors.white,
                      elevation: 0,
                    ),
                    child: Text(_currentIndex == _soalList.length - 1 ? "Selesai" : "Lanjut"),
                  ),
                ],
              ),
            ),
            
            // Tombol Drawer Grid
            Builder(
              builder: (context) => Container(
                width: double.infinity,
                color: const Color(0xFFF1F5F9),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: ElevatedButton.icon(
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  icon: const Icon(Icons.grid_on),
                  label: const Text("Buka Panel Nomor Soal"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black87,
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
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}
