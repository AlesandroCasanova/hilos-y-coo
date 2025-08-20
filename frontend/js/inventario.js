// Inventario agrupado por producto + Modal con variantes + Historial mejorado
import { obtenerToken, logout } from './utils.js';

const API = 'http://localhost:3000/api';
const UMBRAL_ALERTA = 2;

// ===== Guardia de sesión (solo login, sin roles) =====
async function validarSesion() {
  const tk = obtenerToken();
  if (!tk) {
    alert('Acceso denegado: iniciá sesión para continuar.');
    window.location.href = 'login.html';
    return null;
  }
  try {
    const r = await fetch(`${API}/usuarios/me`, { headers: { Authorization: 'Bearer ' + tk } });
    if (!r.ok) throw new Error('no-auth');
    const data = await r.json();
    window.__USER__ = data?.usuario || data;
    return window.__USER__;
  } catch {
    try { localStorage.removeItem('token'); localStorage.removeItem('usuario'); } catch {}
    alert('Acceso denegado: tu sesión expiró o es inválida. Volvé a iniciar sesión.');
    window.location.href = 'login.html';
    return null;
  }
}

// refs
let grid, buscarInput, soloAlertasChk, badgeGlobal, notice, btnRefrescar, btnSalir;
let filtroCategoria, filtroProveedor, minStockInput, ordenSelect, resultadosEl, btnLimpiar;

let modal, mImg, mNombre, mId, mCodigo, mCategoria, mProveedor, mPProv, mPVenta, mTbody, btnCerrar, btnHistorial;
let histWrap, histRows, histVarSel, histTipoSel, histQInput, histLimitSel, histExportBtn;

// caches
let VARIANTES = [];     // filas desde /inventario (v.* + p.*)
let PROV_MAP  = {};     // id -> nombre proveedor
let GROUPS    = [];     // agrupación por producto
let CURRENT_GROUP = null;
let CATEGORIAS = [];

// historial state
let HIST_DATA = [];
let HIST_FILTERED = [];

