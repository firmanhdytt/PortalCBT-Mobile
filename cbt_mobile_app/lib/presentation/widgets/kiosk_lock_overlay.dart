import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class KioskLockOverlay extends StatefulWidget {
  final int strikes;
  final int maxViolations;
  final bool isRequestingUnlock;
  final String? pendingRequestStatus; // null, 'PENDING', 'APPROVED', 'REJECTED'
  final Future<void> Function(String reason) onRequestUnlock;
  final Future<void> Function() onCheckStatus;
  final VoidCallback onForceExit;

  const KioskLockOverlay({
    super.key,
    required this.strikes,
    required this.maxViolations,
    required this.isRequestingUnlock,
    required this.pendingRequestStatus,
    required this.onRequestUnlock,
    required this.onCheckStatus,
    required this.onForceExit,
  });

  @override
  State<KioskLockOverlay> createState() => _KioskLockOverlayState();
}

class _KioskLockOverlayState extends State<KioskLockOverlay> {
  final TextEditingController _reasonController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() async {
    final text = _reasonController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Harap tuliskan alasan permohonan buka kunci!')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    await widget.onRequestUnlock(text);
    if (mounted) {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPending = widget.pendingRequestStatus == 'PENDING';

    return Container(
      color: Colors.black.withOpacity(0.85),
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
      child: Center(
        child: SingleChildScrollView(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 460),
            padding: const EdgeInsets.all(28.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24.0),
              boxShadow: [
                BoxShadow(
                  color: Colors.red.withOpacity(0.3),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.lock_person_rounded,
                    color: AppColors.danger,
                    size: 56,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'UJIAN TERKUNCI',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                    color: AppColors.danger,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Pelanggaran anti-cheat telah mencapai batas (${widget.strikes}/${widget.maxViolations}). Sesi ujian Anda telah dibekukan demi menjaga integritas tes.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                if (!isPending) ...[
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Alasan / Klarifikasi ke Pengawas:',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _reasonController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Contoh: Layar mati otomatis / tidak sengaja tersentuh tombol back...',
                      hintStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.primary, width: 2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: (_isSubmitting || widget.isRequestingUnlock) ? null : _submit,
                      icon: (_isSubmitting || widget.isRequestingUnlock)
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.send_rounded, size: 18),
                      label: Text(
                        (_isSubmitting || widget.isRequestingUnlock)
                            ? 'MENGIRIMKAN...'
                            : 'MOHON BUKA KUNCI',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.shade300),
                    ),
                    child: const Row(
                      children: [
                        SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange),
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Permohonan Anda sedang ditinjau oleh guru pengawas. Layar akan terbuka otomatis saat disetujui.',
                            style: TextStyle(fontSize: 12, color: Colors.brown, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: OutlinedButton.icon(
                      onPressed: widget.onCheckStatus,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Periksa Status Sekarang'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.primary,
                        side: const BorderSide(color: AppColors.primary),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                TextButton(
                  onPressed: widget.onForceExit,
                  child: const Text(
                    'Keluar ke Halaman Utama',
                    style: TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
