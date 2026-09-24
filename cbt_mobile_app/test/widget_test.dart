import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:cbt_mobile_app/main.dart';

void main() {
  testWidgets('CBT Mobile App smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const MyApp());

    // Verify that MaterialApp is mounted
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}

