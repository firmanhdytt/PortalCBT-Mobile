const masterService = require('../services/masterService');
const { ApiResponse } = require('../utils/response');

class MasterController {
  // Siswa
  async getAllSiswa(req, res, next) {
    try {
      const data = await masterService.getAllSiswa();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createSiswa(req, res, next) {
    try {
      const newSiswa = await masterService.createSiswa(req.body);
      return res.status(200).json({
        message: 'Siswa berhasil ditambahkan!',
        data: newSiswa
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteSiswa(req, res, next) {
    try {
      await masterService.deleteSiswa(req.params.id);
      return res.status(200).json({
        message: 'Siswa berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }

  // Kelas
  async getAllKelas(req, res, next) {
    try {
      const data = await masterService.getAllKelas();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createKelas(req, res, next) {
    try {
      const newKelas = await masterService.createKelas(req.body);
      return res.status(200).json({
        message: 'Kelas berhasil dibuat!',
        data: newKelas
      });
    } catch (err) {
      next(err);
    }
  }

  // Mata Pelajaran
  async getAllMapel(req, res, next) {
    try {
      const data = await masterService.getAllMapel();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createMapel(req, res, next) {
    try {
      const newMapel = await masterService.createMapel(req.body);
      return res.status(200).json({
        message: 'Mata pelajaran berhasil ditambahkan!',
        data: newMapel
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MasterController();
