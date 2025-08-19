// controllers/ventaController.js
const db = require('../models/db');

// ===== Configuración de descuentos/comisiones =====
const DTO_CASH = 0.10;          // 10% descuento al cliente (efectivo/transferencia) cuando es único método
const FEE_TARJETA = 0.077;      // 7.7% comisión (débitos/créditos) aplicada al movimiento de caja (neto)
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Registra un movimiento en movimientos_caja por cada pago recibido.
 * Mapea método → cuenta:
 *  - efectivo  -> caja_fisica
 *  - (transferencia|debito|credito) -> caja_virtual
 * CAMBIO: para débito/crédito descuenta comisión del 7.7% en el monto asentado en caja.
 * CAMBIO: tipo='venta' (ya no 'ingreso').
 */
async function registrarMovimientosCajaPorPagos(conn, ventaId, pagos, usuarioId) {
  if (!Array.isArray(pagos)) return;

  for (const p of pagos) {
    const metodo = String(p.metodo || '').toLowerCase(); // 'efectivo'|'transferencia'|'debito'|'credito'
    const montoBruto = Number(p.monto || 0);
    if (!montoBruto || montoBruto <= 0) continue;

    const cuenta = (metodo === 'efectivo') ? 'caja_fisica' : 'caja_virtual';

    // Para tarjetas (débito/crédito) impactamos en caja el neto luego de comisión (7.7%)
    // Para efectivo/transferencia asentamos lo que venga en pagos (el caller ajusta si corresponde).
    const aplicarFeeTarjeta = (metodo === 'debito' || metodo === 'credito');
    const montoNeto = aplicarFeeTarjeta ? round2(montoBruto * (1 - FEE_TARJETA)) : round2(montoBruto);

    await conn.query(
      `INSERT INTO movimientos_caja
         (fecha, usuario_id, cuenta,  tipo,   signo, monto,  referencia_tipo, referencia_id, descripcion)
       VALUES
         (NOW(), ?,        ?,       'venta', +1,    ?,      'venta',         ?,             ?)`,
      [usuarioId || null, cuenta, montoNeto, ventaId, `Venta ID ${ventaId} (${metodo})`]
    );
  }
}

/* ===================== CARRITO (BACKEND) ===================== */

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

/* ===================== VENTAS (FLUJO CARRITO EN BD) ===================== */

exports.confirmarVenta = async (req, res) => {
  const { usuario_id, pagos } = req.body; // pagos opcional en este flujo
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [carrito] = await conn.query('SELECT * FROM carrito WHERE usuario_id = ?', [usuario_id]);
    if (carrito.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ mensaje: 'Carrito vacío' });
    }

    // Calcular total (bruto) leyendo precio actual
    let total = 0;
    for (const item of carrito) {
      const [[{ precio }]] = await conn.query(`
        SELECT p.precio FROM productos p
        JOIN variantes v ON v.producto_id = p.id
        WHERE v.id = ?
      `, [item.variante_id]);
      total += Number(precio) * Number(item.cantidad);
    }
    total = round2(total);

    // Normalizar pagos (si no mandan, asumo todo efectivo)
    const pagosNormalizados = (Array.isArray(pagos) && pagos.length)
      ? pagos.map(x => ({ metodo: String(x.metodo || '').toLowerCase(), monto: Number(x.monto || 0) }))
      : [{ metodo: 'efectivo', monto: total }];

    // Si es UN SOLO método y es efectivo/transferencia => aplicar 10% de descuento al cliente
    const unicoMetodo = pagosNormalizados.length === 1;
    const metodoUnico = unicoMetodo ? pagosNormalizados[0].metodo : null;
    const esCashOnly = unicoMetodo && (metodoUnico === 'efectivo' || metodoUnico === 'transferencia');

    if (esCashOnly) {
      const totalConDto = round2(total * (1 - DTO_CASH)); // 10% menos
      total = totalConDto;
      pagosNormalizados[0].monto = totalConDto; // el movimiento asentará este bruto; (sin doble descuento aquí)
    }

    // Crear venta (total puede venir con descuento si aplica efectivo/transferencia único)
    const [venta] = await conn.query(
      'INSERT INTO ventas (usuario_id, total, fecha) VALUES (?, ?, NOW())',
      [usuario_id, total]
    );
    const venta_id = venta.insertId;

    // Detalle + stock + historial
    for (const item of carrito) {
      const [[{ precio }]] = await conn.query(`
        SELECT p.precio FROM productos p
        JOIN variantes v ON v.producto_id = p.id
        WHERE v.id = ?
      `, [item.variante_id]);

      await conn.query(
        'INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [venta_id, item.variante_id, item.cantidad, precio]
      );

      await conn.query(
        'UPDATE variantes SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.variante_id]
      );

      await conn.query(
        'INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo) VALUES (?, "Egreso", ?, "Venta")',
        [item.variante_id, item.cantidad]
      );
    }

    // Vaciar carrito del usuario
    await conn.query('DELETE FROM carrito WHERE usuario_id = ?', [usuario_id]);

    // Finanzas: ingreso por el total de la venta (ya con descuento si fue cash-only)
    await conn.query(
      'INSERT INTO finanzas (tipo, descripcion, monto, fecha) VALUES ("Ingreso", ?, ?, NOW())',
      [`Venta ID ${venta_id}`, total]
    );

    // Movimientos de caja:
    // - Efectivo/Transferencia único: ya mandamos el monto con descuento (no hay doble descuento).
    // - Débito/Crédito: se aplicará automático el 7.7% de fee al asentar el movimiento (monto neto).
    await registrarMovimientosCajaPorPagos(conn, venta_id, pagosNormalizados, usuario_id);

    await conn.commit();
    res.json({ mensaje: 'Venta confirmada', venta_id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ mensaje: 'Error al confirmar venta', error });
  } finally {
    conn.release();
  }
};

