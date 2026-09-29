const certificateRepository = require('../repositories/certificateRepository');
const db = require('../database/db');
const QrCodeGenerator = require('./qrCodeGenerator');
const notificationService = require('./notificationService');

class CertificateService {
  /**
   * Helper untuk masking NIS (Privacy compliance)
   */
  maskNis(nis) {
    if (!nis) return '-';
    const str = String(nis);
    if (str.length <= 4) return str.substring(0, 1) + '**' + str.substring(str.length - 1);
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  }

  /**
   * Terbitkan sertifikat kelulusan untuk seorang siswa pada ujian tertentu (Idempotent)
   */
  async issueCertificate(ujianId, siswaId, baseUrl = 'http://localhost:3000') {
    // 1. Cek apakah sertifikat sudah ada sebelumnya (Idempotent)
    const existing = await certificateRepository.findCertificateByExamAndStudent(ujianId, siswaId);
    if (existing) {
      return this.enrichCertificateData(existing, baseUrl);
    }

    // 2. Ambil data hasil ujian siswa
    const hasilQuery = `
      SELECT 
        h.id, 
        h.ujian_id, 
        h.siswa_id, 
        h.nilai_akhir, 
        h.status_kelulusan,
        u.kkm,
        u.nama_ujian
      FROM hasil_ujian h
      JOIN ujian u ON h.ujian_id = u.id
      WHERE h.ujian_id = ? AND h.siswa_id = ?
      LIMIT 1
    `;
    const hasilRows = await db.query(hasilQuery, [ujianId, siswaId]);
    if (!hasilRows || hasilRows.length === 0) {
      const err = new Error('Hasil ujian peserta belum ditemukan. Siswa belum menyelesaikan ujian.');
      err.statusCode = 404;
      throw err;
    }
    const hasil = hasilRows[0];

    // 3. Validasi kelayakan kelulusan
    if (hasil.status_kelulusan !== 'LULUS') {
      const err = new Error(
        `Sertifikat hanya dapat diterbitkan untuk peserta yang LULUS (Status: ${hasil.status_kelulusan}, Nilai: ${hasil.nilai_akhir}, KKM: ${hasil.kkm}).`
      );
      err.statusCode = 400;
      throw err;
    }

    // 4. Generate Nomor Seri Sertifikat Unik
    const year = new Date().getFullYear();
    const nextSeq = await certificateRepository.getNextCertificateSequence();
    const certNumber = `CERT/CBT/${year}/${String(nextSeq).padStart(6, '0')}`;

    // 5. URL Verifikasi Publik untuk QR Code
    const verifyUrl = `${baseUrl.replace(/\/$/, '')}/verify.html?cert=${encodeURIComponent(certNumber)}`;

    // 6. Simpan sertifikat ke database
    await certificateRepository.createCertificate({
      certificate_number: certNumber,
      siswa_id: siswaId,
      ujian_id: ujianId,
      hasil_ujian_id: hasil.id,
      qr_code_url: verifyUrl,
      file_path: null,
      issued_at: new Date()
    });

    // 7. Ambil data lengkap sertifikat yang baru dibuat
    const certData = await certificateRepository.findCertificateByNumber(certNumber);

    // Kirim notifikasi sertifikat kelulusan ke siswa
    notificationService.onCertificateIssued(ujianId, siswaId, certNumber).catch(() => {});

    return this.enrichCertificateData(certData, baseUrl);
  }

  /**
   * Terbitkan sertifikat secara massal untuk seluruh peserta yang lulus pada satu ujian
   */
  async issueBatchCertificates(ujianId, baseUrl = 'http://localhost:3000') {
    const unissued = await certificateRepository.findPassedStudentsWithoutCertificate(ujianId);
    const issuedList = [];

    for (const student of unissued) {
      try {
        const cert = await this.issueCertificate(ujianId, student.siswa_id, baseUrl);
        issuedList.push(cert);
      } catch (err) {
        console.error(`Gagal menerbitkan sertifikat untuk siswa ${student.siswa_id}:`, err.message);
      }
    }

    return {
      ujian_id: Number(ujianId),
      total_issued: issuedList.length,
      certificates: issuedList
    };
  }

