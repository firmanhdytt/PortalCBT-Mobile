import 'option.dart';

class Question {
  final int id;
  final int ujianId;
  final String jenisSoal; // 'PG' | 'ESSAY'
  final String teksSoal;
  final String? gambarUrl;
  final String? gambarLokal;
  final double bobot;
  final int nomorUrut;
  final List<Option> options;

  const Question({
    required this.id,
    required this.ujianId,
    required this.jenisSoal,
    required this.teksSoal,
    this.gambarUrl,
    this.gambarLokal,
    this.bobot = 1.0,
    required this.nomorUrut,
    this.options = const [],
  });

  List<Option> get pilihan => options;
  bool get isEssay => jenisSoal.toUpperCase() == 'ESSAY';
  bool get isMultipleChoice => jenisSoal.toUpperCase() == 'PG';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Question && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
