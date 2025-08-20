// js/caja.js
import { obtenerToken } from './utils.js';

const API = 'http://localhost:3000/api';

// --- Helpers de auth: siempre tomar token fresco
function authHeaders() {
  const token = obtenerToken();
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token
  };
}

// --- Normalizador de rol (quita tildes, espacios, mayúsculas)
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos (Dueño -> Dueno)
    .trim()
    .toLowerCase();
}

// Solo puede entrar el dueño (aceptamos ambas variantes)
const ROLES_PERMITIDOS_CAJA = new Set(['duenio', 'dueno']); // sumá 'admin' si querés

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Validación de sesión por token con ALERT si no hay o es inválido
  const usuario = await validarSesion(); // muestra alert y redirige si falla
  if (!usuario) return;

  // 2) Verificación de rol con ALERT si no es dueño
  const rolNorm = normalizarRol(usuario.rol);
  if (!ROLES_PERMITIDOS_CAJA.has(rolNorm)) {
    alert('Acceso denegado: esta sección es solo para el Dueño.');
    window.location.href = 'dashboard.html';
    return;
  }

  // 3) Mostrar usuario logueado en el header (si existiera el span)
  const span = document.getElementById('usuario-logueado');
  if (span) span.textContent = `${usuario.nombre} (${usuario.rol})`;

  // 4) Inicializar UI y cargar datos
  initEventos();
  await cargarSaldos();
  await cargarMovimientos();
});

// ---- Verificación de sesión: usa /api/usuarios/me y muestra alert si falla
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
    console.error('validarSesion:', e);
    // limpiar storage por si quedó algo viejo
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

function initEventos() {
  const hoy = new Date().toISOString().slice(0,10);
  const inputFecha = document.getElementById('f-fecha');
  if (inputFecha) inputFecha.value = hoy;

  const btnBuscar = document.getElementById('btn-buscar');
  if (btnBuscar) btnBuscar.addEventListener('click', cargarMovimientos);
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

    // Estructura esperada: { caja: { fisica, virtual }, total }
    setMonto('saldo-fisica', data?.caja?.fisica);
    setMonto('saldo-virtual', data?.caja?.virtual);
    setMonto('balance-total', data?.total);
  } catch (e) {
    console.error('cargarSaldos:', e);
  }
}

async function cargarMovimientos() {
  const fecha = document.getElementById('f-fecha')?.value || '';
  const cuenta = document.getElementById('f-cuenta')?.value || '';

  const params = new URLSearchParams({ fecha, cuenta });

  try {
    const res = await fetch(`${API}/caja/movimientos?${params.toString()}`, { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        alert('Tu sesión no es válida. Iniciá sesión nuevamente.');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al obtener movimientos');
    }
    const data = await res.json();
    renderTabla(data);
  } catch (e) {
    console.error('cargarMovimientos:', e);
  }
}

function renderTabla(rows) {
  const tbody = document.getElementById('tabla-movs');
  if (!tbody) return;

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
      <td class="num ${r.signo > 0 ? 'ingreso' : 'egreso'}">$${format(r.monto)}</td>
      <td>${r.descripcion || ''}</td>
      <td>${r.referencia_tipo || ''} ${r.referencia_id || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function setMonto(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = '$' + format(val);
}
function format(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatFecha(f) {
  try { return new Date(f).toLocaleString('es-AR'); } catch { return f; }
}