  /**
   * Ambil daftar sertifikat siswa beserta QR code
   */
  async getStudentCertificates(siswaId, baseUrl = 'http://localhost:3000') {
    const certs = await certificateRepository.findCertificatesByStudent(siswaId);
    const enriched = [];
    for (const c of certs) {
      enriched.push(await this.enrichCertificateData(c, baseUrl));
    }
    return enriched;
  }

  /**
   * Ambil daftar sertifikat untuk satu ujian (Guru/Admin)
   */
  async getExamCertificates(ujianId, baseUrl = 'http://localhost:3000') {
    const certs = await certificateRepository.findCertificatesByExam(ujianId);
    return certs.map((c) => ({
      ...c,
      verify_url: `${baseUrl.replace(/\/$/, '')}/verify.html?cert=${encodeURIComponent(c.certificate_number)}`
    }));
  }

  /**
   * Verifikasi sertifikat publik (Unauthenticated & aman)
   */
  async verifyCertificatePublic(certificateNumber, reqMeta = {}) {
    if (!certificateNumber) {
      return {
        valid: false,
        message: 'Nomor sertifikat tidak boleh kosong'
      };
    }

    const cert = await certificateRepository.findCertificateByNumber(certificateNumber.trim());
    if (!cert) {
      return {
        valid: false,
        certificate_number: certificateNumber,
        message: 'Nomor sertifikat tidak terdaftar dalam pangkalan data resmi CBT.'
      };
    }

    // Catat log verifikasi (Audit log)
    try {
      await certificateRepository.logVerification({
        certificate_id: cert.id,
        ip_address: reqMeta.ip || reqMeta.ipAddress || null,
        user_agent: reqMeta.userAgent || null
      });
    } catch (e) {
      console.warn('Gagal mencatat log verifikasi sertifikat:', e.message);
    }

    // Ambil statistik verifikasi
    const stats = await certificateRepository.getVerificationStats(cert.id);

    return {
      valid: true,
      certificate_number: cert.certificate_number,
      nama_siswa: cert.nama_siswa,
      nis_masked: this.maskNis(cert.nis),
      kelas: cert.nama_kelas,
      nama_ujian: cert.nama_ujian,
      nama_mapel: cert.nama_mapel,
      nilai_akhir: cert.nilai_akhir,
      kkm: cert.kkm,
      status_kelulusan: cert.status_kelulusan,
      issued_at: cert.issued_at,
      total_verifications: stats.total_verifications,
      last_verified_at: stats.last_verified_at,
      message: 'Sertifikat resmi dan terverifikasi sah oleh Sistem CBT.'
    };
  }

  /**
   * Helper untuk menambahkan QR code ke data sertifikat
   */
  async enrichCertificateData(cert, baseUrl = 'http://localhost:3000') {
    const verifyUrl = cert.qr_code_url || `${baseUrl.replace(/\/$/, '')}/verify.html?cert=${encodeURIComponent(cert.certificate_number)}`;
    const qrDataUrl = await QrCodeGenerator.toDataURL(verifyUrl, { width: 180, margin: 1 });
    const qrSvg = await QrCodeGenerator.toSvg(verifyUrl, { width: 150, margin: 1 });

    return {
      ...cert,
      verify_url: verifyUrl,
      qr_data_url: qrDataUrl,
      qr_svg: qrSvg
    };
  }

