import '../../core/utils/type_parser.dart';
import '../../domain/entities/question.dart';
import 'option_model.dart';

class QuestionModel extends Question {
  const QuestionModel({
    required super.id,
    required super.ujianId,
    required super.jenisSoal,
    required super.teksSoal,
    super.gambarUrl,
    super.gambarLokal,
    super.bobot,
    required super.nomorUrut,
    super.options,
  });

  factory QuestionModel.fromJson(Map<String, dynamic> json, {int? defaultUjianId}) {
    List<OptionModel> opts = [];
    final questionId = TypeParser.parseInt(json['id']);
    if (json['pilihan'] != null && json['pilihan'] is List) {
      opts = (json['pilihan'] as List)
          .whereType<Map<String, dynamic>>()
          .map((o) => OptionModel.fromJson(o, defaultSoalId: questionId))
          .toList();
    }

    return QuestionModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      ujianId: TypeParser.parseIntOr(json['ujian_id'], defaultUjianId ?? 0),
      jenisSoal: json['jenis_soal']?.toString() ?? 'pg',
      teksSoal: json['teks_soal']?.toString() ?? '',
      gambarUrl: json['gambar_url']?.toString(),
      bobot: TypeParser.parseDoubleOr(json['bobot'], 1.0),
      nomorUrut: TypeParser.parseIntOr(json['nomor_urut'], 1),
      options: opts,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ujian_id': ujianId,
      'jenis_soal': jenisSoal,
      'teks_soal': teksSoal,
      'gambar_url': gambarUrl,
      'bobot': bobot,
      'nomor_urut': nomorUrut,
      'pilihan': options.map((o) => (o as OptionModel).toJson()).toList(),
    };
  }

  factory QuestionModel.fromDb(Map<String, dynamic> map, {List<OptionModel> options = const []}) {
    return QuestionModel(
      id: TypeParser.parseIntOr(map['id'], 0),
      ujianId: TypeParser.parseIntOr(map['ujian_id'], 0),
      jenisSoal: map['jenis_soal']?.toString() ?? 'pg',
      teksSoal: map['teks_soal']?.toString() ?? '',
      gambarUrl: map['gambar_url']?.toString(),
      gambarLokal: map['gambar_lokal']?.toString(),
      bobot: TypeParser.parseDoubleOr(map['bobot'], 1.0),
      nomorUrut: TypeParser.parseIntOr(map['nomor_urut'], 1),
      options: options,
    );
  }

  Map<String, dynamic> toDb() {
    return {
      'id': id,
      'ujian_id': ujianId,
      'jenis_soal': jenisSoal,
      'teks_soal': teksSoal,
      'gambar_url': gambarUrl ?? '',
      'gambar_lokal': gambarLokal,
      'bobot': bobot,
      'nomor_urut': nomorUrut,
    };
  }
}
