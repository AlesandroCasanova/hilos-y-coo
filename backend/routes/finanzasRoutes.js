const express = require('express');
const router = express.Router();
const finanzasController = require('../controllers/finanzasController');

const requireAuth = (req, res, next) => {
  try {
    if (!req.usuario) req.usuario = { id: 0, nombre: 'sistema' };
    next();
  } catch (e) {
    next(e);
  }
};

// Saldos unificados
router.get('/saldos', requireAuth, finanzasController.obtenerSaldos);
router.get('/finanzas/saldos', finanzasController.obtenerSaldos);


// Históricos
router.get('/movimientos', requireAuth, finanzasController.movimientosHistoricos);
router.get('/reservas', requireAuth, finanzasController.historialReservas);

// Reservas (alta / liberar)
router.post('/reservas', requireAuth, finanzasController.crearReserva);
router.post('/reservas/liberar', requireAuth, finanzasController.liberarReserva);

module.exports = router;
