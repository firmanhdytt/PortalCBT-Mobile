const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/authMiddleware');

// Seluruh route notifikasi mewajibkan otentikasi JWT
router.use(authenticate);

// Ambil daftar notifikasi pengguna
router.get('/', (req, res, next) => notificationController.getNotifications(req, res, next));

// Ambil total notifikasi belum dibaca
router.get('/unread-count', (req, res, next) => notificationController.getUnreadCount(req, res, next));

// Tandai seluruh notifikasi sebagai sudah dibaca
router.put('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

// Tandai 1 notifikasi sebagai sudah dibaca
router.put('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

// Hapus 1 notifikasi
router.delete('/:id', (req, res, next) => notificationController.deleteNotification(req, res, next));

module.exports = router;