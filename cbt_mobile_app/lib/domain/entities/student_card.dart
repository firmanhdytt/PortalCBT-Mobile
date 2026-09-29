class StudentCardExam {
  final int id;
  final String namaUjian;
  final String namaMapel;
  final int durasiMenit;
  final String? waktuMulai;
  final String? waktuSelesai;
  final double kkm;

  const StudentCardExam({
    required this.id,
    required this.namaUjian,
    required this.namaMapel,
    required this.durasiMenit,
    this.waktuMulai,
    this.waktuSelesai,
    required this.kkm,
  });
}

class StudentCard {
  final int siswaId;
  final String noPeserta;
  final String nis;
  final String nama;
  final int kelasId;
  final String kelas;
  final String ruang;
  final String sesi;
  final String? avatar;
  final String tahunAjaran;
  final String tanggalCetak;
  final String qrDataUrl;
  final List<StudentCardExam> jadwalUjian;

  const StudentCard({
    required this.siswaId,
    required this.noPeserta,
    required this.nis,
    required this.nama,
    required this.kelasId,
    required this.kelas,
    required this.ruang,
    required this.sesi,
    this.avatar,
    required this.tahunAjaran,
    required this.tanggalCetak,
    required this.qrDataUrl,
    required this.jadwalUjian,
  });
}
