class Exam {
  final int id;
  final String namaUjian;
  final int durasiMenit;
  final String token;
  final String status;
  final int? bankSoalId;
  final int? kelasId;
  final String? namaKelas;
  final bool isAktif;
  final bool allowBackNavigation;
  final bool randomizeQuestions;
  final bool randomizeOptions;
  final bool showResult;
  final int maxViolations;
  final double kkm;

  const Exam({
    required this.id,
    required this.namaUjian,
    required this.durasiMenit,
    required this.token,
    this.status = 'not_started',
    this.bankSoalId,
    this.kelasId,
    this.namaKelas,
    this.isAktif = true,
    this.allowBackNavigation = true,
    this.randomizeQuestions = true,
    this.randomizeOptions = false,
    this.showResult = true,
    this.maxViolations = 3,
    this.kkm = 70.0,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Exam && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
