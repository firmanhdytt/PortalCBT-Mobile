import '../../core/utils/type_parser.dart';
import '../../domain/entities/user_profile.dart';

class UserProfileModel extends UserProfile {
  const UserProfileModel({
    required super.id,
    required super.username,
    required super.role,
    required super.nama,
    super.email = '',
    super.avatar,
    required super.fallbackInitial,
    super.siswaId,
    super.nis,
    super.kelasId,
    super.namaKelas,
    super.guruId,
    super.nip,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    return UserProfileModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      username: json['username']?.toString() ?? '',
      role: json['role']?.toString() ?? 'siswa',
      nama: json['nama']?.toString() ?? (json['username']?.toString() ?? 'User'),
      email: json['email']?.toString() ?? '',
      avatar: json['avatar']?.toString(),
      fallbackInitial: json['fallback_initial']?.toString() ?? 'U',
      siswaId: TypeParser.parseInt(json['siswa_id']),
      nis: json['nis']?.toString(),
      kelasId: TypeParser.parseInt(json['kelas_id']),
      namaKelas: json['nama_kelas']?.toString(),
      guruId: TypeParser.parseInt(json['guru_id']),
      nip: json['nip']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'nama': nama,
      'email': email,
      'avatar': avatar,
      'fallback_initial': fallbackInitial,
      'siswa_id': siswaId,
      'nis': nis,
      'kelas_id': kelasId,
      'nama_kelas': namaKelas,
      'guru_id': guruId,
      'nip': nip,
    };
  }
}
