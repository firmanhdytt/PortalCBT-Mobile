import '../../domain/entities/exam_result.dart';

class ExamResultModel extends ExamResult {
  const ExamResultModel({
    required super.id,
    required super.siswaId,
    required super.ujianId,
    required super.namaUjian,
    required super.jumlahBenar,
    required super.jumlahSalah,
    super.nilaiPg = 0.0,
    super.nilaiEssay = 0.0,
    required super.nilaiAkhir,
    super.statusKelulusan = 'PENDING',
    super.kkm = 75.0,
    required super.waktuSelesai,
  });

  factory ExamResultModel.fromJson(Map<String, dynamic> json) {
    final na = (json['nilai_akhir'] as num?)?.toDouble() ?? 0.0;
    return ExamResultModel(
      id: json['id'] as int? ?? 0,
      siswaId: json['siswa_id'] as int? ?? 0,
      ujianId: json['ujian_id'] as int? ?? 0,
      namaUjian: (json['nama_ujian'] ?? 'Ujian').toString(),
      jumlahBenar: json['jumlah_benar'] as int? ?? 0,
      jumlahSalah: json['jumlah_salah'] as int? ?? 0,
      nilaiPg: (json['nilai_pg'] as num?)?.toDouble() ?? na,
      nilaiEssay: (json['nilai_essay'] as num?)?.toDouble() ?? 0.0,
      nilaiAkhir: na,
      statusKelulusan: (json['status_kelulusan'] ?? 'PENDING').toString(),
      kkm: (json['kkm'] as num?)?.toDouble() ?? 75.0,
      waktuSelesai: (json['waktu_selesai'] ?? '-').toString(),
    );
  }
}
