// backend/controllers/ventaDetalleController.js
const db = require('../models/db');

/**
 * GET /api/ventas/:id/detalle
 * Devuelve SOLO los ítems de la venta con info enriquecida para la UI.
 */
exports.detalleVenta = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
         dv.id,
         dv.venta_id,
         dv.variante_id,
         dv.cantidad,
         dv.precio_unitario,
         v.fecha,
         var.producto_id,
         p.nombre       AS producto_nombre,
         var.color,
         var.talle
       FROM detalle_venta dv
       JOIN ventas v       ON v.id = dv.venta_id
       JOIN variantes var  ON var.id = dv.variante_id
       JOIN productos p    ON p.id = var.producto_id
       WHERE dv.venta_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('detalleVenta error:', error);
    res.status(500).json({ mensaje: 'Error al obtener detalle de la venta' });
  }
};

/**
 * GET /api/ventas/:id
 * Devuelve cabecera + items (útil para otros usos).
 */
exports.obtenerVenta = async (req, res) => {
  const { id } = req.params;
  try {
    const [[venta]] = await db.query(
      `SELECT v.id, v.fecha, v.total, u.nombre AS vendedor
       FROM ventas v
       LEFT JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.id = ?
       LIMIT 1`,
      [id]
    );
    if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });

    const [items] = await db.query(
      `SELECT 
         dv.id,
         dv.venta_id,
         dv.variante_id,
         dv.cantidad,
         dv.precio_unitario,
         v.fecha,
         var.producto_id,
         p.nombre       AS producto_nombre,
         var.color,
         var.talle
       FROM detalle_venta dv
       JOIN ventas v       ON v.id = dv.venta_id
       JOIN variantes var  ON var.id = dv.variante_id
       JOIN productos p    ON p.id = var.producto_id
       WHERE dv.venta_id = ?`,
      [id]
    );

    res.json({ venta, items });
  } catch (error) {
    console.error('obtenerVenta error:', error);
    res.status(500).json({ mensaje: 'Error al obtener la venta' });
  }
};
