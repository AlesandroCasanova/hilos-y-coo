// routes/gananciasRoutes.js
const express = require('express');
const router = express.Router();

const ganancias = require('../controllers/gananciasController');
// ✅ usar tu middleware existente
const auth = require('../middleware/authMiddleware');

// Rutas protegidas (si querés restringir por rol, podés encadenar: auth.requerirRol('Dueño','Admin'))
router.get('/mensual', auth, ganancias.mensual);
router.get('/top-productos', auth, ganancias.topProductosMensual);

module.exports = router;
