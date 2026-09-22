import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/db_helper.dart';
import 'dashboard_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscureText = true;

  @override
  void initState() {
    super.initState();
    _checkSession();
  }

  void _checkSession() async {
    final siswa = await DbHelper.getSiswa();
    if (siswa != null && mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => DashboardPage(siswa: siswa)),
      );
    }
  }

  void _handleLogin() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      _showSnackbar("Harap isi username dan password!", isError: true);
      return;
    }

    setState(() => _isLoading = true);
    final res = await ApiService.login(username, password);
    setState(() => _isLoading = false);

    if (res == null) {
      _showSnackbar("Gagal terhubung ke server! Periksa IP Server & Wi-Fi.", isError: true);
      return;
    }

    if (res['user'] != null && res['user']['role'] != 'siswa') {
      _showSnackbar("Akun Admin & Guru hanya dapat login via Portal Web!", isError: true);
      return;
    }

    if (res['user'] != null && res['user']['role'] == 'siswa' && res['profil'] != null) {
      final profil = Map<String, dynamic>.from(res['profil']);
      await DbHelper.saveSiswa(profil);

      if (mounted) {
        _showSnackbar("Login Berhasil! Selamat datang, ${profil['nama']}");
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => DashboardPage(siswa: profil)),
        );
      }
    } else {
      _showSnackbar("Username atau Password salah!", isError: true);
    }
  }

  void _showSnackbar(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              color: Colors.white,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                msg,
                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? const Color(0xFFEF4444) : const Color(0xFF10B981),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _quickFill(String username, String password) {
    _usernameController.text = username;
    _passwordController.text = password;
    _showSnackbar("Autofill akun '$username' berhasil!");
  }

  void _openSettingsDialog() async {
    final currentIp = await ApiService.getServerIp();
    final ipController = TextEditingController(text: currentIp);
    if (!mounted) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.wifi_tethering, color: Color(0xFF2563EB)),
            SizedBox(width: 10),
            Text("Pengaturan IP Server", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Masukkan Alamat IP & Port server backend yang terhubung ke jaringan Wi-Fi Anda.",
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: ipController,
              decoration: InputDecoration(
                hintText: "Contoh: 192.168.1.147:3000",
                labelText: "IP & Port Server",
                prefixIcon: const Icon(Icons.dns_outlined, color: Color(0xFF2563EB)),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Batal", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            icon: const Icon(Icons.save_rounded, size: 18),
            label: const Text("Simpan"),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () async {
              final newIp = ipController.text.trim();
              if (newIp.isNotEmpty) {
                await ApiService.setServerIp(newIp);
                if (!context.mounted) return;
                Navigator.pop(context);
                _showSnackbar("IP Server diperbarui ke $newIp");
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12, top: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: IconButton(
              icon: const Icon(Icons.settings_outlined, color: Color(0xFF2563EB)),
              onPressed: _openSettingsDialog,
              tooltip: "Pengaturan IP Server",
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Branding Header
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF2563EB).withOpacity(0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.assignment_turned_in_rounded,
                    color: Colors.white,
                    size: 42,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  "PORTAL CBT MOBILE",
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  "Aplikasi Ujian Siswa Real-Time Mandiri",
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 32),

                // Card Container Form
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withOpacity(0.06),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Masuk Akun Siswa",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Quick Fill Test Chips
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            const Text(
                              "Quick Fill: ",
                              style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                            ),
                            ActionChip(
                              avatar: const Icon(Icons.person, size: 14, color: Color(0xFF2563EB)),
                              label: const Text("siswa", style: TextStyle(fontSize: 11)),
                              backgroundColor: const Color(0xFFEFF6FF),
                              onPressed: () => _quickFill("siswa", "siswa"),
                            ),
                            const SizedBox(width: 6),
                            ActionChip(
                              avatar: const Icon(Icons.person_outline, size: 14, color: Color(0xFF2563EB)),
                              label: const Text("siswa2", style: TextStyle(fontSize: 11)),
                              backgroundColor: const Color(0xFFEFF6FF),
                              onPressed: () => _quickFill("siswa2", "siswa2"),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Username Input
                      TextField(
                        controller: _usernameController,
                        textInputAction: TextInputAction.next,
                        decoration: InputDecoration(
                          labelText: "Username / NIS",
                          hintText: "Contoh: siswa",
                          prefixIcon: const Icon(Icons.person_rounded, color: Color(0xFF2563EB)),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Password Input
                      TextField(
                        controller: _passwordController,
                        obscureText: _obscureText,
                        onSubmitted: (_) => _handleLogin(),
                        decoration: InputDecoration(
                          labelText: "Password",
                          hintText: "Masukkan kata sandi...",
                          prefixIcon: const Icon(Icons.lock_rounded, color: Color(0xFF2563EB)),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscureText ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                              color: const Color(0xFF64748B),
                            ),
                            onPressed: () => setState(() => _obscureText = !_obscureText),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(color: Color(0xFF2563EB), width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Submit Button
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _isLoading ? null : _handleLogin,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(0xFF93C5FD),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            elevation: 4,
                            shadowColor: const Color(0xFF2563EB).withOpacity(0.4),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      "MASUK SESI UJIAN",
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                    SizedBox(width: 8),
                                    Icon(Icons.arrow_forward_rounded, size: 20),
                                  ],
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                
                // Info Footer
                const Text(
                  "© Portal CBT System • Secure Offline Caching",
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
