const express = require('express');
const router = express.Router();
const {
  crearUsuario,
  listarUsuarios,
  editarUsuario,
  eliminarUsuario
} = require('../controllers/usuarioController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/usuarios', verificarToken, crearUsuario);
router.get('/usuarios', verificarToken, listarUsuarios);
router.put('/usuarios/:id', verificarToken, editarUsuario);
router.delete('/usuarios/:id', verificarToken, eliminarUsuario);

module.exports = router;
