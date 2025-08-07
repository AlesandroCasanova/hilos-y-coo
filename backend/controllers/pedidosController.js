const db = require('../models/db');
const path = require('path');
const fs = require('fs');

/* ========================= Helpers ========================= */

async function obtenerSaldoCaja(conn, cuenta) {
  const [[row]] = await conn.query(
    `SELECT COALESCE(SUM(signo * monto), 0) AS saldo
     FROM movimientos_caja
     WHERE cuenta = ?`,
    [cuenta]
  );
  return Number(row?.saldo || 0);
}

async function obtenerReservasDisponibles(conn, tipo) {
  const [[row]] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE WHEN movimiento='alta'       THEN monto ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN movimiento='liberacion' THEN monto ELSE 0 END), 0) AS disponible
     FROM movimientos_reserva
     WHERE tipo = ?`,
    [tipo]
  );
  return Number(row?.disponible || 0);
}

/* ========================= Pedidos ========================= */

// --- Crear pedido con archivo adjunto ---
exports.crearPedido = async (req, res) => {
  try {
    const { proveedor_id, monto_total, fecha_pedido, observaciones } = req.body;
    const archivo = req.file;
    const usuario_id = req.usuario.id;

    if (!fecha_pedido || isNaN(new Date(fecha_pedido))) {
      return res.status(400).json({ mensaje: 'Fecha inválida' });
    }

    const fechaFormateada = new Date(fecha_pedido).toISOString().slice(0, 10);
    const archivo_comprobante = archivo ? `/uploads/${archivo.filename}` : null;

    await db.query(
      `INSERT INTO pedidos (proveedor_id, monto_total, fecha, observaciones, archivo_comprobante, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [proveedor_id, monto_total, fechaFormateada, observaciones, archivo_comprobante, usuario_id]
    );

    res.json({ mensaje: 'Pedido creado exitosamente' });
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ mensaje: 'Error al crear pedido', error });
  }
};

// --- Obtener pedidos ---
exports.obtenerPedidos = async (req, res) => {
  try {
    const [pedidos] = await db.query(`
      SELECT p.*, pr.nombre AS proveedor_nombre,
        (SELECT SUM(monto) FROM pagos_pedidos WHERE pedido_id = p.id) AS total_pagado
      FROM pedidos p
      JOIN proveedores pr ON p.proveedor_id = pr.id
      ORDER BY p.fecha DESC
    `);
    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ mensaje: 'Error al obtener pedidos' });
  }
};

// --- Registrar pago simple (legacy compatible) ---
exports.registrarPago = async (req, res) => {
  const { pedido_id, monto } = req.body;
  const fecha = new Date();

  try {
    await db.query(
      'INSERT INTO pagos_pedidos (pedido_id, monto, fecha) VALUES (?, ?, ?)',
      [pedido_id, monto, fecha]
    );

    const [[{ total_pagado }]] = await db.query(
      `SELECT SUM(monto) AS total_pagado FROM pagos_pedidos WHERE pedido_id = ?`,
      [pedido_id]
    );
    const [[{ monto_total }]] = await db.query(
      `SELECT monto_total FROM pedidos WHERE id = ?`,
      [pedido_id]
    );

    let nuevoEstado = 'Pendiente';
    if (total_pagado >= monto_total) nuevoEstado = 'Pago completo';
    else if (total_pagado >= monto_total / 2) nuevoEstado = '1ra cuota pagada';

    await db.query('UPDATE pedidos SET estado = ? WHERE id = ?', [nuevoEstado, pedido_id]);

    res.json({ mensaje: 'Pago registrado' });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ mensaje: 'Error al registrar pago' });
  }
};

