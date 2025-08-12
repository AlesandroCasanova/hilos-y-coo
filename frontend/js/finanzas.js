// js/finanzas.js
import { obtenerToken } from './utils.js';

const API = 'http://localhost:3000/api';

// --- Helpers: headers con token fresco
function authHeaders() {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}

// --- Normalizar rol (quita tildes, case, espacios)
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();
}
const ROLES_PERMITIDOS = new Set(['duenio', 'dueno']); // agregar 'admin' si querés

// --- Validar sesión: alerta y redirect si no hay token o es inválido
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
  // Guard de sesión
  const usuario = await validarSesion();
  if (!usuario) return;

  // Guard de rol
  const rolNorm = normalizarRol(usuario.rol);
  if (!ROLES_PERMITIDOS.has(rolNorm)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    window.location.href = 'dashboard.html';
    return;
  }

  // UI inicial
  setHoySemana();
  await cargarSaldos();

  // Tabs
  document.getElementById('tab-caja')?.addEventListener('click', () => toggleTab('caja'));
  document.getElementById('tab-reservas')?.addEventListener('click', () => toggleTab('reservas'));

  document.getElementById('c-buscar')?.addEventListener('click', buscarCaja);
  document.getElementById('r-buscar')?.addEventListener('click', buscarReservas);

  // Primera carga
  await buscarCaja();
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
    const res = await fetch(`${API}/finanzas/saldos`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al obtener saldos');
    }
    const data = await res.json();

    // Soporta ambas formas: {caja:{fisica,virtual}, reservas:{...}, total} o {fisica,virtual}
    const fisica = data?.caja?.fisica ?? data?.fisica ?? 0;
    const virtual = data?.caja?.virtual ?? data?.virtual ?? 0;
    const rFisica = data?.reservas?.fisica ?? data?.reservasFisica ?? 0;
    const rVirtual = data?.reservas?.virtual ?? data?.reservasVirtual ?? 0;
    const total = data?.total ?? (fisica + virtual + rFisica + rVirtual);

    setText('saldo-fisica', fisica);
    setText('saldo-virtual', virtual);
    setText('reservas-fisica', rFisica);
    setText('reservas-virtual', rVirtual);
    setText('balance-total', total);
  } catch (e) {
    console.error('cargarSaldos:', e);
  }
}

async function buscarCaja() {
  const desde = document.getElementById('c-desde').value;
  const hasta = document.getElementById('c-hasta').value;
  const cuenta = document.getElementById('c-cuenta').value;
  const tipo = document.getElementById('c-tipo').value;

  const qs = new URLSearchParams({ desde, hasta, cuenta, tipo }).toString();
  try {
    const res = await fetch(`${API}/finanzas/movimientos?${qs}`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al obtener movimientos de caja');
    }
    const rows = await res.json();
    renderCaja(rows);
  } catch (e) {
    console.error('buscarCaja:', e);
  }
}

async function buscarReservas() {
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;
  const tipo = document.getElementById('r-tipo').value;
  const movimiento = document.getElementById('r-mov').value;

  const qs = new URLSearchParams({ desde, hasta, tipo, movimiento }).toString();
  try {
    const res = await fetch(`${API}/finanzas/reservas?${qs}`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al obtener reservas');
    }
    const rows = await res.json();
    renderReservas(rows);
  } catch (e) {
    console.error('buscarReservas:', e);
  }
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
