const express = require('express');
const router = express.Router();
const {
  crearProducto,
  listarProductos,
  obtenerProducto,
  editarProducto,
  eliminarProducto,
  historialPrecios
} = require('../controllers/productoController');
const verificarToken = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.post('/productos', verificarToken, upload.single('imagen'), crearProducto);
router.put('/productos/:id', verificarToken, upload.single('imagen'), editarProducto);
router.get('/productos', verificarToken, listarProductos);
router.get('/productos/:id', verificarToken, obtenerProducto);
router.delete('/productos/:id', verificarToken, eliminarProducto);
router.get('/productos/historial/:id', verificarToken, historialPrecios);

module.exports = router;
