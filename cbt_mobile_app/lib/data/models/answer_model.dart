import '../../domain/entities/answer.dart';

class AnswerModel extends Answer {
  const AnswerModel({
    super.id,
    required super.siswaId,
    required super.ujianId,
    required super.soalId,
    super.pilihanJawabanId,
    super.teksJawabanEssay,
    super.isRagu,
    required super.waktuDijawab,
    super.syncStatus,
  });

  factory AnswerModel.fromEntity(Answer entity) {
    return AnswerModel(
      id: entity.id,
      siswaId: entity.siswaId,
      ujianId: entity.ujianId,
      soalId: entity.soalId,
      pilihanJawabanId: entity.pilihanJawabanId,
      teksJawabanEssay: entity.teksJawabanEssay,
      isRagu: entity.isRagu,
      waktuDijawab: entity.waktuDijawab,
      syncStatus: entity.syncStatus,
    );
  }

  factory AnswerModel.fromDb(Map<String, dynamic> map) {
    return AnswerModel(
      id: map['id'] as int?,
      siswaId: map['siswa_id'] as int,
      ujianId: map['ujian_id'] as int,
      soalId: map['soal_id'] as int,
      pilihanJawabanId: map['pilihan_jawaban_id'] as int?,
      teksJawabanEssay: (map['teks_jawaban_essay'] ?? '').toString(),
      isRagu: (map['is_ragu'] as int? ?? 0) == 1,
      waktuDijawab: DateTime.tryParse(map['waktu_dijawab'].toString()) ?? DateTime.now(),
      syncStatus: (map['sync_status'] ?? 'pending').toString(),
    );
  }

  Map<String, dynamic> toDb() {
    final map = <String, dynamic>{
      'siswa_id': siswaId,
      'ujian_id': ujianId,
      'soal_id': soalId,
      'pilihan_jawaban_id': pilihanJawabanId,
      'teks_jawaban_essay': teksJawabanEssay,
      'is_ragu': isRagu ? 1 : 0,
      'waktu_dijawab': waktuDijawab.toIso8601String(),
      'sync_status': syncStatus,
    };
    if (id != null) map['id'] = id;
    return map;
  }

  Map<String, dynamic> toSyncJson() {
    return {
      'soal_id': soalId,
      'pilihan_jawaban_id': pilihanJawabanId,
      'teks_jawaban_essay': teksJawabanEssay,
      'is_ragu': isRagu ? 1 : 0,
    };
  }
}
