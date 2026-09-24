const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');
const tokenRepo = require('../repositories/tokenRepository');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class AuthService {
  /**
   * Login user with username/NIS and password
   */
  async login(username, password, meta = {}) {
    if (!username || !password) {
      throw new ApiError('Username dan Password wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const cleanInput = username.toString().trim();
    let user = await userRepo.findByUsername(cleanInput);

    // If not found by username, check if input matches student NIS
    if (!user) {
      const student = await userRepo.findStudentByNis(cleanInput);
      if (student && student.user_id) {
        user = await userRepo.findById(student.user_id);
      }
    }

    if (!user) {
      throw new ApiError('Username atau Password salah!', 401, ERROR_CODES.AUTH_INVALID);
    }

    // Check password
    let passwordMatches = false;
    const isBcrypt = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'));

    if (isBcrypt) {
      passwordMatches = await bcrypt.compare(password, user.password);
    } else {
      // Graceful fallback for legacy plain-text: compare and auto-upgrade to bcrypt hash
      if (user.password === password) {
        passwordMatches = true;
        const newHash = await bcrypt.hash(password, 10);
        await userRepo.updatePassword(user.id, newHash);
      }
    }

    if (!passwordMatches) {
      throw new ApiError('Username atau Password salah!', 401, ERROR_CODES.AUTH_INVALID);
    }

    // Resolve profile based on role
    const profil = await userRepo.findProfileByRoleAndUserId(user.role, user.id);

    // Generate JWT Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Persist refresh token in database (expires in 7 days)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    try {
      await tokenRepo.saveToken({
        userId: user.id,
        refreshToken,
        expiresAt,
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null
      });
    } catch (e) {
      console.warn('Notice: token storage:', e.message);
    }

    return {
      token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        avatar: user.avatar
      },
      profil
    };
  }

  /**
   * Refresh Access Token using Refresh Token
   */
  async refreshToken(refreshTokenStr, meta = {}) {
    if (!refreshTokenStr) {
      throw new ApiError('Refresh token wajib disertakan!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenStr);
    } catch (err) {
      throw new ApiError('Refresh token tidak valid atau telah kedaluwarsa!', 401, ERROR_CODES.AUTH_INVALID);
    }

    // Verify token exists and not revoked in DB
    const dbToken = await tokenRepo.findValidToken(refreshTokenStr);
    if (!dbToken) {
      throw new ApiError('Refresh token telah dicabut atau tidak terdaftar!', 401, ERROR_CODES.AUTH_INVALID);
    }

    const user = await userRepo.findById(decoded.id);
    if (!user) {
      throw new ApiError('Pengguna tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Generate new Access Token and optionally new Refresh Token
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Rotate refresh token: revoke old, save new
    await tokenRepo.revokeToken(refreshTokenStr);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await tokenRepo.saveToken({
      userId: user.id,
      refreshToken: newRefreshToken,
      expiresAt,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null
    });

    return {
      token: newAccessToken,
      refresh_token: newRefreshToken
    };
  }

  /**
   * Register new student
   */
  async registerSiswa(data) {
    const { nis, nama, kelas_id, password } = data;
    if (!nis || !nama || !kelas_id) {
      throw new ApiError('NIS, Nama, dan Kelas wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const cleanNis = nis.toString().trim();
    const existing = await userRepo.findByUsername(cleanNis);
    if (existing) {
      throw new ApiError('Siswa dengan NIS tersebut sudah terdaftar!', 409, ERROR_CODES.CONFLICT);
    }

    const hashedPassword = await bcrypt.hash(password || cleanNis, 10);

    const user = await userRepo.createUser({
      username: cleanNis,
      password: hashedPassword,
      email: `${cleanNis}@cbt.local`,
      role: 'siswa',
      is_active: 1
    });

    const student = await userRepo.createStudent({
      user_id: user.id,
      nis: cleanNis,
      nama: nama.trim(),
      kelas_id: parseInt(kelas_id)
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      profil: student
    };
  }

  /**
   * Get Current Authenticated User & Profile
   */
  async getMe(userId) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new ApiError('Pengguna tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const profil = await userRepo.findProfileByRoleAndUserId(user.role, user.id);
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        avatar: user.avatar,
        created_at: user.created_at
      },
      profil
    };
  }

  /**
   * Logout and revoke refresh token
   */
  async logout(refreshTokenStr) {
    if (refreshTokenStr) {
      await tokenRepo.revokeToken(refreshTokenStr);
    }
    return true;
  }
}

module.exports = new AuthService();
