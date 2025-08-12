const express = require('express');
const router = express.Router();

// Ojo: usás carpeta singular "middleware" en tu proyecto
const verificarToken = require('../middleware/authMiddleware');

const {
  crearVariante,
  listarVariantesPorProducto,
  editarVariante,
  eliminarVariante,
  actualizarStock,
  obtenerInventario,
  obtenerMovimientosInventario
} = require('../controllers/varianteController');

// CRUD variantes
router.post('/variantes', verificarToken, crearVariante);

// ✅ Acepta ambas formas:
//    - /api/variantes?producto_id=5
//    - /api/variantes/5
router.get('/variantes', verificarToken, listarVariantesPorProducto);
router.get('/variantes/:producto_id', verificarToken, listarVariantesPorProducto);

router.put('/variantes/:id', verificarToken, editarVariante);
router.delete('/variantes/:id', verificarToken, eliminarVariante);

// Inventario
router.get('/inventario', verificarToken, obtenerInventario);
router.put('/actualizarStock/:id', verificarToken, actualizarStock);
router.get('/inventario/movimientos', verificarToken, obtenerMovimientosInventario);

module.exports = router;
