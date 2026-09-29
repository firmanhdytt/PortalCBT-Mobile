const notificationRepository = require('../repositories/notificationRepository');
const db = require('../database/db');

class NotificationService {
  /**
   * Kirim notifikasi tunggal
   */
  async notifyUser({ userId, title, message, type = 'info', category = 'general', referenceId = null }) {
    if (!userId || !title || !message) return null;
    const insertId = await notificationRepository.create({
      userId,
      title,
      message,
      type,
      category,
      referenceId
    });
    return { id: insertId, userId, title, message, type, category, referenceId };
  }

  /**
   * Kirim notifikasi ke seluruh siswa di suatu kelas
   */
  async notifyClass(kelasId, { title, message, type = 'info', category = 'general', referenceId = null }) {
    if (!kelasId) return 0;
    const students = await db.query(
      `SELECT user_id FROM siswa WHERE kelas_id = ? AND user_id IS NOT NULL`,
      [kelasId]
    );

    if (students.length === 0) return 0;

    const notifs = students.map(s => ({
      userId: s.user_id,
      title,
      message,
      type,
      category,
      referenceId
    }));

    return await notificationRepository.createBatch(notifs);
  }

  /**
   * Kirim notifikasi ke seluruh pengguna dengan role tertentu (guru / admin)
   */
  async notifyRole(role, { title, message, type = 'info', category = 'general', referenceId = null }) {
    if (!role) return 0;
    const users = await db.query(`SELECT id FROM users WHERE role = ?`, [role]);
    if (users.length === 0) return 0;

    const notifs = users.map(u => ({
      userId: u.id,
      title,
      message,
      type,
      category,
      referenceId
    }));

    return await notificationRepository.createBatch(notifs);
  }

  /**
   * Ambil daftar notifikasi untuk pengguna login
   */
  async getUserNotifications(userId, { limit = 30, unreadOnly = false } = {}) {
    return await notificationRepository.findByUserId(userId, { limit, unreadOnly });
  }

  /**
   * Ambil total unread notifikasi
   */
  async getUnreadCount(userId) {
    return await notificationRepository.getUnreadCount(userId);
  }

  /**
   * Tandai notifikasi sebagai sudah dibaca
   */
  async markAsRead(id, userId) {
    return await notificationRepository.markAsRead(id, userId);
  }

  /**
   * Tandai seluruh notifikasi sebagai sudah dibaca
   */
  async markAllAsRead(userId) {
    return await notificationRepository.markAllAsRead(userId);
  }

  /**
   * Hapus notifikasi
   */
  async deleteNotification(id, userId) {
    return await notificationRepository.deleteById(id, userId);
  }

  // ==========================================
  // EVENT-DRIVEN NOTIFICATION TRIGGERS
  // ==========================================

  /**
   * Trigger: Sesi ujian baru diterbitkan / diaktifkan untuk suatu kelas
   */
  async onExamPublished(ujianId) {
    try {
      const exams = await db.query(
        `SELECT u.id, u.nama_ujian, u.kelas_id, k.nama_kelas, m.nama_mapel
         FROM ujian u
         LEFT JOIN kelas k ON u.kelas_id = k.id
         LEFT JOIN bank_soal b ON u.bank_soal_id = b.id
         LEFT JOIN mata_pelajaran m ON b.mapel_id = m.id
         WHERE u.id = ?`,
        [ujianId]
      );
      if (exams.length === 0) return;
      const ex = exams[0];

      await this.notifyClass(ex.kelas_id, {
        title: '📝 Sesi Ujian Baru Tersedia',
        message: `Ujian "${ex.nama_ujian}" untuk mata pelajaran ${ex.nama_mapel || '-'} telah dibuka untuk kelas ${ex.nama_kelas || '-'}.`,
        type: 'info',
        category: 'ujian_tersedia',
        referenceId: ex.id
      });
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi ujian tersedia:', e.message);
    }
  }

  /**
   * Trigger: Siswa menyelesaikan ujian (Submit)
   */
  async onExamSubmitted(ujianId, siswaId, hasilId, hasEssay = false) {
    try {
      const [student] = await db.query(
        `SELECT s.id, s.nama, s.nis, s.user_id, u.nama_ujian, b.guru_id
         FROM siswa s
         JOIN ujian u ON u.id = ?
         JOIN bank_soal b ON u.bank_soal_id = b.id
         WHERE s.id = ?`,
        [ujianId, siswaId]
      );
      if (!student) return;

      // 1. Notifikasi ke guru pengampu
      if (student.guru_id) {
        const [guru] = await db.query(`SELECT user_id FROM guru WHERE id = ?`, [student.guru_id]);
        if (guru && guru.user_id) {
          const title = hasEssay
            ? '✍️ Jawaban Siswa Menunggu Koreksi Essay'
            : '✅ Siswa Telah Menyelesaikan Ujian';
          const msg = hasEssay
            ? `Siswa ${student.nama} (${student.nis}) telah menyelesaikan "${student.nama_ujian}". Terdapat butir essay yang membutuhkan koreksi manual.`
            : `Siswa ${student.nama} (${student.nis}) telah menyelesaikan "${student.nama_ujian}".`;

          await this.notifyUser({
            userId: guru.user_id,
            title,
            message: msg,
            type: hasEssay ? 'warning' : 'success',
            category: hasEssay ? 'essay_menunggu_koreksi' : 'siswa_selesai',
            referenceId: ujianId
          });
        }
      }

      // 2. Notifikasi konfirmasi ke siswa
      if (student.user_id) {
        await this.notifyUser({
          userId: student.user_id,
          title: '🎉 Ujian Berhasil Dikumpulkan',
          message: hasEssay
            ? `Jawaban Anda untuk "${student.nama_ujian}" telah tersimpan dengan aman di server dan sedang menunggu penilaian essay oleh guru.`
            : `Jawaban Anda untuk "${student.nama_ujian}" telah berhasil dinilai. Anda dapat melihat hasil nilai akhir Anda di menu riwayat.`,
          type: 'success',
          category: 'ujian_selesai',
          referenceId: ujianId
        });
      }
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi submit ujian:', e.message);
    }
  }

