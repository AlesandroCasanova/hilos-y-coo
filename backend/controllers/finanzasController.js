const db = require('../models/db');

// GET /api/finanzas/saldos
exports.obtenerSaldos = async (req, res) => {
  try {
    const [[cajas]] = await db.query('SELECT * FROM vista_saldo_cajas');
    const [[resv]]  = await db.query('SELECT * FROM vista_reservas_disponibles');

    const fisica = Number(cajas?.caja_fisica || 0);
    const virtual = Number(cajas?.caja_virtual || 0);
    const reservasFisica = Number(resv?.reservas_fisica || 0);
    const reservasVirtual = Number(resv?.reservas_virtual || 0);

    res.json({
      caja: { fisica, virtual },
      reservas: { fisica: reservasFisica, virtual: reservasVirtual },
      total: fisica + virtual + reservasFisica + reservasVirtual
    });
  } catch (err) {
    console.error('obtenerSaldos error:', err);
    res.status(500).json({ mensaje: 'Error al obtener saldos' });
  }
};

// GET /api/finanzas/movimientos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&cuenta=(fisica|virtual|todas)&tipo=(ingreso|egreso|transferencia|reserva|ajuste|todos)
exports.movimientosHistoricos = async (req, res) => {
  try {
    const { desde, hasta, cuenta = 'todas', tipo = 'todos' } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Parámetros desde y hasta son requeridos' });
    }

    let where = 'DATE(fecha) BETWEEN ? AND ?';
    const params = [desde, hasta];

    if (cuenta === 'fisica') {
      where += " AND cuenta='caja_fisica'";
    } else if (cuenta === 'virtual') {
      where += " AND cuenta='caja_virtual'";
    }

    if (['ingreso','egreso','transferencia','reserva','ajuste'].includes(tipo)) {
      where += ' AND tipo = ?';
      params.push(tipo);
    }

    const [rows] = await db.query(
      `SELECT id, fecha, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion
       FROM movimientos_caja
       WHERE ${where}
       ORDER BY fecha DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('movimientosHistoricos error:', err);
    res.status(500).json({ mensaje: 'Error al obtener movimientos' });
  }
};

// GET /api/finanzas/reservas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=(fisica|virtual|todas)&movimiento=(alta|liberacion|todos)
exports.historialReservas = async (req, res) => {
  try {
    const { desde, hasta, tipo = 'todas', movimiento = 'todos' } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Parámetros desde y hasta son requeridos' });
    }

    let where = 'DATE(fecha) BETWEEN ? AND ?';
    const params = [desde, hasta];

    if (['fisica','virtual'].includes(tipo)) {
      where += ' AND tipo = ?';
      params.push(tipo);
    }
    if (['alta','liberacion'].includes(movimiento)) {
      where += ' AND movimiento = ?';
      params.push(movimiento);
    }

    const [rows] = await db.query(
      `SELECT id, fecha, tipo, movimiento, monto, referencia_tipo, referencia_id, descripcion
       FROM movimientos_reserva
       WHERE ${where}
       ORDER BY fecha DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('historialReservas error:', err);
    res.status(500).json({ mensaje: 'Error al obtener reservas' });
  }
};

// POST /api/finanzas/reservas  { tipo:'fisica'|'virtual', monto, descripcion }
exports.crearReserva = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { tipo, monto, descripcion } = req.body;

  if (!['fisica','virtual'].includes(tipo)) {
    return res.status(400).json({ mensaje: 'tipo inválido (fisica|virtual)' });
  }
  if (monto == null || isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(400).json({ mensaje: 'Monto inválido' });
  }

  const cuenta = tipo === 'fisica' ? 'caja_fisica' : 'caja_virtual';

  try {
    await db.query(
      `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'reserva', -1, ?, 'reserva', ?)`,
      [usuario_id, cuenta, monto, descripcion || 'Reserva manual']
    );

    await db.query(
      `INSERT INTO movimientos_reserva (usuario_id, tipo, movimiento, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'alta', ?, 'reserva', ?)`,
      [usuario_id, tipo, monto, descripcion || 'Reserva manual']
    );

    res.json({ mensaje: 'Reserva creada' });
  } catch (err) {
    console.error('crearReserva error:', err);
    res.status(500).json({ mensaje: 'Error al crear reserva' });
  }
};

// POST /api/finanzas/reservas/liberar  { tipo:'fisica'|'virtual', monto, descripcion }
exports.liberarReserva = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { tipo, monto, descripcion } = req.body;

  if (!['fisica','virtual'].includes(tipo)) {
    return res.status(400).json({ mensaje: 'tipo inválido (fisica|virtual)' });
  }
  if (monto == null || isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(400).json({ mensaje: 'Monto inválido' });
  }

  const cuenta = tipo === 'fisica' ? 'caja_fisica' : 'caja_virtual';

  try {
    const [[disp]] = await db.query('SELECT * FROM vista_reservas_disponibles');
    const disponible = Number(tipo === 'fisica' ? disp.reservas_fisica : disp.reservas_virtual);

    if (Number(monto) > disponible) {
      return res.status(400).json({ mensaje: `No hay reservas ${tipo} suficientes. Disponible: ${disponible}` });
    }

    await db.query(
      `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'reserva', +1, ?, 'reserva', ?)`,
      [usuario_id, cuenta, monto, descripcion || 'Liberación de reserva']
    );

    await db.query(
      `INSERT INTO movimientos_reserva (usuario_id, tipo, movimiento, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'liberacion', ?, 'reserva', ?)`,
      [usuario_id, tipo, monto, descripcion || 'Liberación de reserva']
    );

    res.json({ mensaje: 'Reserva liberada' });
  } catch (err) {
    console.error('liberarReserva error:', err);
    res.status(500).json({ mensaje: 'Error al liberar reserva' });
  }
};
