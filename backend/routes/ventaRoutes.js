const express = require('express');
const router = express.Router();
const {
  agregarAlCarrito,
  obtenerCarrito,
  actualizarCantidadCarrito,
  eliminarItemCarrito,
  confirmarVenta,
  listarVentas,
  detalleVenta,
  ventaDesdeCarrito,
  listarVentasDetallado,
  fixMovimientosVenta
} = require('../controllers/ventaController');
const verificarToken = require('../middleware/authMiddleware');

// Rutas de carrito físico
router.post('/carrito', verificarToken, agregarAlCarrito);
router.get('/carrito/:id_usuario', verificarToken, obtenerCarrito);
router.put('/carrito/:id_item', verificarToken, actualizarCantidadCarrito);
router.delete('/carrito/:id_item', verificarToken, eliminarItemCarrito);

// Rutas de venta tradicional
router.post('/ventas', verificarToken, confirmarVenta);
router.get('/ventas', verificarToken, listarVentas);
router.get('/venta/:id', verificarToken, detalleVenta);

// venta desde "carrito local" del frontend
router.post('/ventas/carrito', verificarToken, ventaDesdeCarrito);

// historial detallado para tabla de ventas por variante
router.get('/ventas-detallado', verificarToken, listarVentasDetallado);

// utilidad para corregir históricos mal clasificados
router.post('/ventas/fix-movimientos-venta', verificarToken, fixMovimientosVenta);

module.exports = router;
