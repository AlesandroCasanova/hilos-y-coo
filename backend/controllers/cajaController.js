const db = require('../models/db');

// --- ABRIR CAJA (NO registrar ingreso en movimientos_caja) ---
exports.abrirCaja = async (req, res) => {
  const { tipo_caja } = req.body;
  const usuario_id = req.usuario.id;

  try {
    // Buscar último cierre
    const [ultimoCierre] = await db.query(
      `SELECT monto_final FROM caja_cierres 
       JOIN caja_aperturas ON caja_cierres.apertura_id = caja_aperturas.id
       WHERE caja_aperturas.tipo_caja = ? 
       ORDER BY caja_cierres.fecha DESC 
       LIMIT 1`,
      [tipo_caja]
    );

    const monto_inicial = ultimoCierre.length > 0 ? Number(ultimoCierre[0].monto_final) : 0;

    // Registrar apertura SOLO en caja_aperturas, NO movimientos_caja
    const [resultado] = await db.query(
      `INSERT INTO caja_aperturas (usuario_id, tipo_caja, monto_inicial) VALUES (?, ?, ?)`,
      [usuario_id, tipo_caja, monto_inicial]
    );

    const apertura_id = resultado.insertId;

    res.json({ mensaje: `Caja abierta con $${monto_inicial.toFixed(2)}`, apertura_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al abrir caja', detalle: error });
  }
};




// --- CERRAR CAJA (corrige: reserva automática real, con descuento de caja) ---
exports.cerrarCaja = async (req, res) => {
  const { apertura_id, monto_final } = req.body;
  const usuario_id = req.usuario.id;

  try {
    // Buscar datos de apertura
    const [apertura] = await db.query(
      `SELECT monto_inicial, tipo_caja FROM caja_aperturas WHERE id = ?`,
      [apertura_id]
    );
    if (!apertura.length) {
      return res.status(400).json({ error: 'Apertura de caja no encontrada' });
    }
    const tipo_caja = apertura[0].tipo_caja;

    // Calcular ingresos/egresos desde la apertura
    const [ingresos] = await db.query(
      `SELECT SUM(monto) AS total_ingresos FROM movimientos_caja 
       WHERE tipo = 'ingreso' AND caja_tipo = ? 
       AND fecha > (SELECT fecha_apertura FROM caja_aperturas WHERE id = ?)`,
      [tipo_caja, apertura_id]
    );
    const [egresos] = await db.query(
      `SELECT SUM(monto) AS total_egresos FROM movimientos_caja 
       WHERE tipo = 'egreso' AND caja_tipo = ? 
       AND fecha > (SELECT fecha_apertura FROM caja_aperturas WHERE id = ?)`,
      [tipo_caja, apertura_id]
    );

    const saldo_total =
      Number(apertura[0].monto_inicial) +
      Number(ingresos[0].total_ingresos || 0) -
      Number(egresos[0].total_egresos || 0);

    const excedente = saldo_total - Number(monto_final);

    // Registrar cierre
    await db.query(
      `INSERT INTO caja_cierres (apertura_id, usuario_id, monto_final, fecha) 
       VALUES (?, ?, ?, NOW())`,
      [apertura_id, usuario_id, monto_final]
    );

    // Si hay excedente, registrar reserva y movimiento de caja
    if (excedente > 0) {
      // Obtener nombre del usuario
      const [[usuario]] = await db.query(
        'SELECT nombre FROM usuarios WHERE id = ?',
        [usuario_id]
      );
      const nombreUsuario = usuario?.nombre || 'usuario';
      const descripcion = `Reserva por cierre de caja (${nombreUsuario})`;

      // 1. Registrar reserva en finanzas
      await db.query(
        `INSERT INTO finanzas 
         (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva, liberada)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [
          'reserva',
          'Reserva',
          'Sistema',
          'Reserva automática por cierre de caja',
          descripcion,
          excedente,
          tipo_caja,
          usuario_id,
          1, // es_reserva
          0  // liberada
        ]
      );

      // 2. Registrar movimiento de egreso en movimientos_caja
      await db.query(
        `INSERT INTO movimientos_caja 
         (fecha, tipo, monto, caja_tipo, descripcion, usuario_id)
         VALUES (NOW(), ?, ?, ?, ?, ?)`,
        [
          'egreso',
          excedente,
          tipo_caja,
          descripcion,
          usuario_id
        ]
      );
    }

    res.json({ mensaje: 'Caja cerrada correctamente y reserva registrada' });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: 'Error al cerrar caja', detalle: error });
  }
};



// --- NO PERMITIR CERRAR SESIÓN SI LA CAJA FÍSICA ESTÁ ABIERTA ---
exports.cajaFisicaAbierta = async (req, res) => {
  const usuario_id = req.usuario.id;
  try {
    const [abierta] = await db.query(
      `SELECT a.id FROM caja_aperturas a
      LEFT JOIN caja_cierres c ON a.id = c.apertura_id
      WHERE a.tipo_caja = 'fisica' AND c.id IS NULL AND a.usuario_id = ?`,
      [usuario_id]
    );
    res.json({ abierta: abierta.length > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar estado de caja física', detalle: error });
  }
};

// --- REGISTRAR MOVIMIENTO ---
exports.registrarMovimiento = async (req, res) => {
  const { tipo, descripcion, monto, metodo_pago, caja_tipo, venta_id } = req.body;
  const usuario_id = req.usuario.id;
  try {
    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, venta_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, venta_id || null]
    );
    res.json({ mensaje: 'Movimiento registrado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar movimiento', detalle: error });
  }
};

// --- OBTENER MOVIMIENTOS ---
exports.obtenerMovimientos = async (req, res) => {
  const { tipo_caja } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT m.*, u.nombre AS usuario_nombre
       FROM movimientos_caja m
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE caja_tipo = ?
       ORDER BY fecha DESC`,
      [tipo_caja]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener movimientos', detalle: error });
  }
};

// -// --- ESTADO DE CAJA UNIFICADO Y CONSISTENTE ---
exports.estadoCaja = async (req, res) => {
  const { tipo_caja } = req.params;

  try {
    if (tipo_caja === 'virtual') {
      // CAJA VIRTUAL: suma directa de movimientos
      const [resultado] = await db.query(`
  SELECT 
    IFNULL(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) -
    IFNULL(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END), 0) AS saldo
  FROM movimientos_caja
  WHERE caja_tipo = 'virtual'
`);

      const saldo_actual = Number(resultado[0].saldo || 0);

      return res.json({
        abierta: true,
        saldo: saldo_actual,
        ingresos: 0,
        egresos: 0,
        apertura_id: null,
        usuario_nombre: null
      });
    }

    // CAJA FISICA NORMAL
    const [apertura] = await db.query(`
      SELECT a.id, a.monto_inicial, a.fecha_apertura, u.nombre AS usuario_nombre
      FROM caja_aperturas a
      JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN caja_cierres c ON a.id = c.apertura_id
      WHERE a.tipo_caja = ? AND c.id IS NULL
      ORDER BY a.fecha_apertura DESC LIMIT 1
    `, [tipo_caja]);

    if (apertura.length > 0) {
      const apertura_id = apertura[0].id;
      const monto_inicial = Number(apertura[0].monto_inicial);

      const [resultado] = await db.query(`
        SELECT SUM(monto) AS saldo
        FROM movimientos_caja
        WHERE caja_tipo = ? AND fecha >= (
          SELECT fecha_apertura FROM caja_aperturas WHERE id = ?
        )
      `, [tipo_caja, apertura_id]);

      const saldo_actual = monto_inicial + Number(resultado[0].saldo || 0);

      return res.json({
        abierta: true,
        saldo: saldo_actual,
        ingresos: 0,
        egresos: 0,
        apertura_id,
        usuario_nombre: apertura[0].usuario_nombre
      });
    } else {
      // CAJA CERRADA
      const [ultimoCierre] = await db.query(`
        SELECT c.monto_final, c.fecha, u.nombre AS usuario_nombre
        FROM caja_cierres c
        JOIN caja_aperturas a ON a.id = c.apertura_id
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE a.tipo_caja = ?
        ORDER BY c.fecha DESC LIMIT 1
      `, [tipo_caja]);

      const saldo_final = ultimoCierre.length > 0 ? Number(ultimoCierre[0].monto_final) : 0;

      return res.json({
        abierta: false,
        saldo: saldo_final,
        ingresos: 0,
        egresos: 0,
        apertura_id: null,
        usuario_nombre: ultimoCierre.length > 0 ? ultimoCierre[0].usuario_nombre : null
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estado de caja', detalle: error });
  }
};


// --- FILTRAR MOVIMIENTOS ---
exports.filtrarMovimientos = async (req, res) => {
  const { desde, hasta, tipo, caja } = req.query;
  let sql = `
    SELECT m.*, u.nombre AS usuario_nombre
    FROM movimientos_caja m
    JOIN usuarios u ON m.usuario_id = u.id
    WHERE 1 = 1
  `;
  const params = [];
  if (desde) {
    sql += ' AND DATE(m.fecha) >= ?';
    params.push(desde);
  }
  if (hasta) {
    sql += ' AND DATE(m.fecha) <= ?';
    params.push(hasta);
  }
  if (tipo && tipo !== 'todos') {
    sql += ' AND m.tipo = ?';
    params.push(tipo);
  }
  if (caja && caja !== 'ambas') {
    sql += ' AND m.caja_tipo = ?';
    params.push(caja);
  }
  sql += ' ORDER BY m.fecha DESC';
  try {
    const [filtrados] = await db.query(sql, params);
    res.json(filtrados);
  } catch (error) {
    res.status(500).json({ error: 'Error al filtrar movimientos', detalle: error });
  }
};

// --- REGISTRAR ARQUEO (intermedio o cierre) ---
exports.registrarArqueo = async (req, res) => {
  const { caja_tipo, saldo_teorico, saldo_contado, tipo, observaciones } = req.body;
  const usuario_id = req.usuario.id;
  const diferencia = Number(saldo_contado) - Number(saldo_teorico);

  try {
    await db.query(
      `INSERT INTO arqueos_caja (caja_tipo, usuario_id, tipo, saldo_teorico, saldo_contado, diferencia, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [caja_tipo, usuario_id, tipo, saldo_teorico, saldo_contado, diferencia, observaciones || null]
    );
    res.json({ mensaje: 'Arqueo registrado correctamente', diferencia });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar arqueo', detalle: error });
  }
};

// --- LISTAR AUDITORÍAS / ARQUEOS ---
exports.listarArqueos = async (req, res) => {
  const { desde, hasta, usuario_id, caja_tipo, tipo } = req.query;
  let sql = `
    SELECT a.*, u.nombre AS usuario_nombre
    FROM arqueos_caja a
    JOIN usuarios u ON a.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (desde) { sql += " AND a.fecha >= ?"; params.push(desde + " 00:00:00"); }
  if (hasta) { sql += " AND a.fecha <= ?"; params.push(hasta + " 23:59:59"); }
  if (usuario_id) { sql += " AND a.usuario_id = ?"; params.push(usuario_id); }
  if (caja_tipo) { sql += " AND a.caja_tipo = ?"; params.push(caja_tipo); }
  if (tipo) { sql += " AND a.tipo = ?"; params.push(tipo); }
  sql += " ORDER BY a.fecha DESC";
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar auditoría', detalle: error });
  }
};

// --- OBTENER SALDOS Y RESERVAS UNIFICADOS DESDE CAJA ---
exports.saldosCaja = async (req, res) => {
  try {
    const [fisica] = await db.query(`
      SELECT 
        IFNULL(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) -
        IFNULL(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END), 0) AS saldo
      FROM movimientos_caja WHERE caja_tipo='fisica'
    `);

    const [virtual] = await db.query(`
      SELECT 
        IFNULL(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) -
        IFNULL(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END), 0) AS saldo
      FROM movimientos_caja WHERE caja_tipo='virtual'
    `);

    const [reservasFisica] = await db.query(`
      SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total
      FROM finanzas
      WHERE es_reserva = 1 AND liberada = 0 AND caja_tipo = 'fisica'
    `);

    const [reservasVirtual] = await db.query(`
      SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total
      FROM finanzas
      WHERE es_reserva = 1 AND liberada = 0 AND caja_tipo = 'virtual'
    `);

    res.json({
      fisica: fisica[0].saldo || 0,
      virtual: virtual[0].saldo || 0,
      reservasFisica: reservasFisica[0].total || 0,
      reservasVirtual: reservasVirtual[0].total || 0
    });
  } catch (error) {
    console.error("Error al obtener saldos desde cajaController:", error);
    res.status(500).json({ error: 'Error al obtener saldos de caja' });
  }
};


exports.estadoCajaCompleto = async (req, res) => {
  try {
    // Caja física
    const [aperturaFisica] = await db.query(`
      SELECT a.id AS apertura_id, a.fecha_apertura, a.monto_inicial, u.nombre AS usuario_nombre
      FROM caja_aperturas a
      JOIN usuarios u ON a.usuario_id = u.id
      LEFT JOIN caja_cierres c ON a.id = c.apertura_id
      WHERE a.tipo_caja = 'fisica' AND c.id IS NULL
      ORDER BY a.fecha_apertura DESC LIMIT 1
    `);

    let saldoFisica = 0;
    let aperturaIdFisica = null;
    let usuarioFisica = null;

    if (aperturaFisica.length > 0) {
      aperturaIdFisica = aperturaFisica[0].apertura_id;
      usuarioFisica = aperturaFisica[0].usuario_nombre;
      const montoInicial = Number(aperturaFisica[0].monto_inicial);

      const [resultado] = await db.query(`
        SELECT SUM(monto) AS saldo FROM movimientos_caja
        WHERE caja_tipo = 'fisica' AND fecha >= (
          SELECT fecha_apertura FROM caja_aperturas WHERE id = ?
        )
      `, [aperturaIdFisica]);

      saldoFisica = montoInicial + Number(resultado[0].saldo || 0);
    } else {
      const [ultimoCierre] = await db.query(`
        SELECT monto_final FROM caja_cierres c
        JOIN caja_aperturas a ON a.id = c.apertura_id
        WHERE a.tipo_caja = 'fisica'
        ORDER BY c.fecha DESC LIMIT 1
      `);
      saldoFisica = Number(ultimoCierre[0]?.monto_final || 0);
    }

    // Caja virtual
    const [virtual] = await db.query(`
      SELECT 
        IFNULL(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) -
        IFNULL(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END), 0) AS saldo
      FROM movimientos_caja WHERE caja_tipo='virtual'
    `);

    const saldoVirtual = Number(virtual[0].saldo || 0);

    // Reservas
    const [reservasFisica] = await db.query(`
      SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total
      FROM finanzas WHERE es_reserva=1 AND liberada=0 AND caja_tipo='fisica'
    `);
    const [reservasVirtual] = await db.query(`
      SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total
      FROM finanzas WHERE es_reserva=1 AND liberada=0 AND caja_tipo='virtual'
    `);

    const reservasF = Number(reservasFisica[0].total || 0);
    const reservasV = Number(reservasVirtual[0].total || 0);

    const balanceNumerico = saldoFisica + saldoVirtual + reservasF + reservasV;

    res.json({
      saldoFisica,
      saldoVirtual,
      reservasFisica: reservasF,
      reservasVirtual: reservasV,
      aperturaIdFisica,
      usuarioFisica,
      balanceTotal: balanceNumerico
    });

  } catch (error) {
    console.error('Error en estadoCajaCompleto:', error);
    res.status(500).json({ error: 'Error interno al calcular el estado de la caja' });
  }
};