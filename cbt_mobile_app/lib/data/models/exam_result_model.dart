import '../../core/utils/type_parser.dart';
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
    final na = TypeParser.parseDoubleOr(json['nilai_akhir'], 0.0);
    return ExamResultModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      siswaId: TypeParser.parseIntOr(json['siswa_id'], 0),
      ujianId: TypeParser.parseIntOr(json['ujian_id'], 0),
      namaUjian: (json['nama_ujian'] ?? 'Ujian').toString(),
      jumlahBenar: TypeParser.parseIntOr(json['jumlah_benar'], 0),
      jumlahSalah: TypeParser.parseIntOr(json['jumlah_salah'], 0),
      nilaiPg: TypeParser.parseDoubleOr(json['nilai_pg'], na),
      nilaiEssay: TypeParser.parseDoubleOr(json['nilai_essay'], 0.0),
      nilaiAkhir: na,
      statusKelulusan: (json['status_kelulusan'] ?? 'PENDING').toString(),
      kkm: TypeParser.parseDoubleOr(json['kkm'], 75.0),
      waktuSelesai: (json['waktu_selesai'] ?? '-').toString(),
    );
  }
}
