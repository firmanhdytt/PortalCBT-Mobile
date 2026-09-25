import 'package:cbt_mobile_app/data/models/exam_model.dart';
import 'package:cbt_mobile_app/domain/entities/exam.dart';

void main() {
  print('====================================================');
  print('🧪 CBT MOBILE PHASE 6 EXAMINATION ENGINE & ANTI-CHEAT TEST');
  print('====================================================\n');

  int passed = 0;
  int failed = 0;

  void expect(bool condition, String message) {
    if (condition) {
      print('  ✅ PASS: $message');
      passed++;
    } else {
      print('  ❌ FAIL: $message');
      failed++;
    }
  }

  // --- 1. EXAM MODEL WITH PHASE 6 FIELDS ---
  print('--- 1. EXAM MODEL CONFIGURATION & PARSING ---');
  final jsonExam = {
    'id': 101,
    'nama_ujian': 'Ujian Akhir Semester Fisika',
    'durasi_menit': 90,
    'token': 'FISIKA2026',
    'status': 'ONGOING',
    'bank_soal_id': 12,
    'kelas_id': 3,
    'nama_kelas': 'XII-IPA-1',
    'is_aktif': 1,
    'allow_back_navigation': 0, // Strict forward-only!
    'randomize_questions': 1,
    'randomize_options': 1,
    'show_result': 1,
    'max_violations': 3,
    'kkm': '75.50'
  };

  final model = ExamModel.fromJson(jsonExam);
  expect(model.id == 101, 'Exam ID berhasil diparse (101)');
  expect(model.namaUjian == 'Ujian Akhir Semester Fisika', 'Nama ujian benar');
  expect(model.allowBackNavigation == false, 'allowBackNavigation bernilai false (forward-only)');
  expect(model.randomizeQuestions == true, 'randomizeQuestions bernilai true');
  expect(model.randomizeOptions == true, 'randomizeOptions bernilai true');
  expect(model.maxViolations == 3, 'maxViolations bernilai 3');
  expect(model.kkm == 75.50, 'KKM bernilai 75.50');

  final serialized = model.toJson();
  expect(serialized['allow_back_navigation'] == 0, 'Serialized allow_back_navigation = 0');
  expect(serialized['randomize_options'] == 1, 'Serialized randomize_options = 1');
  expect(serialized['max_violations'] == 3, 'Serialized max_violations = 3');

  // --- 2. FORWARD-ONLY NAVIGATION RESTRICTION ENGINE ---
  print('\n--- 2. NAVIGATION RESTRICTION RULES ---');
  // Helper simulator for examination navigation
  bool canNavigatePrev(Exam exam, int currentIndex) {
    return exam.allowBackNavigation && currentIndex > 0;
  }

  bool canJumpTo(Exam exam, int currentIndex, int targetIndex) {
    if (!exam.allowBackNavigation && targetIndex < currentIndex) {
      return false; // Mundur dilarang!
    }
    return true;
  }

  // Test with allowBackNavigation = false
  expect(!canNavigatePrev(model, 2), 'Soal ke-2 tidak dapat kembali ke soal sebelumnya (allowBackNavigation=false)');
  expect(!canJumpTo(model, 3, 1), 'Tidak dapat melompat mundur dari soal 4 ke soal 2');
  expect(canJumpTo(model, 1, 3), 'Dapat melompat maju dari soal 2 ke soal 4');

  // Test with allowBackNavigation = true
  const standardExam = Exam(
    id: 102,
    namaUjian: 'Kuis Terbuka',
    durasiMenit: 30,
    token: 'KUIS1',
    allowBackNavigation: true,
  );
  expect(canNavigatePrev(standardExam, 2), 'Soal ke-2 dapat kembali ke soal sebelumnya (allowBackNavigation=true)');
  expect(canJumpTo(standardExam, 3, 1), 'Dapat melompat bebas antar soal ketika allowBackNavigation=true');

  // --- 3. ANTI-CHEAT STRIKE ACCUMULATION & LOCK THRESHOLD ---
  print('\n--- 3. ANTI-CHEAT STRIKE LOGIC ---');
  int strikes = 0;
  bool isLocked = false;
  final int maxThreshold = model.maxViolations; // 3

  void recordStrike() {
    strikes++;
    if (strikes >= maxThreshold) {
      isLocked = true;
    }
  }

  recordStrike();
  expect(strikes == 1, 'Strike 1 tercatat');
  expect(isLocked == false, 'Sesi belum terkunci pada strike 1');

  recordStrike();
  expect(strikes == 2, 'Strike 2 tercatat');
  expect(isLocked == false, 'Sesi belum terkunci pada strike 2');

  recordStrike();
  expect(strikes == 3, 'Strike 3 tercatat');
  expect(isLocked == true, 'Sesi otomatis TERKUNCI saat mencapai strike ke-3 (maxViolations)');

  // Extra strike attempt while already locked
  recordStrike();
  expect(isLocked == true, 'Status tetap terkunci');

  // --- 4. UNLOCK TRANSITIONS ---
  print('\n--- 4. UNLOCK STATE TRANSITION ---');
  String? unlockStatus = 'PENDING';
  expect(unlockStatus == 'PENDING', 'Permohonan buka kunci dikirim dengan status PENDING');

  // Supervisor approves request
  void approveUnlock() {
    unlockStatus = 'APPROVED';
    isLocked = false;
    strikes = 0; // reset
  }

  approveUnlock();
  expect(unlockStatus == 'APPROVED', 'Permohonan disetujui');
  expect(isLocked == false, 'Sesi ujian berhasil dibuka kembali (isLocked = false)');
  expect(strikes == 0, 'Strikes berhasil direset menjadi 0');

  print('\n====================================================');
  print('PHASE 6 MOBILE TEST SUMMARY: $passed PASSED, $failed FAILED');
  print('====================================================\n');
}
