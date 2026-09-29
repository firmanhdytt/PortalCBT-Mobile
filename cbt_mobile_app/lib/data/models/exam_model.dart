import '../../core/utils/type_parser.dart';
import '../../domain/entities/exam.dart';

class ExamModel extends Exam {
  const ExamModel({
    required super.id,
    required super.namaUjian,
    required super.durasiMenit,
    required super.token,
    super.status,
    super.bankSoalId,
    super.kelasId,
    super.namaKelas,
    super.isAktif,
    super.allowBackNavigation,
    super.randomizeQuestions,
    super.randomizeOptions,
    super.showResult,
    super.maxViolations,
    super.kkm,
  });

  factory ExamModel.fromJson(Map<String, dynamic> json) {
    return ExamModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      namaUjian: json['nama_ujian']?.toString() ?? '',
      durasiMenit: TypeParser.parseIntOr(json['durasi_menit'], 60),
      token: json['token']?.toString() ?? '',
      status: json['status']?.toString() ?? 'not_started',
      bankSoalId: TypeParser.parseInt(json['bank_soal_id']),
      kelasId: TypeParser.parseInt(json['kelas_id']),
      namaKelas: json['nama_kelas']?.toString(),
      isAktif: TypeParser.parseBool(json['is_aktif']),
      allowBackNavigation: json['allow_back_navigation'] == null || TypeParser.parseBool(json['allow_back_navigation'], defaultValue: true),
      randomizeQuestions: json['randomize_questions'] == null || TypeParser.parseBool(json['randomize_questions'], defaultValue: true),
      randomizeOptions: TypeParser.parseBool(json['randomize_options']),
      showResult: json['show_result'] == null || TypeParser.parseBool(json['show_result'], defaultValue: true),
      maxViolations: TypeParser.parseIntOr(json['max_violations'], 3),
      kkm: TypeParser.parseDoubleOr(json['kkm'], 70.0),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nama_ujian': namaUjian,
      'durasi_menit': durasiMenit,
      'token': token,
      'status': status,
      'bank_soal_id': bankSoalId,
      'kelas_id': kelasId,
      'nama_kelas': namaKelas,
      'is_aktif': isAktif,
      'allow_back_navigation': allowBackNavigation ? 1 : 0,
      'randomize_questions': randomizeQuestions ? 1 : 0,
      'randomize_options': randomizeOptions ? 1 : 0,
      'show_result': showResult ? 1 : 0,
      'max_violations': maxViolations,
      'kkm': kkm,
    };
  }

  factory ExamModel.fromDb(Map<String, dynamic> map) {
    return ExamModel(
      id: TypeParser.parseIntOr(map['id'], 0),
      namaUjian: map['nama_ujian']?.toString() ?? '',
      durasiMenit: TypeParser.parseIntOr(map['durasi_menit'], 60),
      token: map['token']?.toString() ?? '',
      status: map['status']?.toString() ?? 'not_started',
    );
  }

  Map<String, dynamic> toDb() {
    return {
      'id': id,
      'nama_ujian': namaUjian,
      'durasi_menit': durasiMenit,
      'token': token,
      'status': status,
    };
  }
}
