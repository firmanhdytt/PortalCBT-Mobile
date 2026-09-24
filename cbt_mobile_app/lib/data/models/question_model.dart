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
    if (json['pilihan'] != null && json['pilihan'] is List) {
      opts = (json['pilihan'] as List)
          .map((o) => OptionModel.fromJson(o as Map<String, dynamic>, defaultSoalId: json['id'] as int?))
          .toList();
    }

    return QuestionModel(
      id: json['id'] as int,
      ujianId: (json['ujian_id'] ?? defaultUjianId ?? 0) as int,
      jenisSoal: json['jenis_soal'].toString(),
      teksSoal: json['teks_soal'].toString(),
      gambarUrl: json['gambar_url']?.toString(),
      bobot: (json['bobot'] as num?)?.toDouble() ?? 1.0,
      nomorUrut: json['nomor_urut'] as int? ?? 1,
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
      id: map['id'] as int,
      ujianId: map['ujian_id'] as int,
      jenisSoal: map['jenis_soal'].toString(),
      teksSoal: map['teks_soal'].toString(),
      gambarUrl: map['gambar_url']?.toString(),
      gambarLokal: map['gambar_lokal']?.toString(),
      bobot: (map['bobot'] as num?)?.toDouble() ?? 1.0,
      nomorUrut: map['nomor_urut'] as int,
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
