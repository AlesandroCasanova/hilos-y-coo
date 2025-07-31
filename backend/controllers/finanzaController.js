const db = require('../db');

// Registrar egreso (manual): impacta finanzas + movimientos_caja
exports.registrarEgreso = async (req, res) => {
  const { tipo_egreso, categoria, concepto, descripcion, monto, empleado_id, proveedor_id, entidad_manual, caja_tipo } = req.body;
  const fecha = new Date();
  let entidad = '';
  let categoriaFinal = categoria || '';
  let conceptoFinal = concepto || '';

  if (tipo_egreso === 'Pago proveedor' && proveedor_id) {
    const [[prov]] = await db.query('SELECT nombre FROM proveedores WHERE id = ?', [proveedor_id]);
    entidad = prov ? prov.nombre : '';
    categoriaFinal = 'Pago proveedor';
  } else if (tipo_egreso === 'Sueldo' && empleado_id) {
    const [[emp]] = await db.query('SELECT nombre FROM usuarios WHERE id = ?', [empleado_id]);
    entidad = emp ? emp.nombre : '';
    categoriaFinal = 'Pago empleado';
  } else if (tipo_egreso === 'Impuesto') {
    entidad = 'AFIP';
    categoriaFinal = 'Impuesto';
  } else if (tipo_egreso === 'Otro') {
    entidad = entidad_manual || '';
    categoriaFinal = 'Otro gasto';
  }

  try {
    await db.query(
      'INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Gasto', categoriaFinal, entidad, conceptoFinal, descripcion, monto, fecha, caja_tipo]
    );
    if (caja_tipo === 'fisica' || caja_tipo === 'virtual') {
      await db.query(
        `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['egreso', categoriaFinal + (conceptoFinal ? ' - ' + conceptoFinal : ''), monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, req.usuario?.id || null]
      );
    }
    res.json({ mensaje: 'Egreso registrado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar egreso', error });
  }
};

// Registrar ingreso manual (impacta finanzas + movimientos_caja)
exports.registrarIngreso = async (req, res) => {
  const { categoria, entidad, concepto, descripcion, monto, caja_tipo } = req.body;
  const fecha = new Date();
  try {
    await db.query(
      'INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['Ingreso', categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo]
    );
    if (caja_tipo === 'fisica' || caja_tipo === 'virtual') {
      await db.query(
        `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['ingreso', categoria + (concepto ? ' - ' + concepto : ''), monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, req.usuario?.id || null]
      );
    }
    res.json({ mensaje: 'Ingreso registrado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar ingreso', error });
  }
};

// Registrar reserva de dinero: descuenta de la caja y suma a reservas (corregida)
exports.registrarReserva = async (req, res) => {
  try {
    const { monto, caja, descripcion } = req.body;
    const usuario_id = req.usuario.id;

    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    const fecha = new Date();
    const metodo = caja === 'fisica' ? 'efectivo' : 'transferencia';

    // 1. Registrar en finanzas como reserva (es_reserva = 1)
    await db.query(`
      INSERT INTO finanzas (fecha, tipo, categoria, concepto, descripcion, monto, caja_tipo, es_reserva, liberada, usuario_id)
      VALUES (?, 'egreso', 'Reserva', 'Reserva manual', ?, ?, ?, 1, 0, ?)
    `, [fecha, descripcion, monto, caja, usuario_id]);

    // 2. Registrar en movimientos_caja como egreso
    await db.query(`
      INSERT INTO movimientos_caja (fecha, tipo, monto, metodo_pago, caja_tipo, descripcion, usuario_id)
      VALUES (?, 'egreso', ?, ?, ?, ?, ?)
    `, [fecha, monto, metodo, caja, descripcion, usuario_id]);

    res.status(200).json({ mensaje: 'Reserva registrada correctamente' });

  } catch (err) {
    console.error('Error al registrar reserva:', err);
    res.status(500).json({ error: 'Error interno al registrar reserva' });
  }
};



// (El resto del archivo permanece igual como ya lo tenés implementado)




// Listar movimientos
exports.listarFinanzas = async (req, res) => {
  try {
    const [registros] = await db.query(
      'SELECT id, fecha, tipo, categoria, entidad, concepto, descripcion, monto, caja_tipo FROM finanzas ORDER BY fecha DESC, id DESC'
    );
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener registros financieros', error });
  }
};

// Eliminar un movimiento
exports.eliminarMovimiento = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM finanzas WHERE id = ?', [id]);
    res.json({ mensaje: 'Movimiento eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar movimiento', error });
  }
};

