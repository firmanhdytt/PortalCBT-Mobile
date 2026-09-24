const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateBody } = require('../middlewares/validator');

router.post(
  '/login',
  validateBody({
    username: { required: true },
    password: { required: true }
  }),
  (req, res, next) => authController.login(req, res, next)
);

router.post(
  '/register',
  validateBody({
    nis: { required: true },
    nama: { required: true },
    kelas_id: { required: true }
  }),
  (req, res, next) => authController.registerSiswa(req, res, next)
);

module.exports = router;
