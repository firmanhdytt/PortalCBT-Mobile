class UserPreference {
  final int userId;
  final String theme; // 'light', 'dark', 'system'
  final String fontScale; // 'normal', 'medium', 'large'
  final bool highContrast;

  const UserPreference({
    required this.userId,
    required this.theme,
    required this.fontScale,
    required this.highContrast,
  });
}
