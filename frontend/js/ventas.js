import {
  obtenerToken,
  mostrarMensaje,
  logout
} from './utils.js';

const API = 'http://localhost:3000/api';

// ===== Guardia de sesión =====
async function validarSesion() {
  const tk = obtenerToken();
  if (!tk) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    window.__USER__ = data?.usuario || data;
    return window.__USER__;
  } catch (e) {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

const token = obtenerToken();
let usuario = null;
let ventasCache = [];
let empleadosCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const authUser = await validarSesion();
  if (!authUser) return;
  usuario = authUser;

  // Header user (opcional)
  const u = document.getElementById('usuario-logueado');
  if (u) u.textContent = `${usuario.nombre || 'Usuario'} (${usuario.rol || ''})`;

  // Inicializaciones
  await cargarEmpleados();
  await cargarCarrito();
  await cargarHistorialVentas();

  // Listeners
  document.getElementById('btnConfirmarVenta')?.addEventListener('click', confirmarVenta);
  document.getElementById('btn-aplicar-filtros')?.addEventListener('click', aplicarFiltros);
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);
  document.getElementById('btn-salir')?.addEventListener('click', (e)=>{ e.preventDefault(); logout(); });
});

/* =========================
   Empleados para filtro
   ========================= */
async function cargarEmpleados(){
  try {
    const res = await fetch(`${API}/lista-empleados`, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('Error empleados');
    const data = await res.json();
    empleadosCache = data || [];

    const sel = document.getElementById('filtro-empleado');
    if (sel) {
      sel.innerHTML = `<option value="">Todos los empleados</option>`;
      empleadosCache.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nombre;
        sel.appendChild(opt);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   Carrito
   ========================= */
async function cargarCarrito() {
  const res = await fetch(`${API}/carrito/${usuario.id}`, { headers: { Authorization: "Bearer " + token } });
  const carrito = await res.json();
  renderizarCarrito(carrito || []);
}

function renderizarCarrito(carrito) {
  const tbody = document.querySelector('#tabla-carrito tbody');
  const vacio = document.getElementById('carrito-vacio');
  tbody.innerHTML = '';
  let total = 0;

  if (!carrito.length) {
    vacio.style.display = '';
    document.getElementById('totalCarrito').innerText = '';
    document.getElementById('btnConfirmarVenta').disabled = true;
    return;
  }

  vacio.style.display = 'none';
  document.getElementById('btnConfirmarVenta').disabled = false;

  carrito.forEach(item => {
    const subtotal = item.precio * item.cantidad;
    total += subtotal;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.producto}</td>
      <td>${item.talle || '-'}</td>
      <td>${item.color || '-'}</td>
      <td>$${Number(item.precio).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
      <td>
        <input class="inline-number" type="number" min="1" value="${item.cantidad}"
          onchange="actualizarCantidad(${item.id}, this.value)">
      </td>
      <td>$${subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
      <td>
        <button class="btn warn sm" onclick="eliminarDelCarrito(${item.id})">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('totalCarrito').innerText = "$" + total.toLocaleString('es-AR', {minimumFractionDigits:2});
}

// Actualiza cantidad de un ítem
window.actualizarCantidad = function(id_item, cantidad) {
  fetch(`${API}/carrito/${id_item}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ cantidad })
  })
  .then(() => cargarCarrito());
};

// Elimina un ítem del carrito
window.eliminarDelCarrito = function(id_item) {
  if (!confirm("¿Eliminar este producto del carrito?")) return;
  fetch(`${API}/carrito/${id_item}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  })
  .then(() => cargarCarrito());
};

// Confirma la venta y vacía el carrito
function confirmarVenta() {
  if (!confirm("¿Registrar la venta? Se descontará el stock y se guardará en el historial.")) return;
  fetch(`${API}/ventas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ usuario_id: usuario.id })
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.venta_id) {
        mostrarMensaje?.("Venta registrada con éxito.", "exito");
        cargarCarrito();
        cargarHistorialVentas();
      } else if (data && data.mensaje) {
        mostrarMensaje?.(data.mensaje, "info");
      }
    })
    .catch(() => mostrarMensaje?.("No se pudo registrar la venta", "error"));
}

/* =========================
   Historial de ventas + filtros
   ========================= */
async function cargarHistorialVentas() {
  const res = await fetch(`${API}/ventas`, { headers: { Authorization: "Bearer " + token } });
  ventasCache = await res.json();
  renderHistorial(ventasCache);
}

function renderHistorial(ventas) {
  const tbody = document.getElementById('tabla-historial-ventas');
  tbody.innerHTML = '';
  (ventas || []).forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.id}</td>
      <td>${formatearFecha(v.fecha)}</td>
      <td>$${Number(v.total).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
      <td>${v.vendedor || obtenerNombreEmpleado(v.empleado_id) || '-'}</td>
      <td>
        <button class="btn ghost sm" onclick="verDetalleVenta(${v.id})">Detalle</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function obtenerNombreEmpleado(id){
  if (!id) return null;
  const e = empleadosCache.find(x => String(x.id) === String(id));
  return e?.nombre || null;
}

function aplicarFiltros(){
  const desdeStr = document.getElementById('filtro-desde').value;
  const hastaStr = document.getElementById('filtro-hasta').value;
  const empId = document.getElementById('filtro-empleado').value;

  const desde = desdeStr ? new Date(desdeStr + 'T00:00:00') : null;
  const hasta = hastaStr ? new Date(hastaStr + 'T23:59:59') : null;

  const filtradas = (ventasCache || []).filter(v => {
    // Fecha
    const fv = v.fecha ? new Date(v.fecha) : null;
    if (desde && fv && fv < desde) return false;
    if (hasta && fv && fv > hasta) return false;

    // Empleado
    if (!empId) return true;
    if (String(v.empleado_id || '') === String(empId)) return true;
    const empName = obtenerNombreEmpleado(empId);
    if (empName && String(v.vendedor || '').toLowerCase() === empName.toLowerCase()) return true;

    return false;
  });

  renderHistorial(filtradas);
}

function limpiarFiltros(){
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';
  document.getElementById('filtro-empleado').value = '';
  renderHistorial(ventasCache);
}

// Redirige al detalle de la venta
window.verDetalleVenta = function(id) {
  window.location.href = `detalle_venta.html?id=${id}`;
};

function formatearFecha(fecha) {
  if (!fecha) return "-";
  const d = new Date(fecha);
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}, ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
}

/* Header */
function cerrarSesion() { logout(); }
window.cerrarSesion = cerrarSesion;
