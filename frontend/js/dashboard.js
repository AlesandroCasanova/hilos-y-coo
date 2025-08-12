// ===== Config =====
const API = 'http://localhost:3000/api';
const UMBRAL_ALERTA = 2; // Notificar si stock <= 2

// ===== Helpers (sin módulos) =====
function getToken() {
  return localStorage.getItem('token') || '';
}
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
}
function authHeaders(extra = {}) {
  return { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json', ...extra };
}
function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function normalizarRol(rol) {
  return String(rol || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase(); // "Dueño" -> "dueno"
}
function logout() {
  clearSession();
  window.location.href = 'login.html';
}
function alertAndRedirect(msg, href) {
  alert(msg);
  window.location.href = href;
}

// ===== DOM refs =====
const estadoTexto = document.getElementById('estado-texto');
const btnAbrirCaja = document.getElementById('btn-abrir-caja');
const btnCerrarCaja = document.getElementById('btn-cerrar-caja');
const saldoFisicaEl = document.getElementById('saldo-fisica');
const saldoVirtualEl = document.getElementById('saldo-virtual');
const saldoTotalEl = document.getElementById('saldo-total');

const saldoWrap    = document.getElementById('saldos-wrap');
const fisicaWrap   = document.getElementById('saldo-fisica-wrap');
const virtualWrap  = document.getElementById('saldo-virtual-wrap');
const totalWrap    = document.getElementById('saldo-total-wrap');
const div1         = document.getElementById('saldo-div-1');
const div2         = document.getElementById('saldo-div-2');

const btnLogout = document.getElementById('btn-logout');
const modalCerrar = document.getElementById('modal-cerrar');
const confirmarCierreBtn = document.getElementById('confirmar-cierre');
const cancelarCierreBtn = document.getElementById('cancelar-cierre');
const montoFinalInput = document.getElementById('monto-final');
const spanUsuario = document.getElementById('usuario-logueado');
const grid = document.getElementById('menu-grid');

// Notificaciones
const notifBell   = document.getElementById('notif-bell');
const notifPanel  = document.getElementById('notif-panel');
const notifBadge  = document.getElementById('notif-badge');
const notifList   = document.getElementById('notif-list');
const notifEmpty  = document.getElementById('notif-empty');
const notifRefresh= document.getElementById('notif-refresh');

// ===== Menú (se filtra por rol) =====
const MENU = [
  { href: 'catalogo.html',     label: 'Catálogo',              icon: '🗂️', roles: ['dueno','duenio','admin','empleado'] },
  { href: 'productos.html',    label: 'Productos',             icon: '📦', roles: ['dueno','duenio','admin','empleado'] },
  { href: 'inventario.html',   label: 'Inventario',            icon: '📋', roles: ['dueno','duenio','admin','empleado'] },
  { href: 'carrito.html',      label: 'Carrito',               icon: '🛒', roles: ['dueno','duenio','admin','empleado'] },
  { href: 'ventas.html',       label: 'Ventas',                icon: '💳', roles: ['dueno','duenio','admin','empleado'] },
  { href: 'devoluciones.html', label: 'Devoluciones',          icon: '↩️', roles: ['dueno','duenio','admin','empleado'] },

  { href: 'caja.html',         label: 'Caja (diario)',         icon: '💼', roles: ['dueno','duenio','admin'] },
  { href: 'finanzas.html',     label: 'Finanzas',              icon: '📈', roles: ['dueno','duenio','admin'] },

  { href: 'empleados.html',    label: 'Empleados',             icon: '👥', roles: ['dueno','duenio','admin'] },
  { href: 'pedidos.html',      label: 'Pedidos a Proveedores', icon: '🧾', roles: ['dueno','duenio','admin'] },
  { href: 'pagos.html',        label: 'Pagos',                 icon: '💵', roles: ['dueno','duenio','admin'] },
];

// ===== Validación de sesión (solo “logueado”, no valida rol) =====
async function validarSesion() {
  const token = getToken();
  if (!token) {
    alertAndRedirect('Acceso denegado: iniciá sesión para continuar.', 'login.html');
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    return data.usuario;
  } catch (e) {
    console.error('validarSesion:', e);
    clearSession();
    alertAndRedirect('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.', 'login.html');
    return null;
  }
}

// ===== Render de menú por rol =====
function renderMenu(rol) {
  const rolNorm = normalizarRol(rol);
  grid.innerHTML = '';

  const items = MENU.filter(it => it.roles.includes(rolNorm));
  const finalItems = items.length ? items : MENU.filter(it => it.roles.includes('empleado'));

  finalItems.forEach(({ href, label, icon }) => {
    const a = document.createElement('a');
    a.href = href;
    a.className = 'menu-btn';
    a.innerHTML = `<span class="icon">${icon}</span><span class="text">${label}</span>`;
    grid.appendChild(a);
  });
}

// ===== Saldos visibles por rol =====
function configurarSaldosPorRol(rol) {
  const rolNorm = normalizarRol(rol);
  const esEmpleado = rolNorm === 'empleado';

  [virtualWrap, totalWrap, div1, div2].forEach(el => el?.classList.remove('oculto'));
  saldoWrap?.classList.remove('solo-fisica');

  if (esEmpleado) {
    [virtualWrap, totalWrap, div1, div2].forEach(el => el?.classList.add('oculto'));
    saldoWrap?.classList.add('solo-fisica');
  }
}

// ===== Eventos base =====
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
    alert(data.mensaje || 'Caja abierta');
    await refreshEstadoYSaldos();
  } catch (e) {
    alert(e.message);
  }
});

