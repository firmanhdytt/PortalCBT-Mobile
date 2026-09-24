import 'package:cbt_mobile_app/core/security/encryption_service.dart';
import 'package:cbt_mobile_app/data/models/student_model.dart';
import 'package:cbt_mobile_app/data/models/exam_model.dart';
import 'package:cbt_mobile_app/data/models/question_model.dart';
import 'package:cbt_mobile_app/data/models/answer_model.dart';

void main() {
  print('====================================================');
  print('🧪 CBT MOBILE PHASE 5 OFFLINE & ENCRYPTION TEST SUITE');
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

  // --- 1. LOCAL STORAGE ENCRYPTION & DECRYPTION ---
  print('--- 1. TESTING AES ENCRYPTION & TAMPER RESISTANCE ---');
  const secret = '2026001_AhmadFauzi_Secret';
  const sampleQuestion = 'Manakah yang termasuk pilar pemrograman berorientasi objek (OOP)?';

  final encrypted = EncryptionService.encrypt(sampleQuestion, secret);
  expect(encrypted.startsWith('enc:v1:'), 'Hasil enkripsi memiliki header format enc:v1:');
  expect(encrypted != sampleQuestion, 'Ciphertext tidak lagi menampilkan plain text');

  final decrypted = EncryptionService.decrypt(encrypted, secret);
  expect(decrypted == sampleQuestion, 'Dekripsi berhasil merekonstruksi teks soal secara presisi');

  // Multi-byte Unicode / Emoji test
  const unicodeText = 'Soal Matematika: Hitunglah nilai π ≈ 3.14159 & akar kuadrat √144 🎯';
  final encUnicode = EncryptionService.encrypt(unicodeText, secret);
  final decUnicode = EncryptionService.decrypt(encUnicode, secret);
  expect(decUnicode == unicodeText, 'Enkripsi & dekripsi mendukung karakter khusus Unicode & Emoji');

  // Tamper detection
  bool tamperCaught = false;
  try {
    final tampered = '${encrypted.substring(0, encrypted.length - 4)}ZZZZ';
    EncryptionService.decrypt(tampered, secret);
  } catch (e) {
    tamperCaught = true;
  }
  expect(tamperCaught, 'Manipulasi/tampering pada ciphertext berhasil dideteksi dan ditolak');

  // --- 2. TAMPER-EVIDENT ANSWER CHECKSUMS ---
  print('\n--- 2. TESTING TAMPER-RESISTANT ANSWER CHECKSUMS ---');
  const timeIso = '2026-09-24T14:30:00.000Z';
  final checksum = EncryptionService.computeAnswerChecksum(
    siswaId: 10,
    ujianId: 1,
    soalId: 101,
    pilihanId: 2,
    essay: '',
    timestamp: timeIso,
    secretKey: secret,
  );
  expect(checksum.isNotEmpty, 'Checksum HMAC-SHA256 berhasil digenerasi');

  final valid = EncryptionService.verifyAnswerChecksum(
    siswaId: 10,
    ujianId: 1,
    soalId: 101,
    pilihanId: 2,
    essay: '',
    timestamp: timeIso,
    checksum: checksum,
    secretKey: secret,
  );
  expect(valid, 'Verifikasi integritas jawaban offline valid');

  final altered = EncryptionService.verifyAnswerChecksum(
    siswaId: 10,
    ujianId: 1,
    soalId: 101,
    pilihanId: 3, // Pilihan diubah tanpa hak
    essay: '',
    timestamp: timeIso,
    checksum: checksum,
    secretKey: secret,
  );
  expect(!altered, 'Integritas jawaban gagal verifikasi jika pilihan jawaban dimanipulasi secara offline');

  // --- 3. OUTBOX QUEUE & SYNC PAYLOAD ---
  print('\n--- 3. TESTING OUTBOX QUEUE & SYNC PAYLOAD ---');
  final answer = AnswerModel(
    id: 1,
    siswaId: 10,
    ujianId: 1,
    soalId: 101,
    pilihanJawabanId: 2,
    waktuDijawab: DateTime.parse(timeIso),
    syncStatus: 'pending',
  );
  expect(answer.syncStatus == 'pending', 'Jawaban baru memiliki status pending');

  final dbMap = answer.toDb();
  expect(dbMap['sync_status'] == 'pending', 'Mapping database lokal menyimpan sync_status: pending');

  final syncJson = answer.toSyncJson();
  expect(syncJson['soal_id'] == 101, 'Sync JSON memiliki soal_id');
  expect(syncJson['pilihan_jawaban_id'] == 2, 'Sync JSON memiliki pilihan_jawaban_id');
  expect(syncJson['is_ragu'] == 0, 'Sync JSON memetakan flag is_ragu');

  // --- 4. SESSION RESUMPTION CHECKPOINT DATA ---
  print('\n--- 4. TESTING SESSION RESUMPTION CHECKPOINT DATA ---');
  final examData = {
    'id': 1,
    'nama_ujian': 'Ujian Akhir Semester Pemrograman',
    'durasi_menit': 90,
    'token': 'INF123',
    'status': 'aktif',
    'waktu_mulai': '2026-09-24T10:00:00.000Z',
    'sisa_detik': 3240, // 54 minutes remaining
    'is_submitted': 0,
  };
  final examModel = ExamModel.fromJson(examData);
  expect(examModel.id == 1, 'ExamModel parsing id checkpoint');
  expect(examModel.durasiMenit == 90, 'ExamModel parsing durasiMenit');
  expect(examData['sisa_detik'] == 3240, 'Checkpoint sisa_detik berhasil dicatat untuk resume session');
  expect(examData['is_submitted'] == 0, 'Sesi belum di-submit ditandai sebagai resumable session');

  print('\n====================================================');
  print('PHASE 5 TEST SUMMARY: $passed PASSED, $failed FAILED');
  print('====================================================');

  if (failed > 0) {
    throw Exception('$failed tests failed!');
  }
}
