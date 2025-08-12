// js/devoluciones.js
const API = 'http://localhost:3000/api';

// ===== Helpers =====
function getToken(){ return localStorage.getItem('token') || ''; }
function clearSession(){ localStorage.removeItem('token'); localStorage.removeItem('usuario'); }
function authHeaders(extra = {}){ return { Authorization: 'Bearer ' + getToken(), 'Content-Type':'application/json', ...extra }; }
function fmt(n){ return Number(n || 0).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function logout(){ clearSession(); window.location.href = 'login.html'; }
function alertRedirect(msg, href){ alert(msg); window.location.href = href; }
function byId(id){ return document.getElementById(id); }

// ===== DOM refs =====
const spanUsuario  = byId('usuario-logueado');
const btnLogout    = byId('btn-logout');
const ventaInput   = byId('venta-id');
const btnBuscar    = byId('btn-buscar');
const ventaResumen = byId('venta-resumen');
const ventaTotal   = byId('venta-total');
const hintItems    = byId('hint-items');
const tablaWrap    = byId('tabla-wrap');
const tbody        = byId('items-body');
const chkVigente   = byId('chk-precio-vigente');
const sumDevEl     = byId('sum-devuelto');
const sumEntEl     = byId('sum-entregado');
const sumNetoEl    = byId('sum-neto');
const motivoInput  = byId('motivo');
const btnConfirmar = byId('btn-confirmar');

// Modal ventas
const modalVentas  = byId('modal-ventas');
const mvenCerrar   = byId('mven-cerrar');
const mvenBuscar   = byId('mven-buscar');
const mvenRows     = byId('mven-rows');
const btnAbrirModalVentas = byId('btn-abrir-modal-ventas');

// Modal variantes
const modalVar       = byId('modal-variantes');
const mvarCerrar     = byId('mvar-cerrar');
const mvarBuscarProd = byId('mvar-buscar-prod');
const mvarRecargar   = byId('mvar-recargar-prod');
const mvarRowsProd   = byId('mvar-rows-prod');
const mvarRowsVar    = byId('mvar-rows-var');
const mvarSeleccion  = byId('mvar-seleccion');
const mvarUsar       = byId('mvar-usar');

// ===== Estado global =====
let USUARIO = null;
let VENTA = null;          // { id, fecha, total, ... }
let ITEMS = [];            // ítems de la venta enriquecidos

let HIST_VENTAS = [];      // cache del historial para el modal
let PRODUCTOS = [];        // cache de productos para modal variantes
let VARIANTES = [];        // cache de variantes del producto activo
let MODAL_ITEM_IDX = null; // fila sobre la que se abrió el modal de variantes
let PRODUCTO_SELEC = null; // producto seleccionado en modal {id, nombre, precio}
let VARIANTE_SELEC = null; // variante seleccionada en modal {id, talle, color, stock}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  const usuario = await validarSesion();
  if (!usuario) return;
  USUARIO = usuario;
  spanUsuario.textContent = `${usuario.nombre} (${usuario.rol})`;

  // Listeners
  btnLogout?.addEventListener('click', logout);
  btnBuscar?.addEventListener('click', buscarVenta);
  chkVigente?.addEventListener('change', recalcResumen);
  btnConfirmar?.addEventListener('click', confirmar);
  ventaInput?.addEventListener('keydown', e => { if (e.key === 'Enter') btnBuscar.click(); });

  // Modal ventas
  btnAbrirModalVentas?.addEventListener('click', openVentasModal);
  mvenCerrar?.addEventListener('click', () => modalVentas.classList.remove('abierto'));
  mvenBuscar?.addEventListener('input', renderVentasModal);

  // Modal variantes
  mvarCerrar?.addEventListener('click', closeVarModal);
  mvarRecargar?.addEventListener('click', cargarProductosModal);
  mvarBuscarProd?.addEventListener('input', renderProductosModal);
  mvarUsar?.addEventListener('click', usarVarianteSeleccionada);
});

// ===== Auth: solo valida login (no filtra por rol) =====
async function validarSesion(){
  const token = getToken();
  if (!token){
    alertRedirect('Acceso denegado: iniciá sesión para continuar.', 'login.html');
    return null;
  }
  try{
    const r = await fetch(`${API}/usuarios/me`, { headers: authHeaders() });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    return data.usuario;
  }catch(e){
    console.error('validarSesion:', e);
    clearSession();
    alertRedirect('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.', 'login.html');
    return null;
  }
}

