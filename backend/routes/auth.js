const express = require('express');
const router = express.Router();
const { login, perfil, actualizarPerfil } = require('../controllers/authController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/perfil', verificarToken, perfil);
router.put('/perfil', verificarToken, actualizarPerfil);

module.exports = router;