/* ===================== VENTA DESDE CARRITO (FRONTEND LOCAL) ===================== */

exports.ventaDesdeCarrito = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { items, pagos } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ mensaje: 'El carrito está vacío.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Total BRUTO a partir de los items que llegan del front
    let total = 0;
    for (const item of items) {
      total += Number(item.precio) * Number(item.cantidad);
    }
    total = round2(total);

    // Normalizar pagos del front (pueden venir 1 o más)
    let pagosNormalizados = Array.isArray(pagos) ? pagos.map(x => ({
      metodo: String(x.metodo || '').toLowerCase(),
      monto: Number(x.monto || 0)
    })) : [];

    // Si es UN SOLO método y es efectivo/transferencia => aplicar 10% de descuento al cliente
    if (pagosNormalizados.length === 1) {
      const m = pagosNormalizados[0].metodo;
      if (m === 'efectivo' || m === 'transferencia') {
        const totalConDto = round2(total * (1 - DTO_CASH));
        total = totalConDto;
        pagosNormalizados[0].monto = totalConDto; // evitamos doble descuento en movimientos
      }
    }

    // Crear venta
    const [venta] = await conn.query(
      'INSERT INTO ventas (usuario_id, total, fecha) VALUES (?, ?, NOW())',
      [usuario_id, total]
    );
    const venta_id = venta.insertId;

    // Detalle + stock + historial
    for (const item of items) {
      await conn.query(
        'INSERT INTO detalle_venta (venta_id, variante_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [venta_id, item.variante_id, item.cantidad, item.precio]
      );

      await conn.query(
        'UPDATE variantes SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.variante_id]
      );

      await conn.query(
        'INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo) VALUES (?, "Egreso", ?, "Venta")',
        [item.variante_id, item.cantidad]
      );
    }

    // Finanzas: ingreso por el total (ya descontado si corresponde cash-only)
    await conn.query(
      'INSERT INTO finanzas (tipo, descripcion, monto, fecha) VALUES ("Ingreso", ?, ?, NOW())',
      [`Venta múltiple ID ${venta_id}`, total]
    );

    // Movimientos de caja:
    // - Para débito/crédito se aplicará automáticamente 7.7% fee (entra neto a caja_virtual).
    await registrarMovimientosCajaPorPagos(conn, venta_id, pagosNormalizados, usuario_id);

    await conn.commit();
    res.json({ mensaje: 'Venta registrada', venta_id });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ mensaje: 'Error al registrar venta desde carrito', error });
  } finally {
    conn.release();
  }
};

/* ===================== CONSULTAS ===================== */

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

/* ===================== UTILIDAD: FIX HISTÓRICO ===================== */
exports.fixMovimientosVenta = async (_req, res) => {
  try {
    const [r] = await db.query(`
      UPDATE movimientos_caja
      SET tipo = 'venta'
      WHERE signo = +1
        AND tipo = 'ingreso'
        AND (
             referencia_tipo = 'venta'
          OR descripcion LIKE '%Venta ID%'
          OR referencia_id IN (SELECT id FROM ventas)
        );
    `);
    res.json({ mensaje: 'Movimientos corregidos', afectados: r.affectedRows || 0 });
  } catch (error) {
    console.error('fixMovimientosVenta error:', error);
    res.status(500).json({ mensaje: 'No se pudo corregir movimientos' });
  }
};
