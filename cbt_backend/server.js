require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/database/db');
const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

const { securityHeaders, sanitizeInputs } = require('./src/middlewares/securityMiddleware');

// Global Security & Parsing Middlewares
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInputs);

// Serve Static Frontend Assets (Web Portal)
app.use(express.static(path.join(__dirname, 'public')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const certificateController = require('./src/controllers/certificateController');

// Direct Web Views (Printable layout without /api prefix)
app.get('/sertifikat/print/:certificateNumber', (req, res, next) =>
  certificateController.printCertificateHtml(req, res, next)
);
app.get('/kartu-ujian/print/:siswaId', (req, res, next) => {
  req.query.siswa_id = req.params.siswaId;
  return certificateController.printStudentCardHtml(req, res, next);
});

// Mount All API Routes
app.use('/api', routes);

// 404 Not Found Middleware
app.use(notFoundHandler);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Graceful Start
const server = app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`SERVER CBT BERJALAN PADA URL: http://localhost:${PORT}`);
  console.log(`Database Server: MySQL (Database: ${process.env.DB_NAME || 'cbt_system'} pada ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306})`);
  console.log(`Architecture: Routes -> Middlewares -> Controllers -> Services -> Repositories -> MySQL`);
  console.log(`====================================================`);
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('✅ Koneksi MySQL Pool Berhasil & Siap.');
    } else {
      console.warn('⚠️ Gagal memverifikasi koneksi MySQL pool.');
    }
  } catch (err) {
    console.error('❌ Error saat inisialisasi koneksi database:', err.message);
  }
});

module.exports = { app, server };