// ===== Buscar venta e ítems =====
async function buscarVenta(){
  const id = Number(ventaInput.value || 0);
  if (!id || id <= 0) { alert('Ingresá un número de venta válido'); return; }

  try{
    const data = await fetchDetalleVenta(id);
    if (!data || !Array.isArray(data.items) || data.items.length === 0){
      ventaResumen.textContent = 'Venta no encontrada o sin ítems';
      ventaTotal.classList.add('oculto');
      ITEMS = []; VENTA = null;
      renderItems();
      return;
    }
    const calcTotal = data.items.reduce((a,b)=>a + (Number(b.precio_unitario)*Number(b.cantidad)), 0);
    VENTA = data.venta || { id: id, fecha: data.items[0]?.fecha || null, total: calcTotal };
    ITEMS = data.items.map(enrichItemRow);

    ventaResumen.textContent = `Venta #${VENTA.id} • ${new Date(VENTA.fecha || Date.now()).toLocaleString('es-AR')}`;
    ventaTotal.textContent   = `Total $${fmt(VENTA.total)}`;
    ventaTotal.classList.remove('oculto');
    renderItems();
  }catch(err){
    console.error(err);
    alert('No se pudo obtener la venta.');
  }
}

function enrichItemRow(r){
  return {
    venta_item_id: Number(r.id),
    producto_id: Number(r.producto_id),
    variante_id: Number(r.variante_id),
    producto_nombre: r.producto_nombre || r.nombre_producto || `Producto ${r.producto_id}`,
    color: r.color || '',
    talle: r.talle || '',
    cantidad_vendida: Number(r.cantidad || 0),
    precio_unitario: Number(r.precio_unitario || 0),
    // UI (solo afecta este item, nunca toda la venta)
    cantidad_devolver: 0,
    cambio_producto_id: null,
    cambio_producto_nombre: '',
    cambio_variante_id: null
  };
}

// Busca detalle de venta probando endpoints comunes
async function fetchDetalleVenta(ventaId){
  // 1) /ventas/:id/detalle -> devuelve array de items
  let r = await fetch(`${API}/ventas/${ventaId}/detalle`, { headers: authHeaders() });
  if (r.ok){
    const items = await r.json();
    return { venta:{ id:ventaId }, items };
  }
  // 2) /detalle-venta/:id
  r = await fetch(`${API}/detalle-venta/${ventaId}`, { headers: authHeaders() });
  if (r.ok){
    const items = await r.json();
    return { venta:{ id:ventaId }, items };
  }
  // 3) /ventas/:id con {venta, items} o solo items
  r = await fetch(`${API}/ventas/${ventaId}`, { headers: authHeaders() });
  if (r.ok){
    const data = await r.json();
    if (Array.isArray(data)) return { venta:{ id:ventaId }, items: data };
    if (Array.isArray(data.items)) return { venta: data.venta || { id:ventaId }, items: data.items };
    if (Array.isArray(data.detalle)) return { venta: data.venta || { id:ventaId }, items: data.detalle };
  }
  throw new Error('No existe endpoint de detalle de venta compatible');
}

