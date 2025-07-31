const db = require('../models/db');
const fs = require('fs');
const path = require('path');

function normalizarNombre(nombre) {
  return nombre
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]+/g, '');
}

// --- CREAR PRODUCTO ---
exports.crearProducto = async (req, res) => {
  const { nombre, descripcion, codigo, categoria, proveedor_id, precio_proveedor, precio, usuario_id } = req.body;
  let imagenTemp = req.file ? req.file.filename : null;

  try {
    // 1. Insertar producto (activo = 1)
    const [result] = await db.query(
      'INSERT INTO productos (nombre, descripcion, codigo, categoria, proveedor_id, precio_proveedor, precio, activo) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [nombre, descripcion, codigo, categoria, proveedor_id, precio_proveedor, precio]
    );
    const idProducto = result.insertId;

    // 2. Insertar en historial de precios
    await db.query(
      'INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo, fecha, usuario_id) VALUES (?, ?, ?, NOW(), ?)',
      [idProducto, 0, precio_proveedor, usuario_id || null]
    );

    // 3. Procesar imagen
    if (imagenTemp) {
      const ext = path.extname(imagenTemp);
      const nombreArchivoFinal = `${idProducto}-${normalizarNombre(nombre)}${ext}`;
      const rutaTemp = path.join(__dirname, '..', 'public/imagenes_productos', imagenTemp);
      const rutaFinal = path.join(__dirname, '..', 'public/imagenes_productos', nombreArchivoFinal);

      fs.renameSync(rutaTemp, rutaFinal);

      await db.query('UPDATE productos SET imagen = ? WHERE id = ?', [nombreArchivoFinal, idProducto]);
    }

    res.json({ mensaje: 'Producto creado' });
  } catch (error) {
    if (imagenTemp) {
      const rutaTemp = path.join(__dirname, '..', 'public/imagenes_productos', imagenTemp);
      if (fs.existsSync(rutaTemp)) fs.unlinkSync(rutaTemp);
    }
    res.status(500).json({ mensaje: 'Error al crear producto', error });
  }
};

// --- LISTAR PRODUCTOS (sólo activos) ---
exports.listarProductos = async (req, res) => {
  try {
    const [productos] = await db.query(`
      SELECT p.*, 
        pr.nombre AS proveedor_nombre, 
        c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      LEFT JOIN categorias c ON p.categoria = c.nombre
      WHERE p.activo = 1
      ORDER BY p.id DESC
    `);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener productos', error });
  }
};

// --- OBTENER UN PRODUCTO ---
exports.obtenerProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const [producto] = await db.query(`
      SELECT p.*, 
        pr.nombre AS proveedor_nombre, 
        c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      LEFT JOIN categorias c ON p.categoria = c.nombre
      WHERE p.id = ? AND p.activo = 1
    `, [id]);
    if (!producto[0]) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.json(producto[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener producto', error });
  }
};

// --- EDITAR PRODUCTO ---
exports.editarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, codigo, categoria, proveedor_id, precio_proveedor, precio, usuario_id } = req.body;
  let imagenTemp = req.file ? req.file.filename : null;

  try {
    // Obtener imagen y precio_proveedor anterior
    let imagenAnterior = null;
    let precioAnterior = 0;
    const [rows] = await db.query('SELECT imagen, precio_proveedor FROM productos WHERE id = ?', [id]);
    if (rows.length > 0) {
      imagenAnterior = rows[0].imagen;
      precioAnterior = rows[0].precio_proveedor;
    }

    // Actualizar producto
    let query = `
      UPDATE productos 
      SET nombre = ?, descripcion = ?, codigo = ?, categoria = ?, proveedor_id = ?, precio_proveedor = ?, precio = ?`;
    let params = [nombre, descripcion, codigo, categoria, proveedor_id, precio_proveedor, precio];

    if (imagenTemp) {
      const ext = path.extname(imagenTemp);
      const nombreImagenFinal = `${id}-${normalizarNombre(nombre)}${ext}`;
      query += `, imagen = ?`;
      params.push(nombreImagenFinal);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await db.query(query, params);

    // Registrar en historial SOLO si cambió el precio_proveedor
    if (Number(precio_proveedor) !== Number(precioAnterior)) {
      await db.query(
        'INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo, fecha, usuario_id) VALUES (?, ?, ?, NOW(), ?)',
        [id, precioAnterior, precio_proveedor, usuario_id || null]
      );
    }

    // Procesar imagen nueva
    if (imagenTemp) {
      const ext = path.extname(imagenTemp);
      const nombreImagenFinal = `${id}-${normalizarNombre(nombre)}${ext}`;
      const rutaTemp = path.join(__dirname, '..', 'public/imagenes_productos', imagenTemp);
      const rutaFinal = path.join(__dirname, '..', 'public/imagenes_productos', nombreImagenFinal);

      fs.renameSync(rutaTemp, rutaFinal);

      if (imagenAnterior) {
        const rutaVieja = path.join(__dirname, '..', 'public/imagenes_productos', imagenAnterior);
        if (fs.existsSync(rutaVieja)) fs.unlinkSync(rutaVieja);
      }
    }

    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    if (imagenTemp) {
      const rutaTemp = path.join(__dirname, '..', 'public/imagenes_productos', imagenTemp);
      if (fs.existsSync(rutaTemp)) fs.unlinkSync(rutaTemp);
    }
    res.status(500).json({ mensaje: 'Error al actualizar producto', error });
  }
};

// --- SOFT DELETE: "ELIMINAR" PRODUCTO Y VARIANTES ---
exports.eliminarProducto = async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // "Eliminar" variantes asociadas (soft delete)
    await conn.query('UPDATE variantes SET activo = 0 WHERE producto_id = ?', [id]);
    // "Eliminar" producto (soft delete)
    await conn.query('UPDATE productos SET activo = 0 WHERE id = ?', [id]);

    await conn.commit();

    res.json({ mensaje: 'Producto eliminado (soft delete)' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ mensaje: 'Error al eliminar producto', error });
  } finally {
    conn.release();
  }
};

// --- HISTORIAL DE PRECIOS ---
exports.historialPrecios = async (req, res) => {
  const { id } = req.params;
  try {
    const [historial] = await db.query(
      'SELECT * FROM historial_precios WHERE producto_id = ? ORDER BY fecha DESC',
      [id]
    );
    res.json(historial);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener historial de precios', error });
  }
};
