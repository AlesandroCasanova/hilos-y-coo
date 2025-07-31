const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const verificarToken = require('../middleware/authMiddleware'); // Usá SIEMPRE este nombre

// --- Todas las rutas de caja requieren autenticación ---
router.use(verificarToken);

// --- Apertura y cierre de caja ---
router.post('/abrir', cajaController.abrirCaja);
router.post('/cerrar', cajaController.cerrarCaja);

// --- Movimientos de caja ---
router.post('/movimiento', cajaController.registrarMovimiento);
router.get('/movimientos/:tipo_caja', cajaController.obtenerMovimientos);
router.get('/movimientos', cajaController.filtrarMovimientos); // Filtrar por query

// --- Estado de caja y consulta de caja abierta ---
router.get('/estado/:tipo_caja', cajaController.estadoCaja);
router.get('/abierta-fisica', cajaController.cajaFisicaAbierta); // (Opcional: sólo si usás este endpoint)

router.post('/arqueo', cajaController.registrarArqueo);
router.get('/arqueos', cajaController.listarArqueos);

router.get('/saldos', cajaController.estadoCajaCompleto);



module.exports = router;
