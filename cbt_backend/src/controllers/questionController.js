const questionService = require('../services/questionService');
const { ApiResponse } = require('../utils/response');

class QuestionController {
  // Bank Soal
  async getBankSoal(req, res, next) {
    try {
      const data = await questionService.getAllBankSoal(req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createBankSoal(req, res, next) {
    try {
      const data = await questionService.createBankSoal(req.body, req.user);
      return res.status(200).json({
        message: 'Bank soal berhasil dibuat!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async updateBankSoal(req, res, next) {
    try {
      const data = await questionService.updateBankSoal(req.params.id, req.body, req.user);
      return res.status(200).json({
        message: 'Bank soal berhasil diperbarui!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteBankSoal(req, res, next) {
    try {
      await questionService.deleteBankSoal(req.params.id, req.user);
      return res.status(200).json({
        message: 'Bank soal berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }

  // Soal
  async getQuestionsByBankId(req, res, next) {
    try {
      const data = await questionService.getQuestionsByBankId(req.params.bankSoalId, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getQuestionDetail(req, res, next) {
    try {
      const data = await questionService.getQuestionDetail(req.params.id, req.user);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  async createQuestion(req, res, next) {
    try {
      const data = await questionService.createQuestion(req.body, req.user);
      return res.status(200).json({
        message: 'Soal berhasil ditambahkan!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuestion(req, res, next) {
    try {
      const data = await questionService.updateQuestion(req.params.id, req.body, req.user);
      return res.status(200).json({
        message: 'Soal berhasil diperbarui!',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteQuestion(req, res, next) {
    try {
      await questionService.deleteQuestion(req.params.id, req.user);
      return res.status(200).json({
        message: 'Soal berhasil dihapus!'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new QuestionController();
