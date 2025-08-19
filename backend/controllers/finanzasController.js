const db = require('../models/db');

/* =========================================================
   SALDOS (sin vistas) — usado por tu Dashboard/Finanzas
   Respuesta:
   {
     caja: { fisica, virtual },
     reservas: { fisica, virtual },
     total
   }
   ========================================================= */
exports.obtenerSaldos = async (req, res) => {
  try {
    // Saldos de caja = sum(signo * monto) por cuenta
    const [mc] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN cuenta='caja_fisica'  THEN signo * monto END),0) AS saldo_fisica,
        COALESCE(SUM(CASE WHEN cuenta='caja_virtual' THEN signo * monto END),0) AS saldo_virtual
      FROM movimientos_caja
    `);

    const fisica = Number(mc?.[0]?.saldo_fisica || 0);
    const virtual = Number(mc?.[0]?.saldo_virtual || 0);

    // Reservas disponibles por tipo = ALTAS - LIBERACIONES
    const [mr] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo='fisica'  AND movimiento='alta'       THEN monto END),0)
      - COALESCE(SUM(CASE WHEN tipo='fisica'  AND movimiento='liberacion' THEN monto END),0) AS reservas_fisica,
        COALESCE(SUM(CASE WHEN tipo='virtual' AND movimiento='alta'       THEN monto END),0)
      - COALESCE(SUM(CASE WHEN tipo='virtual' AND movimiento='liberacion' THEN monto END),0) AS reservas_virtual
      FROM movimientos_reserva
    `);

    const reservasFisica  = Number(mr?.[0]?.reservas_fisica  || 0);
    const reservasVirtual = Number(mr?.[0]?.reservas_virtual || 0);

    return res.json({
      caja: { fisica, virtual },
      reservas: { fisica: reservasFisica, virtual: reservasVirtual },
      total: fisica + virtual + reservasFisica + reservasVirtual
    });
  } catch (err) {
    console.error('obtenerSaldos error:', err);
    return res.status(500).json({ mensaje: 'Error al obtener saldos' });
  }
};

/* =========================================================
   MOVIMIENTOS DE CAJA (histórico filtrable)
   ========================================================= */
