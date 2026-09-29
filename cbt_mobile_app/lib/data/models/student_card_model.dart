import '../../core/utils/type_parser.dart';
import '../../domain/entities/student_card.dart';

class StudentCardExamModel extends StudentCardExam {
  const StudentCardExamModel({
    required super.id,
    required super.namaUjian,
    required super.namaMapel,
    required super.durasiMenit,
    super.waktuMulai,
    super.waktuSelesai,
    required super.kkm,
  });

  factory StudentCardExamModel.fromJson(Map<String, dynamic> json) {
    return StudentCardExamModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      namaUjian: json['nama_ujian']?.toString() ?? '',
      namaMapel: json['nama_mapel']?.toString() ?? '',
      durasiMenit: TypeParser.parseIntOr(json['durasi_menit'], 60),
      waktuMulai: json['waktu_mulai']?.toString(),
      waktuSelesai: json['waktu_selesai']?.toString(),
      kkm: TypeParser.parseDoubleOr(json['kkm'], 75.0),
    );
  }
}

class StudentCardModel extends StudentCard {
  const StudentCardModel({
    required super.siswaId,
    required super.noPeserta,
    required super.nis,
    required super.nama,
    required super.kelasId,
    required super.kelas,
    required super.ruang,
    required super.sesi,
    super.avatar,
    required super.tahunAjaran,
    required super.tanggalCetak,
    required super.qrDataUrl,
    required super.jadwalUjian,
  });

  factory StudentCardModel.fromJson(Map<String, dynamic> json) {
    final rawExams = json['jadwal_ujian'] as List<dynamic>? ?? [];
    final exams = rawExams
        .whereType<Map<String, dynamic>>()
        .map((e) => StudentCardExamModel.fromJson(e))
        .toList();

    return StudentCardModel(
      siswaId: TypeParser.parseIntOr(json['siswa_id'], 0),
      noPeserta: json['no_peserta']?.toString() ?? '',
      nis: json['nis']?.toString() ?? '',
      nama: json['nama']?.toString() ?? '',
      kelasId: TypeParser.parseIntOr(json['kelas_id'], 0),
      kelas: json['kelas']?.toString() ?? '',
      ruang: json['ruang']?.toString() ?? 'Ruang Lab CBT',
      sesi: json['sesi']?.toString() ?? 'Sesi 1',
      avatar: json['avatar']?.toString(),
      tahunAjaran: json['tahun_ajaran']?.toString() ?? '',
      tanggalCetak: json['tanggal_cetak']?.toString() ?? '',
      qrDataUrl: json['qr_data_url']?.toString() ?? '',
      jadwalUjian: exams,
    );
  }
}
