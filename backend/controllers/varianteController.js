// ✅ Archivo: controllers/varianteController.js
const db = require('../models/db');

// ------------------ CRUD de variantes ------------------
exports.crearVariante = async (req, res) => {
  const { producto_id, talle, color, stock } = req.body;
  try {
    await db.query(
      'INSERT INTO variantes (producto_id, talle, color, stock) VALUES (?, ?, ?, ?)',
      [producto_id, talle, color, stock]
    );
    res.json({ mensaje: 'Variante creada' });
  } catch (error) {
    console.error('crearVariante:', error);
    res.status(500).json({ mensaje: 'Error al crear variante' });
  }
};

exports.listarVariantesPorProducto = async (req, res) => {
  // ✅ Soporta path param y query param
  const producto_id = req.params.producto_id ?? req.query.producto_id;

  if (!producto_id) {
    return res.status(400).json({ mensaje: 'Falta producto_id' });
  }

  try {
    const [variantes] = await db.query(
      'SELECT * FROM variantes WHERE producto_id = ?',
      [producto_id]
    );
    res.json(variantes);
  } catch (error) {
    console.error('listarVariantesPorProducto:', error);
    res.status(500).json({ mensaje: 'Error al obtener variantes' });
  }
};

exports.editarVariante = async (req, res) => {
  const { id } = req.params;
  const { talle, color, stock } = req.body;
  try {
    let set = [];
    let params = [];
    if (talle !== undefined) { set.push("talle = ?"); params.push(talle); }
    if (color !== undefined) { set.push("color = ?"); params.push(color); }
    if (stock !== undefined) { set.push("stock = ?"); params.push(stock); }
    if (!set.length) return res.status(400).json({ mensaje: 'Nada para actualizar' });

    params.push(id);
    await db.query(`UPDATE variantes SET ${set.join(', ')} WHERE id = ?`, params);
    res.json({ mensaje: 'Variante actualizada' });
  } catch (error) {
    console.error('editarVariante:', error);
    res.status(500).json({ mensaje: 'Error al actualizar variante' });
  }
};

exports.eliminarVariante = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM variantes WHERE id = ?', [id]);
    res.json({ mensaje: 'Variante eliminada' });
  } catch (error) {
    console.error('eliminarVariante:', error);
    res.status(500).json({ mensaje: 'Error al eliminar variante' });
  }
};

// ------------------ Inventario: listado enriquecido ------------------
/**
 * Devuelve el inventario con datos completos del producto
 * v.* + p.*  (para la pantalla de inventario)
 */
exports.obtenerInventario = async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT
        v.id, v.producto_id, v.talle, v.color, v.stock, v.activo,
        p.id           AS p_id,
        p.nombre       AS producto_nombre,
        p.codigo,
        p.descripcion,
        p.categoria,
        p.proveedor_id,
        p.precio_proveedor,
        p.precio,
        p.imagen
      FROM variantes v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.activo = 1 AND p.activo = 1
      ORDER BY p.id, v.color, v.talle
    `);
    res.json(filas);
  } catch (error) {
    console.error('obtenerInventario:', error);
    res.status(500).json({ mensaje: 'Error al obtener inventario' });
  }
};

// ------------------ Inventario: actualizar stock + movimiento ------------------
/**
 * PUT /api/actualizarStock/:id
 * body: { stock, referencia_tipo?, referencia_id?, descripcion? }
 * - Actualiza el stock de la variante
 * - Inserta movimiento en inventario_movimientos con la diferencia (delta)
 */
exports.actualizarStock = async (req, res) => {
  const varianteId = Number(req.params.id);
  const { stock } = req.body;

  if (isNaN(stock) || stock < 0) {
    return res.status(400).json({ mensaje: 'El stock ingresado no es válido' });
  }

  const referenciaTipo = (req.body.referencia_tipo ? String(req.body.referencia_tipo) : 'ajuste_manual').slice(0, 50);
  const referenciaId   = Number.isFinite(Number(req.body.referencia_id)) ? Number(req.body.referencia_id) : varianteId;

  const quien = (req.usuario && (req.usuario.nombre || `usuario #${req.usuario.id}`)) || 'sistema';
  const descBody = req.body.descripcion ? String(req.body.descripcion) : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[actual]] = await conn.query(
      'SELECT stock, producto_id FROM variantes WHERE id = ? FOR UPDATE',
      [varianteId]
    );
    if (!actual) {
      await conn.rollback();
      return res.status(404).json({ mensaje: 'Variante no encontrada' });
    }

    const nuevo = Number(stock);
    const viejo = Number(actual.stock);
    const delta = nuevo - viejo;

    await conn.query('UPDATE variantes SET stock = ? WHERE id = ?', [nuevo, varianteId]);

    if (delta !== 0) {
      const descripcion = (descBody && descBody.trim().slice(0,255))
        || `Ajuste manual desde inventario por ${quien} (${viejo} → ${nuevo})`;

      await conn.query(`
        INSERT INTO inventario_movimientos
          (fecha, producto_id, variante_id, tipo, cantidad, referencia_tipo, referencia_id, descripcion)
        VALUES (NOW(), ?, ?, 'ajuste', ?, ?, ?, ?)
      `, [actual.producto_id, varianteId, delta, referenciaTipo, referenciaId, descripcion]);
    }

    await conn.commit();
    res.status(200).json({ mensaje: 'Stock actualizado correctamente', delta });
  } catch (error) {
    console.error('actualizarStock:', error);
    try { await conn.rollback(); } catch {}
    res.status(500).json({ mensaje: 'Error del servidor al actualizar stock' });
  } finally {
    conn.release();
  }
};

// ------------------ Inventario: historial de movimientos ------------------
/**
 * GET /api/inventario/movimientos?producto_id=&variante_id=&limit=50
 */
exports.obtenerMovimientosInventario = async (req, res) => {
  const { producto_id, variante_id } = req.query;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

  try {
    let sql = `
      SELECT id, fecha, producto_id, variante_id, tipo, cantidad, referencia_tipo, referencia_id, descripcion
      FROM inventario_movimientos
      WHERE 1=1
    `;
    const params = [];
    if (producto_id) { sql += ' AND producto_id = ?'; params.push(producto_id); }
    if (variante_id) { sql += ' AND variante_id = ?'; params.push(variante_id); }
    sql += ' ORDER BY fecha DESC, id DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('obtenerMovimientosInventario:', error);
    res.status(500).json({ mensaje: 'Error al obtener movimientos' });
  }
};
