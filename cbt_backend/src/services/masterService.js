const masterRepo = require('../repositories/masterRepository');
const userRepo = require('../repositories/userRepository');
const ErrorCodes = require('../utils/errorCodes');
const bcrypt = require('bcryptjs');

class MasterService {
  // --- WORKSPACE HELPER & AUTHORIZATION ---
  async getGuruWorkspace(user) {
    if (user.role === 'admin') {
      const allKelas = await masterRepo.findAllKelas();
      const allMapel = await masterRepo.findAllMapel();
      return {
        is_admin: true,
        kelas: allKelas,
        mapel: allMapel
      };
    }

    const guru = await masterRepo.findGuruByUserId(user.id);
    if (!guru) {
      const err = new Error('Data profil guru tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    const assignments = await masterRepo.getGuruAssignmentsByUserId(user.id);
    return {
      is_admin: false,
      guru: { id: guru.id, nama: guru.nama, nip: guru.nip },
      assignments: assignments
    };
  }

  async verifyWorkspaceAccess(user, kelasId, mapelId) {
    if (user.role === 'admin') return true;

    if (user.role === 'guru') {
      const isAssigned = await masterRepo.isGuruAssigned(user.id, kelasId, mapelId);
      if (!isAssigned) {
        const err = new Error('Akses Ditolak: Anda tidak ditugaskan di Kelas & Mata Pelajaran ini!');
        err.statusCode = 403;
        err.code = ErrorCodes.FORBIDDEN;
        throw err;
      }
      return true;
    }

    const err = new Error('Akses Ditolak!');
    err.statusCode = 403;
    err.code = ErrorCodes.FORBIDDEN;
    throw err;
  }

  // --- KELAS ---
  async getAllKelas() {
    return await masterRepo.findAllKelas();
  }

  async getKelasDetail(id) {
    const detail = await masterRepo.getKelasDetail(id);
    if (!detail) {
      const err = new Error('Kelas tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    return detail;
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

    return await masterRepo.createKelas({
      nama_kelas: namaKelas.trim(),
      tingkat: data.tingkat || 'XII',
      jurusan: data.jurusan || 'Umum',
      tahun_ajaran: data.tahun_ajaran || '2025/2026',
      status: data.status || 'aktif'
    });
  }

  async updateKelas(id, data) {
    const existing = await masterRepo.findKelasById(id);
    if (!existing) {
      const err = new Error('Kelas tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    if (data.nama_kelas && data.nama_kelas.trim() !== existing.nama_kelas) {
      const check = await masterRepo.findKelasByName(data.nama_kelas.trim());
      if (check) {
        const err = new Error('Kelas dengan nama tersebut sudah ada!');
        err.statusCode = 409;
        err.code = ErrorCodes.CONFLICT;
        throw err;
      }
    }

    return await masterRepo.updateKelas(id, data);
  }

  async deleteKelas(id) {
    const existing = await masterRepo.findKelasById(id);
    if (!existing) {
      const err = new Error('Kelas tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    await masterRepo.deleteKelas(id);
    return true;
  }

  // --- MATA PELAJARAN ---
  async getAllMapel() {
    return await masterRepo.findAllMapel();
  }

  async getMapelDetail(id) {
    const detail = await masterRepo.getMapelDetail(id);
    if (!detail) {
      const err = new Error('Mata pelajaran tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    return detail;
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
      nama_mapel: namaMapel.trim(),
      status: data.status || 'aktif'
    });
  }

  async updateMapel(id, data) {
    const existing = await masterRepo.findMapelById(id);
    if (!existing) {
      const err = new Error('Mata pelajaran tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    return await masterRepo.updateMapel(id, data);
  }

  async deleteMapel(id) {
    const existing = await masterRepo.findMapelById(id);
    if (!existing) {
      const err = new Error('Mata pelajaran tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    await masterRepo.deleteMapel(id);
    return true;
  }

  // --- SISWA ---
  async getAllSiswa() {
    return await userRepo.findAllStudents();
  }

  async getSiswaById(id) {
    const siswa = await masterRepo.getSiswaDetail(id);
    if (!siswa) {
      const err = new Error('Data siswa tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    return siswa;
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

  async updateSiswa(id, data) {
    const student = await userRepo.findStudentById(id);
    if (!student) {
      const err = new Error('Data siswa tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    if (data.kelas_id) {
      const kelas = await masterRepo.findKelasById(data.kelas_id);
      if (!kelas) {
        const err = new Error('Kelas yang dipilih tidak ditemukan!');
        err.statusCode = 404;
        err.code = ErrorCodes.NOT_FOUND;
        throw err;
      }
    }

    const updatePayload = {};
    if (data.nama) updatePayload.nama = data.nama.trim();
    if (data.kelas_id) updatePayload.kelas_id = parseInt(data.kelas_id);
    if (data.email !== undefined) updatePayload.email = data.email || null;
    if (data.status) updatePayload.status = data.status;

    await userRepo.updateProfile(student.user_id, 'siswa', updatePayload);
    if (data.kelas_id) {
      const db = require('../database/db');
      await db.query('UPDATE siswa SET kelas_id = ? WHERE id = ?', [parseInt(data.kelas_id), id]);
    }

    if (data.password && data.password.trim()) {
      const hashedPassword = await bcrypt.hash(data.password.trim(), 10);
      await userRepo.updatePassword(student.user_id, hashedPassword);
    }

    return await masterRepo.getSiswaDetail(id);
  }

  async deleteSiswa(id) {
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

  // --- GURU MANAGEMENT ---
  async getAllGuru() {
    return await masterRepo.findAllGuru();
  }

  async getGuruById(id) {
    const guru = await masterRepo.getGuruDetail(id);
    if (!guru) {
      const err = new Error('Data guru tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }
    return guru;
  }

  async createGuru(data) {
    const { nip, nama, email, password, assignments } = data;

    if (!nip || !nama) {
      const err = new Error('NIP dan Nama guru wajib diisi!');
      err.statusCode = 400;
      err.code = ErrorCodes.VALIDATION_ERROR;
      throw err;
    }

    const cleanNip = nip.toString().trim();
    const existingUser = await userRepo.findByUsername(cleanNip);
    if (existingUser) {
      const err = new Error('Guru dengan NIP tersebut sudah terdaftar!');
      err.statusCode = 409;
      err.code = ErrorCodes.CONFLICT;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password || cleanNip, 10);
    const user = await userRepo.createUser({
      username: cleanNip,
      password: hashedPassword,
      email: email || `${cleanNip}@cbt.local`,
      role: 'guru',
      is_active: 1
    });

    const guru = await masterRepo.createGuru({
      user_id: user.id,
      nip: cleanNip,
      nama: nama.trim(),
      email: email || null,
      status: 'aktif'
    });

    if (Array.isArray(assignments) && assignments.length > 0) {
      for (const a of assignments) {
        if (a.kelas_id && a.mapel_id) {
          await masterRepo.addGuruAssignment(guru.id, a.kelas_id, a.mapel_id);
        }
      }
    }

    return await masterRepo.getGuruDetail(guru.id);
  }

  async updateGuru(id, data) {
    const guru = await masterRepo.findGuruById(id);
    if (!guru) {
      const err = new Error('Data guru tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    const updatePayload = {};
    if (data.nama) updatePayload.nama = data.nama.trim();
    if (data.email !== undefined) updatePayload.email = data.email || null;
    if (data.status) updatePayload.status = data.status;

    if (Object.keys(updatePayload).length > 0) {
      await masterRepo.updateGuru(id, updatePayload);
      await userRepo.updateProfile(guru.user_id, 'guru', updatePayload);
    }

    if (data.password && data.password.trim()) {
      const hashedPassword = await bcrypt.hash(data.password.trim(), 10);
      await userRepo.updatePassword(guru.user_id, hashedPassword);
    }

    if (Array.isArray(data.assignments)) {
      await masterRepo.clearGuruAssignments(id);
      for (const a of data.assignments) {
        if (a.kelas_id && a.mapel_id) {
          await masterRepo.addGuruAssignment(id, a.kelas_id, a.mapel_id);
        }
      }
    }

    return await masterRepo.getGuruDetail(id);
  }

  async deleteGuru(id) {
    const guru = await masterRepo.findGuruById(id);
    if (!guru) {
      const err = new Error('Data guru tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    await masterRepo.clearGuruAssignments(id);
    if (guru.user_id) {
      await userRepo.deleteUser(guru.user_id);
    }
    await masterRepo.deleteGuru(id);
    return true;
  }

  async assignGuru(guruId, assignments) {
    const guru = await masterRepo.findGuruById(guruId);
    if (!guru) {
      const err = new Error('Guru tidak ditemukan!');
      err.statusCode = 404;
      err.code = ErrorCodes.NOT_FOUND;
      throw err;
    }

    await masterRepo.clearGuruAssignments(guruId);
    for (const a of assignments) {
      if (a.kelas_id && a.mapel_id) {
        await masterRepo.addGuruAssignment(guruId, a.kelas_id, a.mapel_id);
      }
    }
    return await masterRepo.getGuruAssignments(guruId);
  }
}

module.exports = new MasterService();
