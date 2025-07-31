const express = require('express');
const router = express.Router();
const {
  crearVariante,
  listarVariantesPorProducto,
  editarVariante,
  eliminarVariante,
  actualizarStock
} = require('../controllers/varianteController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/variantes', verificarToken, crearVariante);
router.get('/variantes/:producto_id', verificarToken, listarVariantesPorProducto);
router.put('/variantes/:id', verificarToken, editarVariante);
router.delete('/variantes/:id', verificarToken, eliminarVariante);
router.put('/actualizarStock/:id', verificarToken, actualizarStock);

module.exports = router;
