class Student {
  final int id;
  final int? userId;
  final String nis;
  final String nama;
  final int kelasId;
  final String namaKelas;
  final String? username;

  const Student({
    required this.id,
    this.userId,
    required this.nis,
    required this.nama,
    required this.kelasId,
    required this.namaKelas,
    this.username,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Student && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
