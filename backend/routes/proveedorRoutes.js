const express = require('express');
const router = express.Router();
const {
  crearProveedor,
  listarProveedores,
  editarProveedor,
  eliminarProveedor
} = require('../controllers/proveedorController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/proveedores', verificarToken, crearProveedor);
router.get('/proveedores', verificarToken, listarProveedores);
router.put('/proveedores/:id', verificarToken, editarProveedor);
router.delete('/proveedores/:id', verificarToken, eliminarProveedor);

module.exports = router;
