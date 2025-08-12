// backend/routes/varianteRoutes.js
const express = require('express');
const router = express.Router();

const verificarToken = require('../middleware/authMiddleware');
const {
  crearVariante,
  listarVariantes,              // NUEVO -> /api/variantes?producto_id=1
  listarVariantesPorProducto,   // Compat -> /api/variantes/:producto_id
  obtenerVariante,              // NUEVO -> /api/variantes/id/:id
  editarVariante,
  eliminarVariante,
  actualizarStock
} = require('../controllers/varianteController');

// Crear
router.post('/variantes', verificarToken, crearVariante);

// Listar (nuevo con filtros por query) -> ***ESTA ES LA QUE USA devoluciones.js***
router.get('/variantes', verificarToken, listarVariantes);

// Obtener por ID (evitamos conflicto con :producto_id usando prefijo /id/)
router.get('/variantes/id/:id', verificarToken, obtenerVariante);

// Compat anterior: listar por producto_id como parámetro
router.get('/variantes/:producto_id', verificarToken, listarVariantesPorProducto);

// Editar / eliminar / stock
router.put('/variantes/:id', verificarToken, editarVariante);
router.delete('/variantes/:id', verificarToken, eliminarVariante);
router.put('/actualizarStock/:id', verificarToken, actualizarStock);

module.exports = router;
