const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const upload = require('../middleware/uploadPedidos');
const auth = require('../middleware/authMiddleware');

// Registrar nuevo pedido con comprobante (imagen o PDF)
router.post('/pedidos', auth, upload.single('archivo'), pedidosController.crearPedido);

// Obtener todos los pedidos
router.get('/pedidos', auth, pedidosController.obtenerPedidos);

// Registrar un pago simple (prompt clásico)
router.post('/pedidos/pago', auth, pedidosController.registrarPago);

// Registrar un pago detallado (con múltiples métodos de pago: caja/reserva física/virtual)
router.post('/pedidos/pago-detallado', auth, pedidosController.registrarPagoDetallado);

router.get('/historial/:id', auth, pedidosController.obtenerHistorialPagos);


module.exports = router;
