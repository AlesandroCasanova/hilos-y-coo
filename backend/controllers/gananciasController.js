// controllers/gananciasController.js
const db = require('../models/db');

// ---------- Utils de fechas ----------
function yyyymmRange(year, month){
  const y = Number(year), m = Number(month);
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const to   = new Date(Date.UTC(y, m, 0, 23, 59, 59)); // último día del mes
  const iso = d => d.toISOString().slice(0, 19).replace('T', ' ');
  return { from: iso(from), to: iso(to), fromDate: iso(from).slice(0,10), toDate: iso(to).slice(0,10) };
}
function clampYearMonth(qy, qm){
  const now = new Date();
  const Y = Number(qy) || now.getFullYear();
  const M = Math.min(Math.max(Number(qm) || (now.getMonth()+1), 1), 12);
  return { Y, M };
}

/**
 * GET /api/ganancias/mensual?year=YYYY&month=MM
 * Resumen contable + flujo de caja para el mes indicado.
 *
 * Ventas: detalle_venta (variante_id) -> variantes -> productos
 * COGS: usa productos.precio_proveedor (no hay historial de costo)
 * Finanzas: usa tipo 'Ingreso' / 'Gasto' (según tu enum) y es_reserva.
 */
exports.mensual = async (req, res) => {
  try {
    const { Y, M } = clampYearMonth(req.query.year, req.query.month);
    const { from, to, fromDate, toDate } = yyyymmRange(Y, M);

    // ------- 1) Ventas e COGS (accrual) -------
    const [ventasRows] = await db.query(
      `
      SELECT
        COALESCE(SUM(dv.cantidad * dv.precio_unitario), 0) AS ingresos_ventas,
        COALESCE(SUM(dv.cantidad * p.precio_proveedor), 0) AS cogs,
        COALESCE(SUM(dv.cantidad), 0) AS unidades
      FROM detalle_venta dv
      JOIN ventas v     ON v.id = dv.venta_id
      JOIN variantes va ON va.id = dv.variante_id
      JOIN productos p  ON p.id = va.producto_id
      WHERE v.fecha BETWEEN ? AND ?
      `,
      [from, to]
    );

    const ingresos_ventas = Number(ventasRows[0]?.ingresos_ventas || 0);
    const cogs            = Number(ventasRows[0]?.cogs || 0);
    const unidades        = Number(ventasRows[0]?.unidades || 0);

    // ------- 2) Finanzas (cash entries) -------
    // Ajustá estas categorías a tus usos reales (sirven para evitar dobles conteos)
    const CATS_RESERVAS = [
      'Reserva', 'Reserva física', 'Reserva virtual', 'Reserva automática cierre'
    ];
    const CATS_TRANSFER = ['Transferencia entre cajas', 'Transferencia'];
    const CATS_COMPRAS  = ['Pago proveedor', 'Compra inventario', 'Compra de inventario'];
    const CATS_VENTAS   = ['Venta', 'Ventas']; // por si registrás ventas en finanzas (evitamos duplicar)

    // 2.a) Otros ingresos (no ventas), excluye reservas/transfer y ventas
    const [otrosIngRows] = await db.query(
      `
      SELECT COALESCE(SUM(monto),0) AS otros_ingresos
      FROM finanzas
      WHERE DATE(fecha) BETWEEN ? AND ?
        AND tipo = 'Ingreso'
        AND es_reserva = 0
        AND (categoria IS NULL OR (categoria NOT IN (?) AND categoria NOT IN (?) AND categoria NOT IN (?)))
      `,
      [fromDate, toDate, CATS_RESERVAS, CATS_TRANSFER, CATS_VENTAS]
    );
    const otros_ingresos = Number(otrosIngRows[0]?.otros_ingresos || 0);

    // 2.b) Gastos operativos (excluye compras/pagos a proveedor, reservas y transferencias)
    const [opexRows] = await db.query(
      `
      SELECT COALESCE(SUM(monto),0) AS gastos_operativos
      FROM finanzas
      WHERE DATE(fecha) BETWEEN ? AND ?
        AND tipo = 'Gasto'
        AND es_reserva = 0
        AND (categoria IS NULL OR (
             categoria NOT IN (?)   -- NO compras/pago proveedor
         AND categoria NOT IN (?)   -- NO reservas
         AND categoria NOT IN (?)   -- NO transferencias
        ))
      `,
      [fromDate, toDate, CATS_COMPRAS, CATS_RESERVAS, CATS_TRANSFER]
    );
    const gastos_operativos = Number(opexRows[0]?.gastos_operativos || 0);

    // 2.c) Egresos por compras (para ver salida de caja a proveedores)
    const [comprasRows] = await db.query(
      `
      SELECT COALESCE(SUM(monto),0) AS egresos_compras
      FROM finanzas
      WHERE DATE(fecha) BETWEEN ? AND ?
        AND tipo = 'Gasto'
        AND categoria IN (?)
      `,
      [fromDate, toDate, CATS_COMPRAS]
    );
    const egresos_compras = Number(comprasRows[0]?.egresos_compras || 0);

    // 2.d) Totales de caja (cashflow)
    const [ingCajaRows] = await db.query(
      `
      SELECT COALESCE(SUM(monto),0) AS ingresos_caja
      FROM finanzas
      WHERE DATE(fecha) BETWEEN ? AND ?
        AND tipo = 'Ingreso'
      `,
      [fromDate, toDate]
    );
    const [egrCajaRows] = await db.query(
      `
      SELECT COALESCE(SUM(monto),0) AS egresos_caja
      FROM finanzas
      WHERE DATE(fecha) BETWEEN ? AND ?
        AND tipo = 'Gasto'
      `,
      [fromDate, toDate]
    );
    const ingresos_caja = Number(ingCajaRows[0]?.ingresos_caja || 0);
    const egresos_caja  = Number(egrCajaRows[0]?.egresos_caja || 0);
    const cashflow_neto = ingresos_caja - egresos_caja;

    // ------- 3) Cálculos finales -------
    const ingresos_netos   = ingresos_ventas + otros_ingresos;
    const margen_bruto     = ingresos_ventas - cogs;
    const ganancia_neta    = ingresos_netos - cogs - gastos_operativos;

    return res.json({
      periodo: { year: Y, month: M, from: fromDate, to: toDate },
      ventas: { ingresos_ventas, unidades },
      costos: { cogs },
      otros_ingresos,
      gastos_operativos,
      egresos_compras,
      resultados: {
        ingresos_netos,
        margen_bruto,
        ganancia_neta,
        margen_bruto_pct: ingresos_ventas > 0 ? Number(((margen_bruto / ingresos_ventas) * 100).toFixed(2)) : 0,
        ganancia_neta_pct: ingresos_netos > 0 ? Number(((ganancia_neta / ingresos_netos) * 100).toFixed(2)) : 0
      },
      cashflow: { ingresos_caja, egresos_caja, neto: cashflow_neto }
    });
  } catch (e) {
    console.error('ganancias.mensual', e);
    res.status(500).json({ mensaje: 'Error al calcular ganancias mensuales', error: e.message });
  }
};

