const db = require('../models/db');

// --- LO TUYO ARRANCA ACÁ ---
exports.agregarAlCarrito = async (req, res) => {
  const { usuario_id, variante_id, cantidad } = req.body;
  try {
    await db.query(
      'INSERT INTO carrito (usuario_id, variante_id, cantidad) VALUES (?, ?, ?)',
      [usuario_id, variante_id, cantidad]
    );
    res.json({ mensaje: 'Producto agregado al carrito' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar al carrito', error });
  }
};

exports.obtenerCarrito = async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const [carrito] = await db.query(`
      SELECT c.id, c.cantidad, v.talle, v.color, v.stock, p.nombre AS producto, p.precio
      FROM carrito c
      JOIN variantes v ON c.variante_id = v.id
      JOIN productos p ON v.producto_id = p.id
      WHERE c.usuario_id = ?
    `, [id_usuario]);
    res.json(carrito);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener carrito', error });
  }
};

exports.actualizarCantidadCarrito = async (req, res) => {
  const { id_item } = req.params;
  const { cantidad } = req.body;
  try {
    await db.query('UPDATE carrito SET cantidad = ? WHERE id = ?', [cantidad, id_item]);
    res.json({ mensaje: 'Cantidad actualizada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar cantidad', error });
  }
};

exports.eliminarItemCarrito = async (req, res) => {
  const { id_item } = req.params;
  try {
    await db.query('DELETE FROM carrito WHERE id = ?', [id_item]);
    res.json({ mensaje: 'Item eliminado del carrito' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar item', error });
  }
};

exports.confirmarVenta = async (req, res) => {
  const { usuario_id } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [carrito] = await conn.query('SELECT * FROM carrito WHERE usuario_id = ?', [usuario_id]);

    if (carrito.length === 0) {
      await conn.release();
      return res.status(400).json({ mensaje: 'Carrito vacío' });
    }

    let total = 0;
    for (const item of carrito) {
      const [[{ precio }]] = await conn.query(`
        SELECT p.precio FROM productos p
        JOIN variantes v ON v.producto_id = p.id
        WHERE v.id = ?
      `, [item.variante_id]);
      total += precio * item.cantidad;
    }

    const [venta] = await conn.query(
      'INSERT INTO ventas (usuario_id, total) VALUES (?, ?)',
      [usuario_id, total]
    );
    const venta_id = venta.insertId;

    for (const item of carrito) {
      const [[{ precio }]] = await conn.query(`
        SELECT p.precio FROM productos p
        JOIN variantes v ON v.producto_id = p.id
        WHERE v.id = ?
      `, [item.variante_id]);

      await conn.query(`
        INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)`,
        [venta_id, item.variante_id, item.cantidad, precio]);

      await conn.query(`
        UPDATE variantes SET stock = stock - ? WHERE id = ?`,
        [item.cantidad, item.variante_id]);

      await conn.query(`
        INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo)
        VALUES (?, 'Egreso', ?, 'Venta')`,
        [item.variante_id, item.cantidad]);
    }

    await conn.query('DELETE FROM carrito WHERE usuario_id = ?', [usuario_id]);

    await conn.query(`
      INSERT INTO finanzas (tipo, descripcion, monto, fecha)
      VALUES ('Ingreso', 'Venta ID ${venta_id}', ?, CURDATE())
    `, [total]);

    await conn.commit();
    res.json({ mensaje: 'Venta confirmada', venta_id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ mensaje: 'Error al confirmar venta', error });
  } finally {
    conn.release();
  }
};

exports.ventaDesdeCarrito = async (req, res) => {
  const usuario_id = req.usuario.id;
  const { items, pagos } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ mensaje: 'El carrito está vacío.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let total = 0;
    for (const item of items) {
      total += item.precio * item.cantidad;
    }

    const [venta] = await conn.query(
      'INSERT INTO ventas (usuario_id, total, fecha) VALUES (?, ?, NOW())',
      [usuario_id, total]
    );
    const venta_id = venta.insertId;

    for (const item of items) {
      await conn.query(`
        INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?)`,
        [venta_id, item.variante_id, item.cantidad, item.precio]);

      await conn.query(`
        UPDATE variantes SET stock = stock - ? WHERE id = ?`,
        [item.cantidad, item.variante_id]);

      await conn.query(`
        INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo)
        VALUES (?, 'Egreso', ?, 'Venta')`,
        [item.variante_id, item.cantidad]);
    }

    await conn.query(`
      INSERT INTO finanzas (tipo, descripcion, monto, fecha)
      VALUES ('Ingreso', 'Venta múltiple ID ${venta_id}', ?, NOW())`,
      [total]);

    // REGISTRO DE MOVIMIENTOS DE CAJA (NUEVO CON venta_id)
    for (const pago of pagos) {
      const caja_tipo = pago.metodo === 'efectivo' ? 'fisica' : 'virtual';
      await conn.query(`
        INSERT INTO movimientos_caja (venta_id, tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
        VALUES (?, 'ingreso', ?, ?, ?, ?, ?)`,
        [venta_id, `Venta ID ${venta_id}`, pago.monto, pago.metodo, caja_tipo, usuario_id]);
    }

    await conn.commit();
    res.json({ mensaje: 'Venta registrada', venta_id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ mensaje: 'Error al registrar venta desde carrito', error });
  } finally {
    conn.release();
  }
};

exports.listarVentas = async (req, res) => {
  try {
    const [ventas] = await db.query(`
      SELECT v.id, v.fecha, v.total, u.nombre AS vendedor
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      ORDER BY v.fecha DESC
    `);
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar ventas', error });
  }
};

exports.detalleVenta = async (req, res) => {
  const { id } = req.params;
  try {
    const [detalle] = await db.query(`
      SELECT dv.*, v.talle, v.color, p.nombre AS producto
      FROM detalle_venta dv
      JOIN variantes v ON dv.variante_id = v.id
      JOIN productos p ON v.producto_id = p.id
      WHERE dv.venta_id = ?
    `, [id]);
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener detalle', error });
  }
};

exports.listarVentasDetallado = async (req, res) => {
  try {
    const [ventas] = await db.query(`
      SELECT v.id, v.fecha, v.total, u.nombre AS usuario_nombre,
        p.nombre AS producto_nombre, d.cantidad, d.precio_unitario,
        vta.talle, vta.color
      FROM ventas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN detalle_venta d ON d.venta_id = v.id
      JOIN variantes vta ON d.variante_id = vta.id
      JOIN productos p ON vta.producto_id = p.id
      ORDER BY v.fecha DESC
    `);
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar ventas', error });
  }
};
