const express = require('express');
const router = express.Router();
const finanzaController = require('../controllers/finanzaController');
const verificarToken = require('../middleware/authMiddleware');

// Todas las rutas requieren token (por seguridad)
router.use(verificarToken);

// --- Movimientos generales de finanzas ---
router.post('/finanzas/egreso', finanzaController.registrarEgreso);
router.post('/finanzas/ingreso', finanzaController.registrarIngreso);
router.get('/finanzas', finanzaController.listarFinanzas);
router.delete('/finanzas/:id', finanzaController.eliminarMovimiento);

// --- Select dinámicos empleados/proveedores ---
router.get('/finanzas/lista-empleados', finanzaController.listaEmpleados);
router.get('/finanzas/lista-proveedores', finanzaController.listaProveedores);

// --- Reservas ---
router.post('/finanzas/reserva', finanzaController.registrarReserva);
router.get('/finanzas/reservas-activas', finanzaController.obtenerReservasActivas);
router.post('/finanzas/liberar-reserva/:id', finanzaController.liberarReserva);
router.post('/finanzas/liberar-parcial/:id', finanzaController.liberarReservaParcial);
router.post('/finanzas/reservas/extraer', finanzaController.extraerDesdeReserva);
router.get('/finanzas/reservas/total', finanzaController.obtenerTotalReservas);

// --- Saldos (para dashboard, caja, finanzas) ---
router.get('/finanzas/saldos', finanzaController.obtenerSaldos);

router.post('/finanzas/transferir-caja', finanzaController.transferirEntreCajas);

router.get('/finanzas/categorias-frecuentes', finanzaController.categoriasFrecuentes);
router.get('/finanzas/conceptos-por-categoria', finanzaController.conceptosPorCategoria);


module.exports = router;
