const db = require('../db');

// Helpers
function toDateOrNow(d) { return d ? new Date(d) : new Date(); }
function normalizeCajaTipo(caja_tipo) {
  const v = String(caja_tipo || '').toLowerCase();
  return v.includes('fisic') ? 'fisica' : 'virtual';
}
function mapCuenta(caja_tipo_normalizada) {
  return caja_tipo_normalizada === 'fisica' ? 'caja_fisica' : 'caja_virtual';
}

// ---------------------------------------------------------
// PAGOS A EMPLEADOS (EGRESO)
// ---------------------------------------------------------
exports.registrarPagoEmpleado = async (req, res) => {
  const { empleado_id, monto, concepto, descripcion, fecha, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  const fechaSQL = toDateOrNow(fecha);
  const cajaNorm = normalizeCajaTipo(caja_tipo);
  const cuenta   = mapCuenta(cajaNorm);

  try {
    // 1) Insert en empleados_pagos (NO existe metodo_pago en esta tabla)
    const [r1] = await db.query(
      `INSERT INTO empleados_pagos (empleado_id, monto, concepto, fecha, descripcion)
       VALUES (?, ?, ?, ?, ?)`,
      [empleado_id, monto, concepto || 'Pago', fechaSQL, descripcion || '']
    );
    const refId = r1.insertId || null;

    // 2) Nombre del empleado para dejar trazabilidad en finanzas
    const [[empleado]] = await db.query('SELECT nombre FROM usuarios WHERE id = ?', [empleado_id]);
    const entidad = empleado ? empleado.nombre : `empleado#${empleado_id}`;

    // 3) Asiento en finanzas (impacta saldos y reportes)
    await db.query(
      `INSERT INTO finanzas
        (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva)
       VALUES
        ('Gasto', 'Pago empleado', ?, ?, ?, ?, ?, ?, ?, 0)`,
      [entidad, concepto || 'Pago', descripcion || `Pago a empleado ${entidad}`, monto, fechaSQL, cajaNorm, usuario_id]
    );

    // 4) Movimiento de caja (ledger): egreso en la cuenta elegida
    await db.query(
      `INSERT INTO movimientos_caja
        (fecha, usuario_id, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion)
       VALUES
        (?, ?, ?, 'egreso', -1, ?, 'pago_empleado', ?, ?)`,
      [fechaSQL, usuario_id, cuenta, monto, refId, `Pago a empleado - ${entidad}`]
    );

    res.json({ mensaje: 'Pago a empleado registrado correctamente' });
  } catch (err) {
    console.error('registrarPagoEmpleado:', err);
    res.status(500).json({ error: 'Error al registrar pago a empleado', detalle: err.message });
  }
};

// ---------------------------------------------------------
// PAGOS A PROVEEDORES (EGRESO)
// ---------------------------------------------------------
exports.registrarPagoProveedor = async (req, res) => {
  const { proveedor_id, monto, descripcion, concepto, fecha, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  const fechaSQL = toDateOrNow(fecha);
  const cajaNorm = normalizeCajaTipo(caja_tipo);
  const cuenta   = mapCuenta(cajaNorm);

  try {
    // 1) Registrar en proveedores_pagos
    const [r1] = await db.query(
      `INSERT INTO proveedores_pagos (proveedor_id, monto, descripcion, concepto, fecha)
       VALUES (?, ?, ?, ?, ?)`,
      [proveedor_id, monto, descripcion || '', concepto || 'Pago', fechaSQL]
    );
    const refId = r1.insertId || null;

    // 2) Nombre proveedor para trazabilidad
    const [[prov]] = await db.query('SELECT nombre FROM proveedores WHERE id = ?', [proveedor_id]);
    const entidad = prov ? prov.nombre : `proveedor#${proveedor_id}`;

    // 3) Asiento en finanzas (se usa categoría 'Pago proveedor' para el reporte de egresos_compras)
    await db.query(
      `INSERT INTO finanzas
        (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva)
       VALUES
        ('Gasto', 'Pago proveedor', ?, ?, ?, ?, ?, ?, ?, 0)`,
      [entidad, concepto || 'Pago', descripcion || `Pago a proveedor ${entidad}`, monto, fechaSQL, cajaNorm, usuario_id]
    );

    // 4) Movimiento de caja (ledger)
    await db.query(
      `INSERT INTO movimientos_caja
        (fecha, usuario_id, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion)
       VALUES
        (?, ?, ?, 'egreso', -1, ?, 'pago_proveedor', ?, ?)`,
      [fechaSQL, usuario_id, cuenta, monto, refId, `Pago a proveedor - ${entidad}`]
    );

    res.json({ mensaje: 'Pago a proveedor registrado correctamente' });
  } catch (err) {
    console.error('registrarPagoProveedor:', err);
    res.status(500).json({ error: 'Error al registrar pago a proveedor', detalle: err.message });
  }
};

// ---------------------------------------------------------
// IMPUESTOS (EGRESO)
// ---------------------------------------------------------
exports.registrarImpuesto = async (req, res) => {
  const { entidad, concepto, monto, descripcion, caja_tipo, fecha } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  const fechaSQL = toDateOrNow(fecha);
  const cajaNorm = normalizeCajaTipo(caja_tipo);
  const cuenta   = mapCuenta(cajaNorm);

  try {
    // 1) Registrar en impuestos_pagos
    const [r1] = await db.query(
      'INSERT INTO impuestos_pagos (entidad, concepto, monto, descripcion, fecha) VALUES (?, ?, ?, ?, ?)',
      [entidad, concepto || 'Impuesto', monto, descripcion || '', fechaSQL]
    );
    const refId = r1.insertId || null;

    // 2) Asiento en finanzas
    await db.query(
      `INSERT INTO finanzas
        (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva)
       VALUES
        ('Gasto', 'Impuesto', ?, ?, ?, ?, ?, ?, ?, 0)`,
      [entidad, concepto || 'Impuesto', descripcion || `Pago de impuesto - ${entidad}`, monto, fechaSQL, cajaNorm, usuario_id]
    );

    // 3) Movimiento de caja (ledger)
    await db.query(
      `INSERT INTO movimientos_caja
        (fecha, usuario_id, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion)
       VALUES
        (?, ?, ?, 'egreso', -1, ?, 'pago_impuesto', ?, ?)`,
      [fechaSQL, usuario_id, cuenta, monto, refId, `Pago de impuesto - ${entidad}`]
    );

    res.json({ mensaje: 'Impuesto registrado correctamente' });
  } catch (err) {
    console.error('registrarImpuesto:', err);
    res.status(500).json({ error: 'Error al registrar impuesto', detalle: err.message });
  }
};

// ---------------------------------------------------------
// OTROS GASTOS (EGRESO)
// ---------------------------------------------------------
exports.registrarOtroPago = async (req, res) => {
  const { entidad, concepto, monto, descripcion, caja_tipo, fecha } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  const fechaSQL = toDateOrNow(fecha);
  const cajaNorm = normalizeCajaTipo(caja_tipo);
  const cuenta   = mapCuenta(cajaNorm);

  try {
    // 1) Registrar en tabla de otros_pagos
    const [r1] = await db.query(
      'INSERT INTO otros_pagos (entidad, concepto, monto, descripcion, fecha) VALUES (?, ?, ?, ?, ?)',
      [entidad, concepto || 'Otro gasto', monto, descripcion || '', fechaSQL]
    );
    const refId = r1.insertId || null;

    // 2) Asiento en finanzas
    await db.query(
      `INSERT INTO finanzas
        (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id, es_reserva)
       VALUES
        ('Gasto', 'Otro gasto', ?, ?, ?, ?, ?, ?, ?, 0)`,
      [entidad, concepto || 'Otro gasto', descripcion || `Otro egreso - ${entidad}`, monto, fechaSQL, cajaNorm, usuario_id]
    );

    // 3) Movimiento de caja (ledger)
    await db.query(
      `INSERT INTO movimientos_caja
        (fecha, usuario_id, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion)
       VALUES
        (?, ?, ?, 'egreso', -1, ?, 'otro_gasto', ?, ?)`,
      [fechaSQL, usuario_id, cuenta, monto, refId, `Otro egreso - ${entidad}`]
    );

    res.json({ mensaje: 'Otro egreso registrado correctamente' });
  } catch (err) {
    console.error('registrarOtroPago:', err);
    res.status(500).json({ error: 'Error al registrar otro pago', detalle: err.message });
  }
};

// ---------------------------------------------------------
// LISTADOS
// ---------------------------------------------------------
exports.obtenerPagosEmpleados = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT ep.*, u.nombre AS empleado 
      FROM empleados_pagos ep
      JOIN usuarios u ON ep.empleado_id = u.id
      ORDER BY ep.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos empleados', detalle: err.message });
  }
};

exports.obtenerPagosProveedores = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT pp.*, p.nombre AS proveedor 
      FROM proveedores_pagos pp
      JOIN proveedores p ON pp.proveedor_id = p.id
      ORDER BY pp.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos a proveedores', detalle: err.message });
  }
};

exports.obtenerImpuestos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM impuestos_pagos ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener impuestos', detalle: err.message });
  }
};

exports.obtenerOtrosPagos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM otros_pagos ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener otros pagos', detalle: err.message });
  }
};
