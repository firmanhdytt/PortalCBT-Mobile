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
}

module.exports = new UserRepository();
