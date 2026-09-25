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
      id: json['id'] as int,
      namaUjian: json['nama_ujian'].toString(),
      durasiMenit: json['durasi_menit'] as int? ?? 60,
      token: json['token'].toString(),
      status: json['status']?.toString() ?? 'not_started',
      bankSoalId: json['bank_soal_id'] as int?,
      kelasId: json['kelas_id'] as int?,
      namaKelas: json['nama_kelas']?.toString(),
      isAktif: json['is_aktif'] == 1 || json['is_aktif'] == true,
      allowBackNavigation: json['allow_back_navigation'] == 1 || json['allow_back_navigation'] == true || json['allow_back_navigation'] == null,
      randomizeQuestions: json['randomize_questions'] == 1 || json['randomize_questions'] == true || json['randomize_questions'] == null,
      randomizeOptions: json['randomize_options'] == 1 || json['randomize_options'] == true,
      showResult: json['show_result'] == 1 || json['show_result'] == true || json['show_result'] == null,
      maxViolations: json['max_violations'] as int? ?? 3,
      kkm: double.tryParse(json['kkm']?.toString() ?? '70.0') ?? 70.0,
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
      id: map['id'] as int,
      namaUjian: map['nama_ujian'].toString(),
      durasiMenit: map['durasi_menit'] as int? ?? 60,
      token: map['token'].toString(),
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
