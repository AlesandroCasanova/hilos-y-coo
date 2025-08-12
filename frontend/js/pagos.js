// js/pagos.js
import { obtenerToken, logout } from './utils.js';

const API = 'http://localhost:3000/api';
let empleadosCache = [];
let proveedoresCache = [];

// --- Headers con token fresco
function authHeaders(extra = {}) {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
    ...extra
  };
}

// --- Normalizar rol
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}
const ROLES_PERMITIDOS = new Set(['duenio', 'dueno']); // agregá 'admin' si hace falta

// --- Validar sesión
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

document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;

  const rolNorm = normalizarRol(usuario.rol);
  if (!ROLES_PERMITIDOS.has(rolNorm)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    window.location.href = 'dashboard.html';
    return;
  }

  // Cargas iniciales
  await cargarSelectEmpleados().then(cargarPagosEmpleados);
  await cargarSelectProveedores().then(cargarPagosProveedores);
  await cargarPagosImpuestos();
  await cargarOtrosPagos();

  // Listeners de formularios
  document.getElementById('formEmpleado')?.addEventListener('submit', onSubmitEmpleado);
  document.getElementById('formProveedor')?.addEventListener('submit', onSubmitProveedor);
  document.getElementById('formImpuesto')?.addEventListener('submit', onSubmitImpuesto);
  document.getElementById('formOtroPago')?.addEventListener('submit', onSubmitOtro);
});

// Logout desde botón
window.cerrarSesion = logout;

async function validarSaldoDisponible(caja_tipo, monto) {
  const res = await fetch(`${API}/finanzas/saldos`, { headers: authHeaders() });
  const data = await res.json();

  // Soporta ambas estructuras
  const fisica = data?.caja?.fisica ?? data?.fisica ?? 0;
  const virtual = data?.caja?.virtual ?? data?.virtual ?? 0;

  const saldo = caja_tipo === 'fisica' ? Number(fisica) : Number(virtual);
  return saldo >= monto;
}

async function cargarSelectEmpleados() {
  const res = await fetch(`${API}/lista-empleados`, { headers: authHeaders() });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
      window.location.href = 'login.html';
      return;
    }
    throw new Error('Error al obtener empleados');
  }
  const empleados = await res.json();
  empleadosCache = empleados;
  const select = document.getElementById('empleado');
  select.innerHTML = '';
  empleados.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.nombre;
    select.appendChild(opt);
  });
}

async function cargarSelectProveedores() {
  const res = await fetch(`${API}/lista-proveedores`, { headers: authHeaders() });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
      window.location.href = 'login.html';
      return;
    }
    throw new Error('Error al obtener proveedores');
  }
  const proveedores = await res.json();
  proveedoresCache = proveedores;
  const select = document.getElementById('proveedor');
  select.innerHTML = '';
  proveedores.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nombre;
    select.appendChild(opt);
  });
}

