class AppNotification {
  final int id;
  final int userId;
  final String title;
  final String message;
  final String type;
  final String category;
  final int? referenceId;
  final bool isRead;
  final String? createdAt;

  const AppNotification({
    required this.id,
    required this.userId,
    required this.title,
    required this.message,
    required this.type,
    required this.category,
    this.referenceId,
    required this.isRead,
    this.createdAt,
  });
}
