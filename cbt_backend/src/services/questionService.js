const questionRepository = require('../repositories/questionRepository');
const masterService = require('./masterService');
const masterRepo = require('../repositories/masterRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class QuestionService {
  // --- BANK SOAL ---
  async getAllBankSoal(user) {
    if (!user || user.role === 'admin') {
      return await questionRepository.findAllBankSoal(null);
    }
    return await questionRepository.findAllBankSoal(user.id);
  }

  async getBankSoalById(id, user) {
    const bank = await questionRepository.findBankSoalById(id);
    if (!bank) {
      throw new ApiError('Bank soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    if (user && user.role === 'guru') {
      await masterService.verifyWorkspaceAccess(user, bank.kelas_id, bank.mapel_id);
    }

    return bank;
  }

  async createBankSoal({ judul, deskripsi, mapel_id, kelas_id }, user) {
    if (!judul || !judul.trim()) {
      throw new ApiError('Judul bank soal wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!mapel_id || !kelas_id) {
      throw new ApiError('Kelas dan Mata Pelajaran wajib dipilih!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify workspace access for Guru
    if (user && user.role === 'guru') {
      await masterService.verifyWorkspaceAccess(user, kelas_id, mapel_id);
    }

    let guruId = 1;
    if (user && user.role === 'guru') {
      const guru = await masterRepo.findGuruByUserId(user.id);
      if (guru) guruId = guru.id;
    }

    const newId = await questionRepository.createBankSoal({
      mapel_id: parseInt(mapel_id),
      kelas_id: parseInt(kelas_id),
      guru_id: guruId,
      judul: judul.trim(),
      deskripsi: deskripsi || null
    });

    return await questionRepository.findBankSoalById(newId.id || newId);
  }

  async updateBankSoal(id, { judul, deskripsi, mapel_id, kelas_id }, user) {
    const existing = await this.getBankSoalById(id, user);

    const targetKelasId = kelas_id ? parseInt(kelas_id) : existing.kelas_id;
    const targetMapelId = mapel_id ? parseInt(mapel_id) : existing.mapel_id;

    if (user && user.role === 'guru') {
      await masterService.verifyWorkspaceAccess(user, targetKelasId, targetMapelId);
    }

    await questionRepository.updateBankSoal(id, {
      judul: judul ? judul.trim() : existing.judul,
      deskripsi: deskripsi !== undefined ? deskripsi : existing.deskripsi,
      kelas_id: targetKelasId,
      mapel_id: targetMapelId
    });

    return await questionRepository.findBankSoalById(id);
  }

  async deleteBankSoal(id, user) {
    await this.getBankSoalById(id, user);
    await questionRepository.deleteBankSoal(id);
    return true;
  }

  // --- SOAL ---
  async getQuestionsByBankId(bankSoalId, user) {
    await this.getBankSoalById(bankSoalId, user);

    const questions = await questionRepository.findQuestionsByBankId(bankSoalId);
    const result = [];
    for (const q of questions) {
      const options = await questionRepository.findOptionsByQuestionId(q.id);
      result.push({
        ...q,
        pilihan: options
      });
    }
    return result;
  }

  async getQuestionDetail(id, user) {
    const question = await questionRepository.findQuestionById(id);
    if (!question) {
      throw new ApiError('Soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Verify parent bank soal workspace
    await this.getBankSoalById(question.bank_soal_id, user);

    const options = await questionRepository.findOptionsByQuestionId(id);
    return {
      ...question,
      pilihan: options
    };
  }

  async createQuestion({ bank_soal_id, jenis_soal, teks_soal, bobot, opsi_list, gambar_url }, user) {
    if (!bank_soal_id || !jenis_soal || !teks_soal) {
      throw new ApiError('Data soal tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify workspace access for parent bank soal
    await this.getBankSoalById(bank_soal_id, user);

    const existingQuestions = await questionRepository.findQuestionsByBankId(bank_soal_id);
    const nextNomorUrut = existingQuestions.length + 1;

    const soalInserted = await questionRepository.createQuestion({
      bank_soal_id: parseInt(bank_soal_id),
      jenis_soal,
      teks_soal,
      gambar_url: gambar_url || '',
      bobot: parseFloat(bobot || 1.0),
      nomor_urut: nextNomorUrut
    });

    const soalId = soalInserted.id || soalInserted;

    if (jenis_soal === 'PG' && Array.isArray(opsi_list)) {
      for (const o of opsi_list) {
        await questionRepository.createOption({
          soal_id: soalId,
          teks_pilihan: o.teks_pilihan,
          label: o.label,
          is_kunci: o.is_kunci ? 1 : 0
        });
      }
    }

    return await this.getQuestionDetail(soalId, user);
  }

  async updateQuestion(id, { jenis_soal, teks_soal, bobot, opsi_list, gambar_url }, user) {
    const existing = await this.getQuestionDetail(id, user);

    const updateData = {};
    if (jenis_soal !== undefined) updateData.jenis_soal = jenis_soal;
    if (teks_soal !== undefined) updateData.teks_soal = teks_soal;
    if (bobot !== undefined) updateData.bobot = parseFloat(bobot || 1.0);
    if (gambar_url !== undefined) updateData.gambar_url = gambar_url;

    await questionRepository.updateQuestion(id, updateData);

    if (jenis_soal === 'PG' && Array.isArray(opsi_list)) {
      await questionRepository.deleteOptionsByQuestionId(id);
      for (const o of opsi_list) {
        await questionRepository.createOption({
          soal_id: id,
          teks_pilihan: o.teks_pilihan,
          label: o.label,
          is_kunci: o.is_kunci ? 1 : 0
        });
      }
    } else if (jenis_soal === 'ESSAY') {
      await questionRepository.deleteOptionsByQuestionId(id);
    }

    return await this.getQuestionDetail(id, user);
  }

  async deleteQuestion(id, user) {
    await this.getQuestionDetail(id, user);
    await questionRepository.deleteOptionsByQuestionId(id);
    await questionRepository.deleteQuestion(id);
    return true;
  }
}

module.exports = new QuestionService();