// ===== Render de ítems (parcial, por fila) =====
function renderItems(){
  tbody.innerHTML = '';

  if (!ITEMS.length){
    hintItems.classList.remove('oculto');
    tablaWrap.classList.add('oculto');
    recalcResumen();
    return;
  }

  hintItems.classList.add('oculto');
  tablaWrap.classList.remove('oculto');

  ITEMS.forEach((it, idx) => {
    const selCambio = it.cambio_variante_id
      ? `<span class="pill">Var #${it.cambio_variante_id}${it.cambio_producto_nombre ? ' • ' + it.cambio_producto_nombre : ''}</span>`
      : `<span class="muted">—</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${it.venta_item_id}</td>
      <td>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div>${it.producto_nombre}</div>
          <div class="muted">Var ${it.variante_id} • ${it.color || '-'} ${it.talle ? ' / ' + it.talle : ''}</div>
        </div>
      </td>
      <td class="right">${it.cantidad_vendida}</td>
      <td class="right">
        <input type="number" min="0" max="${it.cantidad_vendida}" step="1" data-idx="${idx}" class="inp-cant" style="width:96px;text-align:right;" value="${it.cantidad_devolver}">
      </td>
      <td>
        <div class="actions">
          ${selCambio}
          <button class="btn sm" data-idx="${idx}" data-action="pick-cambio">Elegir cambio</button>
          <button class="btn sm danger" data-idx="${idx}" data-action="clear-cambio" ${it.cambio_variante_id ? '' : 'disabled'}>Quitar</button>
        </div>
      </td>
      <td class="right">$${fmt(it.precio_unitario)}</td>
      <td class="right" id="sub-dev-${idx}">$0,00</td>
      <td class="right" id="sub-ent-${idx}">$0,00</td>
    `;
    tbody.appendChild(tr);
  });

  // Listeners por fila
  tbody.querySelectorAll('.inp-cant').forEach(inp => {
    inp.addEventListener('input', e => {
      const i = Number(e.target.dataset.idx);
      let v = Number(e.target.value || 0);
      if (v < 0) v = 0;
      if (v > ITEMS[i].cantidad_vendida) v = ITEMS[i].cantidad_vendida;
      ITEMS[i].cantidad_devolver = v;
      e.target.value = v;
      recalcResumen();
    });
  });

  tbody.querySelectorAll('button[data-action="pick-cambio"]').forEach(btn => {
    btn.addEventListener('click', e => openVarModal(Number(e.currentTarget.dataset.idx)));
  });
  tbody.querySelectorAll('button[data-action="clear-cambio"]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = Number(e.currentTarget.dataset.idx);
      ITEMS[i].cambio_producto_id = null;
      ITEMS[i].cambio_producto_nombre = '';
      ITEMS[i].cambio_variante_id = null;
      renderItems(); // re-render para refrescar pill y botón
    });
  });

  recalcResumen();
}

// ===== Resumen =====
async function recalcResumen(){
  let totalDev = 0;
  let totalEnt = 0;

  for (let i = 0; i < ITEMS.length; i++){
    const it = ITEMS[i];
    const cant = Number(it.cantidad_devolver || 0);
    const precioOriginal = Number(it.precio_unitario || 0);

    const subDev = cant * precioOriginal;
    totalDev += subDev;

    // Entrega por cambio (si hay selección y cant > 0)
    let subEnt = 0;
    if (cant > 0 && it.cambio_variante_id){
      let precioEnt = precioOriginal;
      if (chkVigente.checked){
        // Si usa vigente, tomar del producto ELEGIDO para el cambio
        const precioVig = await getPrecioVigenteProducto(it.cambio_producto_id || it.producto_id);
        precioEnt = Number(precioVig || 0);
      }
      subEnt = cant * precioEnt;
      totalEnt += subEnt;
    }

    const devEl = byId(`sub-dev-${i}`);
    const entEl = byId(`sub-ent-${i}`);
    if (devEl) devEl.textContent = `$${fmt(subDev)}`;
    if (entEl) entEl.textContent = `$${fmt(subEnt)}`;
  }

  const neto = totalEnt - totalDev;
  sumDevEl.textContent = `$${fmt(totalDev)}`;
  sumEntEl.textContent = `$${fmt(totalEnt)}`;
  sumNetoEl.textContent  = `$${fmt(neto)}`;
}

// ===== Precio vigente de un producto =====
const PRICE_CACHE = new Map();
async function getPrecioVigenteProducto(producto_id){
  if (!producto_id) return 0;
  if (PRICE_CACHE.has(producto_id)) return PRICE_CACHE.get(producto_id);

  try{
    const r = await fetch(`${API}/productos/${producto_id}`, { headers: authHeaders() });
    if (!r.ok) throw new Error('producto');
    const p = await r.json();
    const precio = Number(p.precio || p?.data?.precio || 0);
    PRICE_CACHE.set(producto_id, precio);
    return precio;
  }catch(e){
    console.warn('No pude obtener precio vigente de producto', producto_id, e);
    PRICE_CACHE.set(producto_id, 0);
    return 0;
  }
}