// --- Obtener Saldos de Cajas y Reservas (para finanzas.js) ---
exports.obtenerSaldos = async (req, res) => {
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

    const [reservasFisica] = await db.query(
      'SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total FROM finanzas WHERE es_reserva=1 AND liberada=0 AND caja_tipo="fisica"'
    );
    const [reservasVirtual] = await db.query(
      'SELECT IFNULL(SUM(monto - IFNULL(monto_liberado,0)),0) AS total FROM finanzas WHERE es_reserva=1 AND liberada=0 AND caja_tipo="virtual"'
    );

    res.json({
      fisica: fisica[0].saldo || 0,
      virtual: virtual[0].saldo || 0,
      reservasFisica: reservasFisica[0].total || 0,
      reservasVirtual: reservasVirtual[0].total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener saldos' });
  }
};

// --- Total reservas, si lo necesitas separado ---
// controllers/finanzaController.js

exports.obtenerTotalReservas = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        caja_tipo, 
        SUM(monto - IFNULL(monto_liberado, 0)) AS total 
      FROM finanzas 
      WHERE es_reserva = 1 AND liberada = 0 
      GROUP BY caja_tipo
    `);

    let reservasFisica = 0;
    let reservasVirtual = 0;

    rows.forEach(r => {
      if (r.caja_tipo === 'fisica') reservasFisica = r.total;
      if (r.caja_tipo === 'virtual') reservasVirtual = r.total;
    });

    res.json({
      reservasFisica: reservasFisica || 0,
      reservasVirtual: reservasVirtual || 0
    });
  } catch (error) {
    console.error('Error al obtener reservas totales:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
};


// Select empleados
exports.listaEmpleados = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nombre FROM usuarios WHERE rol = 'Empleado'");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Select proveedores
exports.listaProveedores = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, nombre FROM proveedores");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Listar reservas activas ---
exports.obtenerReservasActivas = async (req, res) => {
  try {
    const [reservas] = await db.query(
      `SELECT id, caja_tipo, monto, IFNULL(monto_liberado,0) AS monto_liberado, descripcion 
      FROM finanzas WHERE es_reserva=1 AND liberada=0`
    );
    res.json(reservas);
  } catch (err) {
    res.status(500).json({ mensaje: "Error al obtener reservas activas" });
  }
};

// --- Liberar una reserva ---
exports.liberarReserva = async (req, res) => {
  const { id } = req.params;
  const usuario_id = req.usuario?.id || null;

  try {
    const [[reserva]] = await db.query(
      "SELECT * FROM finanzas WHERE id = ? AND es_reserva=1 AND liberada=0",
      [id]
    );
    if (!reserva) {
      return res.status(404).json({ mensaje: 'Reserva no encontrada o ya liberada' });
    }

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'ingreso',
        `Liberación reserva #${id}`,
        reserva.monto,
        reserva.caja_tipo === 'fisica' ? 'efectivo' : 'transferencia',
        reserva.caja_tipo,
        usuario_id
      ]
    );

    await db.query(
      "UPDATE finanzas SET liberada = 1 WHERE id = ?",
      [id]
    );

    res.json({ mensaje: 'Reserva liberada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al liberar reserva', error });
  }
};

// --- Liberar monto parcial desde una reserva ---
exports.liberarReservaParcial = async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;
  const usuario_id = req.usuario?.id || null;

  try {
    const [[reserva]] = await db.query(
      "SELECT * FROM finanzas WHERE id = ? AND es_reserva = 1",
      [id]
    );
    if (!reserva) {
      return res.status(404).json({ mensaje: 'Reserva no encontrada' });
    }

    const disponible = reserva.monto - reserva.monto_liberado;
    if (monto <= 0 || monto > disponible) {
      return res.status(400).json({ mensaje: `Monto inválido. Disponible: $${disponible}` });
    }

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'ingreso',
        `Liberación parcial reserva #${id}`,
        monto,
        reserva.caja_tipo === 'fisica' ? 'efectivo' : 'transferencia',
        reserva.caja_tipo,
        usuario_id
      ]
    );

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [
        'liberación',
        'Liberación de reserva',
        'Sistema',
        `Desde reserva #${id}`,
        `Liberación parcial de $${monto}`,
        monto,
        reserva.caja_tipo,
        usuario_id
      ]
    );

    await db.query(
      `UPDATE finanzas SET monto_liberado = monto_liberado + ? WHERE id = ?`,
      [monto, id]
    );

    res.json({ mensaje: 'Monto liberado correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al liberar monto', error });
  }
};

