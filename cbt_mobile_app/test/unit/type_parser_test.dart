import 'package:flutter_test/flutter_test.dart';
import 'package:cbt_mobile_app/core/utils/type_parser.dart';
import 'package:cbt_mobile_app/data/models/exam_model.dart';
import 'package:cbt_mobile_app/data/models/question_model.dart';
import 'package:cbt_mobile_app/data/models/option_model.dart';
import 'package:cbt_mobile_app/data/models/exam_result_model.dart';

void main() {
  group('TypeParser & Deserialization Resilience Tests', () {
    test('TypeParser correctly parses int, double, num, bool from strings', () {
      expect(TypeParser.parseInt('123'), 123);
      expect(TypeParser.parseInt('45.67'), 45);
      expect(TypeParser.parseInt(null), null);
      expect(TypeParser.parseIntOr('789', 0), 789);
      expect(TypeParser.parseIntOr(null, 10), 10);

      expect(TypeParser.parseDouble('75.50'), 75.50);
      expect(TypeParser.parseDouble(90), 90.0);
      expect(TypeParser.parseDoubleOr('100.0', 0.0), 100.0);

      expect(TypeParser.parseBool('1'), true);
      expect(TypeParser.parseBool('true'), true);
      expect(TypeParser.parseBool('0'), false);
      expect(TypeParser.parseBool('false'), false);
      expect(TypeParser.parseBool(1), true);
    });

    test('ExamModel handles stringified numeric JSON from backend API', () {
      final json = {
        'id': '12',
        'nama_ujian': 'Matematika Dasar',
        'durasi_menit': '90',
        'token': 'MATH2026',
        'bank_soal_id': '5',
        'kelas_id': '3',
        'is_aktif': '1',
        'allow_back_navigation': '0',
        'max_violations': '3',
        'kkm': '75.50',
      };

      final exam = ExamModel.fromJson(json);
      expect(exam.id, 12);
      expect(exam.durasiMenit, 90);
      expect(exam.token, 'MATH2026');
      expect(exam.bankSoalId, 5);
      expect(exam.kelasId, 3);
      expect(exam.isAktif, true);
      expect(exam.allowBackNavigation, false);
      expect(exam.maxViolations, 3);
      expect(exam.kkm, 75.50);
    });

    test('QuestionModel & OptionModel handle stringified numeric JSON from token entry & questions API', () {
      final questionJson = {
        'id': '201',
        'ujian_id': '12',
        'jenis_soal': 'PG',
        'teks_soal': 'Berapakah 2 + 2?',
        'bobot': '2.50',
        'nomor_urut': '1',
        'pilihan': [
          {'id': '1001', 'soal_id': '201', 'label': 'A', 'teks_pilihan': '4'},
          {'id': '1002', 'soal_id': '201', 'label': 'B', 'teks_pilihan': '5'},
        ]
      };

      final question = QuestionModel.fromJson(questionJson);
      expect(question.id, 201);
      expect(question.ujianId, 12);
      expect(question.bobot, 2.50);
      expect(question.nomorUrut, 1);
      expect(question.options.length, 2);
      expect(question.options.first.id, 1001);
      expect(question.options.first.soalId, 201);
    });

    test('ExamResultModel handles stringified numeric JSON without num cast error', () {
      final resultJson = {
        'id': '50',
        'siswa_id': '10',
        'ujian_id': '12',
        'nama_ujian': 'Matematika Dasar',
        'jumlah_benar': '18',
        'jumlah_salah': '2',
        'nilai_pg': '90.00',
        'nilai_essay': '0.00',
        'nilai_akhir': '90.00',
        'status_kelulusan': 'LULUS',
        'kkm': '75.00',
        'waktu_selesai': '2026-09-29 14:00:00',
      };

      final result = ExamResultModel.fromJson(resultJson);
      expect(result.id, 50);
      expect(result.siswaId, 10);
      expect(result.ujianId, 12);
      expect(result.jumlahBenar, 18);
      expect(result.jumlahSalah, 2);
      expect(result.nilaiPg, 90.00);
      expect(result.nilaiEssay, 0.00);
      expect(result.nilaiAkhir, 90.00);
      expect(result.kkm, 75.00);
    });
  });
}
