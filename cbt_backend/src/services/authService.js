const userRepo = require('../repositories/userRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class AuthService {
  async login(username, password) {
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

    // Direct password match (Phase 3 will upgrade to bcrypt hashing)
    if (user.password !== password) {
      throw new ApiError('Username atau Password salah!', 401, ERROR_CODES.AUTH_INVALID);
    }

    // Resolve profile based on role
    const profil = await userRepo.findProfileByRoleAndUserId(user.role, user.id);

    return {
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

    const user = await userRepo.createUser({
      username: cleanNis,
      password: password || cleanNis,
      role: 'siswa'
    });

    const student = await userRepo.createStudent({
      user_id: user.id,
      nis: cleanNis,
      nama: nama.trim(),
      kelas_id: parseInt(kelas_id)
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      profil: student
    };
  }
}

module.exports = new AuthService();
