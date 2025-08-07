const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- Rutas de autenticación ---
router.post('/login', authController.login);
router.post('/registro', authController.registro);

module.exports = router;
