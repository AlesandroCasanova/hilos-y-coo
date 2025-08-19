// backend/routes/usuarioRoutes.js
const express = require('express');
const router = express.Router();

const {
  registroDuenio,
  crearUsuario,
  listarUsuarios,
  editarUsuario,
  eliminarUsuario,
  me
} = require('../controllers/usuarioController');

const verificarToken = require('../middleware/authMiddleware');

/**
 * RUTA PÚBLICA (sin token)
 * Crea el primer usuario con rol 'duenio'
 * Endpoint final: POST /api/usuarios/registro-duenio
 */
router.post('/usuarios/registro-duenio', registroDuenio);

/**
 * RUTAS PROTEGIDAS (requieren token)
 */
router.get('/usuarios/me', verificarToken, me);
router.post('/usuarios', verificarToken, crearUsuario);
router.get('/usuarios', verificarToken, listarUsuarios);
router.put('/usuarios/:id', verificarToken, editarUsuario);
router.delete('/usuarios/:id', verificarToken, eliminarUsuario);

module.exports = router;
