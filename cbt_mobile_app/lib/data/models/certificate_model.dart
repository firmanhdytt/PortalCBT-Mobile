import '../../core/utils/type_parser.dart';
import '../../domain/entities/certificate.dart';

class CertificateModel extends Certificate {
  const CertificateModel({
    required super.id,
    required super.certificateNumber,
    required super.ujianId,
    required super.namaUjian,
    required super.namaMapel,
    required super.kkm,
    required super.nilaiPg,
    required super.nilaiEssay,
    required super.nilaiAkhir,
    required super.statusKelulusan,
    required super.issuedAt,
    required super.verifyUrl,
    required super.qrDataUrl,
  });

  factory CertificateModel.fromJson(Map<String, dynamic> json) {
    return CertificateModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      certificateNumber: json['certificate_number']?.toString() ?? '',
      ujianId: TypeParser.parseIntOr(json['ujian_id'], 0),
      namaUjian: json['nama_ujian']?.toString() ?? '',
      namaMapel: json['nama_mapel']?.toString() ?? '',
      kkm: TypeParser.parseDoubleOr(json['kkm'], 75.0),
      nilaiPg: TypeParser.parseDoubleOr(json['nilai_pg'], 0.0),
      nilaiEssay: TypeParser.parseDoubleOr(json['nilai_essay'], 0.0),
      nilaiAkhir: TypeParser.parseDoubleOr(json['nilai_akhir'], 0.0),
      statusKelulusan: json['status_kelulusan']?.toString() ?? 'LULUS',
      issuedAt: json['issued_at']?.toString() ?? '',
      verifyUrl: json['verify_url']?.toString() ?? '',
      qrDataUrl: json['qr_data_url']?.toString() ?? '',
    );
  }
}
