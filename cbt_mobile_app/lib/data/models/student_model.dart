import '../../core/utils/type_parser.dart';
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
      id: TypeParser.parseIntOr(json['id'], 0),
      userId: TypeParser.parseInt(json['user_id']),
      nis: json['nis']?.toString() ?? '',
      nama: json['nama']?.toString() ?? '',
      kelasId: TypeParser.parseIntOr(json['kelas_id'], 0),
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
      id: TypeParser.parseIntOr(map['id'], 0),
      userId: TypeParser.parseInt(map['user_id']),
      nis: map['nis']?.toString() ?? '',
      nama: map['nama']?.toString() ?? '',
      kelasId: TypeParser.parseIntOr(map['kelas_id'], 0),
      namaKelas: map['nama_kelas']?.toString() ?? '',
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
