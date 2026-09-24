import '../../domain/entities/exam_result.dart';

class ExamResultModel extends ExamResult {
  const ExamResultModel({
    required super.id,
    required super.siswaId,
    required super.ujianId,
    required super.namaUjian,
    required super.jumlahBenar,
    required super.jumlahSalah,
    required super.nilaiAkhir,
    required super.waktuSelesai,
  });

  factory ExamResultModel.fromJson(Map<String, dynamic> json) {
    return ExamResultModel(
      id: json['id'] as int? ?? 0,
      siswaId: json['siswa_id'] as int? ?? 0,
      ujianId: json['ujian_id'] as int? ?? 0,
      namaUjian: (json['nama_ujian'] ?? 'Ujian').toString(),
      jumlahBenar: json['jumlah_benar'] as int? ?? 0,
      jumlahSalah: json['jumlah_salah'] as int? ?? 0,
      nilaiAkhir: (json['nilai_akhir'] as num?)?.toDouble() ?? 0.0,
      waktuSelesai: (json['waktu_selesai'] ?? '-').toString(),
    );
  }
}
