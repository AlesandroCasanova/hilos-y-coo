import {
  obtenerToken,
  fetchConToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    mostrarMensaje?.("Venta no encontrada", "error");
    document.body.innerHTML = "<h2 style='padding:16px'>Venta no encontrada</h2>";
    return;
  }

  try {
    // 1) Info general
    const ventas = await fetchConToken(`${API}/ventas`).then(res => res.json());
    const venta = (Array.isArray(ventas) ? ventas : []).find(v => String(v.id) === String(id));

    if (!venta) {
      mostrarMensaje?.("Venta no encontrada", "error");
      document.body.innerHTML = "<h2 style='padding:16px'>Venta no encontrada</h2>";
      return;
    }

    // Cabecera
    document.getElementById('ventaTitulo').textContent = `Venta #${venta.id}`;
    document.getElementById('ventaFecha').textContent = venta.fecha
      ? new Date(venta.fecha).toLocaleString('es-AR')
      : '-';
    document.getElementById('ventaEmpleado').textContent = venta.vendedor || venta.usuario_nombre || '-';
    document.getElementById('ventaTotal').textContent = venta.total
      ? Number(venta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })
      : '0,00';

    // 2) Detalle
    const detalle = await fetchConToken(`${API}/venta/${id}`).then(res => res.json());
    const tbody = document.getElementById('detalleVentaBody');
    tbody.innerHTML = '';

    (Array.isArray(detalle) ? detalle : []).forEach(item => {
      const precio = Number(item.precio_unitario || 0);
      const cantidad = Number(item.cantidad || 0);
      const subtotal = precio * cantidad;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.producto)}</td>
        <td>${escapeHtml(item.talle)}</td>
        <td>${escapeHtml(item.color)}</td>
        <td>${cantidad}</td>
        <td>$${precio.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
        <td>$${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    mostrarMensaje?.("Error al cargar detalle de venta", "error");
  }
});

// Util — Sanitizar HTML
function escapeHtml(str=''){
  return String(str ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}
