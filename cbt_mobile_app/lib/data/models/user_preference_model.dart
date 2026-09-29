import '../../domain/entities/user_preference.dart';

class UserPreferenceModel extends UserPreference {
  const UserPreferenceModel({
    required super.userId,
    required super.theme,
    required super.fontScale,
    required super.highContrast,
  });

  factory UserPreferenceModel.fromJson(Map<String, dynamic> json) {
    return UserPreferenceModel(
      userId: json['user_id'] is int ? json['user_id'] : int.tryParse(json['user_id']?.toString() ?? '0') ?? 0,
      theme: json['theme']?.toString() ?? 'system',
      fontScale: json['font_scale']?.toString() ?? 'normal',
      highContrast: json['high_contrast'] == 1 || json['high_contrast'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'theme': theme,
      'font_scale': fontScale,
      'high_contrast': highContrast ? 1 : 0,
    };
  }
}