// --- Registrar pago detallado (caja/reservas) ---
exports.registrarPagoDetallado = async (req, res) => {
  const { pedido_id, monto_total, detalles } = req.body;
  const usuario_id = req.usuario.id;

  if (!pedido_id || !monto_total || !detalles) {
    return res.status(400).json({ mensaje: 'Faltan datos: pedido_id, monto_total y detalles son obligatorios.' });
  }

  // Validación: suma de detalles = monto_total (tolerancia centavos)
  const sumDetalles = Object.values(detalles).reduce((acc, v) => acc + Number(v || 0), 0);
  if (Math.abs(sumDetalles - Number(monto_total)) > 0.01) {
    return res.status(400).json({ mensaje: 'La suma del desglose no coincide con el monto total.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Registrar pago administrativo
    await conn.query(
      'INSERT INTO pagos_pedidos (pedido_id, monto, fecha) VALUES (?, ?, NOW())',
      [pedido_id, Number(monto_total)]
    );

    // 2) Por cada fuente, registrar movimiento correspondiente
    // Caja física
    if (detalles.caja_fisica && Number(detalles.caja_fisica) > 0) {
      const monto = Number(detalles.caja_fisica);
      const saldo = await obtenerSaldoCaja(conn, 'caja_fisica');
      if (saldo < monto) {
        throw new Error('Saldo insuficiente en caja física');
      }

      await conn.query(
        `INSERT INTO movimientos_caja
          (fecha, usuario_id, cuenta,     tipo,    signo, monto, referencia_tipo, referencia_id, descripcion)
         VALUES
          (NOW(), ?,        'caja_fisica','egreso',  -1,   ?,     'pago_pedido',  ?,             ?)`,
        [usuario_id, monto, pedido_id, `Pago pedido #${pedido_id} desde caja física`]
      );
    }

    // Caja virtual
    if (detalles.caja_virtual && Number(detalles.caja_virtual) > 0) {
      const monto = Number(detalles.caja_virtual);
      const saldo = await obtenerSaldoCaja(conn, 'caja_virtual');
      if (saldo < monto) {
        throw new Error('Saldo insuficiente en caja virtual');
      }

      await conn.query(
        `INSERT INTO movimientos_caja
          (fecha, usuario_id, cuenta,     tipo,    signo, monto, referencia_tipo, referencia_id, descripcion)
         VALUES
          (NOW(), ?,        'caja_virtual','egreso',  -1,   ?,     'pago_pedido',  ?,             ?)`,
        [usuario_id, monto, pedido_id, `Pago pedido #${pedido_id} desde caja virtual`]
      );
    }

    // Reserva física (liberación)
    if (detalles.reserva_fisica && Number(detalles.reserva_fisica) > 0) {
      const monto = Number(detalles.reserva_fisica);
      const disponible = await obtenerReservasDisponibles(conn, 'fisica');
      if (disponible < monto) {
        throw new Error('Reserva física insuficiente');
      }

      await conn.query(
        `INSERT INTO movimientos_reserva
          (fecha, usuario_id, tipo,    movimiento,   monto, referencia_tipo, referencia_id, descripcion)
         VALUES
          (NOW(), ?,        'fisica', 'liberacion',  ?,     'pago_pedido',   ?,             ?)`,
        [usuario_id, monto, pedido_id, `Pago pedido #${pedido_id} (liberación de reserva física)`]
      );
    }

    // Reserva virtual (liberación)
    if (detalles.reserva_virtual && Number(detalles.reserva_virtual) > 0) {
      const monto = Number(detalles.reserva_virtual);
      const disponible = await obtenerReservasDisponibles(conn, 'virtual');
      if (disponible < monto) {
        throw new Error('Reserva virtual insuficiente');
      }

      await conn.query(
        `INSERT INTO movimientos_reserva
          (fecha, usuario_id, tipo,     movimiento,   monto, referencia_tipo, referencia_id, descripcion)
         VALUES
          (NOW(), ?,        'virtual', 'liberacion',  ?,     'pago_pedido',   ?,             ?)`,
        [usuario_id, monto, pedido_id, `Pago pedido #${pedido_id} (liberación de reserva virtual)`]
      );
    }

    // 3) Actualizar estado del pedido
    const [[{ total_pagado }]] = await conn.query(
      `SELECT SUM(monto) AS total_pagado FROM pagos_pedidos WHERE pedido_id = ?`,
      [pedido_id]
    );
    const [[{ monto_total: totalPedido }]] = await conn.query(
      `SELECT monto_total FROM pedidos WHERE id = ?`,
      [pedido_id]
    );

    let nuevoEstado = 'Pendiente';
    if (Number(total_pagado) >= Number(totalPedido)) nuevoEstado = 'Pago completo';
    else if (Number(total_pagado) >= Number(totalPedido) / 2) nuevoEstado = '1ra cuota pagada';

    await conn.query('UPDATE pedidos SET estado = ? WHERE id = ?', [nuevoEstado, pedido_id]);

    await conn.commit();
    res.json({ mensaje: 'Pago detallado registrado correctamente' });
  } catch (error) {
    await conn.rollback();
    console.error('Error en pago detallado:', error);
    res.status(500).json({ mensaje: 'Error al registrar pago', error: error.sqlMessage || error.message });
  } finally {
    conn.release();
  }
};

// --- Obtener historial de pagos de un pedido ---
exports.obtenerHistorialPagos = async (req, res) => {
  const pedido_id = req.params.id;
  try {
    const [historial] = await db.query(`
      SELECT fecha, monto
      FROM pagos_pedidos
      WHERE pedido_id = ?
      ORDER BY fecha ASC
    `, [pedido_id]);

    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ mensaje: 'Error al obtener historial de pagos' });
  }
};