async function cargarPagosEmpleados() {
  const res = await fetch(`${API}/empleado`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#tablaEmpleados tbody');
  tbody.innerHTML = '';
  data.forEach(p => {
    const empleado = empleadosCache.find(e => String(e.id) === String(p.empleado_id));
    const entidad = empleado ? empleado.nombre : p.empleado || '';
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${p.id}</td>
      <td>${p.empleado}</td>
      <td>${entidad}</td>
      <td>${p.concepto || ''}</td>
      <td>$${parseFloat(p.monto).toFixed(2)}</td>
      <td>${p.fecha ? new Date(p.fecha).toLocaleDateString() : ''}</td>
      <td>${p.descripcion || ''}</td>`;
    tbody.appendChild(fila);
  });
}

async function cargarPagosProveedores() {
  const res = await fetch(`${API}/proveedor`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#tablaProveedores tbody');
  tbody.innerHTML = '';
  data.forEach(p => {
    const proveedor = proveedoresCache.find(e => String(e.id) === String(p.proveedor_id));
    const entidad = proveedor ? proveedor.nombre : p.proveedor || '';
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${p.id}</td>
      <td>${p.proveedor}</td>
      <td>${entidad}</td>
      <td>${p.concepto || ''}</td>
      <td>$${parseFloat(p.monto).toFixed(2)}</td>
      <td>${p.fecha ? new Date(p.fecha).toLocaleDateString() : ''}</td>
      <td>${p.descripcion || ''}</td>`;
    tbody.appendChild(fila);
  });
}

async function cargarPagosImpuestos() {
  const res = await fetch(`${API}/impuestos`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#tablaImpuestos tbody');
  tbody.innerHTML = '';
  data.forEach(p => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${p.id}</td>
      <td>${p.entidad || ''}</td>
      <td>${p.tipo || p.concepto || ''}</td>
      <td>$${parseFloat(p.monto).toFixed(2)}</td>
      <td>${p.fecha ? new Date(p.fecha).toLocaleDateString() : ''}</td>
      <td>${p.descripcion || ''}</td>`;
    tbody.appendChild(fila);
  });
}

async function cargarOtrosPagos() {
  const res = await fetch(`${API}/otros-pagos`, { headers: authHeaders() });
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.querySelector('#tablaOtros tbody');
  tbody.innerHTML = '';
  data.forEach(p => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${p.id}</td>
      <td>${p.entidad || ''}</td>
      <td>${p.concepto || ''}</td>
      <td>$${parseFloat(p.monto).toFixed(2)}</td>
      <td>${p.fecha ? new Date(p.fecha).toLocaleDateString() : ''}</td>
      <td>${p.descripcion || ''}</td>`;
    tbody.appendChild(fila);
  });
}

// ---------- Submit handlers ----------
async function onSubmitEmpleado(e) {
  e.preventDefault();
  const empleado_id = document.getElementById('empleado').value;
  const entidad = empleadosCache.find(emp => String(emp.id) === String(empleado_id))?.nombre || '';
  const concepto = document.getElementById('conceptoEmpleado').value;
  const monto = parseFloat(document.getElementById('montoEmpleado').value);
  const descripcion = document.getElementById('descripcionEmpleado').value;
  const caja_tipo = document.getElementById('cajaEmpleado').value;

  if (!await validarSaldoDisponible(caja_tipo, monto)) {
    return alert(`Saldo insuficiente en caja ${caja_tipo.toUpperCase()} para pagar $${monto}`);
  }

  const res = await fetch(`${API}/empleado`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ empleado_id, entidad, concepto, monto, descripcion, caja_tipo, fecha: new Date().toISOString() })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje || 'Pago registrado');
    e.target.reset();
    cargarPagosEmpleados();
  } else {
    alert(data.error || 'Error al registrar pago');
  }
}

async function onSubmitProveedor(e) {
  e.preventDefault();
  const proveedor_id = document.getElementById('proveedor').value;
  const entidad = proveedoresCache.find(p => String(p.id) === String(proveedor_id))?.nombre || '';
  const concepto = document.getElementById('conceptoProveedor').value;
  const monto = parseFloat(document.getElementById('montoProveedor').value);
  const descripcion = document.getElementById('descripcionProveedor').value;
  const caja_tipo = document.getElementById('cajaProveedor').value;

  if (!await validarSaldoDisponible(caja_tipo, monto)) {
    return alert(`Saldo insuficiente en caja ${caja_tipo.toUpperCase()} para pagar $${monto}`);
  }

  const res = await fetch(`${API}/proveedor`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ proveedor_id, entidad, concepto, monto, descripcion, caja_tipo, fecha: new Date().toISOString() })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje || 'Pago registrado');
    e.target.reset();
    cargarPagosProveedores();
  } else {
    alert(data.error || 'Error al registrar pago');
  }
}

async function onSubmitImpuesto(e) {
  e.preventDefault();
  const entidad = document.getElementById('entidadImpuesto').value;
  const concepto = document.getElementById('conceptoImpuesto').value;
  const monto = parseFloat(document.getElementById('montoImpuesto').value);
  const descripcion = document.getElementById('descripcionImpuesto').value;
  const caja_tipo = document.getElementById('cajaImpuesto').value;

  if (!await validarSaldoDisponible(caja_tipo, monto)) {
    return alert(`Saldo insuficiente en caja ${caja_tipo.toUpperCase()} para pagar $${monto}`);
  }

  const res = await fetch(`${API}/impuestos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entidad, concepto, monto, descripcion, caja_tipo })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje || 'Impuesto registrado');
    e.target.reset();
    cargarPagosImpuestos();
  } else {
    alert(data.error || 'Error al registrar impuesto');
  }
}

async function onSubmitOtro(e) {
  e.preventDefault();
  const entidad = document.getElementById('entidadOtro').value;
  const concepto = document.getElementById('conceptoOtro').value;
  const monto = parseFloat(document.getElementById('montoOtro').value);
  const descripcion = document.getElementById('descripcionOtro').value;
  const caja_tipo = document.getElementById('cajaOtro').value;

  if (!await validarSaldoDisponible(caja_tipo, monto)) {
    return alert(`Saldo insuficiente en caja ${caja_tipo.toUpperCase()} para pagar $${monto}`);
  }

  const res = await fetch(`${API}/otro-pago`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ entidad, concepto, monto, descripcion, caja_tipo })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje || 'Egreso registrado');
    e.target.reset();
    cargarOtrosPagos();
  } else {
    alert(data.error || 'Error al registrar egreso');
  }
}
