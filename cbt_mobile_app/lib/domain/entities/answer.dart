class Answer {
  final int? id;
  final int siswaId;
  final int ujianId;
  final int soalId;
  final int? pilihanJawabanId;
  final String teksJawabanEssay;
  final bool isRagu;
  final DateTime waktuDijawab;
  final String syncStatus; // 'pending' | 'synced'

  const Answer({
    this.id,
    required this.siswaId,
    required this.ujianId,
    required this.soalId,
    this.pilihanJawabanId,
    this.teksJawabanEssay = '',
    this.isRagu = false,
    required this.waktuDijawab,
    this.syncStatus = 'pending',
  });

  Answer copyWith({
    int? id,
    int? siswaId,
    int? ujianId,
    int? soalId,
    int? pilihanJawabanId,
    String? teksJawabanEssay,
    bool? isRagu,
    DateTime? waktuDijawab,
    String? syncStatus,
  }) {
    return Answer(
      id: id ?? this.id,
      siswaId: siswaId ?? this.siswaId,
      ujianId: ujianId ?? this.ujianId,
      soalId: soalId ?? this.soalId,
      pilihanJawabanId: pilihanJawabanId ?? this.pilihanJawabanId,
      teksJawabanEssay: teksJawabanEssay ?? this.teksJawabanEssay,
      isRagu: isRagu ?? this.isRagu,
      waktuDijawab: waktuDijawab ?? this.waktuDijawab,
      syncStatus: syncStatus ?? this.syncStatus,
    );
  }

  bool get isAnswered =>
      pilihanJawabanId != null || teksJawabanEssay.trim().isNotEmpty;

  bool get isSynced => syncStatus == 'synced';
}
