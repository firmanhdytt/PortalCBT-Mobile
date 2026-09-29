const certificateService = require('../services/certificateService');
const studentCardService = require('../services/studentCardService');
const userRepository = require('../repositories/userRepository');

/**
 * Helper untuk menentukan Base URL aplikasi dari request
 */
function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

/**
 * Helper untuk me-resolve ID siswa dari token JWT atau query
 */
async function resolveSiswaId(req) {
  if (req.query.siswa_id && ['admin', 'guru'].includes(req.user?.role)) {
    return req.query.siswa_id;
  }
  if (req.user) {
    if (req.user.role === 'siswa') {
      const student = await userRepository.findStudentByUserId(req.user.id);
      if (student) return student.id;
    }
    return req.user.siswa_id || req.user.id;
  }
  return req.query.siswa_id || null;
}

class CertificateController {
  /**
   * Terbitkan sertifikat kelulusan per siswa (Guru / Admin)
   */
  async issueCertificate(req, res, next) {
    try {
      const { ujian_id, siswa_id } = req.body;
      const baseUrl = getBaseUrl(req);
      const cert = await certificateService.issueCertificate(ujian_id, siswa_id, baseUrl);
      return res.status(201).json({
        status: 'success',
        message: 'Sertifikat kelulusan berhasil diterbitkan.',
        data: cert
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Terbitkan sertifikat massal untuk semua siswa yang lulus pada suatu ujian (Guru / Admin)
   */
  async issueBatchCertificates(req, res, next) {
    try {
      const { ujian_id } = req.body;
      const baseUrl = getBaseUrl(req);
      const result = await certificateService.issueBatchCertificates(ujian_id, baseUrl);
      return res.json({
        status: 'success',
        message: `Berhasil menerbitkan ${result.total_issued} sertifikat kelulusan.`,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Daftar sertifikat yang telah diterbitkan pada satu ujian (Guru / Admin)
   */
  async getExamCertificates(req, res, next) {
    try {
      const { ujianId } = req.params;
      const baseUrl = getBaseUrl(req);
      const certs = await certificateService.getExamCertificates(ujianId, baseUrl);
      return res.json({
        status: 'success',
        data: certs
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Daftar sertifikat milik siswa yang sedang login (Siswa / Flutter App)
   */
  async getStudentCertificates(req, res, next) {
    try {
      const siswaId = await resolveSiswaId(req);
      const baseUrl = getBaseUrl(req);
      const certs = await certificateService.getStudentCertificates(siswaId, baseUrl);
      return res.json({
        status: 'success',
        data: certs
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifikasi sertifikat publik (Unauthenticated & aman)
   */
  async verifyPublicCertificate(req, res, next) {
    try {
      const { certificateNumber } = req.params;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
      const userAgent = req.get('user-agent');

      const result = await certificateService.verifyCertificatePublic(certificateNumber, {
        ip,
        userAgent
      });

      return res.status(result.valid ? 200 : 404).json({
        status: result.valid ? 'success' : 'fail',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Tampilkan halaman sertifikat siap cetak (HTML View)
   */
  async printCertificateHtml(req, res, next) {
    try {
      const { certificateNumber } = req.params;
      const baseUrl = getBaseUrl(req);
      const html = await certificateService.renderCertificateHtml(certificateNumber, baseUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ambil data Kartu Ujian siswa yang login (Siswa / Flutter App)
   */
  async getStudentCard(req, res, next) {
    try {
      const siswaId = await resolveSiswaId(req);
      const cardData = await studentCardService.getStudentCardData(siswaId);
      return res.json({
        status: 'success',
        data: cardData
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cetak HTML Kartu Ujian Siswa (Single)
   */
  async printStudentCardHtml(req, res, next) {
    try {
      const siswaId = await resolveSiswaId(req);
      const cardData = await studentCardService.getStudentCardData(siswaId);
      const html = studentCardService.renderCardHtml(cardData, false);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ambil data Kartu Ujian sekelas (Guru / Admin)
   */
  async getClassCards(req, res, next) {
    try {
      const { kelasId } = req.params;
      const cards = await studentCardService.getClassCardsData(kelasId);
      return res.json({
        status: 'success',
        data: cards
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cetak HTML Kartu Ujian Sekelas (Batch Cetak Massal A4)
   */
  async printClassCardsHtml(req, res, next) {
    try {
      const { kelasId } = req.params;
      const cards = await studentCardService.getClassCardsData(kelasId);
      const html = studentCardService.renderCardHtml(cards, true);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CertificateController();
