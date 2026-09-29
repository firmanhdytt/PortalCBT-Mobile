const notificationService = require('../services/notificationService');

class NotificationController {
  /**
   * Ambil daftar notifikasi milik pengguna
   */
  async getNotifications(req, res, next) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
      const unreadOnly = req.query.unread === 'true' || req.query.unread === '1';
      const notifications = await notificationService.getUserNotifications(req.user.id, {
        limit,
        unreadOnly
      });
      return res.json({
        status: 'success',
        data: notifications
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ambil total unread notifikasi
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await notificationService.getUnreadCount(req.user.id);
      return res.json({
        status: 'success',
        data: { unread_count: count }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Tandai 1 notifikasi sebagai sudah dibaca
   */
  async markAsRead(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await notificationService.markAsRead(id, req.user.id);
      return res.json({
        status: 'success',
        message: 'Notifikasi ditandai sebagai telah dibaca.',
        data: { updated: success }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Tandai seluruh notifikasi pengguna sebagai sudah dibaca
   */
  async markAllAsRead(req, res, next) {
    try {
      const count = await notificationService.markAllAsRead(req.user.id);
      return res.json({
        status: 'success',
        message: 'Seluruh notifikasi berhasil ditandai sebagai dibaca.',
        data: { marked_count: count }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Hapus notifikasi
   */
  async deleteNotification(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await notificationService.deleteNotification(id, req.user.id);
      return res.json({
        status: 'success',
        message: 'Notifikasi berhasil dihapus.',
        data: { deleted: success }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();