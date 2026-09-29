class UserProfile {
  final int id;
  final String username;
  final String role;
  final String nama;
  final String email;
  final String? avatar;
  final String fallbackInitial;
  final int? siswaId;
  final String? nis;
  final int? kelasId;
  final String? namaKelas;
  final int? guruId;
  final String? nip;

  const UserProfile({
    required this.id,
    required this.username,
    required this.role,
    required this.nama,
    this.email = '',
    this.avatar,
    required this.fallbackInitial,
    this.siswaId,
    this.nis,
    this.kelasId,
    this.namaKelas,
    this.guruId,
    this.nip,
  });

  bool get hasAvatar => avatar != null && avatar!.trim().isNotEmpty;
}
