import { obtenerToken } from './utils.js';
const API = 'http://localhost:3000/api';
const token = obtenerToken();
const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-fecha').value = new Date().toISOString().slice(0,10);
  document.getElementById('btn-buscar').addEventListener('click', cargarMovimientos);
  cargarSaldos();
  cargarMovimientos();
});

async function cargarSaldos() {
  try {
    const res = await fetch(`${API}/finanzas/saldos`, { headers });
    const data = await res.json();
    setMonto('saldo-fisica', data.caja.fisica);
    setMonto('saldo-virtual', data.caja.virtual);
    setMonto('balance-total', data.total);
  } catch (e) { console.error(e); }
}

async function cargarMovimientos() {
  const fecha = document.getElementById('f-fecha').value;
  const cuenta = document.getElementById('f-cuenta').value;

  const params = new URLSearchParams({ fecha, cuenta });
  try {
    const res = await fetch(`${API}/caja/movimientos?` + params.toString(), { headers });
    const data = await res.json();
    renderTabla(data);
  } catch (e) { console.error(e); }
}

function renderTabla(rows) {
  const tbody = document.getElementById('tabla-movs');
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
      <td class="${r.signo > 0 ? 'ingreso' : 'egreso'}">${r.tipo}</td>
      <td class="${r.signo > 0 ? 'ingreso' : 'egreso'}">$${format(r.monto)}</td>
      <td>${r.descripcion || ''}</td>
      <td>${r.referencia_tipo || ''} ${r.referencia_id || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setMonto(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = '$'+format(val);
}
function format(n) {
  return Number(n||0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFecha(f) {
  try { return new Date(f).toLocaleString('es-AR'); } catch { return f; }
}
