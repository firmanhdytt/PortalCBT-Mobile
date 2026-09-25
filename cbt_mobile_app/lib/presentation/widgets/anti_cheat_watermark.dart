import 'dart:math' as math;
import 'package:flutter/material.dart';

class AntiCheatWatermark extends StatelessWidget {
  final String studentName;
  final String studentNis;
  final String examToken;

  const AntiCheatWatermark({
    super.key,
    required this.studentName,
    required this.studentNis,
    required this.examToken,
  });

  @override
  Widget build(BuildContext context) {
    final watermarkText = '$studentName • NIS: $studentNis • $examToken';

    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final height = constraints.maxHeight;

          // Hitung baris dan kolom untuk menutupi layar secara merata
          const double rowSpacing = 160.0;
          final int rowCount = (height / rowSpacing).ceil() + 2;

          return SizedBox(
            width: width,
            height: height,
            child: OverflowBox(
              maxWidth: width * 1.5,
              maxHeight: height * 1.5,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(rowCount, (rowIndex) {
                  return Transform.rotate(
                    angle: -math.pi / 7, // Miring sekitar -25 derajat
                    child: Opacity(
                      opacity: 0.08, // Transparan halus agar tidak mengganggu bacaan
                      child: Text(
                        '$watermarkText     $watermarkText     $watermarkText',
                        maxLines: 1,
                        overflow: TextOverflow.visible,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.black,
                          letterSpacing: 2.0,
                          decoration: TextDecoration.none,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          );
        },
      ),
    );
  }
}
