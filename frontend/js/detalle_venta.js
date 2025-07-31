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
    mostrarMensaje("Venta no encontrada", "error");
    document.body.innerHTML = "<h2>Venta no encontrada</h2>";
    return;
  }

  try {
    // Traer info general de la venta (vendedor, fecha, total)
    const ventas = await fetchConToken(`${API}/ventas`).then(res => res.json());
    const venta = ventas.find(v => v.id == id);

    if (!venta) {
      mostrarMensaje("Venta no encontrada", "error");
      document.body.innerHTML = "<h2>Venta no encontrada</h2>";
      return;
    }

    // Cargar datos principales
    document.getElementById('ventaTitulo').textContent = `Venta #${venta.id}`;
    document.getElementById('ventaFecha').textContent = venta.fecha
      ? new Date(venta.fecha).toLocaleString('es-AR')
      : '-';
    document.getElementById('ventaEmpleado').textContent = venta.vendedor || venta.usuario_nombre || '-';
    document.getElementById('ventaTotal').textContent = venta.total
      ? Number(venta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })
      : '0,00';

    // Traer detalle de la venta
    const detalle = await fetchConToken(`${API}/venta/${id}`).then(res => res.json());
    const tbody = document.getElementById('detalleVentaBody');
    tbody.innerHTML = '';
    detalle.forEach(item => {
      tbody.innerHTML += `
        <tr>
          <td>${item.producto}</td>
          <td>${item.talle}</td>
          <td>${item.color}</td>
          <td>${item.cantidad}</td>
          <td>$${Number(item.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          <td><b>$${(item.precio_unitario * item.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</b></td>
        </tr>
      `;
    });

  } catch (err) {
    mostrarMensaje("Error al cargar detalle de venta", "error");
    console.error(err);
  }
});
