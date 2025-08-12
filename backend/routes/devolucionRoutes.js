// backend/routes/devolucionRoutes.js
const express = require('express');
const router = express.Router();

const verificarToken = require('../middleware/authMiddleware');
const devolucionController = require('../controllers/devolucionController');

router.post('/devoluciones', verificarToken, devolucionController.crear);
router.get('/devoluciones/:id', verificarToken, devolucionController.detalle);

module.exports = router;
