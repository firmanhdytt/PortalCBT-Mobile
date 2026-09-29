const masterService = require('../services/masterService');
const { ApiResponse } = require('../utils/response');

class MasterController {
  // --- WORKSPACE ---
  async getWorkspace(req, res, next) {
    try {
      const data = await masterService.getGuruWorkspace(req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // --- SISWA ---
  async getAllSiswa(req, res, next) {
    try {
      const data = await masterService.getAllSiswa();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getSiswaById(req, res, next) {
    try {
      const data = await masterService.getSiswaById(req.params.id);
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

  async updateSiswa(req, res, next) {
    try {
      const updated = await masterService.updateSiswa(req.params.id, req.body);
      return res.status(200).json({
        message: 'Data siswa berhasil diperbarui!',
        data: updated
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

  // --- GURU ---
  async getAllGuru(req, res, next) {
    try {
      const data = await masterService.getAllGuru();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getGuruById(req, res, next) {
    try {
      const data = await masterService.getGuruById(req.params.id);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createGuru(req, res, next) {
    try {
      const newGuru = await masterService.createGuru(req.body);
      return res.status(200).json({
        message: 'Guru berhasil ditambahkan!',
        data: newGuru
      });
    } catch (err) {
      next(err);
    }
  }

  async updateGuru(req, res, next) {
    try {
      const updated = await masterService.updateGuru(req.params.id, req.body);
      return res.status(200).json({
        message: 'Data guru berhasil diperbarui!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteGuru(req, res, next) {
    try {
      await masterService.deleteGuru(req.params.id);
      return res.status(200).json({
        message: 'Guru berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }

  async assignGuru(req, res, next) {
    try {
      const assignments = await masterService.assignGuru(req.params.id, req.body.assignments || []);
      return res.status(200).json({
        message: 'Penempatan guru pada kelas & mapel berhasil diperbarui!',
        data: assignments
      });
    } catch (err) {
      next(err);
    }
  }

  // --- KELAS ---
  async getAllKelas(req, res, next) {
    try {
      const data = await masterService.getAllKelas();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getKelasDetail(req, res, next) {
    try {
      const data = await masterService.getKelasDetail(req.params.id);
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

  async updateKelas(req, res, next) {
    try {
      const updated = await masterService.updateKelas(req.params.id, req.body);
      return res.status(200).json({
        message: 'Data kelas berhasil diperbarui!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteKelas(req, res, next) {
    try {
      await masterService.deleteKelas(req.params.id);
      return res.status(200).json({
        message: 'Kelas berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }

  // --- MATA PELAJARAN ---
  async getAllMapel(req, res, next) {
    try {
      const data = await masterService.getAllMapel();
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getMapelDetail(req, res, next) {
    try {
      const data = await masterService.getMapelDetail(req.params.id);
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

  async updateMapel(req, res, next) {
    try {
      const updated = await masterService.updateMapel(req.params.id, req.body);
      return res.status(200).json({
        message: 'Mata pelajaran berhasil diperbarui!',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteMapel(req, res, next) {
    try {
      await masterService.deleteMapel(req.params.id);
      return res.status(200).json({
        message: 'Mata pelajaran berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MasterController();
