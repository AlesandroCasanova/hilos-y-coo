const express = require('express');
const router = express.Router();
const finanzasController = require('../controllers/finanzasController');

// Auth mínimo (si ya tenés uno global, podés quitar esto)
const requireAuth = (req, res, next) => {
  try {
    if (!req.usuario) req.usuario = { id: 0, nombre: 'sistema' };
    next();
  } catch (e) {
    next(e);
  }
};

// Saldos unificados (dejo tu ruta duplicada por compatibilidad)
router.get('/saldos', requireAuth, finanzasController.obtenerSaldos);
router.get('/finanzas/saldos', finanzasController.obtenerSaldos);

// Históricos
router.get('/movimientos', requireAuth, finanzasController.movimientosHistoricos);
router.get('/reservas', requireAuth, finanzasController.historialReservas);

// Reservas (alta / liberar)
router.post('/reservas', requireAuth, finanzasController.crearReserva);
router.post('/reservas/liberar', requireAuth, finanzasController.liberarReserva);

// NUEVO: Resumen P&L (para tu tarjeta “Ganancias”)
router.get('/resumen', requireAuth, finanzasController.resumen);

module.exports = router;
