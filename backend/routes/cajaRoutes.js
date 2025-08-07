const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');

// Middleware real de auth (usá el tuyo); si ya tenés uno global, podés quitar este.
const requireAuth = (req, res, next) => {
  try {
    if (!req.usuario) req.usuario = { id: 0, nombre: 'sistema' };
    next();
  } catch (e) {
    next(e);
  }
};

// Estado y movimientos
router.get('/estado', requireAuth, cajaController.estadoCaja);
router.get('/movimientos', requireAuth, cajaController.movimientosDelDia);

// Apertura / Cierre / Transferencia
router.post('/abrir', requireAuth, cajaController.abrirCaja);
router.post('/cerrar', requireAuth, cajaController.cerrarCaja);
router.post('/transferir', requireAuth, cajaController.transferirEntreCajas);

module.exports = router;
