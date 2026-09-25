import 'package:flutter_test/flutter_test.dart';
import 'package:cbt_mobile_app/domain/entities/answer.dart';
import 'package:cbt_mobile_app/data/models/student_model.dart';
import 'package:cbt_mobile_app/data/models/exam_model.dart';
import 'package:cbt_mobile_app/data/models/question_model.dart';
import 'package:cbt_mobile_app/data/models/answer_model.dart';

void main() {
  group('Clean Architecture Entity & Model Tests', () {
    test('StudentModel serialization & deserialization', () {
      final json = {
        'id': 10,
        'user_id': 20,
        'nis': '2026001',
        'nama': 'Ahmad Fauzi',
        'kelas_id': 1,
        'nama_kelas': 'X RPL 1',
        'username': 'ahmad_fauzi',
      };

      final model = StudentModel.fromJson(json);
      expect(model.id, 10);
      expect(model.nis, '2026001');
      expect(model.nama, 'Ahmad Fauzi');
      expect(model.namaKelas, 'X RPL 1');

      final serialized = model.toJson();
      expect(serialized['nis'], '2026001');
      expect(serialized['nama_kelas'], 'X RPL 1');
    });

    test('ExamModel mapping with duration and token', () {
      final json = {
        'id': 1,
        'nama_ujian': 'Ujian Akhir Semester Pemrograman',
        'durasi_menit': 90,
        'token': 'INF123',
        'status': 'aktif',
      };

      final exam = ExamModel.fromJson(json);
      expect(exam.id, 1);
      expect(exam.namaUjian, 'Ujian Akhir Semester Pemrograman');
      expect(exam.durasiMenit, 90);
      expect(exam.token, 'INF123');
      expect(exam.status, 'aktif');
    });

    test('QuestionModel and OptionModel mapping for PG', () {
      final json = {
        'id': 101,
        'ujian_id': 1,
        'jenis_soal': 'PG',
        'teks_soal': 'Manakah yang termasuk OOP principle?',
        'bobot': 2.0,
        'nomor_urut': 1,
        'pilihan': [
          {'id': 1, 'soal_id': 101, 'label': 'A', 'teks_pilihan': 'Encapsulation'},
          {'id': 2, 'soal_id': 101, 'label': 'B', 'teks_pilihan': 'Compilation'},
        ],
      };

      final q = QuestionModel.fromJson(json);
      expect(q.isMultipleChoice, true);
      expect(q.isEssay, false);
      expect(q.pilihan.length, 2);
      expect(q.pilihan[0].label, 'A');
      expect(q.pilihan[0].teksPilihan, 'Encapsulation');
    });

    test('AnswerModel status and synchronization flags', () {
      final answer = Answer(
        id: 1,
        siswaId: 10,
        ujianId: 1,
        soalId: 101,
        pilihanJawabanId: 2,
        teksJawabanEssay: '',
        isRagu: false,
        waktuDijawab: DateTime.now(),
        syncStatus: 'synced',
      );

      final model = AnswerModel.fromEntity(answer);
      expect(model.isAnswered, true);
      expect(model.isSynced, true);
      expect(model.pilihanJawabanId, 2);

      final dbMap = model.toDb();
      expect(dbMap['soal_id'], 101);
      expect(dbMap['pilihan_jawaban_id'], 2);
      expect(dbMap['is_ragu'], 0);
      expect(dbMap['sync_status'], 'synced');
    });
  });
}