// ===== helpers =====
function fmt(n){ return Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function toast(msg, isErr=false){
  const n = document.createElement('div');
  n.textContent = msg;
  Object.assign(n.style,{position:'fixed',top:'18px',right:'18px',background:isErr?'#7f1d1d':'#4f46e5',color:'#fff',padding:'10px 14px',borderRadius:'10px',zIndex:9999});
  document.body.appendChild(n); setTimeout(()=>n.remove(),1800);
}
function imgURL(nombre){
  if (!nombre) return 'https://dummyimage.com/300x300/ede9fe/6d28d9&text=Sin+imagen';
  if (/^https?:\/\//i.test(nombre)) return nombre;
  return `http://localhost:3000/imagenes_productos/${encodeURIComponent(nombre)}`;
}

// badge verde “stock alto”
function ensureBadgeStyles(){
  if (document.getElementById('inv-badge-styles')) return;
  const s = document.createElement('style');
  s.id = 'inv-badge-styles';
  s.textContent = `
    .cap.ok{ background:#ecfdf5!important; color:#065f46!important; border:1px solid #bbf7d0!important;
      padding:2px 8px;border-radius:999px;font-weight:600;font-size:12px;white-space:nowrap; }
  `;
  document.head.appendChild(s);
}

// ===== data =====
async function fetchProveedores(){
  const tok = obtenerToken();
  const r = await fetch(`${API}/proveedores`, { headers:{ Authorization:'Bearer '+tok } });
  if (!r.ok) return {};
  const arr = await r.json();
  const map = {};
  arr.forEach(p => map[p.id] = p.nombre || `#${p.id}`);
  return map;
}
async function fetchCategorias(){
  const tok = obtenerToken();
  try{
    const r = await fetch(`${API}/categorias`, { headers:{ Authorization:'Bearer '+tok } });
    if(!r.ok) return [];
    return await r.json(); // [{id?, nombre}, ...]
  }catch{ return []; }
}

/** Trae inventario con todos los campos de producto */
async function fetchInventario(){
  const tok = obtenerToken();
  const r = await fetch(`${API}/inventario`, { headers:{ Authorization:'Bearer '+tok } });
  if (!r.ok) throw new Error('No se pudo obtener inventario');
  const arr = await r.json();

  return arr.map(v => ({
    // variante
    variante_id:  Number(v.id),
    producto_id:  Number(v.producto_id),
    talle:        v.talle || '',
    color:        v.color || '',
    stock:        Number(v.stock || 0),
    activo:       v.activo ?? 1,

    // producto
    p_id:             Number(v.p_id ?? v.producto_id),
    p_nombre:         v.producto_nombre || v.nombre || v.nombre_producto || 'Producto',
    p_codigo:         v.codigo || '',
    p_descripcion:    v.descripcion || '',
    p_categoria:      v.categoria || '',
    p_proveedor_id:   v.proveedor_id || null,
    p_precio_prov:    Number(v.precio_proveedor || 0),
    p_precio:         Number(v.precio || 0),
    p_imagen:         v.imagen || null
  }));
}

function agrupar(variantes){
  const q = norm(buscarInput.value);
  const soloAlertas = !!soloAlertasChk.checked;
  const cat = filtroCategoria.value;
  const prov = filtroProveedor.value;
  const minStock = Number(minStockInput.value || 0);
  const orden = ordenSelect.value;

  const map = new Map();
  let alertas = 0, totalItems = 0;

  variantes.forEach(row => {
    // filtros
    const matchTxt = !q
      || norm(row.p_nombre).includes(q)
      || norm(row.p_codigo).includes(q)
      || norm(row.color).includes(q)
      || norm(row.talle).includes(q)
      || String(row.variante_id).includes(q);
    if (!matchTxt) return;
    if (cat && String(row.p_categoria) !== cat) return;
    if (prov && String(row.p_proveedor_id||'') !== prov) return;
    if (minStock && row.stock < minStock) return;

    const low = row.stock <= UMBRAL_ALERTA;
    if (soloAlertas && !low) return;
    if (low) alertas++;

    const key = row.producto_id;
    if (!map.has(key)){
      map.set(key, {
        producto_id: row.producto_id,
        nombre: row.p_nombre,
        codigo: row.p_codigo,
        descripcion: row.p_descripcion,
        categoria: row.p_categoria,
        proveedor_id: row.p_proveedor_id,
        precio_prov: row.p_precio_prov,
        precio: row.p_precio,
        imagen: row.p_imagen,
        stock_total: 0,
        items: []
      });
    }
    const g = map.get(key);
    g.items.push({ id: row.variante_id, talle: row.talle, color: row.color, stock: row.stock });
    g.stock_total += row.stock;
    totalItems++;
  });

  let list = Array.from(map.values()).map(g => ({
    ...g,
    items: g.items.sort((a,b)=> (a.color||'').localeCompare(b.color||'') || (a.talle||'').localeCompare(b.talle||''))})
  );

  // Orden
  switch(orden){
    case 'stock-asc':  list.sort((a,b)=> a.stock_total - b.stock_total); break;
    case 'stock-desc': list.sort((a,b)=> b.stock_total - a.stock_total); break;
    case 'nombre-asc': list.sort((a,b)=> a.nombre.localeCompare(b.nombre)); break;
    case 'nombre-desc':list.sort((a,b)=> b.nombre.localeCompare(a.nombre)); break;
    default: /* relevancia: deja el orden natural de filtrado */ ;
  }

  return { grupos: list, alertas, totalVar: totalItems };
}

// ===== render =====
function render(){
  grid.innerHTML = '';
  const { grupos, alertas, totalVar } = agrupar(VARIANTES);
  GROUPS = grupos;

  // cabeceras/avisos
  if (alertas>0){ badgeGlobal.style.display=''; badgeGlobal.textContent=`${alertas} alerta${alertas===1?'':'s'}`; notice.classList.add('show'); }
  else{ badgeGlobal.style.display='none'; notice.classList.remove('show'); }

  resultadosEl.textContent = `${grupos.length} producto${grupos.length!==1?'s':''} · ${totalVar} variante${totalVar!==1?'s':''}`;

  if (!grupos.length){
    grid.innerHTML = `<div class="empty muted">Sin resultados.</div>`;
    return;
  }

  grupos.forEach(g => grid.appendChild(cardProducto(g)));
}

function cardProducto(g){
  const provName = PROV_MAP[g.proveedor_id] || (g.proveedor_id ? `#${g.proveedor_id}` : '—');

  const card = document.createElement('article');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';
  head.innerHTML = `
    <img class="pic" src="${imgURL(g.imagen)}" alt="">
    <div class="info">
      <h3 class="title">${g.nombre}</h3>
      <div class="subtitle">Código <b>${g.codigo || '—'}</b> · Cat. <b>${g.categoria || '—'}</b> · Prov. <b>${provName}</b></div>
      <div class="meta">
        <span class="tag">Stock total: <b>${g.stock_total}</b></span>
        <span class="tag">$Prov: <b>${fmt(g.precio_prov)}</b></span>
        <span class="tag">$Venta: <b>${fmt(g.precio)}</b></span>
      </div>
    </div>
  `;
  card.appendChild(head);

  const foot = document.createElement('div');
  foot.className = 'card-foot';
  const btnVar = document.createElement('button');
  btnVar.className = 'btn';
  btnVar.textContent = 'Ver variantes';
  btnVar.addEventListener('click', () => openModal(g));
  foot.appendChild(btnVar);
  card.appendChild(foot);

  return card;
}

// ===== modal =====
function openModal(grupo){
  CURRENT_GROUP = grupo;

  // header mini
  mImg.src = imgURL(grupo.imagen);
  mNombre.textContent = grupo.nombre || 'Producto';
  mId.textContent = grupo.producto_id ?? '—';
  mCodigo.textContent = grupo.codigo || '—';
  mCategoria.textContent = grupo.categoria || '—';
  mProveedor.textContent = PROV_MAP[grupo.proveedor_id] || (grupo.proveedor_id ? `#${grupo.proveedor_id}` : '—');
  mPProv.textContent = fmt(grupo.precio_prov);
  mPVenta.textContent = fmt(grupo.precio);

  // cuerpo variantes
  mTbody.innerHTML = '';
  grupo.items.forEach(v => {
    const low = Number(v.stock) <= UMBRAL_ALERTA;
    const tr = document.createElement('tr');
    tr.classList.toggle('low', low);
    tr.innerHTML = `
      <td>${v.id}</td>
      <td>${v.talle || '-'}</td>
      <td>${v.color || '-'}</td>
      <td><input type="number" id="st-${v.id}" min="0" value="${v.stock}"></td>
      <td>${low ? `<span class="cap">STOCK BAJO</span>` : `<span class="cap ok">STOCK ALTO</span>`}</td>
      <td><button class="btn-mini" data-id="${v.id}">Guardar</button></td>
    `;
    mTbody.appendChild(tr);
  });

  // listeners guardar
  mTbody.querySelectorAll('.btn-mini').forEach(btn => {
    btn.addEventListener('click', () => guardarStock(Number(btn.dataset.id), grupo.producto_id));
  });

  // filtros del historial
  prepararFiltrosHistorial(grupo);

  // historial toggle
  btnHistorial.onclick = () => toggleHistorial(grupo.producto_id);

  modal.classList.remove('oculto');
}

function closeModal(){
  modal.classList.add('oculto');
  histWrap.classList.add('oculto');
  histRows.innerHTML = '';
  HIST_DATA = [];
  HIST_FILTERED = [];
}

// ===== acciones variantes =====
async function guardarStock(varianteId){
  const input = document.getElementById(`st-${varianteId}`);
  const nuevoStock = Number(input?.value);
  if (isNaN(nuevoStock) || nuevoStock<0) return toast('Stock inválido', true);

  const tok = obtenerToken();
  const btn = document.querySelector(`.btn-mini[data-id="${varianteId}"]`);
  if (btn) btn.disabled = true;

  try{
    const body = {
      stock: nuevoStock,
      referencia_tipo: 'ajuste_manual',
      referencia_id: varianteId,
      descripcion: 'Ajuste manual desde Inventario'
    };

    const r = await fetch(`${API}/actualizarStock/${varianteId}`, {
      method:'PUT',
      headers:{ Authorization:'Bearer '+tok, 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.mensaje || 'Error al actualizar');

    // actualizar cache
    const item = VARIANTES.find(x => x.variante_id === Number(varianteId));
    if (item) item.stock = nuevoStock;

    // actualizar en grupo actual
    const it = CURRENT_GROUP?.items.find(v => v.id === Number(varianteId));
    if (it) it.stock = nuevoStock;

    // re-render modal y listado
    if (CURRENT_GROUP) openModal(CURRENT_GROUP);
    render();

    toast('Stock actualizado');
    if (nuevoStock <= UMBRAL_ALERTA) alert(`Atención: la variante #${varianteId} quedó con stock ≤ ${UMBRAL_ALERTA}.`);
  }catch(e){
    console.error(e); toast('No se pudo actualizar', true);
  }finally{
    if (btn) btn.disabled = false;
  }
}

// ===== historial =====
function prepararFiltrosHistorial(grupo){
  histVarSel.innerHTML = `<option value="">Todas las variantes</option>`;
  grupo.items.forEach(v => {
    const label = `Var #${v.id} - ${v.color || '-'} / ${v.talle || '-'}`;
    const op = document.createElement('option');
    op.value = String(v.id);
    op.textContent = label;
    histVarSel.appendChild(op);
  });
  histTipoSel.value = ''; histQInput.value = ''; histLimitSel.value = '50';
}

async function toggleHistorial(productoId){
  if (!histWrap.classList.contains('oculto')){
    histWrap.classList.add('oculto'); 
    return;
  }
  await loadHistorial(productoId);
  histWrap.classList.remove('oculto');
}

async function loadHistorial(productoId){
  const limit = Number(histLimitSel.value || '50');
  histRows.innerHTML = `<tr><td colspan="6" class="ref-muted">Cargando...</td></tr>`;
  try{
    const tok = obtenerToken();
    const r = await fetch(`${API}/inventario/movimientos?producto_id=${productoId}&limit=${limit}`, {
      headers:{ Authorization:'Bearer '+tok }
    });
    const rows = await r.json();
    HIST_DATA = Array.isArray(rows) ? rows : [];
    renderHistorial();
  }catch(e){
    console.error(e);
    histRows.innerHTML = `<tr><td colspan="6" class="ref-muted">No se pudo cargar el historial</td></tr>`;
  }
}

function renderHistorial(){
  const varId = histVarSel.value.trim();
  const tipo  = histTipoSel.value.trim();
  const q     = norm(histQInput.value);

  HIST_FILTERED = HIST_DATA.filter(m => {
    if (varId && String(m.variante_id) !== varId) return false;
    if (tipo && String(m.tipo) !== tipo) return false;
    if (q){
      const blob = `${m.referencia_tipo||''} ${m.referencia_id||''} ${m.descripcion||''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  histRows.innerHTML = '';
  if (!HIST_FILTERED.length){
    histRows.innerHTML = `<tr><td colspan="6" class="ref-muted">Sin movimientos</td></tr>`;
    return;
  }

  HIST_FILTERED.forEach(m => {
    const cant = Number(m.cantidad||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatFechaHora(m.fecha)}</td>
      <td>${m.variante_id || ''}</td>
      <td><span class="tag">${m.tipo || '—'}</span></td>
      <td class="${cant >= 0 ? 'qty-pos' : 'qty-neg'}">${cant >= 0 ? '+' : ''}${cant}</td>
      <td class="ref-muted">${(m.referencia_tipo||'')}${m.referencia_id?(' #'+m.referencia_id):''}</td>
      <td><span class="desc" title="${escapeHtml(m.descripcion||'')}">${m.descripcion || ''}</span></td>
    `;
    histRows.appendChild(tr);
  });
}

function formatFechaHora(f){
  try {
    const d = new Date(f);
    const dStr = d.toLocaleDateString('es-AR');
    const tStr = d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    return `${dStr} ${tStr}`;
  } catch { return f || ''; }
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}

function exportHistorialCSV(){
  if (!HIST_FILTERED.length){ toast('No hay datos para exportar', true); return; }
  const header = ['fecha','variante_id','tipo','cantidad','referencia','descripcion'];
  const lines = [header.join(',')];

  HIST_FILTERED.forEach(m => {
    const ref = `${m.referencia_tipo||''}${m.referencia_id?(' #'+m.referencia_id):''}`.trim();
    const row = [
      formatFechaHora(m.fecha),
      m.variante_id || '',
      m.tipo || '',
      Number(m.cantidad||0),
      ref.replace(/,/g,' '),
      (m.descripcion||'').replace(/"/g,'""')
    ];
    lines.push(row.map(val => `"${String(val)}"`).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historial_inventario_${(CURRENT_GROUP?.nombre||'producto').replace(/\s+/g,'_')}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}

// ===== init =====
async function init(){
  try{
    PROV_MAP   = await fetchProveedores();
    CATEGORIAS = await fetchCategorias();
    VARIANTES  = await fetchInventario();

    // llenar selects
    if (filtroCategoria){
      filtroCategoria.innerHTML = `<option value="">Todas</option>`;
      const cats = [...new Set(CATEGORIAS.map(c=>c.nombre||c))].filter(Boolean).sort();
      cats.forEach(n => {
        const op=document.createElement('option'); op.value=n; op.textContent=n; filtroCategoria.appendChild(op);
      });
    }
    if (filtroProveedor){
      filtroProveedor.innerHTML = `<option value="">Todos</option>`;
      Object.entries(PROV_MAP)
        .sort((a,b)=> String(a[1]).localeCompare(String(b[1])))
        .forEach(([id,nombre])=>{
          const op=document.createElement('option'); op.value=id; op.textContent=nombre; filtroProveedor.appendChild(op);
        });
    }

    render();
  }catch(e){
    console.error(e);
    grid.innerHTML = `<div class="empty muted">No se pudo cargar el inventario.</div>`;
  }
}

function wire(){
  btnRefrescar.addEventListener('click', init);
  btnSalir.addEventListener('click', logout);

  // filtros
  [buscarInput, soloAlertasChk, filtroCategoria, filtroProveedor, minStockInput, ordenSelect]
    .forEach(el => el && el.addEventListener(el.tagName==='INPUT' && el.type==='search' ? 'input' : 'change', render));
  btnLimpiar.addEventListener('click', ()=>{
    buscarInput.value=''; soloAlertasChk.checked=false; filtroCategoria.value=''; filtroProveedor.value='';
    minStockInput.value=''; ordenSelect.value='relevancia'; render();
  });

  // filtros historial
  histVarSel.addEventListener('change', renderHistorial);
  histTipoSel.addEventListener('change', renderHistorial);
  histQInput.addEventListener('input', renderHistorial);
  histLimitSel.addEventListener('change', () => { if (CURRENT_GROUP) loadHistorial(CURRENT_GROUP.producto_id); });
  histExportBtn.addEventListener('click', exportHistorialCSV);

  // cerrar modal
  btnCerrar?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
  modal?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('oculto')) closeModal(); });
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const usuario = await validarSesion();
  if (!usuario) return;

  // cache DOM
  grid = document.getElementById('inventario-grid');
  buscarInput = document.getElementById('buscar');
  soloAlertasChk = document.getElementById('solo-alertas');
  badgeGlobal = document.getElementById('badge-global');
  notice = document.getElementById('notice');
  btnRefrescar = document.getElementById('btn-refrescar');
  btnSalir = document.getElementById('btn-salir');
  filtroCategoria = document.getElementById('filtro-categoria');
  filtroProveedor = document.getElementById('filtro-proveedor');
  minStockInput = document.getElementById('min-stock');
  ordenSelect = document.getElementById('orden');
  resultadosEl = document.getElementById('resultados');
  btnLimpiar = document.getElementById('btn-limpiar');

  modal = document.getElementById('modal');
  mImg = document.getElementById('m-img');
  mNombre = document.getElementById('m-nombre');
  mId = document.getElementById('m-id');
  mCodigo = document.getElementById('m-codigo');
  mCategoria = document.getElementById('m-categoria');
  mProveedor = document.getElementById('m-proveedor');
  mPProv = document.getElementById('m-pprov');
  mPVenta = document.getElementById('m-pventa');
  mTbody = document.getElementById('m-tbody');
  btnCerrar = document.getElementById('btn-cerrar');
  btnHistorial = document.getElementById('btn-historial');

  histWrap = document.getElementById('historial');
  histRows = document.getElementById('hist-rows');
  histVarSel = document.getElementById('hist-var');
  histTipoSel = document.getElementById('hist-tipo');
  histQInput = document.getElementById('hist-q');
  histLimitSel = document.getElementById('hist-limit');
  histExportBtn = document.getElementById('hist-export');

  ensureBadgeStyles();
  wire();
  init();
});
