const db = require('../database/db');

class UserRepository {
  async findByUsername(username) {
    return await db.getOne('SELECT * FROM users WHERE username = ?', [username]);
  }

  async findById(id) {
    return await db.getOne('SELECT * FROM users WHERE id = ?', [id]);
  }

  async findProfileByRoleAndUserId(role, userId) {
    if (role === 'siswa') {
      return await db.getOne(`
        SELECT s.*, k.nama_kelas 
        FROM siswa s 
        LEFT JOIN kelas k ON s.kelas_id = k.id 
        WHERE s.user_id = ?
      `, [userId]);
    } else if (role === 'guru') {
      return await db.getOne('SELECT * FROM guru WHERE user_id = ?', [userId]);
    }
    return null;
  }

  async createUser(userData) {
    return await db.insert('users', userData);
  }

  async deleteUser(id) {
    return await db.delete('users', id);
  }

  async updatePassword(id, hashedPassword) {
    return await db.update('users', id, { password: hashedPassword });
  }


  async findAllStudents() {
    return await db.query(`
      SELECT s.id, s.user_id, s.nis, s.nama, s.kelas_id, k.nama_kelas, s.email, s.status, s.avatar, s.created_at
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      ORDER BY s.id DESC
    `);
  }

  async findStudentById(id) {
    return await db.getOne(`
      SELECT s.*, k.nama_kelas 
      FROM siswa s 
      LEFT JOIN kelas k ON s.kelas_id = k.id 
      WHERE s.id = ?
    `, [id]);
  }

  async findStudentByNis(nis) {
    return await db.getOne('SELECT * FROM siswa WHERE nis = ?', [nis]);
  }

  async findStudentByUserId(userId) {
    return await db.getOne('SELECT * FROM siswa WHERE user_id = ?', [userId]);
  }

  async createStudent(studentData) {
    return await db.insert('siswa', studentData);
  }

  async deleteStudent(id) {
    return await db.delete('siswa', id);
  }

  async findTeacherByUserId(userId) {
    return await db.getOne('SELECT * FROM guru WHERE user_id = ?', [userId]);
  }

  async findTeacherById(id) {
    return await db.getOne('SELECT * FROM guru WHERE id = ?', [id]);
  }

  async findTeacherByNip(nip) {
    return await db.getOne('SELECT * FROM guru WHERE nip = ?', [nip]);
  }

  /**
   * Update nama & email pengguna secara tersinkronisasi antar tabel
   */
  async updateProfile(userId, role, { nama, email }) {
    if (email !== undefined) {
      await db.query('UPDATE users SET email = ? WHERE id = ?', [email || null, userId]);
    }

    if (role === 'siswa') {
      const updates = [];
      const params = [];
      if (nama) { updates.push('nama = ?'); params.push(nama); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
      if (updates.length > 0) {
        params.push(userId);
        await db.query(`UPDATE siswa SET ${updates.join(', ')} WHERE user_id = ?`, params);
      }
    } else if (role === 'guru') {
      const updates = [];
      const params = [];
      if (nama) { updates.push('nama = ?'); params.push(nama); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
      if (updates.length > 0) {
        params.push(userId);
        await db.query(`UPDATE guru SET ${updates.join(', ')} WHERE user_id = ?`, params);
      }
    }
    return true;
  }

  /**
   * Update path/URL avatar pengguna
   */
  async updateAvatar(userId, role, avatarUrl) {
    await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, userId]);
    if (role === 'siswa') {
      await db.query('UPDATE siswa SET avatar = ? WHERE user_id = ?', [avatarUrl, userId]);
    } else if (role === 'guru') {
      await db.query('UPDATE guru SET avatar = ? WHERE user_id = ?', [avatarUrl, userId]);
    }
    return true;
  }

  /**
   * Hapus avatar pengguna (kembalikan ke NULL)
   */
  async removeAvatar(userId, role) {
    await db.query('UPDATE users SET avatar = NULL WHERE id = ?', [userId]);
    if (role === 'siswa') {
      await db.query('UPDATE siswa SET avatar = NULL WHERE user_id = ?', [userId]);
    } else if (role === 'guru') {
      await db.query('UPDATE guru SET avatar = NULL WHERE user_id = ?', [userId]);
    }
    return true;
  }
}

module.exports = new UserRepository();
