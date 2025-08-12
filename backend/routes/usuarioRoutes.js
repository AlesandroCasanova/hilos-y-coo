// backend/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();

const {
  crearUsuario,
  listarUsuarios,
  editarUsuario,
  eliminarUsuario,
  me
} = require('../controllers/usuarioController');

const verificarToken = require('../middleware/authMiddleware');

// Verificar token y traer usuario logueado
router.get('/usuarios/me', verificarToken, me);

// ABM de usuarios (protegido)
router.post('/usuarios', verificarToken, crearUsuario);
router.get('/usuarios', verificarToken, listarUsuarios);
router.put('/usuarios/:id', verificarToken, editarUsuario);
router.delete('/usuarios/:id', verificarToken, eliminarUsuario);

module.exports = router;
