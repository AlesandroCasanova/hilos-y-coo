// js/pedidos.js (estética lavanda + topbar, sin sidebar)
import { obtenerToken, logout } from './utils.js';

const API = 'http://localhost:3000/api';

/* ===== Helpers ===== */
function $(sel){ return document.querySelector(sel); }
function authHeaders(extra = {}) {
  const token = obtenerToken();
  return { Authorization: 'Bearer ' + token, ...extra };
}
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}
const ROLES_PERMITIDOS = new Set(['duenio', 'dueno']); // agregar 'admin' si aplica

/* ===== Sesión ===== */
async function validarSesion() {
  const token = obtenerToken();
  if (!token) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const res = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    if (!res.ok) throw new Error('no-auth');
    const data = await res.json();
    return data.usuario;
  } catch (e) {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

/* ===== Cargas iniciales ===== */
async function cargarProveedores() {
  const res = await fetch(`${API}/proveedores`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al obtener proveedores');
  const data = await res.json();
  const select = $('#proveedor');
  if (!select) return;
  select.innerHTML = '';
  data.forEach(prov => {
    const option = document.createElement('option');
    option.value = prov.id;
    option.textContent = prov.nombre;
    select.appendChild(option);
  });
}

async function cargarPedidos() {
  const res = await fetch(`${API}/pedidos`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al obtener pedidos');
  const pedidos = await res.json();
  mostrarPedidos(pedidos);
}

/* ===== Helpers de fechas/montos ===== */
function formatearFecha(fechaStr) {
  const f = new Date(fechaStr);
  return isNaN(f) ? '-' : f.toLocaleDateString('es-AR');
}
function sumarDias(fechaStr, dias) {
  const f = new Date(fechaStr);
  if (isNaN(f)) return new Date();
  f.setDate(f.getDate() + dias);
  return f;
}
function diasDiffDesdeHoy(fecha) {
  const hoy = new Date();
  const ms = (new Date(fecha)) - hoy;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
function fmt(n){ return Number(n || 0).toFixed(2); }

/* ===== Pintar tabla ===== */
function mostrarPedidos(pedidos) {
  const tbody = $('#tabla-pedidos');
  tbody.innerHTML = '';

  let deudaTotal = 0;

  pedidos.forEach(pedido => {
    const monto = Number(pedido.monto_total || 0);
    const pagado = Number(pedido.total_pagado || 0);
    const falta = Math.max(monto - pagado, 0);
    deudaTotal += falta;

    const venc1Date = sumarDias(pedido.fecha, 30);
    const venc2Date = sumarDias(pedido.fecha, 60);
    const diff1 = diasDiffDesdeHoy(venc1Date);
    const diff2 = diasDiffDesdeHoy(venc2Date);

    const tr = document.createElement('tr');

    // Marcadores visuales por vencimiento
    const hayDeuda = falta > 0.0001;
    const vencido = (diff1 < 0 || diff2 < 0) && hayDeuda;
    const pronto = ((diff1 >= 0 && diff1 <= 5) || (diff2 >= 0 && diff2 <= 5)) && hayDeuda;

    if (vencido) tr.classList.add('vencido');
    else if (pronto) tr.classList.add('vencimiento-pronto');

    tr.innerHTML = `
      <td>${pedido.proveedor_nombre || '-'}</td>
      <td>${formatearFecha(pedido.fecha)}</td>
      <td>$${fmt(monto)}</td>
      <td>$${fmt(pagado)}</td>
      <td>$${fmt(falta)}</td>
      <td>${formatearFecha(venc1Date)}</td>
      <td>${diff1 >= 0 ? diff1 : 0} días</td>
      <td>${formatearFecha(venc2Date)}</td>
      <td>${diff2 >= 0 ? diff2 : 0} días</td>
      <td>${pedido.estado || (hayDeuda ? (vencido ? 'Vencido' : 'Pendiente') : 'Pago completo')}</td>
      <td>
        <div class="table-actions">
          <button class="btn ok sm" onclick="abrirPago(${pedido.id}, ${fmt(falta)})">Pagar</button>
          <button class="btn ghost sm" onclick="verHistorial(${pedido.id})">Historial</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  $('#total-deuda').textContent = fmt(deudaTotal);
}

/* ===== Registrar pedido ===== */
async function registrarPedido(e) {
  e.preventDefault();
  const form = $('#form-pedido');
  const formData = new FormData(form);

  // Normalizar fecha a YYYY-MM-DD
  const fechaInput = form.querySelector('input[name="fecha_pedido"]');
  const f = new Date(fechaInput.value);
  const fechaMysql = isNaN(f) ? '' : f.toISOString().split('T')[0];
  if (fechaMysql) formData.set('fecha_pedido', fechaMysql);

  try {
    const res = await fetch(`${API}/pedidos`, {
      method: 'POST',
      headers: authHeaders(), // SOLO Authorization; FormData maneja el boundary
      body: formData
    });
    if (!res.ok) throw new Error('No se pudo registrar el pedido');

    alert('Pedido registrado correctamente');
    form.reset();
    // Reset visual del nombre de archivo
    const nombre = $('#archivo-nombre'); if (nombre) nombre.textContent = 'Ningún archivo seleccionado';
    await cargarPedidos();
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    alert('Error al registrar pedido');
  }
}

/* ===== Modal de pago detallado ===== */
window.abrirPago = function (pedido_id, maximoStr) {
  const maximo = Number(maximoStr || 0);
  $('#pedido_id').value = pedido_id;
  $('#monto_total_pago').value = fmt(maximo);
  $('#fuentes_pago').selectedIndex = -1;
  $('#distribucion').innerHTML = '';
  $('#modal-pago').classList.add('show');
};

window.cerrarModal = function () {
  $('#modal-pago').classList.remove('show');
};

function actualizarDistribucion() {
  const seleccionadas = Array.from($('#fuentes_pago').selectedOptions).map(opt => opt.value);
  const contenedor = $('#distribucion');
  contenedor.innerHTML = '';

  if (seleccionadas.length <= 1) return;

  seleccionadas.forEach(fuente => {
    const label = document.createElement('label');
    label.textContent = `Monto desde ${fuente.replace('_', ' ')}:`;

    const input = document.createElement('input');
    input.type = 'number';
    input.name = `monto_${fuente}`;
    input.min = 0;
    input.step = '0.01';
    input.required = true;
    input.className = 'input';

    contenedor.appendChild(label);
    contenedor.appendChild(input);
  });
}
$('#fuentes_pago')?.addEventListener('change', actualizarDistribucion);

async function enviarPagoDetallado(e) {
  e.preventDefault();

  const pedido_id = $('#pedido_id').value;
  const monto_total = parseFloat($('#monto_total_pago').value);
  const fuentes = Array.from($('#fuentes_pago').selectedOptions).map(opt => opt.value);
  const detalles = {};

  if (fuentes.length === 0) return alert('Seleccioná al menos una fuente de pago');

  if (fuentes.length === 1) {
    detalles[fuentes[0]] = monto_total;
  } else {
    let suma = 0;
    for (const fuente of fuentes) {
      const input = document.querySelector(`[name="monto_${fuente}"]`);
      const monto = parseFloat(input.value);
      if (isNaN(monto) || monto <= 0) return alert('Todos los montos deben ser válidos y mayores a 0');
      detalles[fuente] = monto;
      suma += monto;
    }
    if (Number(suma.toFixed(2)) !== Number(monto_total.toFixed(2))) {
      return alert('La suma de los montos no coincide con el total a pagar');
    }
  }

  try {
    const res = await fetch(`${API}/pedidos/pago-detallado`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id, monto_total, detalles })
    });
    if (!res.ok) throw new Error('Error al registrar pago');

    alert('Pago registrado correctamente');
    cerrarModal();
    await cargarPedidos();
  } catch (error) {
    console.error(error);
    alert('No se pudo registrar el pago');
  }
}

/* ===== Historial ===== */
window.verHistorial = async function (pedido_id) {
  try {
    const res = await fetch(`${API}/historial/${pedido_id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('No se pudo obtener el historial');

    const historial = await res.json();
    const tbody = $('#tabla-historial');
    tbody.innerHTML = '';

    historial.forEach(pago => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatearFecha(pago.fecha)}</td>
        <td>$${fmt(pago.monto)}</td>
        <td>${pago.fuente || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    $('#modal-historial').classList.add('show');
  } catch (error) {
    console.error(error);
    alert('Error al cargar historial de pagos');
  }
};

window.cerrarModalHistorial = function () {
  $('#modal-historial').classList.remove('show');
};

/* ===== Recarga genérica ===== */
async function recargar() {
  await cargarProveedores();
  await cargarPedidos();
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  // Header
  $('#usuario-logueado') && ($('#usuario-logueado').textContent = `${usuario.nombre || 'Usuario'} (${usuario.rol})`);
  const rolNorm = normalizarRol(usuario.rol);
  if (!ROLES_PERMITIDOS.has(rolNorm)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    window.location.href = 'dashboard.html';
    return;
  }

  await recargar();

  // Listeners header
  $('#btn-refrescar')?.addEventListener('click', recargar);
  $('#btn-salir')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  // Listeners formularios / modales
  $('#form-pedido')?.addEventListener('submit', registrarPedido);
  $('#form-pago')?.addEventListener('submit', enviarPagoDetallado);

  // === Archivo: actualizar nombre elegido ===
  const archivoInput = $('#archivo');
  const archivoNombre = $('#archivo-nombre');
  archivoInput?.addEventListener('change', () => {
    const f = archivoInput.files?.[0];
    archivoNombre.textContent = f ? f.name : 'Ningún archivo seleccionado';
  });
});
