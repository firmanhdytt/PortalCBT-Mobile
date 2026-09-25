const proctoringRepository = require('../repositories/proctoringRepository');
const examRepository = require('../repositories/examRepository');
const { ApiError } = require('../utils/response');
const { ERROR_CODES } = require('../utils/errorCodes');

class ProctoringService {
  async recordViolation({ siswa_id, ujian_id, violation_type, description }) {
    if (!siswa_id || !ujian_id || !violation_type) {
      throw new ApiError('Data pelanggaran tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const sId = parseInt(siswa_id);
    const uId = parseInt(ujian_id);

    const ujian = await examRepository.findExamById(uId);
    if (!ujian) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const attempt = await proctoringRepository.findOrCreateAttempt(uId, sId, ujian.durasi_menit);

    if (attempt.status === 'SUBMITTED') {
      return {
        is_locked: false,
        strike_number: 0,
        message: 'Ujian sudah berstatus selesai.'
      };
    }

    // Record violation
    const violation = await proctoringRepository.recordViolation({
      attempt_id: attempt.id,
      siswa_id: sId,
      ujian_id: uId,
      violation_type,
      description: description || 'Pelanggaran integritas ujian terdeteksi'
    });

    const maxViolations = ujian.max_violations || 3;
    const isLocked = violation.strike_number >= maxViolations;

    if (isLocked) {
      await proctoringRepository.updateAttemptStatus(attempt.id, 'LOCKED');
    }

    return {
      strike_number: violation.strike_number,
      max_violations: maxViolations,
      is_locked: isLocked,
      remaining_strikes: Math.max(0, maxViolations - violation.strike_number),
      message: isLocked
        ? 'Batas pelanggaran terlampaui (3/3). Ujian Anda telah dikunci oleh pengawas anti-cheat. Silakan hubungi pengawas!'
        : `Peringatan: Pelanggaran terdeteksi (${violation.strike_number}/${maxViolations}). Harap tetap fokus pada layar ujian.`
    };
  }

  async requestUnlock({ siswa_id, ujian_id, reason }) {
    if (!siswa_id || !ujian_id || !reason) {
      throw new ApiError('Data permohonan buka kunci tidak lengkap!', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const sId = parseInt(siswa_id);
    const uId = parseInt(ujian_id);

    const attempt = await proctoringRepository.findAttempt(uId, sId);
    if (!attempt) {
      throw new ApiError('Sesi ujian peserta tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    if (attempt.status !== 'LOCKED') {
      throw new ApiError('Ujian tidak dalam status terkunci!', 400, ERROR_CODES.CONFLICT);
    }

    const existingPending = await proctoringRepository.findPendingUnlockRequest(sId, uId);
    if (existingPending) {
      return {
        message: 'Permohonan buka kunci sebelumnya masih menunggu persetujuan guru.',
        request: existingPending
      };
    }

    const newRequest = await proctoringRepository.createUnlockRequest({
      attempt_id: attempt.id,
      siswa_id: sId,
      ujian_id: uId,
      reason: reason.trim()
    });

    return {
      message: 'Permohonan buka kunci berhasil dikirimkan ke guru pengawas.',
      request: newRequest
    };
  }

  async getUnlockStatus(ujianId, siswaId) {
    const sId = parseInt(siswaId);
    const uId = parseInt(ujianId);

    const attempt = await proctoringRepository.findAttempt(uId, sId);
    const latestRequest = await proctoringRepository.findLatestUnlockRequest(sId, uId);
    const strikes = await proctoringRepository.countViolations(sId, uId);

    return {
      attempt_status: attempt ? attempt.status : 'NOT_STARTED',
      is_locked: attempt ? attempt.status === 'LOCKED' : false,
      strikes,
      latest_request: latestRequest
    };
  }

  async getProctoringMonitoring(ujianId) {
    const uId = parseInt(ujianId);
    const data = await proctoringRepository.getProctoringMonitoring(uId);
    if (!data) {
      throw new ApiError('Ujian tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }
    return data;
  }

  async reviewUnlockRequest(requestId, action, reviewerId) {
    const reqId = parseInt(requestId);
    const unlockReq = await proctoringRepository.findUnlockRequestById(reqId);
    if (!unlockReq) {
      throw new ApiError('Permohonan buka kunci tidak ditemukan!', 404, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    const validAction = action ? action.toUpperCase() : 'APPROVE';
    const status = validAction === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await proctoringRepository.reviewUnlockRequest(reqId, status, reviewerId);

    if (status === 'APPROVED') {
      // Buka kunci attempt kembali menjadi IN_PROGRESS
      if (unlockReq.attempt_id) {
        await proctoringRepository.updateAttemptStatus(unlockReq.attempt_id, 'IN_PROGRESS');
      }
    }

    return {
      request_id: reqId,
      status,
      message: status === 'APPROVED' ? 'Ujian siswa berhasil dibuka kuncinya!' : 'Permohonan buka kunci ditolak.'
    };
  }

  async manualUnlock(ujianId, siswaId) {
    const uId = parseInt(ujianId);
    const sId = parseInt(siswaId);
    await proctoringRepository.resetViolationsAndUnlock(uId, sId);
    return {
      message: 'Status ujian berhasil dibuka kembali dan pelanggaran direset.'
    };
  }
}

module.exports = new ProctoringService();