exports.movimientosHistoricos = async (req, res) => {
  try {
    const { desde, hasta, cuenta = 'todas', tipo = 'todos' } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Parámetros desde y hasta son requeridos' });
    }

    let where = 'DATE(fecha) BETWEEN ? AND ?';
    const params = [desde, hasta];

    if (cuenta === 'fisica')      where += " AND cuenta='caja_fisica'";
    else if (cuenta === 'virtual') where += " AND cuenta='caja_virtual'";

    if (['ingreso','egreso','transferencia','reserva','ajuste','venta'].includes(tipo)) {
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

/* =========================================================
   HISTORIAL DE RESERVAS
   ========================================================= */
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

/* =========================================================
   CREAR / LIBERAR RESERVAS (impacta caja + reservas)
   ========================================================= */
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

exports.liberarReserva = async (req, res) => {
  const usuario_id = req.usuario?.id || null;
  const { tipo, monto, descripcion } = req.body;

  if (!['fisica','virtual'].includes(tipo)) {
    return res.status(400).json({ mensaje: 'tipo inválido (fisica|virtual)' });
  }
  if (monto == null || isNaN(Number(monto)) || Number(monto) <= 0) {
    return res.status(400).json({ mensaje: 'Monto inválido' });
  }

  try {
    // Disponible actual por tipo (sin vistas)
    const [mr] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN tipo=? AND movimiento='alta'       THEN monto END),0)
      - COALESCE(SUM(CASE WHEN tipo=? AND movimiento='liberacion' THEN monto END),0) AS disponible
      FROM movimientos_reserva
    `, [tipo, tipo]);

    const disponible = Number(mr?.[0]?.disponible || 0);
    if (Number(monto) > disponible) {
      return res.status(400).json({ mensaje: `No hay reservas ${tipo} suficientes. Disponible: ${disponible}` });
    }

    const cuenta = (tipo === 'fisica') ? 'caja_fisica' : 'caja_virtual';

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

/* =========================================================
   RESUMEN P&L DEL PERÍODO  (NUEVO)
   GET /api/finanzas/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   Devuelve:
   {
     ventas, otrosIngresos, cogs, gastosOperativos,
     margenBruto, margenBrutoPorc,
     gananciaNeta, gananciaNetaPorc
   }
   NOTA: “Otros ingresos” excluye ventas/transferencias/reservas/aperturas/cierres/ajustes
   ========================================================= */
exports.resumen = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Parámetros desde y hasta son requeridos' });
    }

    // 1) Ventas = ingresos de caja por ventas (no confundir con todos los ingresos)
    const [vRows] = await db.query(`
      SELECT COALESCE(SUM(monto),0) AS ventas
      FROM movimientos_caja
      WHERE signo = +1
        AND (referencia_tipo = 'venta' OR tipo = 'venta' OR descripcion LIKE '%venta%')
        AND DATE(fecha) BETWEEN ? AND ?;
    `, [desde, hasta]);
    const ventas = Number(vRows[0].ventas || 0);

    // 2) Otros ingresos = ingresos “operativos” que NO son ventas ni movimientos internos
    const [oRows] = await db.query(`
      SELECT COALESCE(SUM(monto),0) AS otros
      FROM movimientos_caja
      WHERE signo = +1
        AND (tipo IS NULL OR tipo IN ('ingreso'))
        AND (referencia_tipo IS NULL OR referencia_tipo NOT IN ('venta','transferencia','reserva','apertura','cierre'))
        AND (tipo NOT IN ('venta','transferencia','reserva','ajuste'))
        AND (descripcion IS NULL OR descripcion NOT LIKE '%venta%')
        AND DATE(fecha) BETWEEN ? AND ?;
    `, [desde, hasta]);
    const otrosIngresos = Number(oRows[0].otros || 0);

    // 3) COGS = costo de lo vendido (usa ventas + detalle + precio_proveedor)
    //    Si tu detalle usa variante_id en vez de producto_id, avisame y lo adapto.
    const [cogsRows] = await db.query(`
      SELECT COALESCE(SUM(d.cantidad * p.precio_proveedor),0) AS cogs
      FROM ventas v
      JOIN ventas_detalle d ON d.venta_id = v.id
      JOIN productos p      ON p.id = d.producto_id
      WHERE DATE(v.fecha) BETWEEN ? AND ?;
    `, [desde, hasta]);
    const cogs = Number(cogsRows[0].cogs || 0);

    // 4) Gastos operativos (no COGS). Si registrás pagos en "finanzas".
    const [gRows] = await db.query(`
      SELECT COALESCE(SUM(monto),0) AS gastos
      FROM finanzas
      WHERE tipo IN ('egreso','gasto','pago')
        AND (categoria IS NULL OR categoria NOT IN ('Pago proveedor'))
        AND DATE(fecha) BETWEEN ? AND ?;
    `, [desde, hasta]);
    const gastosOperativos = Number(gRows[0].gastos || 0);

    // 5) Cálculos
    const margenBruto = ventas - cogs;
    const baseVentas = ventas > 0 ? ventas : 1; // evita división por cero para el %
    const margenBrutoPorc = (margenBruto / baseVentas) * 100;

    const gananciaNeta = ventas + otrosIngresos - cogs - gastosOperativos;
    const baseNeta = (ventas + otrosIngresos) > 0 ? (ventas + otrosIngresos) : 1;
    const gananciaNetaPorc = (gananciaNeta / baseNeta) * 100;

    return res.json({
      ventas,
      otrosIngresos,
      cogs,
      gastosOperativos,
      margenBruto,
      margenBrutoPorc,
      gananciaNeta,
      gananciaNetaPorc
    });
  } catch (err) {
    console.error('resumen P&L error:', err);
    res.status(500).json({ mensaje: 'Error al obtener resumen P&L' });
  }
};
