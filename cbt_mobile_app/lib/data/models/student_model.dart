import '../../domain/entities/student.dart';

class StudentModel extends Student {
  const StudentModel({
    required super.id,
    super.userId,
    required super.nis,
    required super.nama,
    required super.kelasId,
    required super.namaKelas,
  });

  factory StudentModel.fromJson(Map<String, dynamic> json) {
    return StudentModel(
      id: json['id'] as int,
      userId: json['user_id'] as int?,
      nis: json['nis'].toString(),
      nama: json['nama'].toString(),
      kelasId: json['kelas_id'] as int,
      namaKelas: (json['nama_kelas'] ?? '-').toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'nis': nis,
      'nama': nama,
      'kelas_id': kelasId,
      'nama_kelas': namaKelas,
    };
  }

  factory StudentModel.fromDb(Map<String, dynamic> map) {
    return StudentModel(
      id: map['id'] as int,
      userId: map['user_id'] as int?,
      nis: map['nis'].toString(),
      nama: map['nama'].toString(),
      kelasId: map['kelas_id'] as int,
      namaKelas: map['nama_kelas'].toString(),
    );
  }

  Map<String, dynamic> toDb() {
    return {
      'id': id,
      'nis': nis,
      'nama': nama,
      'kelas_id': kelasId,
      'nama_kelas': namaKelas,
    };
  }
}
