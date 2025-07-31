const express = require('express');
const router = express.Router();
const db = require('../db');
const verificarToken = require('../middleware/authMiddleware');

router.get('/', verificarToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT v.id, p.nombre AS nombre_producto, p.imagen, v.talle, v.color, v.stock
      FROM variantes v
      JOIN productos p ON v.producto_id = p.id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener inventario:', err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

module.exports = router;
