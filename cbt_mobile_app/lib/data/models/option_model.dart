import '../../core/utils/type_parser.dart';
import '../../domain/entities/option.dart';

class OptionModel extends Option {
  const OptionModel({
    required super.id,
    required super.soalId,
    required super.label,
    required super.teksPilihan,
  });

  factory OptionModel.fromJson(Map<String, dynamic> json, {int? defaultSoalId}) {
    return OptionModel(
      id: TypeParser.parseIntOr(json['id'], 0),
      soalId: TypeParser.parseIntOr(json['soal_id'], defaultSoalId ?? 0),
      label: json['label']?.toString() ?? '',
      teksPilihan: json['teks_pilihan']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'soal_id': soalId,
      'label': label,
      'teks_pilihan': teksPilihan,
    };
  }

  factory OptionModel.fromDb(Map<String, dynamic> map) {
    return OptionModel(
      id: TypeParser.parseIntOr(map['id'], 0),
      soalId: TypeParser.parseIntOr(map['soal_id'], 0),
      label: map['label']?.toString() ?? '',
      teksPilihan: map['teks_pilihan']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toDb() {
    return {
      'id': id,
      'soal_id': soalId,
      'label': label,
      'teks_pilihan': teksPilihan,
    };
  }
}
