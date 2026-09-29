const db = require('../database/db');

class CertificateRepository {
  /**
   * Simpan data sertifikat baru ke database
   */
  async createCertificate({ certificate_number, siswa_id, ujian_id, hasil_ujian_id, qr_code_url, file_path, issued_at }) {
    const query = `
      INSERT INTO certificates 
        (certificate_number, siswa_id, ujian_id, hasil_ujian_id, qr_code_url, file_path, issued_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.query(query, [
      certificate_number,
      siswa_id,
      ujian_id,
      hasil_ujian_id,
      qr_code_url || null,
      file_path || null,
      issued_at || new Date()
    ]);
    return result.insertId;
  }

  /**
   * Cari sertifikat berdasarkan nomor unik publik sertifikat
   */
  async findCertificateByNumber(certificateNumber) {
    const query = `
      SELECT 
        c.id,
        c.certificate_number,
        c.qr_code_url,
        c.file_path,
        c.issued_at,
        c.created_at,
        s.id AS siswa_id,
        s.nama AS nama_siswa,
        s.nis,
        s.avatar,
        k.id AS kelas_id,
        k.nama_kelas,
        u.id AS ujian_id,
        u.nama_ujian,
        u.kkm,
        m.id AS mapel_id,
        m.nama_mapel,
        h.id AS hasil_ujian_id,
        h.nilai_pg,
        h.nilai_essay,
        h.nilai_akhir,
        h.status_kelulusan,
        h.waktu_selesai
      FROM certificates c
      JOIN siswa s ON c.siswa_id = s.id
      JOIN kelas k ON s.kelas_id = k.id
      JOIN ujian u ON c.ujian_id = u.id
      JOIN bank_soal b ON u.bank_soal_id = b.id
      JOIN mata_pelajaran m ON b.mapel_id = m.id
      JOIN hasil_ujian h ON c.hasil_ujian_id = h.id
      WHERE c.certificate_number = ?
      LIMIT 1
    `;
    const rows = await db.query(query, [certificateNumber]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Cek apakah sertifikat sudah pernah diterbitkan untuk siswa & ujian ini
   */
  async findCertificateByExamAndStudent(ujianId, siswaId) {
    const query = `
      SELECT 
        c.id,
        c.certificate_number,
        c.qr_code_url,
        c.file_path,
        c.issued_at,
        c.created_at,
        c.siswa_id,
        c.ujian_id,
        c.hasil_ujian_id,
        s.nama AS nama_siswa,
        s.nis,
        k.nama_kelas,
        u.nama_ujian,
        h.nilai_akhir,
        h.status_kelulusan
      FROM certificates c
      JOIN siswa s ON c.siswa_id = s.id
      JOIN kelas k ON s.kelas_id = k.id
      JOIN ujian u ON c.ujian_id = u.id
      JOIN hasil_ujian h ON c.hasil_ujian_id = h.id
      WHERE c.ujian_id = ? AND c.siswa_id = ?
      LIMIT 1
    `;
    const rows = await db.query(query, [ujianId, siswaId]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Ambil semua sertifikat yang dimiliki oleh seorang siswa
   */
  async findCertificatesByStudent(siswaId) {
    const query = `
      SELECT 
        c.id,
        c.certificate_number,
        c.qr_code_url,
        c.file_path,
        c.issued_at,
        u.id AS ujian_id,
        u.nama_ujian,
        u.kkm,
        m.nama_mapel,
        h.nilai_pg,
        h.nilai_essay,
        h.nilai_akhir,
        h.status_kelulusan,
        h.waktu_selesai
      FROM certificates c
      JOIN ujian u ON c.ujian_id = u.id
      JOIN bank_soal b ON u.bank_soal_id = b.id
      JOIN mata_pelajaran m ON b.mapel_id = m.id
      JOIN hasil_ujian h ON c.hasil_ujian_id = h.id
      WHERE c.siswa_id = ?
      ORDER BY c.issued_at DESC
    `;
    return db.query(query, [siswaId]);
  }

  /**
   * Ambil semua sertifikat yang telah diterbitkan untuk satu sesi ujian
   */
  async findCertificatesByExam(ujianId) {
    const query = `
      SELECT 
        c.id,
        c.certificate_number,
        c.qr_code_url,
        c.issued_at,
        s.id AS siswa_id,
        s.nama AS nama_siswa,
        s.nis,
        k.nama_kelas,
        h.nilai_akhir,
        h.status_kelulusan
      FROM certificates c
      JOIN siswa s ON c.siswa_id = s.id
      JOIN kelas k ON s.kelas_id = k.id
      JOIN hasil_ujian h ON c.hasil_ujian_id = h.id
      WHERE c.ujian_id = ?
      ORDER BY s.nama ASC
    `;
    return db.query(query, [ujianId]);
  }

  /**
   * Catat aktivitas verifikasi publik sertifikat (Audit log)
   */
  async logVerification({ certificate_id, ip_address, user_agent }) {
    const query = `
      INSERT INTO certificate_verifications 
        (certificate_id, verified_at, ip_address, user_agent)
      VALUES (?, NOW(), ?, ?)
    `;
    return db.query(query, [
      certificate_id,
      ip_address || null,
      user_agent ? user_agent.substring(0, 500) : null
    ]);
  }

  /**
   * Statistik verifikasi sertifikat
   */
  async getVerificationStats(certificateId) {
    const query = `
      SELECT 
        COUNT(*) AS total_verifications,
        MAX(verified_at) AS last_verified_at
      FROM certificate_verifications
      WHERE certificate_id = ?
    `;
    const rows = await db.query(query, [certificateId]);
    return rows.length > 0 ? rows[0] : { total_verifications: 0, last_verified_at: null };
  }

  /**
   * Ambil daftar peserta lulus pada suatu ujian yang belum memiliki sertifikat
   */
  async findPassedStudentsWithoutCertificate(ujianId) {
    const query = `
      SELECT 
        h.id AS hasil_ujian_id,
        h.siswa_id,
        h.ujian_id,
        h.nilai_akhir,
        h.status_kelulusan,
        s.nama AS nama_siswa,
        s.nis,
        k.nama_kelas
      FROM hasil_ujian h
      JOIN siswa s ON h.siswa_id = s.id
      JOIN kelas k ON s.kelas_id = k.id
      WHERE h.ujian_id = ? 
        AND h.status_kelulusan = 'LULUS'
        AND NOT EXISTS (
          SELECT 1 FROM certificates c 
          WHERE c.ujian_id = h.ujian_id AND c.siswa_id = h.siswa_id
        )
      ORDER BY s.nama ASC
    `;
    return db.query(query, [ujianId]);
  }

  /**
   * Ambil nomor ID sertifikat terakhir untuk auto-increment format nomor sertifikat
   */
  async getNextCertificateSequence() {
    const query = `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM certificates`;
    const rows = await db.query(query);
    return rows[0].next_id;
  }
}

module.exports = new CertificateRepository();
