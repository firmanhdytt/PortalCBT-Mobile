class ExamResult {
  final int id;
  final int siswaId;
  final int ujianId;
  final String namaUjian;
  final int jumlahBenar;
  final int jumlahSalah;
  final double nilaiAkhir;
  final String waktuSelesai;

  const ExamResult({
    required this.id,
    required this.siswaId,
    required this.ujianId,
    required this.namaUjian,
    required this.jumlahBenar,
    required this.jumlahSalah,
    required this.nilaiAkhir,
    required this.waktuSelesai,
  });
}
