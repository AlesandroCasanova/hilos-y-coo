import { obtenerToken } from './utils.js';

const token = obtenerToken();
const API = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
  cargarProveedores();
  cargarPedidos();
  document.getElementById('form-pedido').addEventListener('submit', registrarPedido);
  document.getElementById('form-pago').addEventListener('submit', enviarPagoDetallado);
  document.getElementById('fuentes_pago').addEventListener('change', actualizarDistribucion);
});

// ---------- CARGAR PROVEEDORES ----------
async function cargarProveedores() {
  try {
    const res = await fetch(`${API}/proveedores`, {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('Error al obtener proveedores');
    const data = await res.json();

    const select = document.getElementById('proveedor');
    data.forEach(prov => {
      const option = document.createElement('option');
      option.value = prov.id;
      option.textContent = prov.nombre;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
  }
}

// ---------- REGISTRAR PEDIDO ----------
async function registrarPedido(e) {
  e.preventDefault();

  const form = document.getElementById('form-pedido');
  const formData = new FormData(form);

  const fechaInput = form.querySelector('input[name="fecha_pedido"]');
  const fecha = new Date(fechaInput.value);
  const fechaMysql = fecha.toISOString().split('T')[0];
  formData.set('fecha_pedido', fechaMysql);

  try {
    const res = await fetch(`${API}/pedidos`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData
    });

    if (!res.ok) throw new Error('No se pudo registrar el pedido');

    alert('Pedido registrado correctamente');
    form.reset();
    cargarPedidos();
  } catch (error) {
    console.error('Error al registrar pedido:', error);
    alert('Error al registrar pedido');
  }
}

// ---------- CARGAR PEDIDOS ----------
async function cargarPedidos() {
  try {
    const res = await fetch(`${API}/pedidos`, {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('Error al obtener pedidos');
    const pedidos = await res.json();
    mostrarPedidos(pedidos);
  } catch (error) {
    console.error('Error al cargar pedidos:', error);
  }
}

function mostrarPedidos(pedidos) {
  const tbody = document.getElementById('tabla-pedidos');
  tbody.innerHTML = '';

  let deudaTotal = 0;

  pedidos.forEach(pedido => {
    const monto = Number(pedido.monto_total || 0);
    const pagado = Number(pedido.total_pagado || 0);
    const falta = monto - pagado;
    deudaTotal += falta;

    const venc1 = sumarDias(pedido.fecha, 30);
    const venc2 = sumarDias(pedido.fecha, 60);
    const dias1 = diasRestantes(venc1);
    const dias2 = diasRestantes(venc2);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${pedido.proveedor_nombre}</td>
      <td>${formatearFecha(pedido.fecha)}</td>
      <td>$${monto.toFixed(2)}</td>
      <td>$${pagado.toFixed(2)}</td>
      <td>$${falta.toFixed(2)}</td>
      <td>${formatearFecha(venc1)}</td>
      <td>${dias1} días</td>
      <td>${formatearFecha(venc2)}</td>
      <td>${dias2} días</td>
      <td>${pedido.estado}</td>
      <td>
        <button onclick="abrirPago(${pedido.id}, ${falta})">Pagar</button>
        <button onclick="verHistorial(${pedido.id})">Historial</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('total-deuda').textContent = deudaTotal.toFixed(2);
}

// ---------- FUNCIONES AUXILIARES ----------
function formatearFecha(fechaStr) {
  const f = new Date(fechaStr);
  return f.toLocaleDateString('es-AR');
}

function sumarDias(fechaStr, dias) {
  const f = new Date(fechaStr);
  if (isNaN(f)) return new Date(); // fallback
  f.setDate(f.getDate() + dias);
  return f;
}

function diasRestantes(fecha) {
  const hoy = new Date();
  const diff = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

// ---------- MODAL DE PAGO DETALLADO ----------
window.abrirPago = function (pedido_id, maximo) {
  document.getElementById('pedido_id').value = pedido_id;
  document.getElementById('monto_total_pago').value = maximo.toFixed(2);
  document.getElementById('fuentes_pago').selectedIndex = -1;
  document.getElementById('distribucion').innerHTML = '';
  document.getElementById('modal-pago').style.display = 'flex';
};

function cerrarModal() {
  document.getElementById('modal-pago').style.display = 'none';
}

// ---------- ACTUALIZAR CAMPOS DE DISTRIBUCIÓN ----------
function actualizarDistribucion() {
  const seleccionadas = Array.from(document.getElementById('fuentes_pago').selectedOptions).map(opt => opt.value);
  const contenedor = document.getElementById('distribucion');
  contenedor.innerHTML = '';

  if (seleccionadas.length <= 1) return;

  seleccionadas.forEach(fuente => {
    const label = document.createElement('label');
    label.textContent = `Monto desde ${fuente.replace('_', ' ')}:`;
    const input = document.createElement('input');
    input.type = 'number';
    input.name = `monto_${fuente}`;
    input.min = 0;
    input.required = true;
    contenedor.appendChild(label);
    contenedor.appendChild(input);
  });
}

// ---------- ENVIAR PAGO DETALLADO ----------
async function enviarPagoDetallado(e) {
  e.preventDefault();

  const pedido_id = document.getElementById('pedido_id').value;
  const monto_total = parseFloat(document.getElementById('monto_total_pago').value);
  const fuentes = Array.from(document.getElementById('fuentes_pago').selectedOptions).map(opt => opt.value);
  const detalles = {};

  if (fuentes.length === 0) return alert('Debés seleccionar al menos una fuente de pago');

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
    if (suma.toFixed(2) != monto_total.toFixed(2)) {
      return alert('La suma de los montos no coincide con el total a pagar');
    }
  }

  try {
    const res = await fetch(`${API}/pedidos/pago-detallado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ pedido_id, monto_total, detalles })
    });

    if (!res.ok) throw new Error('Error al registrar pago');
    alert('Pago registrado correctamente');
    cerrarModal();
    cargarPedidos();
  } catch (error) {
    console.error(error);
    alert('No se pudo registrar el pago');
  }
}

// ---------- VER HISTORIAL DE PAGOS ----------
window.verHistorial = async function (pedido_id) {
  try {
    const res = await fetch(`${API}/historial/${pedido_id}`, {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!res.ok) throw new Error('No se pudo obtener el historial');

    const historial = await res.json();
    const tbody = document.getElementById('tabla-historial');
    tbody.innerHTML = '';

    historial.forEach(pago => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatearFecha(pago.fecha)}</td>
        <td>$${parseFloat(pago.monto).toFixed(2)}</td>
        <td>${pago.fuente || '-'}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('modal-historial').style.display = 'flex';
  } catch (error) {
    console.error(error);
    alert('Error al cargar historial de pagos');
  }
};

// ----------- CERRAR MODAL DE HISTORIAL -----------
function cerrarModalHistorial() {
  const modal = document.getElementById('modal-historial');
  modal.style.display = 'none';
}

window.cerrarModalHistorial = cerrarModalHistorial;
window.cerrarModal = cerrarModal;
