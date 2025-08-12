// backend/routes/ventaDetalleRoutes.js
const express = require('express');
const router = express.Router();

const verificarToken = require('../middleware/authMiddleware');
const ctrl = require('../controllers/ventaDetalleController');

// Solo lectura / historial / detalle
router.get('/ventas/:id/detalle', verificarToken, ctrl.detalleVenta);  // devuelve array de ítems
router.get('/ventas/:id', verificarToken, ctrl.obtenerVenta);          // devuelve {venta, items}

module.exports = router;
