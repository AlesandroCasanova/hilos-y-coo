const db = require('../models/db');
const path = require('path');
const fs = require('fs');

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

// --- Registrar pago simple ---
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

    await db.query(
      'UPDATE pedidos SET estado = ? WHERE id = ?',
      [nuevoEstado, pedido_id]
    );

    res.json({ mensaje: 'Pago registrado' });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ mensaje: 'Error al registrar pago' });
  }
};

// --- Registrar pago detallado (con múltiples fuentes) ---
exports.registrarPagoDetallado = async (req, res) => {
  const { pedido_id, monto_total, detalles } = req.body;
  const usuario_id = req.usuario.id;
  const fecha = new Date();

  try {
    await db.query(
      'INSERT INTO pagos_pedidos (pedido_id, monto, fecha) VALUES (?, ?, ?)',
      [pedido_id, monto_total, fecha]
    );

    const [[{ total_pagado }]] = await db.query(
      'SELECT SUM(monto) AS total_pagado FROM pagos_pedidos WHERE pedido_id = ?',
      [pedido_id]
    );
    const [[{ monto_total: totalPedido }]] = await db.query(
      'SELECT monto_total FROM pedidos WHERE id = ?',
      [pedido_id]
    );

    let nuevoEstado = 'Pendiente';
    if (total_pagado >= totalPedido) nuevoEstado = 'Pago completo';
    else if (total_pagado >= totalPedido / 2) nuevoEstado = '1ra cuota pagada';

    await db.query(
      'UPDATE pedidos SET estado = ? WHERE id = ?',
      [nuevoEstado, pedido_id]
    );

    for (const fuente in detalles) {
      const monto = detalles[fuente];
      const metodo = fuente.includes('fisica') ? 'efectivo' : 'transferencia';
      const caja = fuente.includes('fisica') ? 'fisica' : 'virtual';

      const [[{ saldoDisponible }]] = await db.query(`
        SELECT 
          SUM(CASE WHEN tipo = 'ingreso' THEN monto ELSE 0 END) -
          SUM(CASE WHEN tipo = 'egreso' THEN monto ELSE 0 END) AS saldoDisponible
        FROM movimientos_caja
        WHERE caja_tipo = ?
      `, [caja]);

      if (fuente.startsWith('reserva')) {
        const [[{ totalReservas }]] = await db.query(`
          SELECT SUM(monto - IFNULL(monto_liberado, 0)) AS totalReservas
          FROM finanzas
          WHERE es_reserva = 1 AND liberada = 0 AND caja_tipo = ?
        `, [caja]);

        if ((totalReservas || 0) < monto) {
          return res.status(400).json({ mensaje: `Saldo insuficiente en ${fuente}` });
        }
      } else {
        if ((saldoDisponible || 0) < monto) {
          return res.status(400).json({ mensaje: `Saldo insuficiente en ${fuente}` });
        }
      }

      await db.query(`
        INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva)
        VALUES ('Gasto', 'Pago pedido', 'Proveedor', 'Pago parcial', ?, ?, ?, ?, ?, 0)
      `, [`Pago de pedido #${pedido_id} desde ${fuente}`, monto, fecha, caja, usuario_id]);

      await db.query(`
        INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, fecha)
        VALUES ('egreso', ?, ?, ?, ?, ?, ?)
      `, [`Pago de pedido #${pedido_id} desde ${fuente}`, monto, metodo, caja, usuario_id, fecha]);

      if (fuente.startsWith('reserva')) {
        const [reservas] = await db.query(`
          SELECT id, monto, IFNULL(monto_liberado, 0) AS monto_liberado
          FROM finanzas
          WHERE es_reserva = 1 AND liberada = 0 AND caja_tipo = ?
          ORDER BY fecha ASC
        `, [caja]);

        let restante = monto;
        for (const r of reservas) {
          const disponible = r.monto - r.monto_liberado;
          if (disponible <= 0) continue;

          const aplicar = Math.min(disponible, restante);
          await db.query(
            'UPDATE finanzas SET monto_liberado = monto_liberado + ? WHERE id = ?',
            [aplicar, r.id]
          );
          restante -= aplicar;
          if (restante <= 0) break;
        }
      }
    }

    res.json({ mensaje: 'Pago detallado registrado correctamente' });
  } catch (error) {
    console.error('Error en pago detallado:', error);
    res.status(500).json({ mensaje: 'Error al registrar pago' });
  }
};

// --- Obtener historial de pagos de un pedido ---
exports.obtenerHistorialPagos = async (req, res) => {
  const { id } = req.params;
  try {
    const [pagos] = await db.query(`
      SELECT id, monto, DATE_FORMAT(fecha, '%d/%m/%Y %H:%i') AS fecha
      FROM pagos_pedidos
      WHERE pedido_id = ?
      ORDER BY fecha ASC
    `, [id]);

    res.json(pagos);
  } catch (error) {
    console.error('Error al obtener historial de pagos:', error);
    res.status(500).json({ mensaje: 'Error al obtener historial de pagos' });
  }
};

// --- Obtener historial de pagos de un pedido ---
exports.obtenerHistorialPagos = async (req, res) => {
  const pedido_id = req.params.id;

  try {
    const [historial] = await db.query(`
      SELECT fecha, monto, 'Pago de pedido' AS descripcion
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
