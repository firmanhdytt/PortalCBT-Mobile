class Option {
  final int id;
  final int soalId;
  final String label;
  final String teksPilihan;

  const Option({
    required this.id,
    required this.soalId,
    required this.label,
    required this.teksPilihan,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Option && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
