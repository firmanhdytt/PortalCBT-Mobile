const masterRepo = require('../repositories/masterRepository');
const userRepo = require('../repositories/userRepository');
const ErrorCodes = require('../utils/errorCodes');

class MasterService {
  // --- KELAS ---
  async getAllKelas() {
    return await masterRepo.findAllKelas();
  }

  async createKelas(data) {
    const namaKelas = typeof data === 'object' && data !== null ? data.nama_kelas : data;
    if (!namaKelas || !namaKelas.trim()) {
      const err = new Error('Nama kelas wajib diisi!');
      err.statusCode = 400;
      err.code = ErrorCodes.VALIDATION_ERROR;
      throw err;
    }

    const existing = await masterRepo.findKelasByName(namaKelas.trim());
    if (existing) {
      const err = new Error('Kelas dengan nama tersebut sudah ada!');
      err.statusCode = 409;
      err.code = ErrorCodes.CONFLICT;
      throw err;
    }

    return await masterRepo.createKelas({ nama_kelas: namaKelas.trim() });
  }

  // --- MATA PELAJARAN ---
  async getAllMapel() {
    return await masterRepo.findAllMapel();
  }

  async createMapel(data, maybeNama) {
    const kodeMapel = typeof data === 'object' && data !== null ? data.kode_mapel : data;
    const namaMapel = typeof data === 'object' && data !== null ? data.nama_mapel : maybeNama;

    if (!kodeMapel || !namaMapel) {
      const err = new Error('Kode dan Nama mata pelajaran wajib diisi!');
      err.statusCode = 400;
      err.code = ErrorCodes.VALIDATION_ERROR;
      throw err;
    }

    const existing = await masterRepo.findMapelByKode(kodeMapel.trim().toUpperCase());
    if (existing) {
      const err = new Error('Kode mata pelajaran sudah digunakan!');
      err.statusCode = 409;
      err.code = ErrorCodes.CONFLICT;
      throw err;
    }

    return await masterRepo.createMapel({
      kode_mapel: kodeMapel.trim().toUpperCase(),
      nama_mapel: namaMapel.trim()
    });
  }

  // --- SISWA ---
  async getAllStudents() {
    return await userRepo.findAllStudents();
  }

  async getAllSiswa() {
    return await this.getAllStudents();
  }

  async registerStudent(nis, nama, kelasId, password) {
    if (!nis || !nama || !kelasId) {
      const err = new Error('NIS, Nama, dan Kelas wajib diisi!');
      err.statusCode = 400;
      err.code = ErrorCodes.VALIDATION_ERROR;
      throw err;
    }

    const cleanNis = nis.toString().trim();
    const existingUser = await userRepo.findByUsername(cleanNis);
    if (existingUser) {
      const err = new Error('Siswa dengan NIS tersebut sudah terdaftar!');
      err.statusCode = 409;
      err.code = ErrorCodes.CONFLICT;
      throw err;
    }

    const kelas = await masterRepo.findKelasById(kelasId);
    if (!kelas) {
      const err = new Error('Kelas yang dipilih tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    // 1. Create User account
    const user = await userRepo.createUser({
      username: cleanNis,
      password: password || cleanNis,
      email: `${cleanNis}@cbt.local`,
      role: 'siswa',
      is_active: 1
    });

    // 2. Create Student profile
    const student = await userRepo.createStudent({
      user_id: user.id,
      nis: cleanNis,
      nama: nama.trim(),
      kelas_id: parseInt(kelasId)
    });

    return {
      ...student,
      nama_kelas: kelas.nama_kelas
    };
  }

  async createSiswa(data) {
    return await this.registerStudent(data.nis, data.nama, data.kelas_id, data.password);
  }

  async deleteStudent(id) {
    const student = await userRepo.findStudentById(id);
    if (!student) {
      const err = new Error('Data siswa tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    if (student.user_id) {
      await userRepo.deleteUser(student.user_id);
    }
    await userRepo.deleteStudent(id);
    return true;
  }

  async deleteSiswa(id) {
    return await this.deleteStudent(id);
  }
}

module.exports = new MasterService();
