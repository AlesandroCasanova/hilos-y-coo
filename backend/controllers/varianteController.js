const db = require('../models/db');

exports.crearVariante = async (req, res) => {
  const { producto_id, talle, color, stock } = req.body;
  try {
    await db.query(
      'INSERT INTO variantes (producto_id, talle, color, stock) VALUES (?, ?, ?, ?)',
      [producto_id, talle, color, stock]
    );
    res.json({ mensaje: 'Variante creada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear variante', error });
  }
};

exports.listarVariantesPorProducto = async (req, res) => {
  const { producto_id } = req.params;
  try {
    const [variantes] = await db.query('SELECT * FROM variantes WHERE producto_id = ?', [producto_id]);
    res.json(variantes);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener variantes', error });
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
    res.status(500).json({ mensaje: 'Error al actualizar variante', error });
  }
};

exports.eliminarVariante = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM variantes WHERE id = ?', [id]);
    res.json({ mensaje: 'Variante eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar variante', error });
  }
};
// ✅ Archivo: controllers/varianteController.js

exports.obtenerInventario = async (req, res) => {
  try {
    const [filas] = await db.query(`
      SELECT v.id, v.producto_id, v.talle, v.color, v.stock, v.activo,
             p.nombre, p.imagen
      FROM variantes v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.activo = 1
    `);

    res.json(filas); // Devolvés los resultados al frontend
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ mensaje: 'Error al obtener inventario' });
  }
};


// Actualizar stock con validación
exports.actualizarStock = async (req, res) => {
  const id = req.params.id;
  const { stock } = req.body;

  if (isNaN(stock)) {
    return res.status(400).json({ mensaje: 'El stock ingresado no es válido' });
  }

  if (stock < 0) {
    return res.status(400).json({ mensaje: 'El stock no puede ser negativo' });
  }

  try {
    await db.query('UPDATE variantes SET stock = ? WHERE id = ?', [stock, id]);
    res.status(200).json({ mensaje: 'Stock actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ mensaje: 'Error del servidor al actualizar stock' });
  }
};
