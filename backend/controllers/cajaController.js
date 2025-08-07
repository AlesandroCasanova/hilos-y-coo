const db = require('../models/db');

// GET /api/caja/estado
exports.estadoCaja = async (req, res) => {
  try {
    const [[abierta]] = await db.query(
      "SELECT * FROM sesiones_caja WHERE estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1"
    );
    const [[saldos]] = await db.query('SELECT * FROM vista_saldo_cajas');

    res.json({
      abierta: !!abierta,
      apertura: abierta || null,
      saldo_fisica: Number(saldos?.caja_fisica || 0),
      saldo_virtual: Number(saldos?.caja_virtual || 0)
    });
  } catch (err) {
    console.error('estadoCaja error:', err);
    res.status(500).json({ mensaje: 'Error al obtener estado de caja' });
  }
};

// GET /api/caja/movimientos?fecha=YYYY-MM-DD&cuenta=(fisica|virtual|todas)
exports.movimientosDelDia = async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().slice(0,10);
    const cuenta = req.query.cuenta || 'todas';

    let where = 'DATE(fecha) = ?';
    const params = [fecha];

    if (cuenta === 'fisica') {
      where += " AND cuenta='caja_fisica'";
    } else if (cuenta === 'virtual') {
      where += " AND cuenta='caja_virtual'";
    }

    const [rows] = await db.query(
      `SELECT id, fecha, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion
       FROM movimientos_caja
       WHERE ${where}
       ORDER BY fecha DESC`, params
    );

    res.json(rows);
  } catch (err) {
    console.error('movimientosDelDia error:', err);
    res.status(500).json({ mensaje: 'Error al obtener movimientos del día' });
  }
};

// POST /api/caja/abrir
exports.abrirCaja = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  try {
    const [abierta] = await db.query(
      "SELECT id FROM sesiones_caja WHERE estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1"
    );
    if (abierta.length) {
      return res.status(400).json({ mensaje: 'Ya hay una caja física abierta.' });
    }

    const [ultCierre] = await db.query(
      "SELECT monto_final FROM sesiones_caja WHERE estado='cerrada' ORDER BY fecha_cierre DESC LIMIT 1"
    );
    const monto_inicial = ultCierre.length ? Number(ultCierre[0].monto_final || 0) : 0;

    await db.query(
      `INSERT INTO sesiones_caja (usuario_id_apertura, monto_inicial, estado)
       VALUES (?, ?, 'abierta')`,
      [usuario_id, monto_inicial]
    );

    res.json({ mensaje: 'Caja física abierta', monto_inicial });
  } catch (err) {
    console.error('abrirCaja error:', err);
    res.status(500).json({ mensaje: 'Error al abrir caja' });
  }
};

// POST /api/caja/cerrar  { monto_final }
exports.cerrarCaja = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { monto_final } = req.body;

  if (monto_final == null || isNaN(Number(monto_final)) || Number(monto_final) < 0) {
    return res.status(400).json({ mensaje: 'monto_final inválido' });
  }

  try {
    const [[apertura]] = await db.query(
      "SELECT * FROM sesiones_caja WHERE estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1"
    );
    if (!apertura) {
      return res.status(400).json({ mensaje: 'No hay caja física abierta.' });
    }

    const monto_inicial = Number(apertura.monto_inicial || 0);

    const [[mov]] = await db.query(
      `SELECT IFNULL(SUM(signo * monto), 0) AS delta
       FROM movimientos_caja
       WHERE cuenta='caja_fisica' AND fecha >= ?`,
      [apertura.fecha_apertura]
    );

    const delta = Number(mov.delta || 0);
    const saldoReal = monto_inicial + delta;
    const declarado = Number(monto_final);

    let reservaAuto = 0;
    let ajuste = 0;

    if (saldoReal > declarado) {
      reservaAuto = saldoReal - declarado;

      await db.query(
        `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
         VALUES (?, 'caja_fisica', 'reserva', -1, ?, 'cierre', 'Reserva automática por cierre')`,
        [usuario_id, reservaAuto]
      );

      await db.query(
        `INSERT INTO movimientos_reserva (usuario_id, tipo, movimiento, monto, referencia_tipo, descripcion)
         VALUES (?, 'fisica', 'alta', ?, 'cierre', 'Reserva automática por cierre')`,
        [usuario_id, reservaAuto]
      );
    } else if (saldoReal < declarado) {
      // Si no querés permitir ajuste positivo, reemplazar por return 400.
      ajuste = declarado - saldoReal;
      await db.query(
        `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
         VALUES (?, 'caja_fisica', 'ajuste', +1, ?, 'cierre', 'Ajuste positivo por cierre')`,
        [usuario_id, ajuste]
      );
    }

    await db.query(
      `UPDATE sesiones_caja
       SET fecha_cierre = NOW(), usuario_id_cierre = ?, monto_final = ?, estado='cerrada'
       WHERE id = ?`,
      [usuario_id, declarado, apertura.id]
    );

    res.json({
      mensaje: 'Caja física cerrada',
      saldoReal,
      declarado,
      reservaAuto,
      ajuste
    });
  } catch (err) {
    console.error('cerrarCaja error:', err);
    res.status(500).json({ mensaje: 'Error al cerrar caja' });
  }
};

// POST /api/caja/transferir  { desde:'fisica'|'virtual', hacia:'fisica'|'virtual', monto, descripcion }
exports.transferirEntreCajas = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { desde, hacia, monto, descripcion } = req.body;

  if (!['fisica','virtual'].includes(desde) || !['fisica','virtual'].includes(hacia) || desde === hacia) {
    return res.status(400).json({ mensaje: 'Parámetros de transferencia inválidos' });
  }
  if (monto == null || isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(400).json({ mensaje: 'Monto inválido' });
  }

  const cuentaDesde = desde === 'fisica' ? 'caja_fisica' : 'caja_virtual';
  const cuentaHacia = hacia === 'fisica' ? 'caja_fisica' : 'caja_virtual';

  try {
    await db.query(
      `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'transferencia', -1, ?, 'transferencia', ?)`,
      [usuario_id, cuentaDesde, monto, descripcion || `Transferencia a ${hacia}`]
    );

    await db.query(
      `INSERT INTO movimientos_caja (usuario_id, cuenta, tipo, signo, monto, referencia_tipo, descripcion)
       VALUES (?, ?, 'transferencia', +1, ?, 'transferencia', ?)`,
      [usuario_id, cuentaHacia, monto, descripcion || `Transferencia desde ${desde}`]
    );

    res.json({ mensaje: 'Transferencia realizada' });
  } catch (err) {
    console.error('transferirEntreCajas error:', err);
    res.status(500).json({ mensaje: 'Error al transferir' });
  }
};
