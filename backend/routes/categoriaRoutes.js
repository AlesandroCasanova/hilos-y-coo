const express = require('express');
const router = express.Router();
const {
  crearCategoria,
  listarCategorias,
  editarCategoria,
  eliminarCategoria
} = require('../controllers/categoriaController');
const verificarToken = require('../middleware/authMiddleware');

router.post('/categorias', verificarToken, crearCategoria);
router.get('/categorias', verificarToken, listarCategorias);
router.put('/categorias/:id', verificarToken, editarCategoria);
router.delete('/categorias/:id', verificarToken, eliminarCategoria);

module.exports = router;
