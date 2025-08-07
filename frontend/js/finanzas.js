import { obtenerToken } from './utils.js';
const API = 'http://localhost:3000/api';
const token = obtenerToken();
const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

document.addEventListener('DOMContentLoaded', () => {
  setHoySemana();
  cargarSaldos();

  // Tabs
  document.getElementById('tab-caja').addEventListener('click', () => toggleTab('caja'));
  document.getElementById('tab-reservas').addEventListener('click', () => toggleTab('reservas'));

  document.getElementById('c-buscar').addEventListener('click', buscarCaja);
  document.getElementById('r-buscar').addEventListener('click', buscarReservas);

  buscarCaja();
});

function setHoySemana() {
  const hoy = new Date();
  const siete = new Date(hoy); siete.setDate(hoy.getDate() - 7);
  document.getElementById('c-desde').value = siete.toISOString().slice(0,10);
  document.getElementById('c-hasta').value = hoy.toISOString().slice(0,10);
  document.getElementById('r-desde').value = siete.toISOString().slice(0,10);
  document.getElementById('r-hasta').value = hoy.toISOString().slice(0,10);
}

async function cargarSaldos() {
  try {
    const res = await fetch(`${API}/finanzas/saldos`, { headers });
    const data = await res.json();
    setText('saldo-fisica', data.caja.fisica);
    setText('saldo-virtual', data.caja.virtual);
    setText('reservas-fisica', data.reservas.fisica);
    setText('reservas-virtual', data.reservas.virtual);
    setText('balance-total', data.total);
  } catch (e) { console.error(e); }
}

async function buscarCaja() {
  const desde = document.getElementById('c-desde').value;
  const hasta = document.getElementById('c-hasta').value;
  const cuenta = document.getElementById('c-cuenta').value;
  const tipo = document.getElementById('c-tipo').value;

  const qs = new URLSearchParams({ desde, hasta, cuenta, tipo }).toString();
  try {
    const res = await fetch(`${API}/finanzas/movimientos?${qs}`, { headers });
    const rows = await res.json();
    renderCaja(rows);
  } catch (e) { console.error(e); }
}

async function buscarReservas() {
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;
  const tipo = document.getElementById('r-tipo').value;
  const movimiento = document.getElementById('r-mov').value;

  const qs = new URLSearchParams({ desde, hasta, tipo, movimiento }).toString();
  try {
    const res = await fetch(`${API}/finanzas/reservas?${qs}`, { headers });
    const rows = await res.json();
    renderReservas(rows);
  } catch (e) { console.error(e); }
}

function renderCaja(rows) {
  const tbody = document.getElementById('caja-rows');
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8">Sin movimientos</td></tr>`;
    return;
  }
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatFecha(r.fecha)}</td>
      <td>${r.cuenta === 'caja_fisica' ? 'Física' : 'Virtual'}</td>
      <td class="${r.signo > 0 ? 'ingreso':'egreso'}">${r.tipo}</td>
      <td class="${r.signo > 0 ? 'ingreso':'egreso'}">$${format(r.monto)}</td>
      <td>${r.descripcion || ''}</td>
      <td>${r.referencia_tipo || ''} ${r.referencia_id || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderReservas(rows) {
  const tbody = document.getElementById('reservas-rows');
  tbody.innerHTML = '';
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#94a3b8">Sin movimientos</td></tr>`;
    return;
  }
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatFecha(r.fecha)}</td>
      <td>${r.tipo === 'fisica' ? 'Física' : 'Virtual'}</td>
      <td class="${r.movimiento === 'alta' ? 'ingreso' : 'egreso'}">${r.movimiento}</td>
      <td class="${r.movimiento === 'alta' ? 'ingreso' : 'egreso'}">$${format(r.monto)}</td>
      <td>${r.descripcion || ''}</td>
      <td>${r.referencia_tipo || ''} ${r.referencia_id || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleTab(which) {
  document.getElementById('tab-caja').classList.toggle('active', which === 'caja');
  document.getElementById('tab-reservas').classList.toggle('active', which === 'reservas');
  document.getElementById('tabla-caja').classList.toggle('oculto', which !== 'caja');
  document.getElementById('filtros-caja').classList.toggle('oculto', which !== 'caja');
  document.getElementById('tabla-reservas').classList.toggle('oculto', which !== 'reservas');
  document.getElementById('filtros-reservas').classList.toggle('oculto', which !== 'reservas');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = '$' + format(val);
}
function format(n) {
  return Number(n||0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFecha(f) {
  try { return new Date(f).toLocaleString('es-AR'); } catch { return f; }
}
