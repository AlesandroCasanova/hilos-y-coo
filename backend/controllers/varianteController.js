// backend/controllers/varianteController.js
const db = require('../models/db');

// ================= CRUD BÁSICO =================
exports.crearVariante = async (req, res) => {
  const { producto_id, talle, color, stock } = req.body;
  try {
    await db.query(
      'INSERT INTO variantes (producto_id, talle, color, stock) VALUES (?, ?, ?, ?)',
      [producto_id, talle, color, stock]
    );
    res.json({ mensaje: 'Variante creada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear variante', error });
  }
};

exports.editarVariante = async (req, res) => {
  const { id } = req.params;
  const { talle, color, stock } = req.body;
  try {
    let set = [];
    let params = [];
    if (talle !== undefined) { set.push('talle = ?'); params.push(talle); }
    if (color !== undefined) { set.push('color = ?'); params.push(color); }
    if (stock !== undefined) { set.push('stock = ?'); params.push(stock); }
    if (!set.length) return res.status(400).json({ mensaje: 'Nada para actualizar' });

    params.push(id);
    await db.query(`UPDATE variantes SET ${set.join(', ')} WHERE id = ?`, params);
    res.json({ mensaje: 'Variante actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar variante', error });
  }
};

exports.eliminarVariante = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM variantes WHERE id = ?', [id]);
    res.json({ mensaje: 'Variante eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar variante', error });
  }
};

// ================= LISTADOS =================

/**
 * GET /api/variantes
 * Filtros opcionales: producto_id, activo, color, talle, q
 * Devuelve: id, producto_id, talle, color, stock, activo
 * => Esta es la ruta que usa devoluciones.js (con ?producto_id=...)
 */
exports.listarVariantes = async (req, res) => {
  try {
    const { producto_id, activo, color, talle, q } = req.query;

    let sql = `
      SELECT v.id, v.producto_id, v.talle, v.color, v.stock, v.activo
      FROM variantes v
    `;
    const where = [];
    const params = [];

    if (producto_id) { where.push('v.producto_id = ?'); params.push(Number(producto_id)); }
    if (typeof activo !== 'undefined') { where.push('v.activo = ?'); params.push(Number(activo) ? 1 : 0); }
    if (color) { where.push('v.color LIKE ?'); params.push(`%${color}%`); }
    if (talle) { where.push('v.talle LIKE ?'); params.push(`%${talle}%`); }
    if (q) {
      where.push('(v.id = ? OR v.color LIKE ? OR v.talle LIKE ?)');
      params.push(Number(q) || 0, `%${q}%`, `%${q}%`);
    }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY v.id DESC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('listarVariantes error:', error);
    res.status(500).json({ mensaje: 'Error al listar variantes' });
  }
};

/**
 * GET /api/variantes/:producto_id
 * Compat para rutas antiguas que pedían por parámetro.
 */
exports.listarVariantesPorProducto = async (req, res) => {
  const { producto_id } = req.params;
  try {
    const [variantes] = await db.query(
      'SELECT id, producto_id, talle, color, stock, activo FROM variantes WHERE producto_id = ?',
      [producto_id]
    );
    res.json(variantes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener variantes', error });
  }
};

/**
 * GET /api/variantes/id/:id
 * Devuelve la variante + datos mínimos del producto
 */
exports.obtenerVariante = async (req, res) => {
  const { id } = req.params;
  try {
    const [[row]] = await db.query(
      `SELECT v.id, v.producto_id, v.talle, v.color, v.stock, v.activo,
              p.nombre AS producto_nombre, p.precio AS producto_precio
       FROM variantes v
       JOIN productos p ON p.id = v.producto_id
       WHERE v.id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ mensaje: 'Variante no encontrada' });
    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener variante' });
  }
};

// =============== INVENTARIO / UTILIDADES ===============
exports.obtenerInventario = async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT v.id, v.producto_id, v.talle, v.color, v.stock, v.activo,
             p.nombre, p.imagen
      FROM variantes v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.activo = 1
    `);
    res.json(filas);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ mensaje: 'Error al obtener inventario' });
  }
};

exports.actualizarStock = async (req, res) => {
  const id = req.params.id;
  const { stock } = req.body;

  if (isNaN(stock)) return res.status(400).json({ mensaje: 'El stock ingresado no es válido' });
  if (stock < 0)     return res.status(400).json({ mensaje: 'El stock no puede ser negativo' });

  try {
    await db.query('UPDATE variantes SET stock = ? WHERE id = ?', [stock, id]);
    res.status(200).json({ mensaje: 'Stock actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ mensaje: 'Error del servidor al actualizar stock' });
  }
};
