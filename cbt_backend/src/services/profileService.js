const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');

class ProfileService {
  /**
   * Helper untuk menghitung inisial fallback dari nama
   */
  getFallbackInitial(name) {
    if (!name || typeof name !== 'string') return 'U';
    const clean = name.trim();
    if (!clean) return 'U';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.substring(0, Math.min(2, clean.length)).toUpperCase();
  }

  /**
   * Ambil data profil lengkap pengguna sesuai role
   */
  async getProfile(userId, role) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('Pengguna tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    const profil = await userRepository.findProfileByRoleAndUserId(role, userId);

    let displayName = user.username;
    let email = user.email || '';
    let avatar = user.avatar || null;
    let extra = {};

    if (role === 'siswa' && profil) {
      displayName = profil.nama || user.username;
      email = profil.email || user.email || '';
      avatar = profil.avatar || user.avatar || null;
      extra = {
        siswa_id: profil.id,
        nis: profil.nis,
        kelas_id: profil.kelas_id,
        nama_kelas: profil.nama_kelas || '-'
      };
    } else if (role === 'guru' && profil) {
      displayName = profil.nama || user.username;
      email = profil.email || user.email || '';
      avatar = profil.avatar || user.avatar || null;
      extra = {
        guru_id: profil.id,
        nip: profil.nip || '-'
      };
    } else if (role === 'admin') {
      displayName = 'Administrator';
    }

    const fallbackInitial = this.getFallbackInitial(displayName);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      nama: displayName,
      email: email,
      avatar: avatar,
      fallback_initial: fallbackInitial,
      ...extra
    };
  }

  /**
   * Update informasi nama dan email pengguna
   */
  async updateProfile(userId, role, { nama, email }) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('Format email tidak valid');
      err.statusCode = 400;
      throw err;
    }

    await userRepository.updateProfile(userId, role, {
      nama: nama ? nama.trim() : undefined,
      email: email !== undefined ? email.trim() : undefined
    });

    return await this.getProfile(userId, role);
  }

  /**
   * Deteksi Magic Bytes (File Signatures) untuk memvalidasi integritas gambar binary asli
   */
  detectImageFormat(buffer) {
    if (!buffer || buffer.length < 12) return null;

    // 1. JPEG / JPG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { ext: '.jpg', mime: 'image/jpeg' };
    }

    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { ext: '.png', mime: 'image/png' };
    }

    // 3. WEBP: RIFF .... WEBP
    const isRiff = buffer.slice(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.slice(8, 12).toString('ascii') === 'WEBP';
    if (isRiff && isWebp) {
      return { ext: '.webp', mime: 'image/webp' };
    }

    // 4. GIF: GIF8
    const isGif = buffer.slice(0, 4).toString('ascii') === 'GIF8';
    if (isGif) {
      return { ext: '.gif', mime: 'image/gif' };
    }

    return null;
  }

  /**
   * Upload / ganti avatar pengguna dengan validasi Magic Bytes dan batas ukuran 2MB
   */
  async uploadAvatar(userId, role, imagePayload, baseUrl = 'http://localhost:3000') {
    if (!imagePayload || typeof imagePayload !== 'string') {
      const err = new Error('Data gambar avatar wajib disertakan (Base64 string atau Data URL)');
      err.statusCode = 400;
      throw err;
    }

    // 1. Ekstrak data binary dari base64 string atau data URI
    let base64String = imagePayload;
    if (imagePayload.includes(',')) {
      base64String = imagePayload.split(',')[1];
    }
    base64String = base64String.trim().replace(/\s/g, '');

    const buffer = Buffer.from(base64String, 'base64');

    // 2. Validasi batas ukuran file (Maksimal 2 MB = 2.097.152 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      const err = new Error(`Ukuran file terlalu besar (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Maksimal ukuran avatar adalah 2 MB.`);
      err.statusCode = 400;
      throw err;
    }

    if (buffer.length < 50) {
      const err = new Error('Berkas gambar tidak valid atau rusak');
      err.statusCode = 400;
      throw err;
    }

    // 3. Validasi Integritas Gambar Berdasarkan Magic Bytes
    const format = this.detectImageFormat(buffer);
    if (!format) {
      const err = new Error('Integritas gambar gagal diverifikasi! Format file harus berupa gambar asli JPEG, PNG, atau WEBP (dilarang memanipulasi ekstensi berkas non-gambar).');
      err.statusCode = 400;
      throw err;
    }

    // 4. Buat folder tujuan jika belum ada
    const uploadsDir = path.join(__dirname, '../../public/uploads/avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 5. Hapus file avatar lama dari disk jika ada
    const currentProfile = await this.getProfile(userId, role);
    if (currentProfile.avatar && currentProfile.avatar.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(currentProfile.avatar);
      const oldFilePath = path.join(uploadsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (e) {
          console.warn('Notice: gagal menghapus avatar lama:', e.message);
        }
      }
    }

    // 6. Tulis file gambar baru ke storage lokal
    const newFilename = `avatar_${role}_${userId}_${Date.now()}${format.ext}`;
    const targetFilePath = path.join(uploadsDir, newFilename);
    fs.writeFileSync(targetFilePath, buffer);

    const relativeUrl = `/uploads/avatars/${newFilename}`;
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${relativeUrl}`;

    // 7. Simpan path URL ke basis data
    await userRepository.updateAvatar(userId, role, relativeUrl);

    return {
      avatar: relativeUrl,
      full_url: fullUrl,
      mime_type: format.mime,
      size_bytes: buffer.length,
      fallback_initial: currentProfile.fallback_initial
    };
  }

  /**
   * Hapus avatar pengguna dari storage dan reset ke NULL di database
   */
  async deleteAvatar(userId, role) {
    const profile = await this.getProfile(userId, role);

    if (profile.avatar && profile.avatar.startsWith('/uploads/avatars/')) {
      const uploadsDir = path.join(__dirname, '../../public/uploads/avatars');
      const filename = path.basename(profile.avatar);
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('Notice: gagal menghapus berkas avatar:', e.message);
        }
      }
    }

    await userRepository.removeAvatar(userId, role);

    return {
      avatar: null,
      fallback_initial: profile.fallback_initial,
      message: 'Foto profil berhasil dihapus dan dikembalikan ke inisial nama default.'
    };
  }

  /**
   * Ganti kata sandi pengguna secara aman dengan verifikasi password saat ini & enkripsi bcrypt
   */
  async changePassword(userId, { current_password, new_password }) {
    if (!current_password || !new_password) {
      const err = new Error('Password saat ini dan password baru wajib diisi');
      err.statusCode = 400;
      throw err;
    }

    if (new_password.length < 6) {
      const err = new Error('Password baru minimal harus terdiri dari 6 karakter');
      err.statusCode = 400;
      throw err;
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('Pengguna tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    // Verifikasi password saat ini
    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));
    let matches = false;

    if (isBcrypt) {
      matches = await bcrypt.compare(current_password, user.password);
    } else {
      matches = user.password === current_password;
    }

    if (!matches) {
      const err = new Error('Password saat ini salah');
      err.statusCode = 400;
      throw err;
    }

    // Enkripsi password baru dengan bcrypt
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await userRepository.updatePassword(userId, hashedPassword);

    return {
      message: 'Password berhasil diubah. Silakan gunakan password baru untuk login berikutnya.'
    };
  }
}

module.exports = new ProfileService();