// ===== Confirmar =====
async function confirmar(){
  if (!VENTA || !ITEMS.length) { alert('Buscá primero una venta.'); return; }

  // Payload solo con ítems seleccionados (PARCIAL, no toca toda la venta)
  const caja_tipo = (document.querySelector('input[name="caja"]:checked')?.value) || 'fisica';
  const usarPrecioVigente = !!chkVigente.checked;
  const motivo = String(motivoInput.value || '');

  const items = [];
  for (const it of ITEMS){
    const cant = Number(it.cantidad_devolver || 0);
    if (!cant) continue;

    const row = { venta_item_id: it.venta_item_id, cantidad: cant };
    if (it.cambio_variante_id) row.variante_id_entregada = it.cambio_variante_id;

    if (cant > it.cantidad_vendida) {
      alert(`La cantidad a devolver del item ${it.venta_item_id} excede lo vendido`);
      return;
    }
    items.push(row);
  }

  if (items.length === 0){
    alert('Indicá al menos una cantidad a devolver/cambiar.');
    return;
  }

  const payload = { venta_id: VENTA.id, caja_tipo, motivo, usarPrecioVigente, items };

  if (!confirm('¿Confirmar devolución/cambio? Se ajustará stock y se registrará el movimiento en caja.')) return;

  try{
    const r = await fetch(`${API}/devoluciones`, {
      method:'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.mensaje || 'Error al registrar la devolución');

    alert(`OK: ${data.mensaje}\n#${data.devolucion_id}\nReintegro: $${fmt(data.total_reintegro)}  |  Entregado: $${fmt(data.total_entregado)}  |  Neto: $${fmt(data.neto)}`);

    // Reset suave
    ventaResumen.textContent = 'Sin venta cargada';
    ventaTotal.classList.add('oculto');
    tbody.innerHTML = '';
    ITEMS = []; VENTA = null;
    hintItems.classList.remove('oculto'); tablaWrap.classList.add('oculto');
    recalcResumen();
  }catch(e){
    console.error(e);
    alert('No se pudo registrar la devolución: ' + e.message);
  }
}

/* ===========================
   Modal: Historial de ventas
   =========================== */
async function openVentasModal(){
  try{
    // Si ya cacheamos, solo abrir
    if (!HIST_VENTAS.length){
      const r = await fetch(`${API}/ventas`, { headers: authHeaders() });
      if (!r.ok) throw new Error('No se pudo obtener historial de ventas');
      HIST_VENTAS = await r.json(); // [{id, fecha, total, vendedor}, ...]
    }
    renderVentasModal();
    modalVentas.classList.add('abierto');
  }catch(e){
    console.error(e);
    alert('No pude cargar el historial de ventas');
  }
}

function renderVentasModal(){
  const q = (mvenBuscar.value || '').toLowerCase().trim();
  mvenRows.innerHTML = '';

  const filtradas = HIST_VENTAS.filter(v => {
    if (!q) return true;
    const idm = String(v.id || '').includes(q);
    const vend = String(v.vendedor || '').toLowerCase().includes(q);
    const fecha = String(v.fecha || '').toLowerCase().includes(q);
    return idm || vend || fecha;
  });

  if (!filtradas.length){
    mvenRows.innerHTML = `<tr><td colspan="4" class="muted">Sin resultados</td></tr>`;
    return;
  }

  filtradas.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.innerHTML = `
      <td>${v.id}</td>
      <td>${formatFechaAR(v.fecha)}</td>
      <td class="right">$${fmt(v.total)}</td>
      <td>${v.vendedor || '-'}</td>
    `;
    tr.addEventListener('click', () => {
      ventaInput.value = v.id;
      modalVentas.classList.remove('abierto');
      btnBuscar.click();
    });
    mvenRows.appendChild(tr);
  });
}