  /**
   * Render layout HTML Sertifikat Digital Berstandar Siap Cetak (A4 Landscape)
   */
  async renderCertificateHtml(certificateNumber, baseUrl = 'http://localhost:3000') {
    const cert = await certificateRepository.findCertificateByNumber(certificateNumber);
    if (!cert) {
      return `<!DOCTYPE html>
      <html><head><title>Sertifikat Tidak Ditemukan</title></head>
      <body style="font-family:sans-serif; text-align:center; padding:50px;">
        <h2>❌ Sertifikat Tidak Ditemukan</h2>
        <p>Nomor sertifikat <code>${certificateNumber}</code> tidak terdaftar pada pangkalan data kami.</p>
      </body></html>`;
    }

    const enriched = await this.enrichCertificateData(cert, baseUrl);
    const issueDateStr = new Date(enriched.issued_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sertifikat Kelulusan - ${enriched.nama_siswa}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      background: #f1f5f9;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .print-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .btn {
      font-family: 'Segoe UI', Arial, sans-serif;
      padding: 10px 20px;
      border-radius: 6px;
      border: none;
      font-weight: 700;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #64748b; color: white; }

    /* Ukuran A4 Landscape: 297mm x 210mm */
    .cert-page {
      width: 297mm;
      height: 210mm;
      background: #ffffff;
      padding: 12mm;
      position: relative;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      border-radius: 4px;
      overflow: hidden;
    }

    /* Bingkai Dekoratif Ornate */
    .cert-border-outer {
      border: 6px solid #1e3a8a;
      height: 100%;
      padding: 4mm;
      position: relative;
    }
    .cert-border-inner {
      border: 2px solid #b45309;
      height: 100%;
      padding: 15px 25px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      position: relative;
      background: radial-gradient(circle at center, #ffffff 70%, #fefce8 100%);
    }

    /* Sudut Hiasan */
    .corner {
      position: absolute;
      width: 32px;
      height: 32px;
      border-color: #b45309;
      border-style: solid;
      pointer-events: none;
    }
    .c-tl { top: -2px; left: -2px; border-width: 4px 0 0 4px; }
    .c-tr { top: -2px; right: -2px; border-width: 4px 4px 0 0; }
    .c-bl { bottom: -2px; left: -2px; border-width: 0 0 4px 4px; }
    .c-br { bottom: -2px; right: -2px; border-width: 0 4px 4px 0; }

    /* Watermark Latar Belakang */
    .cert-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 80px;
      font-weight: 900;
      color: rgba(30, 58, 138, 0.035);
      white-space: nowrap;
      pointer-events: none;
      font-family: 'Segoe UI', sans-serif;
      text-transform: uppercase;
      letter-spacing: 12px;
    }

    /* Header */
    .cert-header {
      margin-top: 5px;
    }
    .cert-institution {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #1e3a8a;
      text-transform: uppercase;
    }
    .cert-school {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #0f172a;
      margin: 3px 0;
    }
    .cert-title-box {
      margin: 8px 0;
    }
    .cert-title {
      font-size: 32px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 3px;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .cert-subtitle {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #b45309;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .cert-number {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #475569;
      margin-top: 4px;
    }

    /* Body */
    .cert-body {
      margin: 5px 0;
    }
    .cert-award-to {
      font-style: italic;
      font-size: 16px;
      color: #334155;
      margin-bottom: 6px;
    }
    .cert-student-name {
      font-size: 34px;
      font-weight: 700;
      color: #0f172a;
      text-decoration: none;
      letter-spacing: 1px;
      margin: 4px 0 6px 0;
      text-transform: uppercase;
      border-bottom: 2px solid #b45309;
      display: inline-block;
      padding: 0 30px 4px 30px;
    }
    .cert-student-meta {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 12px;
    }
    .cert-desc {
      font-size: 16px;
      color: #1e293b;
      line-height: 1.5;
      max-width: 820px;
      margin: 0 auto;
    }

    /* Score Badge */
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: rgba(16, 185, 129, 0.1);
      border: 1.5px solid #10b981;
      border-radius: 8px;
      padding: 4px 18px;
      margin-top: 8px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .score-badge strong {
      font-size: 18px;
      color: #047857;
    }

    /* Footer & TTD */
    .cert-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 30px;
      font-family: 'Segoe UI', Arial, sans-serif;
    }
    .cert-sign-col {
      width: 220px;
      text-align: center;
      font-size: 12px;
    }
    .sign-space {
      height: 50px;
    }
    .sign-name {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
    }
    .sign-nip {
      font-size: 11px;
      color: #64748b;
    }

    /* QR Code Verification Section */
    .cert-qr-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .qr-frame {
      background: white;
      padding: 5px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .qr-frame img {
      width: 78px;
      height: 78px;
      display: block;
    }
    .qr-text {
      font-size: 9px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 0.5px;
      text-align: center;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .print-actions {
        display: none !important;
      }
      .cert-page {
        box-shadow: none;
        border-radius: 0;
        width: 100vw;
        height: 100vh;
      }
    }
  </style>
</head>
<body>
  <div class="print-actions">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
    <a href="${enriched.verify_url}" target="_blank" class="btn btn-secondary">🔍 Cek Halaman Verifikasi</a>
  </div>

  <div class="cert-page">
    <div class="cert-border-outer">
      <div class="cert-border-inner">
        <div class="corner c-tl"></div>
        <div class="corner c-tr"></div>
        <div class="corner c-bl"></div>
        <div class="corner c-br"></div>

        <div class="cert-watermark">CBT VERIFIED • CBT VERIFIED</div>

        <!-- Header -->
        <div class="cert-header">
          <div class="cert-institution">DINAS PENDIDIKAN & KEBUDAYAAN • PROVINSI CBT</div>
          <div class="cert-school">SMK NEGERI 1 CONTOH INDONESIA</div>
          <div class="cert-title-box">
            <h1 class="cert-title">SERTIFIKAT KELULUSAN</h1>
            <div class="cert-subtitle">COMPUTER-BASED TEST MERIT OF ACHIEVEMENT</div>
            <div class="cert-number">Nomor Seri: ${enriched.certificate_number}</div>
          </div>
        </div>

        <!-- Body -->
        <div class="cert-body">
          <div class="cert-award-to">Diberikan secara resmi kepada:</div>
          <div class="cert-student-name">${enriched.nama_siswa}</div>
          <div class="cert-student-meta">NIS: ${enriched.nis} &nbsp;•&nbsp; Kelas: ${enriched.nama_kelas}</div>

          <p class="cert-desc">
            Telah menyelesaikan dan dinyatakan <strong>LULUS</strong> dalam pelaksanaan Ujian Berbasis Komputer (CBT) mata pelajaran <strong>${enriched.nama_mapel}</strong> (${enriched.nama_ujian}) dengan standar kelulusan terakreditasi.
          </p>

          <div class="score-badge">
            <span>Nilai Akhir:</span>
            <strong>${enriched.nilai_akhir}</strong>
            <span style="font-size:11px; color:#64748b;">(Standar KKM: ${enriched.kkm})</span>
            <span style="font-weight:700; color:#047857; margin-left:8px;">★ LULUS KOMPETEN</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="cert-footer">
          <div class="cert-sign-col">
            <div>Mengetahui,</div>
            <div style="font-weight:600;">Guru Mata Pelajaran</div>
            <div class="sign-space"></div>
            <div class="sign-name"><u>Dra. Hj. Siti Aminah, M.Pd</u></div>
            <div class="sign-nip">NIP. 19780514 200501 2 004</div>
          </div>

          <div class="cert-qr-col">
            <div class="qr-frame">
              <img src="${enriched.qr_data_url}" alt="QR Verifikasi Sertifikat">
            </div>
            <div class="qr-text">PINDAI UNTUK VERIFIKASI KEASLIAN</div>
            <div style="font-size:8px; color:#64748b;">SISTEM CBT RESMI</div>
          </div>

          <div class="cert-sign-col">
            <div>Diterbitkan pada ${issueDateStr}</div>
            <div style="font-weight:600;">Kepala Sekolah,</div>
            <div class="sign-space"></div>
            <div class="sign-name"><u>Drs. H. Sulaiman, M.Pd</u></div>
            <div class="sign-nip">NIP. 19750812 200003 1 002</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = new CertificateService();
