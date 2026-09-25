const proctoringService = require('../services/proctoringService');
const ApiResponse = require('../utils/response');

class ProctoringController {
  // Siswa: Record strike violation
  async recordViolation(req, res, next) {
    try {
      const { siswa_id, ujian_id, violation_type, description } = req.body;
      const result = await proctoringService.recordViolation({
        siswa_id: siswa_id || req.user?.id,
        ujian_id,
        violation_type,
        description
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Siswa: Request unlock
  async requestUnlock(req, res, next) {
    try {
      const { siswa_id, ujian_id, reason } = req.body;
      const result = await proctoringService.requestUnlock({
        siswa_id: siswa_id || req.user?.id,
        ujian_id,
        reason
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Siswa: Check unlock status
  async getUnlockStatus(req, res, next) {
    try {
      const { ujianId, siswaId } = req.params;
      const result = await proctoringService.getUnlockStatus(ujianId, siswaId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Guru: Get proctoring monitoring
  async getProctoringMonitoring(req, res, next) {
    try {
      const { ujianId } = req.params;
      const data = await proctoringService.getProctoringMonitoring(ujianId);
      return ApiResponse.raw(res, data);
    } catch (err) {
      next(err);
    }
  }

  // Guru: Review unlock request (approve or reject)
  async reviewUnlockRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const { action } = req.body;
      const reviewerId = req.user?.id;
      const result = await proctoringService.reviewUnlockRequest(requestId, action, reviewerId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // Guru: Manual unlock / reset strikes
  async manualUnlock(req, res, next) {
    try {
      const { ujian_id, siswa_id } = req.body;
      const result = await proctoringService.manualUnlock(ujian_id, siswa_id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ProctoringController();
