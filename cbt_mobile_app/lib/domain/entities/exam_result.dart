class ExamResult {
  final int id;
  final int siswaId;
  final int ujianId;
  final String namaUjian;
  final int jumlahBenar;
  final int jumlahSalah;
  final double nilaiPg;
  final double nilaiEssay;
  final double nilaiAkhir;
  final String statusKelulusan;
  final double kkm;
  final String waktuSelesai;

  const ExamResult({
    required this.id,
    required this.siswaId,
    required this.ujianId,
    required this.namaUjian,
    required this.jumlahBenar,
    required this.jumlahSalah,
    this.nilaiPg = 0.0,
    this.nilaiEssay = 0.0,
    required this.nilaiAkhir,
    this.statusKelulusan = 'PENDING',
    this.kkm = 75.0,
    required this.waktuSelesai,
  });
}
