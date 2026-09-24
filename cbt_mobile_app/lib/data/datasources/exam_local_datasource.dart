import 'package:sqflite/sqflite.dart';
import '../../core/security/encryption_service.dart';
import '../../core/storage/local_database.dart';
import '../models/student_model.dart';
import '../models/exam_model.dart';
import '../models/question_model.dart';
import '../models/option_model.dart';
import '../models/answer_model.dart';

class ExamLocalDataSource {
  Future<Database> get _db => LocalDatabase.instance;

  // Derives encryption key based on student or fallback session key
  String _getSecretKey([int? siswaId]) {
    return 'CBT_OFFLINE_KEY_${siswaId ?? 0}_SECURE';
  }

  // --- Student Profile ---
  Future<void> saveStudent(StudentModel student) async {
    final db = await _db;
    await db.insert('siswa', student.toDb(), conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<StudentModel?> getStudent() async {
    final db = await _db;
    final res = await db.query('siswa', limit: 1);
    if (res.isNotEmpty) {
      return StudentModel.fromDb(res.first);
    }
    return null;
  }

  // --- Exam Metadata & Session Resume ---
  Future<void> saveExam(ExamModel exam) async {
    final db = await _db;
    final map = exam.toDb();
    map['waktu_mulai'] = DateTime.now().toIso8601String();
    map['sisa_detik'] = exam.durasiMenit * 60;
    map['is_submitted'] = 0;
    await db.insert('ujian', map, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> saveExamSessionCheckpoint(int ujianId, int remainingSeconds) async {
    final db = await _db;
    await db.update(
      'ujian',
      {'sisa_detik': remainingSeconds},
      where: 'id = ?',
      whereArgs: [ujianId],
    );
  }

  Future<Map<String, dynamic>?> getActiveIncompleteExam() async {
    final db = await _db;
    final res = await db.query(
      'ujian',
      where: 'is_submitted = 0',
      limit: 1,
    );
    if (res.isNotEmpty) {
      return res.first;
    }
    return null;
  }

  Future<void> markExamSubmitted(int ujianId) async {
    final db = await _db;
    await db.update(
      'ujian',
      {'is_submitted': 1, 'sisa_detik': 0},
      where: 'id = ?',
      whereArgs: [ujianId],
    );
  }

  // --- Questions Caching with Encryption ---
  Future<void> saveQuestions(List<QuestionModel> questions, int ujianId, {int? siswaId}) async {
    final db = await _db;
    final secret = _getSecretKey(siswaId);
    final batch = db.batch();

    for (final q in questions) {
      final qMap = q.toDb();
      // Encrypt question text before saving to local SQLite
      qMap['teks_soal'] = EncryptionService.encrypt(q.teksSoal, secret);
      batch.insert('soal', qMap, conflictAlgorithm: ConflictAlgorithm.replace);

      for (final opt in q.options) {
        final optModel = opt is OptionModel
            ? opt
            : OptionModel(
                id: opt.id,
                soalId: opt.soalId,
                label: opt.label,
                teksPilihan: opt.teksPilihan,
              );
        final optMap = optModel.toDb();
        // Encrypt option text before saving to local SQLite
        optMap['teks_pilihan'] = EncryptionService.encrypt(opt.teksPilihan, secret);
        batch.insert('pilihan_jawaban', optMap, conflictAlgorithm: ConflictAlgorithm.replace);
      }
    }

    await batch.commit(noResult: true);
  }

  Future<List<QuestionModel>> getQuestions(int ujianId, {int? siswaId}) async {
    final db = await _db;
    final secret = _getSecretKey(siswaId);
    final rows = await db.query(
      'soal',
      where: 'ujian_id = ?',
      whereArgs: [ujianId],
      orderBy: 'nomor_urut ASC',
    );

    final result = <QuestionModel>[];
    for (final r in rows) {
      final qId = r['id'] as int;
      final optRows = await db.query(
        'pilihan_jawaban',
        where: 'soal_id = ?',
        whereArgs: [qId],
        orderBy: 'label ASC',
      );

      final decryptedOptions = optRows.map((o) {
        final rawText = (o['teks_pilihan'] ?? '').toString();
        final decryptedText = EncryptionService.decrypt(rawText, secret);
        return OptionModel(
          id: o['id'] as int,
          soalId: o['soal_id'] as int,
          label: (o['label'] ?? '').toString(),
          teksPilihan: decryptedText,
        );
      }).toList();

      final rawQText = (r['teks_soal'] ?? '').toString();
      final decryptedQText = EncryptionService.decrypt(rawQText, secret);

      final decryptedRow = Map<String, dynamic>.from(r);
      decryptedRow['teks_soal'] = decryptedQText;

      result.add(QuestionModel.fromDb(decryptedRow, options: decryptedOptions));
    }
    return result;
  }

  // --- Local Answers with Checksums & Outbox Queue ---
  Future<void> saveAnswer(AnswerModel answer) async {
    final db = await _db;
    final secret = _getSecretKey(answer.siswaId);
    final timestampIso = answer.waktuDijawab.toIso8601String();

    // Compute tamper-resistant checksum
    final checksum = EncryptionService.computeAnswerChecksum(
      siswaId: answer.siswaId,
      ujianId: answer.ujianId,
      soalId: answer.soalId,
      pilihanId: answer.pilihanJawabanId,
      essay: answer.teksJawabanEssay,
      timestamp: timestampIso,
      secretKey: secret,
    );

    final map = answer.toDb();
    map['sync_status'] = 'pending';
    map['checksum'] = checksum;

    final existing = await db.query(
      'jawaban_peserta',
      where: 'siswa_id = ? AND ujian_id = ? AND soal_id = ?',
      whereArgs: [answer.siswaId, answer.ujianId, answer.soalId],
    );

    if (existing.isNotEmpty) {
      await db.update(
        'jawaban_peserta',
        map,
        where: 'id = ?',
        whereArgs: [existing.first['id']],
      );
    } else {
      await db.insert('jawaban_peserta', map);
    }
  }

  Future<AnswerModel?> getAnswer(int soalId, {int? siswaId}) async {
    final db = await _db;
    final res = await db.query(
      'jawaban_peserta',
      where: 'soal_id = ?',
      whereArgs: [soalId],
      limit: 1,
    );
    if (res.isNotEmpty) {
      return AnswerModel.fromDb(res.first);
    }
    return null;
  }

  Future<List<AnswerModel>> getUnsyncedAnswers() async {
    final db = await _db;
    // Retrieve all pending or previously failed answers
    final res = await db.query(
      'jawaban_peserta',
      where: 'sync_status = ? OR sync_status = ?',
      whereArgs: ['pending', 'failed'],
      orderBy: 'waktu_dijawab ASC',
    );
    return res.map((r) => AnswerModel.fromDb(r)).toList();
  }

  Future<void> markAnswersSyncing(List<AnswerModel> answers) async {
    final db = await _db;
    final batch = db.batch();
    for (final a in answers) {
      if (a.id != null) {
        batch.update(
          'jawaban_peserta',
          {'sync_status': 'syncing'},
          where: 'id = ?',
          whereArgs: [a.id],
        );
      }
    }
    await batch.commit(noResult: true);
  }

  Future<void> markAnswersAsSynced(List<AnswerModel> answers) async {
    final db = await _db;
    final batch = db.batch();
    for (final a in answers) {
      if (a.id != null) {
        batch.update(
          'jawaban_peserta',
          {'sync_status': 'synced', 'retry_count': 0},
          where: 'id = ?',
          whereArgs: [a.id],
        );
      }
    }
    await batch.commit(noResult: true);
  }

  Future<void> markAnswersSyncFailed(List<AnswerModel> answers) async {
    final db = await _db;
    final batch = db.batch();
    for (final a in answers) {
      if (a.id != null) {
        batch.rawUpdate('''
          UPDATE jawaban_peserta 
          SET sync_status = 'failed', retry_count = retry_count + 1 
          WHERE id = ?
        ''', [a.id]);
      }
    }
    await batch.commit(noResult: true);
  }

  Future<Map<int, String>> getAnswerStatusMap(int ujianId) async {
    final db = await _db;
    final rows = await db.query('jawaban_peserta', where: 'ujian_id = ?', whereArgs: [ujianId]);
    final map = <int, String>{};

    for (final r in rows) {
      final soalId = r['soal_id'] as int;
      final isRagu = (r['is_ragu'] as int? ?? 0) == 1;
      final pilihanId = r['pilihan_jawaban_id'] as int?;
      final essay = (r['teks_jawaban_essay'] ?? '').toString().trim();

      if (isRagu) {
        map[soalId] = 'doubtful';
      } else if (pilihanId != null || essay.isNotEmpty) {
        map[soalId] = 'answered';
      } else {
        map[soalId] = 'unanswered';
      }
    }

    return map;
  }

  Future<void> clearAll() async {
    final db = await _db;
    await db.delete('siswa');
    await db.delete('ujian');
    await db.delete('soal');
    await db.delete('pilihan_jawaban');
    await db.delete('jawaban_peserta');
  }
}
