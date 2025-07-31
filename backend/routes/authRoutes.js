const express = require('express');
const router = express.Router();
const {
  login,
  perfil,
  actualizarPerfil,
  registrarPrimerDueño
} = require('../controllers/authController');

const verificarToken = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/registro-duenio', registrarPrimerDueño);
router.get('/perfil', verificarToken, perfil);
router.put('/perfil', verificarToken, actualizarPerfil);

// ELIMINAR O COMENTAR ESTA LINEA ↓
// router.post('/logout', verificarToken, authController.logout);

module.exports = router;