/**
 * GET /api/ganancias/top-productos?year=YYYY&month=MM&limit=15
 * Ranking por margen contable en el mes (ventas - costo vendido).
 * Usa detalle_venta -> variantes -> productos.
 */
exports.topProductosMensual = async (req, res) => {
  try {
    const { Y, M } = clampYearMonth(req.query.year, req.query.month);
    const { from, to } = yyyymmRange(Y, M);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '15', 10), 1), 100);

    const [rows] = await db.query(
      `
      SELECT
        p.id AS producto_id,
        p.nombre,
        SUM(dv.cantidad) AS unidades,
        SUM(dv.cantidad * dv.precio_unitario) AS ingresos,
        SUM(dv.cantidad * p.precio_proveedor) AS cogs
      FROM detalle_venta dv
      JOIN ventas v     ON v.id = dv.venta_id
      JOIN variantes va ON va.id = dv.variante_id
      JOIN productos p  ON p.id = va.producto_id
      WHERE v.fecha BETWEEN ? AND ?
      GROUP BY p.id, p.nombre
      ORDER BY (SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * p.precio_proveedor)) DESC
      LIMIT ?
      `,
      [from, to, limit]
    );

    const data = rows.map(r => {
      const ingresos = Number(r.ingresos || 0);
      const cogs     = Number(r.cogs || 0);
      const margen   = ingresos - cogs;
      return {
        producto_id: r.producto_id,
        nombre: r.nombre,
        unidades: Number(r.unidades || 0),
        ingresos,
        cogs,
        margen,
        margen_pct: ingresos > 0 ? Number(((margen / ingresos) * 100).toFixed(2)) : 0
      };
    });

    res.json({ year: Y, month: M, data });
  } catch (e) {
    console.error('ganancias.topProductosMensual', e);
    res.status(500).json({ mensaje: 'Error al obtener ranking mensual', error: e.message });
  }
};
