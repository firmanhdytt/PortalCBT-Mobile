class Certificate {
  final int id;
  final String certificateNumber;
  final int ujianId;
  final String namaUjian;
  final String namaMapel;
  final double kkm;
  final double nilaiPg;
  final double nilaiEssay;
  final double nilaiAkhir;
  final String statusKelulusan;
  final String issuedAt;
  final String verifyUrl;
  final String qrDataUrl;

  const Certificate({
    required this.id,
    required this.certificateNumber,
    required this.ujianId,
    required this.namaUjian,
    required this.namaMapel,
    required this.kkm,
    required this.nilaiPg,
    required this.nilaiEssay,
    required this.nilaiAkhir,
    required this.statusKelulusan,
    required this.issuedAt,
    required this.verifyUrl,
    required this.qrDataUrl,
  });
}