function formatFechaAR(fecha){
  if (!fecha) return '-';
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}`;
}

/* ======================================
   Modal: Producto -> Variantes (por ítem)
   ====================================== */
async function openVarModal(itemIdx){
  MODAL_ITEM_IDX = itemIdx;
  VARIANTE_SELEC = null;
  PRODUCTO_SELEC = null;
  mvarUsar.disabled = true;
  mvarSeleccion.textContent = 'Sin selección';

  try{
    // Trae productos si cache vacío
    if (!PRODUCTOS.length) await cargarProductosModal();
    // Preselecciona el producto actual del ítem
    const it = ITEMS[itemIdx];
    const prod = PRODUCTOS.find(p => Number(p.id) === Number(it.producto_id));
    if (prod){
      PRODUCTO_SELEC = prod;
      await cargarVariantesDeProducto(prod.id);
      marcarProductoFila(prod.id);
    } else {
      // si no se encuentra, limpiar variantes
      mvarRowsVar.innerHTML = `<tr><td colspan="4" class="muted">Seleccioná un producto</td></tr>`;
    }
    modalVar.classList.add('abierto');
  }catch(e){
    console.error(e);
    alert('No se pudieron cargar productos/variantes');
  }
}

function closeVarModal(){
  modalVar.classList.remove('abierto');
  MODAL_ITEM_IDX = null;
}

async function cargarProductosModal(){
  try{
    const r = await fetch(`${API}/productos`, { headers: authHeaders() });
    if (!r.ok) throw new Error('productos');
    PRODUCTOS = await r.json(); // se espera {id, nombre, precio, ...}
    renderProductosModal();
  }catch(e){
    console.error(e);
    alert('No pude cargar productos');
  }
}

function renderProductosModal(){
  const q = (mvarBuscarProd.value || '').toLowerCase().trim();
  mvarRowsProd.innerHTML = '';

  let list = PRODUCTOS;
  if (q){
    list = PRODUCTOS.filter(p => String(p.id).includes(q) || String(p.nombre || p.producto || '').toLowerCase().includes(q));
  }

  if (!list.length){
    mvarRowsProd.innerHTML = `<tr><td colspan="3" class="muted">Sin resultados</td></tr>`;
    return;
  }

  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.dataset.pid = p.id;
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.nombre || p.producto || '-'}</td>
      <td class="right">$${fmt(p.precio || 0)}</td>
    `;
    tr.addEventListener('click', async () => {
      PRODUCTO_SELEC = { id: p.id, nombre: p.nombre || p.producto || '-', precio: Number(p.precio || 0) };
      marcarProductoFila(p.id);
      await cargarVariantesDeProducto(p.id);
    });
    mvarRowsProd.appendChild(tr);
  });
}

function marcarProductoFila(pid){
  mvarRowsProd.querySelectorAll('tr').forEach(tr => tr.style.background = '');
  const tr = mvarRowsProd.querySelector(`tr[data-pid="${pid}"]`);
  if (tr) tr.style.background = 'rgba(99,102,241,.12)';
}

async function cargarVariantesDeProducto(producto_id){
  mvarRowsVar.innerHTML = `<tr><td colspan="4" class="muted">Cargando…</td></tr>`;
  try{
    const url = `${API}/variantes?producto_id=${encodeURIComponent(producto_id)}`;
    const r = await fetch(url, { headers: authHeaders() });
    if (!r.ok) throw new Error('variantes');
    VARIANTES = await r.json(); // [{id, talle, color, stock}, ...]
    renderVariantesModal();
  }catch(e){
    console.error(e);
    mvarRowsVar.innerHTML = `<tr><td colspan="4" class="muted">No se pudieron cargar variantes</td></tr>`;
  }
}

function renderVariantesModal(){
  mvarRowsVar.innerHTML = '';
  if (!VARIANTES.length){
    mvarRowsVar.innerHTML = `<tr><td colspan="4" class="muted">Sin variantes para este producto</td></tr>`;
    return;
  }
  VARIANTE_SELEC = null;
  mvarUsar.disabled = true;
  mvarSeleccion.textContent = PRODUCTO_SELEC
    ? `Producto: ${PRODUCTO_SELEC.nombre} (#${PRODUCTO_SELEC.id})`
    : 'Sin selección';

  VARIANTES.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.dataset.vid = v.id;
    tr.innerHTML = `
      <td>${v.id}</td>
      <td>${v.talle || '-'}</td>
      <td>${v.color || '-'}</td>
      <td class="right">${v.stock ?? '-'}</td>
    `;
    tr.addEventListener('click', () => {
      VARIANTE_SELEC = { id: v.id, talle: v.talle, color: v.color, stock: v.stock };
      mvarRowsVar.querySelectorAll('tr').forEach(x => x.style.background = '');
      tr.style.background = 'rgba(34,211,238,.12)';
      mvarSeleccion.textContent = `Producto: ${PRODUCTO_SELEC?.nombre || '-'} (#${PRODUCTO_SELEC?.id})  |  Variante: #${v.id} (${v.talle || '-'} ${v.color || '-'})`;
      mvarUsar.disabled = false;
    });
    mvarRowsVar.appendChild(tr);
  });
}

function usarVarianteSeleccionada(){
  if (MODAL_ITEM_IDX == null || !VARIANTE_SELEC || !PRODUCTO_SELEC) return;
  const it = ITEMS[MODAL_ITEM_IDX];
  it.cambio_producto_id = PRODUCTO_SELEC.id;
  it.cambio_producto_nombre = PRODUCTO_SELEC.nombre;
  it.cambio_variante_id = VARIANTE_SELEC.id;

  closeVarModal();
  renderItems();   // refresca la fila y recalcula totales
}

/* Util */
function stop(e){ e.preventDefault(); e.stopPropagation(); }
