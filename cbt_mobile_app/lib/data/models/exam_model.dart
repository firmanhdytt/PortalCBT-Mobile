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
