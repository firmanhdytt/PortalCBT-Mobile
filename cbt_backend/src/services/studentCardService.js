const db = require('../database/db');
const QrCodeGenerator = require('./qrCodeGenerator');

class StudentCardService {
  /**
   * Ambil data lengkap kartu ujian untuk seorang siswa
   */
  async getStudentCardData(siswaId) {
    // 1. Data profil siswa
    const studentQuery = `
      SELECT 
        s.id, 
        s.nis, 
        s.nama, 
        s.avatar, 
        k.id AS kelas_id, 
        k.nama_kelas, 
        u.username
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      LIMIT 1
    `;
    const students = await db.query(studentQuery, [siswaId]);
    if (!students || students.length === 0) {
      const err = new Error('Data siswa tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }
    const student = students[0];

    const currentYear = new Date().getFullYear();
    const tahunAjaran = `${currentYear}/${currentYear + 1}`;
    const noPeserta = `KPU-${currentYear}-${String(student.kelas_id).padStart(3, '0')}-${String(student.id).padStart(4, '0')}`;

    // 2. Ambil jadwal ujian untuk kelas siswa
    const examQuery = `
      SELECT 
        u.id, 
        u.nama_ujian, 
        m.nama_mapel, 
        u.durasi_menit, 
        u.waktu_mulai, 
        u.waktu_selesai, 
        u.kkm
      FROM ujian u
      JOIN bank_soal b ON u.bank_soal_id = b.id
      JOIN mata_pelajaran m ON b.mapel_id = m.id
      WHERE u.kelas_id = ? AND u.is_aktif = 1
      ORDER BY u.waktu_mulai ASC, u.id ASC
    `;
    const exams = await db.query(examQuery, [student.kelas_id]);

    // 3. Generate QR Code representasi identitas peserta
    const qrPayload = JSON.stringify({
      app: 'CBT_SYSTEM',
      type: 'KARTU_PESERTA',
      no_peserta: noPeserta,
      nis: student.nis,
      nama: student.nama,
      kelas: student.nama_kelas,
      tahun: tahunAjaran
    });

    const qrDataUrl = await QrCodeGenerator.toDataURL(qrPayload, { width: 180, margin: 1 });
    const qrSvg = await QrCodeGenerator.toSvg(qrPayload, { width: 140, margin: 1 });

    return {
      siswa_id: student.id,
      no_peserta: noPeserta,
      nis: student.nis,
      nama: student.nama,
      kelas_id: student.kelas_id,
      kelas: student.nama_kelas,
      username: student.username || student.nis,
      ruang: 'Ruang Lab CBT 01',
      sesi: 'Sesi 1',
      avatar: student.avatar || null,
      tahun_ajaran: tahunAjaran,
      tanggal_cetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      qr_data_url: qrDataUrl,
      qr_svg: qrSvg,
      jadwal_ujian: exams.map((ex) => ({
        id: ex.id,
        nama_ujian: ex.nama_ujian,
        nama_mapel: ex.nama_mapel,
        durasi_menit: ex.durasi_menit,
        waktu_mulai: ex.waktu_mulai,
        waktu_selesai: ex.waktu_selesai,
        kkm: ex.kkm
      }))
    };
  }

  /**
   * Ambil data kartu ujian untuk seluruh siswa dalam satu kelas
   */
  async getClassCardsData(kelasId) {
    const studentsQuery = `
      SELECT id 
      FROM siswa 
      WHERE kelas_id = ? AND status = 'aktif'
      ORDER BY nama ASC
    `;
    const students = await db.query(studentsQuery, [kelasId]);
    if (!students || students.length === 0) {
      const err = new Error('Tidak ada siswa aktif pada kelas ini');
      err.statusCode = 404;
      throw err;
    }

    const cards = [];
    for (const s of students) {
      const card = await this.getStudentCardData(s.id);
      cards.push(card);
    }
    return cards;
  }

  /**
   * Render HTML Printable layout kartu ujian (Single atau Batch untuk sekelas)
   */
  renderCardHtml(cards, isBatch = false) {
    const cardList = Array.isArray(cards) ? cards : [cards];

    const cardsHtml = cardList.map((card) => {
      const examRows = card.jadwal_ujian.length > 0
        ? card.jadwal_ujian.map((ex, idx) => `
            <tr>
              <td style="text-align:center; padding:4px 6px;">${idx + 1}</td>
              <td style="padding:4px 6px;">${ex.nama_mapel} (${ex.nama_ujian})</td>
              <td style="text-align:center; padding:4px 6px;">${ex.durasi_menit} mnt</td>
              <td style="text-align:center; padding:4px 6px; font-size:10px; color:#475569;">
                ${ex.waktu_mulai ? new Date(ex.waktu_mulai).toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' }) : 'Sesuai Jadwal'}
              </td>
            </tr>
          `).join('')
        : `<tr><td colspan="4" style="text-align:center; padding:8px; color:#64748b; font-style:italic;">Tidak ada ujian terjadwal saat ini</td></tr>`;

      return `
      <div class="card-wrapper">
        <div class="card-inner">
          <!-- Header Kartu -->
          <div class="card-header">
            <div class="header-logo">
              <div class="logo-box">🏛️</div>
            </div>
            <div class="header-text">
              <h3>DINAS PENDIDIKAN & KEBUDAYAAN</h3>
              <h4>SMK NEGERI 1 CONTOH - CBT CENTER</h4>
              <p>KARTU TANDA PESERTA UJIAN BERBASIS KOMPUTER</p>
              <div class="header-sub">TAHUN PELAJARAN ${card.tahun_ajaran}</div>
            </div>
          </div>

          <div class="header-divider"></div>

          <!-- Body Kartu: Profil & QR -->
          <div class="card-body">
            <div class="student-photo-col">
              <div class="photo-box">
                ${card.avatar ? `<img src="${card.avatar}" alt="Foto Siswa">` : `<div class="avatar-placeholder">👤<br><span style="font-size:9px;">FOTO 3x4</span></div>`}
              </div>
              <div class="qr-box">
                <img src="${card.qr_data_url}" alt="QR Peserta" style="width:75px; height:75px; display:block;">
                <span class="qr-label">VALIDASI RESMI</span>
              </div>
            </div>

            <div class="student-info-col">
              <table class="info-table">
                <tr>
                  <td class="info-label">No. Peserta</td>
                  <td class="info-sep">:</td>
                  <td class="info-val"><strong style="color:#1e3a8a; font-family:monospace; font-size:13px;">${card.no_peserta}</strong></td>
                </tr>
                <tr>
                  <td class="info-label">NIS / Login</td>
                  <td class="info-sep">:</td>
                  <td class="info-val"><span style="font-family:monospace; font-weight:600;">${card.nis}</span></td>
                </tr>
                <tr>
                  <td class="info-label">Nama Lengkap</td>
                  <td class="info-sep">:</td>
                  <td class="info-val"><strong>${card.nama.toUpperCase()}</strong></td>
                </tr>
                <tr>
                  <td class="info-label">Kelas / Jurusan</td>
                  <td class="info-sep">:</td>
                  <td class="info-val">${card.kelas}</td>
                </tr>
                <tr>
                  <td class="info-label">Ruang & Sesi</td>
                  <td class="info-sep">:</td>
                  <td class="info-val">${card.ruang} / ${card.sesi}</td>
                </tr>
              </table>

              <!-- Tabel Jadwal Ujian Ringkas -->
              <div class="schedule-container">
                <div class="schedule-title">Jadwal Ujian Terdaftar:</div>
                <table class="schedule-table">
                  <thead>
                    <tr>
                      <th style="width:24px;">No</th>
                      <th>Mata Pelajaran</th>
                      <th style="width:48px;">Durasi</th>
                      <th style="width:70px;">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${examRows}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Footer Kartu: Tata Tertib & TTD -->
          <div class="card-footer">
            <div class="rules-box">
              <strong>Ketentuan Peserta:</strong>
              <ol>
                <li>Wajib membawa kartu ujian saat memasuki ruang ujian.</li>
                <li>Dilarang membawa alat komunikasi / gawai di luar perangkat tes.</li>
                <li>Login menggunakan NIS masing-masing.</li>
              </ol>
            </div>
            <div class="signature-box">
              <div class="sig-date">${card.tanggal_cetak}</div>
              <div class="sig-title">Ketua Panitia Ujian,</div>
              <div class="sig-space"></div>
              <div class="sig-name"><u>Drs. H. Sulaiman, M.Pd</u></div>
              <div class="sig-nip">NIP. 19750812 200003 1 002</div>
            </div>
          </div>
        </div>
      </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kartu Peserta Ujian CBT - ${isBatch ? 'Cetak Massal' : (cardList[0] ? cardList[0].nama : '')}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      line-height: 1.3;
      padding: 20px;
    }
    .print-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 900px;
      margin: 0 auto 20px auto;
      background: white;
      padding: 12px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .btn-print {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover {
      background: #1d4ed8;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    .card-wrapper {
      background: white;
      border: 1.5px dashed #94a3b8;
      border-radius: 12px;
      padding: 12px;
      page-break-inside: avoid;
    }
    .card-inner {
      border: 1.5px solid #1e3a8a;
      border-radius: 8px;
      padding: 12px 14px;
      background: #ffffff;
      position: relative;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-logo .logo-box {
      font-size: 32px;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
    }
    .header-text {
      flex: 1;
      text-align: center;
    }
    .header-text h3 {
      font-size: 11px;
      letter-spacing: 0.5px;
      color: #475569;
      margin-bottom: 1px;
    }
    .header-text h4 {
      font-size: 12px;
      color: #0f172a;
      font-weight: 800;
      margin-bottom: 2px;
    }
    .header-text p {
      font-size: 11px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 0.3px;
    }
    .header-sub {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
    }
    .header-divider {
      height: 2px;
      background: #1e3a8a;
      margin: 8px 0 10px 0;
    }
    .card-body {
      display: flex;
      gap: 12px;
    }
    .student-photo-col {
      width: 85px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .photo-box {
      width: 80px;
      height: 95px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      overflow: hidden;
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-placeholder {
      text-align: center;
      color: #94a3b8;
      font-size: 20px;
    }
    .qr-box {
      text-align: center;
    }
    .qr-label {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
      display: block;
      margin-top: 2px;
    }
    .student-info-col {
      flex: 1;
    }
    .info-table {
      width: 100%;
      font-size: 11px;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .info-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    .info-label {
      width: 90px;
      color: #475569;
    }
    .info-sep {
      width: 10px;
      text-align: center;
    }
    .info-val {
      color: #0f172a;
    }
    .schedule-container {
      margin-top: 4px;
    }
    .schedule-title {
      font-size: 10px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 3px;
    }
    .schedule-table {
      width: 100%;
      font-size: 10px;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    .schedule-table th {
      background: #f1f5f9;
      color: #334155;
      padding: 3px 5px;
      font-weight: 700;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .schedule-table td {
      border: 1px solid #cbd5e1;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      gap: 10px;
    }
    .rules-box {
      flex: 1;
      font-size: 9px;
      color: #475569;
      line-height: 1.3;
    }
    .rules-box ol {
      padding-left: 14px;
      margin-top: 2px;
    }
    .signature-box {
      width: 140px;
      text-align: center;
      font-size: 9.5px;
    }
    .sig-date {
      color: #64748b;
      margin-bottom: 2px;
    }
    .sig-title {
      font-weight: 600;
    }
    .sig-space {
      height: 34px;
    }
    .sig-name {
      font-weight: 700;
    }
    .sig-nip {
      font-size: 8.5px;
      color: #64748b;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .print-bar {
        display: none !important;
      }
      .cards-grid {
        display: block;
        max-width: 100%;
      }
      .card-wrapper {
        border: 1px dashed #cbd5e1;
        margin-bottom: 12mm;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <h2 style="font-size:16px;">Pratinjau Kartu Peserta Ujian</h2>
      <p style="font-size:12px; color:#64748b;">Total kartu: ${cardList.length} kartu siap cetak (Format A4).</p>
    </div>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak Kartu Sekarang</button>
  </div>

  <div class="cards-grid">
    ${cardsHtml}
  </div>
</body>
</html>`;
  }
}

module.exports = new StudentCardService();
