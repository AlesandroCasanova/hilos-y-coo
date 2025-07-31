import { obtenerToken, logout } from './utils.js';

const API = 'http://localhost:3000/api';
const token = obtenerToken();
let empleadosCache = [];
let proveedoresCache = [];

document.addEventListener('DOMContentLoaded', () => {
  cargarSelectEmpleados().then(cargarPagosEmpleados);
  cargarSelectProveedores().then(cargarPagosProveedores);
  cargarPagosImpuestos();
  cargarOtrosPagos();
});

window.cerrarSesion = logout;

async function validarSaldoDisponible(caja_tipo, monto) {
  const res = await fetch(`${API}/finanzas/saldos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const saldo = caja_tipo === 'fisica' ? Number(data.fisica || 0) : Number(data.virtual || 0);
  return saldo >= monto;
}

async function cargarSelectEmpleados() {
  const res = await fetch(`${API}/lista-empleados`, { headers: { Authorization: `Bearer ${token}` } });
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
  const res = await fetch(`${API}/lista-proveedores`, { headers: { Authorization: `Bearer ${token}` } });
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
  const res = await fetch(`${API}/empleado`, { headers: { Authorization: `Bearer ${token}` } });
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
  const res = await fetch(`${API}/proveedor`, { headers: { Authorization: `Bearer ${token}` } });
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
  const res = await fetch(`${API}/impuestos`, { headers: { Authorization: `Bearer ${token}` } });
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
  const res = await fetch(`${API}/otros-pagos`, { headers: { Authorization: `Bearer ${token}` } });
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

document.getElementById('formEmpleado').addEventListener('submit', async (e) => {
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ empleado_id, entidad, concepto, monto, descripcion, caja_tipo, fecha: new Date().toISOString() })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje);
    e.target.reset();
    cargarPagosEmpleados();
  } else {
    alert(data.error || 'Error al registrar pago');
  }
});

document.getElementById('formProveedor').addEventListener('submit', async (e) => {
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ proveedor_id, entidad, concepto, monto, descripcion, caja_tipo, fecha: new Date().toISOString() })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje);
    e.target.reset();
    cargarPagosProveedores();
  } else {
    alert(data.error || 'Error al registrar pago');
  }
});

document.getElementById('formImpuesto').addEventListener('submit', async (e) => {
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ entidad, concepto, monto, descripcion, caja_tipo })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje);
    e.target.reset();
    cargarPagosImpuestos();
  } else {
    alert(data.error || 'Error al registrar impuesto');
  }
});

document.getElementById('formOtroPago').addEventListener('submit', async (e) => {
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ entidad, concepto, monto, descripcion, caja_tipo })
  });

  const data = await res.json();
  if (res.ok) {
    alert(data.mensaje);
    e.target.reset();
    cargarOtrosPagos();
  } else {
    alert(data.error || 'Error al registrar egreso');
  }
});
