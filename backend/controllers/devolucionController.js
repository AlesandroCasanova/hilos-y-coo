// backend/controllers/devolucionController.js
const db = require('../models/db');

/**
 * POST /api/devoluciones
 * {
 *   venta_id: number,
 *   caja_tipo: "fisica" | "virtual",
 *   motivo?: string,
 *   usarPrecioVigente?: boolean,  // default false -> usa precio_unitario original
 *   items: [
 *     { venta_item_id: number, cantidad: number, variante_id_entregada?: number }
 *   ]
 * }
 */
exports.crear = async (req, res) => {
  const {
    venta_id,
    caja_tipo,
    motivo = '',
    usarPrecioVigente = false,
    items = []
  } = req.body;

  if (!venta_id || !caja_tipo || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ mensaje: 'Datos insuficientes para registrar la devolución.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Verificar venta
    const [ventaRows] = await conn.query('SELECT id FROM ventas WHERE id = ? LIMIT 1', [venta_id]);
    if (!ventaRows.length) throw new Error('Venta no encontrada');

    // 2) Items originales (detalle_venta) + producto desde variantes
    const ventaItemIds = items.map(i => Number(i.venta_item_id));
    const placeholders = ventaItemIds.map(() => '?').join(',');
    const [origItems] = await conn.query(
      `SELECT dv.id, dv.venta_id, dv.variante_id, dv.cantidad, dv.precio_unitario,
              v.producto_id
       FROM detalle_venta dv
       JOIN variantes v ON v.id = dv.variante_id
       WHERE dv.venta_id = ? AND dv.id IN (${placeholders})`,
      [venta_id, ...ventaItemIds]
    );
    if (origItems.length !== items.length) {
      throw new Error('Alguno de los ítems no pertenece a la venta o no existe');
    }

    // 3) Acumulado ya devuelto para no exceder
    const [prevDev] = await conn.query(
      `SELECT di.venta_item_id, SUM(di.cantidad_devuelta) AS devuelto
       FROM devolucion_items di
       INNER JOIN devoluciones d ON d.id = di.devolucion_id
       WHERE d.venta_id = ? AND di.venta_item_id IN (${placeholders})
       GROUP BY di.venta_item_id`,
      [venta_id, ...ventaItemIds]
    );
    const devueltoMap = new Map(prevDev.map(r => [Number(r.venta_item_id), Number(r.devuelto || 0)]));

    // 4) Calcular totales
    let totalDevuelto = 0;   // reintegro al cliente
    let totalEntregado = 0;  // lo nuevo que se entrega (cambio)
    const detalleItems = [];

    for (const it of items) {
      const base = origItems.find(o => o.id === Number(it.venta_item_id));
      if (!base) throw new Error('Ítem de venta no encontrado');

      const cant = Number(it.cantidad || 0);
      if (cant <= 0) throw new Error('Cantidad inválida');

      const yaDev = devueltoMap.get(base.id) || 0;
      const maxDisp = Number(base.cantidad) - yaDev;
      if (cant > maxDisp) {
        throw new Error(`Cantidad a devolver del ítem ${base.id} excede lo disponible (${maxDisp}).`);
      }

      // Devuelto al precio original
      const precioDev = Number(base.precio_unitario || 0);
      const subDev = cant * precioDev;
      totalDevuelto += subDev;

      // Cambio (opcional)
      let varianteEntregada = null;
      let precioEnt = 0;
      let subEnt = 0;

      if (it.variante_id_entregada) {
        varianteEntregada = Number(it.variante_id_entregada);

        if (usarPrecioVigente) {
          // Precio vigente: productos.precio de la variante nueva
          const [[rowPrecio]] = await conn.query(
            `SELECT p.precio
             FROM variantes v
             JOIN productos p ON p.id = v.producto_id
             WHERE v.id = ? LIMIT 1`,
            [varianteEntregada]
          );
          if (!rowPrecio) throw new Error('Variante a entregar no encontrada');
          precioEnt = Number(rowPrecio.precio || 0);
        } else {
          precioEnt = precioDev; // mismo precio de lo devuelto
        }

        subEnt = cant * precioEnt;
        totalEntregado += subEnt;
      }

      detalleItems.push({
        venta_item_id: base.id,
        producto_id: base.producto_id,
        variante_id_devuelta: base.variante_id,
        cantidad_devuelta: cant,
        precio_unit_devuelto: precioDev,
        subtotal_devuelto: subDev,
        variante_id_entregada: varianteEntregada,
        cantidad_entregada: varianteEntregada ? cant : 0,
        precio_unit_entregado: precioEnt,
        subtotal_entregado: subEnt
      });
    }

    // 5) Cabecera
    const [devRes] = await conn.query(
      `INSERT INTO devoluciones
       (venta_id, usuario_id, fecha, caja_tipo, motivo, total_reintegro, total_diferencia, observaciones)
       VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)`,
      [
        venta_id,
        req.usuario?.id || null,
        caja_tipo,                // 'fisica' | 'virtual'
        motivo,
        totalDevuelto,
        totalEntregado,
        ''
      ]
    );
    const devolucion_id = devRes.insertId;

    // 6) Items
    for (const d of detalleItems) {
      await conn.query(
        `INSERT INTO devolucion_items
         (devolucion_id, venta_item_id, producto_id,
          variante_id_devuelta, cantidad_devuelta, precio_unit_devuelto, subtotal_devuelto,
          variante_id_entregada, cantidad_entregada, precio_unit_entregado, subtotal_entregado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          devolucion_id,
          d.venta_item_id,
          d.producto_id,
          d.variante_id_devuelta,
          d.cantidad_devuelta,
          d.precio_unit_devuelto,
          d.subtotal_devuelto,
          d.variante_id_entregada,
          d.cantidad_entregada,
          d.precio_unit_entregado,
          d.subtotal_entregado
        ]
      );
    }

    // 7) Stock + historial_stock
    for (const d of detalleItems) {
      // + stock devuelto
      await conn.query(`UPDATE variantes SET stock = stock + ? WHERE id = ?`, [d.cantidad_devuelta, d.variante_id_devuelta]);
      await conn.query(
        `INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo)
         VALUES (?, 'Ingreso', ?, 'devolucion')`,
        [d.variante_id_devuelta, d.cantidad_devuelta]
      );

      // - stock entregado (si hay cambio)
      if (d.variante_id_entregada && d.cantidad_entregada > 0) {
        await conn.query(`UPDATE variantes SET stock = stock - ? WHERE id = ?`, [d.cantidad_entregada, d.variante_id_entregada]);
        await conn.query(
          `INSERT INTO historial_stock (variante_id, tipo_movimiento, cantidad, motivo)
           VALUES (?, 'Egreso', ?, 'cambio')`,
          [d.variante_id_entregada, d.cantidad_entregada]
        );
      }
    }

    // 8) Movimiento neto en movimientos_caja
    const neto = totalEntregado - totalDevuelto;
    if (neto !== 0) {
      const cuenta = caja_tipo === 'fisica' ? 'caja_fisica' : 'caja_virtual';
      const esIngreso = neto > 0;
      const tipo = esIngreso ? 'ingreso' : 'egreso';
      const signo = esIngreso ? +1 : -1;
      const monto = Math.abs(neto);
      const descripcion = esIngreso ? `Diferencia por cambio #${devolucion_id} (venta #${venta_id})`
                                    : `Devolución #${devolucion_id} (venta #${venta_id})`;

      // sesion_id si caja física abierta
      let sesion_id = null;
      if (caja_tipo === 'fisica') {
        const [[sesion]] = await conn.query(
          `SELECT id FROM sesiones_caja
           WHERE estado='abierta'
           ORDER BY fecha_apertura DESC LIMIT 1`
        );
        sesion_id = sesion?.id || null;
      }

      await conn.query(
        `INSERT INTO movimientos_caja
         (fecha, usuario_id, cuenta, tipo, signo, monto, referencia_tipo, referencia_id, descripcion, sesion_id)
         VALUES (NOW(), ?, ?, ?, ?, ?, 'devolucion', ?, ?, ?)`,
        [req.usuario?.id || null, cuenta, tipo, signo, monto, devolucion_id, descripcion, sesion_id]
      );
    }

    await conn.commit();
    res.status(201).json({
      mensaje: 'Devolución registrada',
      devolucion_id,
      total_reintegro: totalDevuelto,
      total_entregado: totalEntregado,
      neto
    });
  } catch (error) {
    try { await conn.rollback(); } catch {}
    console.error('Error en devoluciones.crear:', error);
    res.status(500).json({ mensaje: 'Error al procesar la devolución', error: String(error.message || error) });
  } finally {
    try { conn.release(); } catch {}
  }
};

exports.detalle = async (req, res) => {
  const { id } = req.params;
  try {
    const [[cab]] = await db.query(
      `SELECT d.*, u.nombre AS usuario_nombre
       FROM devoluciones d
       LEFT JOIN usuarios u ON u.id = d.usuario_id
       WHERE d.id = ? LIMIT 1`,
      [id]
    );
    if (!cab) return res.status(404).json({ mensaje: 'Devolución no encontrada' });

    const [its] = await db.query(
      `SELECT di.* FROM devolucion_items di WHERE di.devolucion_id = ?`,
      [id]
    );

    res.json({ devolucion: cab, items: its });
  } catch (error) {
    console.error('Error en devoluciones.detalle:', error);
    res.status(500).json({ mensaje: 'Error al obtener devolución', error: String(error.message || error) });
  }
};
