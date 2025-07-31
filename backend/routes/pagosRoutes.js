const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagosController');
const verificarToken = require('../middleware/authMiddleware');
const db = require('../db'); // necesario para las nuevas rutas

// PAGOS A EMPLEADOS
router.post('/empleado', verificarToken, pagosController.registrarPagoEmpleado);
router.get('/empleado', verificarToken, pagosController.obtenerPagosEmpleados);

// PAGOS A PROVEEDORES
router.post('/proveedor', verificarToken, pagosController.registrarPagoProveedor);
router.get('/proveedor', verificarToken, pagosController.obtenerPagosProveedores);

// IMPUESTOS
router.post('/impuestos', verificarToken, pagosController.registrarImpuesto);
router.get('/impuestos', verificarToken, pagosController.obtenerImpuestos);

// OTROS PAGOS
router.post('/otro-pago', verificarToken, pagosController.registrarOtroPago);
router.get('/otros-pagos', verificarToken, pagosController.obtenerOtrosPagos);

// LISTAS PARA SELECTS DINÁMICOS
router.get('/lista-empleados', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nombre FROM usuarios WHERE rol = 'Empleado'");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lista-proveedores', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nombre FROM proveedores");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