btnCerrarCaja.addEventListener('click', () => {
  modalCerrar.classList.remove('oculto');
  montoFinalInput.value = '';
  montoFinalInput.focus();
});

confirmarCierreBtn.addEventListener('click', async () => {
  const monto_final = Number(montoFinalInput.value || 0);
  if (isNaN(monto_final) || monto_final < 0) return alert('Ingrese un monto válido');

  try {
    const r = await fetch(`${API}/caja/cerrar`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ monto_final })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.mensaje || 'Error al cerrar caja');
    modalCerrar.classList.add('oculto');
    alert(data.mensaje || 'Caja cerrada');
    await refreshEstadoYSaldos();
  } catch (e) {
    alert(e.message);
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

// ===== Notificaciones (stock bajo) =====
function mapInventarioRow(v){
  return {
    variante_id: Number(v.id ?? v.variante_id),
    producto_id: Number(v.producto_id ?? v.p_id ?? v.productoId),
    nombre: v.producto_nombre || v.nombre || v.nombre_producto || 'Producto',
    codigo: v.codigo || v.p_codigo || '',
    color: v.color || '',
    talle: v.talle || '',
    stock: Number(v.stock ?? 0),
    activo: v.activo ?? 1
  };
}

async function cargarNotificacionesStockBajo(){
  const token = getToken();
  if (!token) return;
  try{
    const r = await fetch(`${API}/inventario`, { headers:{ Authorization:'Bearer '+token }});
    if(!r.ok) throw new Error('No se pudo obtener inventario');
    const data = await r.json();

    const variantes = (Array.isArray(data) ? data : []).map(mapInventarioRow);
    const bajos = variantes.filter(v => (v.activo ?? 1) && v.stock <= UMBRAL_ALERTA);

    renderNotifs(bajos);
  }catch(err){
    console.error('Notificaciones:', err);
    renderNotifs([]);
  }
}

function renderNotifs(items){
  // Badge
  const n = items.length;
  if (n > 0){
    notifBadge.textContent = String(n);
    notifBadge.style.display = '';
  } else {
    notifBadge.style.display = 'none';
  }

  // Lista
  notifList.innerHTML = '';
  if (n === 0){
    notifEmpty.classList.remove('oculto');
    return;
  }
  notifEmpty.classList.add('oculto');

  items.forEach(v => {
    const msg = `Stock bajo de ${v.nombre}${v.color ? ' – ' + v.color.toLowerCase() : ''}${v.talle ? ' / ' + v.talle : ''}`;
    const el = document.createElement('div');
    el.className = 'item';
    el.innerHTML = `
      <div>
        <div class="msg">${msg}</div>
        <div class="meta">Variante #${v.variante_id}${v.codigo ? ` · Código: ${v.codigo}` : ''}</div>
      </div>
      <div class="qty">(${fmtInt(v.stock)})</div>
    `;
    notifList.appendChild(el);
  });
}

function toggleNotifPanel(force){
  const shouldOpen = (typeof force === 'boolean') ? force : notifPanel.classList.contains('oculto');
  if (shouldOpen) notifPanel.classList.remove('oculto');
  else notifPanel.classList.add('oculto');
}

function wireNotifs(){
  // Abrir/cerrar panel
  notifBell?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifPanel();
  });
  // Refrescar
  notifRefresh?.addEventListener('click', (e) => {
    e.stopPropagation();
    cargarNotificacionesStockBajo();
  });
  // Cerrar con click afuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.notif-wrap')) {
      notifPanel?.classList.add('oculto');
    }
  });
  // Cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') notifPanel?.classList.add('oculto');
  });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  // Validación de usuario logueado (sin validar rol Dueño)
  const usuario = await validarSesion();
  if (!usuario) return; // alert + redirect ya aplicados

  // Completar nombre y rol visibles
  if (spanUsuario) spanUsuario.textContent = `${usuario.nombre} (${usuario.rol})`;

  // Render de la botonera según rol
  renderMenu(usuario.rol);

  // Configurar visibilidad de saldos según rol
  configurarSaldosPorRol(usuario.rol);

  // Cargar info de caja y saldos
  await refreshEstadoYSaldos();

  // Notificaciones
  wireNotifs();
  await cargarNotificacionesStockBajo();
  setInterval(cargarNotificacionesStockBajo, 60000);
});
