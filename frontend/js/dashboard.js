// ===== Config =====
const API = 'http://localhost:3000/api';

// ===== Helpers (sin módulos) =====
function getToken() {
  return localStorage.getItem('token') || '';
}
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + getToken()
  };
}
function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toast(msg) { try { alert(msg); } catch {} }
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

// ===== DOM =====
const estadoTexto = document.getElementById('estado-texto');
const btnAbrirCaja = document.getElementById('btn-abrir-caja');
const btnCerrarCaja = document.getElementById('btn-cerrar-caja');
const saldoFisicaEl = document.getElementById('saldo-fisica');
const saldoVirtualEl = document.getElementById('saldo-virtual');
const saldoTotalEl = document.getElementById('saldo-total');

const btnLogout = document.getElementById('btn-logout');

const modalCerrar = document.getElementById('modal-cerrar');
const confirmarCierreBtn = document.getElementById('confirmar-cierre');
const cancelarCierreBtn = document.getElementById('cancelar-cierre');
const montoFinalInput = document.getElementById('monto-final');

// ===== Eventos =====
document.addEventListener('DOMContentLoaded', () => {
  // Si no hay token, mandamos al login
  if (!getToken()) return logout();

  // Cargar info
  refreshEstadoYSaldos();
});

btnLogout.addEventListener('click', logout);

btnAbrirCaja.addEventListener('click', async () => {
  try {
    const r = await fetch(`${API}/caja/abrir`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tipo_caja: 'fisica' })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.mensaje || 'Error al abrir caja');
    toast(data.mensaje || 'Caja abierta');
    await refreshEstadoYSaldos();
  } catch (e) {
    toast(e.message);
  }
});

btnCerrarCaja.addEventListener('click', () => {
  // solo abre el modal
  modalCerrar.classList.remove('oculto');
  montoFinalInput.value = '';
  montoFinalInput.focus();
});

confirmarCierreBtn.addEventListener('click', async () => {
  const monto_final = Number(montoFinalInput.value || 0);
  if (isNaN(monto_final) || monto_final < 0) return toast('Ingrese un monto válido');

  try {
    const r = await fetch(`${API}/caja/cerrar`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ monto_final })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.mensaje || 'Error al cerrar caja');

    modalCerrar.classList.add('oculto');
    toast(data.mensaje || 'Caja cerrada');
    await refreshEstadoYSaldos();
  } catch (e) {
    toast(e.message);
  }
});

cancelarCierreBtn.addEventListener('click', () => {
  modalCerrar.classList.add('oculto');
  montoFinalInput.value = '';
});

// ===== Carga de datos =====
async function refreshEstadoYSaldos() {
  await Promise.all([cargarEstadoCaja(), cargarSaldos()]);
}

async function cargarEstadoCaja() {
  try {
    // Esta ruta debe existir en tu backend: GET /api/caja/estado
    const r = await fetch(`${API}/caja/estado`, { headers: authHeaders() });
    const data = await r.json();

    if (!r.ok) throw new Error(data.mensaje || 'No se pudo obtener estado de caja');

    if (data.abierta) {
      estadoTexto.textContent = `Caja física: ABIERTA`;
      btnAbrirCaja.classList.add('oculto');
      btnCerrarCaja.classList.remove('oculto');
    } else {
      estadoTexto.textContent = `Caja física: CERRADA`;
      btnAbrirCaja.classList.remove('oculto');
      btnCerrarCaja.classList.add('oculto');
    }
  } catch (e) {
    console.error('Estado caja:', e);
    estadoTexto.textContent = 'Error al verificar caja';
    btnAbrirCaja.classList.add('oculto');
    btnCerrarCaja.classList.add('oculto');
  }
}

async function cargarSaldos() {
  try {
    // GET /api/finanzas/saldos (tal como ya usan caja/finanzas y funciona)
    const r = await fetch(`${API}/finanzas/saldos`, { headers: authHeaders() });
    const data = await r.json();
    if (!r.ok || data == null) throw new Error(data?.mensaje || 'No se pudo obtener saldos');

    saldoFisicaEl.textContent = fmt(data.caja?.fisica);
    saldoVirtualEl.textContent = fmt(data.caja?.virtual);
    saldoTotalEl.textContent = fmt(data.total);
  } catch (e) {
    console.error('Saldos:', e);
    saldoFisicaEl.textContent = '0,00';
    saldoVirtualEl.textContent = '0,00';
    saldoTotalEl.textContent = '0,00';
  }
}
