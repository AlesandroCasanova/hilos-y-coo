const db = require('../db');

// --- PAGOS A EMPLEADOS ---
exports.registrarPagoEmpleado = async (req, res) => {
  const { empleado_id, monto, concepto, descripcion, fecha, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  try {
    await db.query(
      `INSERT INTO empleados_pagos (empleado_id, monto, concepto, descripcion, fecha) VALUES (?, ?, ?, ?, ?)`,
      [empleado_id, monto, concepto, descripcion || '', fecha || new Date()]
    );

    const [[empleado]] = await db.query('SELECT nombre FROM usuarios WHERE id = ?', [empleado_id]);
    const entidad = empleado ? empleado.nombre : '';

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES ('Gasto', 'Pago empleado', ?, ?, ?, ?, ?, ?, ?)`,
      [entidad, concepto, descripcion || '', monto, fecha || new Date(), caja_tipo, usuario_id]
    );

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, fecha)
       VALUES ('egreso', ?, ?, ?, ?, ?, ?)`,
      [`Pago a empleado - ${entidad}`, monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, usuario_id, fecha || new Date()]
    );

    res.json({ mensaje: 'Pago a empleado registrado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago a empleado', detalle: err.message });
  }
};

// --- PAGOS A PROVEEDORES ---
exports.registrarPagoProveedor = async (req, res) => {
  const { proveedor_id, monto, descripcion, concepto, fecha, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  try {
    await db.query(
      `INSERT INTO proveedores_pagos (proveedor_id, monto, descripcion, concepto, fecha) VALUES (?, ?, ?, ?, ?)`,
      [proveedor_id, monto, descripcion || '', concepto || '', fecha || new Date()]
    );

    const [[proveedor]] = await db.query('SELECT nombre FROM proveedores WHERE id = ?', [proveedor_id]);
    const entidad = proveedor ? proveedor.nombre : '';

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES ('Gasto', 'Pago proveedor', ?, ?, ?, ?, ?, ?, ?)`,
      [entidad, concepto || '', descripcion || '', monto, fecha || new Date(), caja_tipo, usuario_id]
    );

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, fecha)
       VALUES ('egreso', ?, ?, ?, ?, ?, ?)`,
      [`Pago a proveedor - ${entidad}`, monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, usuario_id, fecha || new Date()]
    );

    res.json({ mensaje: 'Pago a proveedor registrado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago a proveedor', detalle: err.message });
  }
};

// --- IMPUESTOS ---
exports.registrarImpuesto = async (req, res) => {
  const { entidad, concepto, monto, descripcion, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  try {
    await db.query(
      'INSERT INTO impuestos_pagos (entidad, concepto, monto, descripcion) VALUES (?, ?, ?, ?)',
      [entidad, concepto, monto, descripcion]
    );

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES ('Gasto', 'Impuesto', ?, ?, ?, ?, NOW(), ?, ?)`,
      [entidad, concepto, descripcion, monto, caja_tipo, usuario_id]
    );

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, fecha)
       VALUES ('egreso', ?, ?, ?, ?, ?, NOW())`,
      [`Pago de impuesto - ${entidad}`, monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, usuario_id]
    );

    res.json({ mensaje: 'Impuesto registrado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar impuesto', detalle: err.message });
  }
};

// --- OTROS GASTOS ---
exports.registrarOtroPago = async (req, res) => {
  const { entidad, concepto, monto, descripcion, caja_tipo } = req.body;
  const usuario_id = req.usuario?.id || null;

  if (!caja_tipo) return res.status(400).json({ error: 'Falta el tipo de caja' });

  try {
    await db.query(
      'INSERT INTO otros_pagos (entidad, concepto, monto, descripcion) VALUES (?, ?, ?, ?)',
      [entidad, concepto, monto, descripcion]
    );

    await db.query(
      `INSERT INTO finanzas (tipo, categoria, entidad, concepto, descripcion, monto, fecha, caja_tipo, usuario_id)
       VALUES ('Gasto', 'Otro gasto', ?, ?, ?, ?, NOW(), ?, ?)`,
      [entidad, concepto, descripcion, monto, caja_tipo, usuario_id]
    );

    await db.query(
      `INSERT INTO movimientos_caja (tipo, descripcion, monto, metodo_pago, caja_tipo, usuario_id, fecha)
       VALUES ('egreso', ?, ?, ?, ?, ?, NOW())`,
      [`Otro egreso - ${entidad}`, monto, caja_tipo === 'fisica' ? 'efectivo' : 'transferencia', caja_tipo, usuario_id]
    );

    res.json({ mensaje: 'Otro egreso registrado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar otro pago', detalle: err.message });
  }
};

// --- OBTENER LISTADOS ---
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
