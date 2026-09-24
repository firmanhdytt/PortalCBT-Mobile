const questionRepository = require('../repositories/questionRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class QuestionService {
  // Bank Soal
  async getAllBankSoal() {
    return await questionRepository.findAllBankSoal();
  }

  async getBankSoalById(id) {
    const bank = await questionRepository.findBankSoalById(id);
    if (!bank) {
      throw new ApiError('Bank soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return bank;
  }

  async createBankSoal({ judul, mapel_id, guru_id }) {
    if (!judul || !judul.trim()) {
      throw new ApiError('Judul bank soal wajib diisi!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const newId = await questionRepository.createBankSoal({
      mapel_id: parseInt(mapel_id || 1),
      guru_id: parseInt(guru_id || 1),
      judul: judul.trim()
    });

    return await questionRepository.findBankSoalById(newId);
  }

  // Soal
  async getQuestionsByBankId(bankSoalId) {
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

  async getQuestionDetail(id) {
    const question = await questionRepository.findQuestionById(id);
    if (!question) {
      throw new ApiError('Soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    const options = await questionRepository.findOptionsByQuestionId(id);
    return {
      ...question,
      pilihan: options
    };
  }

  async createQuestion({ bank_soal_id, jenis_soal, teks_soal, bobot, opsi_list, gambar_url }) {
    if (!bank_soal_id || !jenis_soal || !teks_soal) {
      throw new ApiError('Data soal tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const existingQuestions = await questionRepository.findQuestionsByBankId(bank_soal_id);
    const nextNomorUrut = existingQuestions.length + 1;

    const soalId = await questionRepository.createQuestion({
      bank_soal_id: parseInt(bank_soal_id),
      jenis_soal,
      teks_soal,
      gambar_url: gambar_url || '',
      bobot: parseFloat(bobot || 1.0),
      nomor_urut: nextNomorUrut
    });

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

    return await this.getQuestionDetail(soalId);
  }

  async updateQuestion(id, { jenis_soal, teks_soal, bobot, opsi_list, gambar_url }) {
    const existing = await questionRepository.findQuestionById(id);
    if (!existing) {
      throw new ApiError('Soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

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
    }

    return await this.getQuestionDetail(id);
  }

  async deleteQuestion(id) {
    const existing = await questionRepository.findQuestionById(id);
    if (!existing) {
      throw new ApiError('Soal tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    await questionRepository.deleteOptionsByQuestionId(id);
    await questionRepository.deleteQuestion(id);
    return true;
  }
}

module.exports = new QuestionService();