  /**
   * Trigger: Essay telah selesai dikoreksi oleh guru
   */
  async onEssayGraded(ujianId, siswaId, finalScore) {
    try {
      const [student] = await db.query(
        `SELECT s.user_id, u.nama_ujian
         FROM siswa s
         JOIN ujian u ON u.id = ?
         WHERE s.id = ?`,
        [ujianId, siswaId]
      );
      if (!student || !student.user_id) return;

      await this.notifyUser({
        userId: student.user_id,
        title: '📊 Hasil Koreksi Ujian Tersedia',
        message: `Guru telah selesai mengoreksi jawaban essay Anda pada "${student.nama_ujian}". Nilai akhir Anda adalah ${finalScore}.`,
        type: 'info',
        category: 'hasil_tersedia',
        referenceId: ujianId
      });
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi koreksi essay:', e.message);
    }
  }

  /**
   * Trigger: Sertifikat kelulusan digital diterbitkan
   */
  async onCertificateIssued(ujianId, siswaId, certificateNumber) {
    try {
      const [student] = await db.query(
        `SELECT s.user_id, u.nama_ujian
         FROM siswa s
         JOIN ujian u ON u.id = ?
         WHERE s.id = ?`,
        [ujianId, siswaId]
      );
      if (!student || !student.user_id) return;

      await this.notifyUser({
        userId: student.user_id,
        title: '📜 Sertifikat Kelulusan Resmi Diterbitkan',
        message: `Selamat! Sertifikat kompetensi kelulusan Anda untuk "${student.nama_ujian}" telah diterbitkan dengan No. Seri ${certificateNumber}. Anda dapat mengunduh atau mencetak sertifikat digital Anda sekarang.`,
        type: 'success',
        category: 'sertifikat',
        referenceId: ujianId
      });
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi sertifikat:', e.message);
    }
  }

  /**
   * Trigger: Siswa mengajukan permohonan buka kunci ujian
   */
  async onUnlockRequested(ujianId, siswaId, reason) {
    try {
      const [student] = await db.query(
        `SELECT s.nama, s.nis, u.nama_ujian, b.guru_id
         FROM siswa s
         JOIN ujian u ON u.id = ?
         JOIN bank_soal b ON u.bank_soal_id = b.id
         WHERE s.id = ?`,
        [ujianId, siswaId]
      );
      if (!student) return;

      if (student.guru_id) {
        const [guru] = await db.query(`SELECT user_id FROM guru WHERE id = ?`, [student.guru_id]);
        if (guru && guru.user_id) {
          await this.notifyUser({
            userId: guru.user_id,
            title: '🔒 Permohonan Buka Kunci Ujian Baru',
            message: `Siswa ${student.nama} (${student.nis}) mengajukan permohonan buka kunci ujian "${student.nama_ujian}" dengan alasan: "${reason}".`,
            type: 'warning',
            category: 'unlock_request',
            referenceId: ujianId
          });
        }
      }
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi permohonan buka kunci:', e.message);
    }
  }

  /**
   * Trigger: Guru menyetujui atau menolak permohonan buka kunci
   */
  async onUnlockProcessed(ujianId, siswaId, isApproved) {
    try {
      const [student] = await db.query(
        `SELECT s.user_id, u.nama_ujian
         FROM siswa s
         JOIN ujian u ON u.id = ?
         WHERE s.id = ?`,
        [ujianId, siswaId]
      );
      if (!student || !student.user_id) return;

      await this.notifyUser({
        userId: student.user_id,
        title: isApproved ? '🔓 Permohonan Buka Kunci Disetujui' : '❌ Permohonan Buka Kunci Ditolak',
        message: isApproved
          ? `Pengawas/Guru telah menyetujui permohonan buka kunci sesi ujian "${student.nama_ujian}". Silakan lanjutkan pengerjaan soal Anda.`
          : `Permohonan buka kunci untuk ujian "${student.nama_ujian}" ditolak oleh pengawas. Silakan hubungi proktor ruang ujian Anda.`,
        type: isApproved ? 'success' : 'danger',
        category: 'unlock_request',
        referenceId: ujianId
      });
    } catch (e) {
      console.warn('Notice: Gagal mengirim notifikasi status buka kunci:', e.message);
    }
  }
}

module.exports = new NotificationService();