exports.extraerDesdeReserva = async (req, res) => {
  const { tipo_caja, monto } = req.body;
  const usuario_id = req.usuario?.id || null;

  try {
    if (!['fisica', 'virtual'].includes(tipo_caja)) {
      return res.status(400).json({ mensaje: 'Tipo de caja inválido' });
    }

    const [[{ totalDisponible }]] = await db.query(
      `SELECT SUM(monto - IFNULL(monto_liberado,0)) AS totalDisponible 
       FROM finanzas WHERE es_reserva=1 AND liberada=0 AND caja_tipo = ?`,
      [tipo_caja]
    );

    if (!totalDisponible || totalDisponible < monto) {
      return res.status(400).json({ mensaje: `No hay suficiente monto en reservas ${tipo_caja}` });
    }

    let montoRestante = monto;

    const [reservas] = await db.query(
      `SELECT id, monto, IFNULL(monto_liberado,0) AS monto_liberado FROM finanzas 
       WHERE es_reserva=1 AND liberada=0 AND caja_tipo = ? 
       ORDER BY fecha ASC`, [tipo_caja]
    );

    for (const r of reservas) {
      const disponible = r.monto - r.monto_liberado;
      if (disponible <= 0) continue;
      const aExtraer = Math.min(disponible, montoRestante);

      await db.query(
        `UPDATE finanzas SET monto_liberado = monto_liberado + ? WHERE id = ?`,
        [aExtraer, r.id]
      );

      montoRestante -= aExtraer;
      if (montoRestante <= 0) break;
    }

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'ingreso',
        `Retiro desde reservas ${tipo_caja}`,
        monto,
        tipo_caja === 'fisica' ? 'efectivo' : 'transferencia',
        tipo_caja,
        usuario_id
      ]
    );

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
      [
        'liberación',
        `Retiro de reserva ${tipo_caja}`,
        'Sistema',
        'Retiro desde reservas',
        `Extracción automática desde reservas ${tipo_caja}`,
        monto,
        tipo_caja,
        usuario_id
      ]
    );

    res.json({ mensaje: 'Monto extraído correctamente desde reservas' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al extraer desde reservas', error });
  }
};


// --- Transferencia entre cajas ---
exports.transferirEntreCajas = async (req, res) => {
  const { monto, origen, destino, descripcion } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!['fisica','virtual'].includes(origen) || !['fisica','virtual'].includes(destino) || origen === destino) {
    return res.status(400).json({ mensaje: 'Cajas inválidas o iguales' });
  }
  if (!monto || monto <= 0) {
    return res.status(400).json({ mensaje: 'Monto inválido' });
  }

  // Verificar saldo en origen
  const [rows] = await db.query(
    `SELECT IFNULL(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END),0) -
            IFNULL(SUM(CASE WHEN tipo='egreso' THEN monto ELSE 0 END),0) AS saldo
     FROM movimientos_caja WHERE caja_tipo=?`, [origen]
  );
  const saldoOrigen = Number(rows[0]?.saldo) || 0;
  if (monto > saldoOrigen) {
    return res.status(400).json({ mensaje: `Saldo insuficiente en caja ${origen}. Disponible: $${saldoOrigen.toLocaleString('es-AR',{minimumFractionDigits:2})}` });
  }

  // Egreso en origen
  await db.query(
    `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
     VALUES ('Gasto','Transferencia entre cajas','Sistema','Transferencia a ${destino}', ?, ?, NOW(), ?, ?)`,
    [descripcion || `Transf a ${destino}`, monto, origen, usuario_id]
  );
  await db.query(
    `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
     VALUES ('egreso','Transferencia a ${destino}', ?, ?, ?, ?)`,
    [monto, origen === 'fisica' ? 'efectivo' : 'transferencia', origen, usuario_id]
  );

  // Ingreso en destino
  await db.query(
    `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
     VALUES ('Ingreso','Transferencia entre cajas','Sistema','Transferencia desde ${origen}', ?, ?, NOW(), ?, ?)`,
    [descripcion || `Transf desde ${origen}`, monto, destino, usuario_id]
  );
  await db.query(
    `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id)
     VALUES ('ingreso','Transferencia desde ${origen}', ?, ?, ?, ?)`,
    [monto, destino === 'fisica' ? 'efectivo' : 'transferencia', destino, usuario_id]
  );

  res.json({ mensaje: 'Transferencia realizada correctamente' });
};

// --- CATEGORÍAS FRECUENTES ---
exports.categoriasFrecuentes = async (req, res) => {
  try {
    const [categorias] = await db.query(
      `SELECT categoria, COUNT(*) AS cantidad FROM finanzas WHERE categoria IS NOT NULL AND categoria != '' GROUP BY categoria ORDER BY cantidad DESC LIMIT 10`
    );
    res.json(categorias.map(c => c.categoria));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener categorías", error });
  }
};

// --- SUBCATEGORÍAS/CONCEPTOS por categoría ---
exports.conceptosPorCategoria = async (req, res) => {
  const { categoria } = req.query;
  if (!categoria) return res.json([]);
  try {
    const [conceptos] = await db.query(
      `SELECT concepto, COUNT(*) AS cantidad FROM finanzas WHERE categoria = ? AND concepto IS NOT NULL AND concepto != '' GROUP BY concepto ORDER BY cantidad DESC LIMIT 10`,
      [categoria]
    );
    res.json(conceptos.map(c => c.concepto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener conceptos", error });
  }
};
