// Inventario agrupado por producto + Modal con variantes + Historial mejorado
import { obtenerToken, logout } from './utils.js';

const API = 'http://localhost:3000/api';
const UMBRAL_ALERTA = 2;

// refs
let grid, buscarInput, soloAlertasChk, badgeGlobal, notice, btnRefrescar, btnSalir;
let modal, mImg, mNombre, mId, mCodigo, mCategoria, mProveedor, mPProv, mPVenta, mTbody, btnCerrar, btnHistorial;
let histWrap, histRows, histVarSel, histTipoSel, histQInput, histLimitSel, histExportBtn;

// caches
let VARIANTES = [];     // filas desde /inventario (v.* + p.*)
let PROV_MAP  = {};     // id -> nombre proveedor
let GROUPS    = [];     // agrupación por producto
let CURRENT_GROUP = null;

// historial state
let HIST_DATA = [];
let HIST_FILTERED = [];

// ===== helpers =====
function fmt(n){ return Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); }
function toast(msg, isErr=false){
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.position='fixed'; n.style.top='18px'; n.style.right='18px';
  n.style.background = isErr ? '#7f1d1d' : '#064e3b';
  n.style.border='1px solid rgba(255,255,255,.15)';
  n.style.color='#fff'; n.style.padding='10px 14px';
  n.style.borderRadius='10px'; n.style.zIndex='99';
  document.body.appendChild(n);
  setTimeout(()=>n.remove(), 1800);
}
function imgURL(nombre){
  if (!nombre) return 'https://dummyimage.com/300x300/0b1220/ffffff&text=Sin+imagen';
  if (/^https?:\/\//i.test(nombre)) return nombre;
  return `http://localhost:3000/imagenes_productos/${encodeURIComponent(nombre)}`;
}

// Inyecta el estilo del badge verde para STOCK ALTO (sin tocar tu CSS global)
function ensureBadgeStyles(){
  if (document.getElementById('inv-badge-styles')) return;
  const s = document.createElement('style');
  s.id = 'inv-badge-styles';
  s.textContent = `
    .cap.ok{
      background:#065f46 !important;
      color:#ecfdf5 !important;
      border:1px solid rgba(255,255,255,.15) !important;
      padding:2px 8px;
      border-radius:8px;
      font-weight:600;
      font-size:12px;
      letter-spacing:.3px;
      display:inline-block;
      white-space:nowrap;
    }
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

function agrupar(variantes, qTxt='', soloAlertas=false){
  const q = norm(qTxt);
  const map = new Map();
  let alertas = 0;

  variantes.forEach(row => {
    const match = !q
      || norm(row.p_nombre).includes(q)
      || norm(row.p_codigo).includes(q)
      || norm(row.color).includes(q)
      || norm(row.talle).includes(q)
      || String(row.variante_id).includes(q);

    const low = row.stock <= UMBRAL_ALERTA;
    if (!match) return;
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
        items: []
      });
    }
    map.get(key).items.push({
      id: row.variante_id,
      talle: row.talle,
      color: row.color,
      stock: row.stock
    });
  });

  const list = Array.from(map.values()).map(g => ({
    ...g,
    items: g.items.sort((a,b)=> (a.color||'').localeCompare(b.color||'') || (a.talle||'').localeCompare(b.talle||''))}
  ));

  return { grupos: list, alertas };
}

// ===== render =====
function render(){
  grid.innerHTML = '';
  const { grupos, alertas } = agrupar(VARIANTES, buscarInput.value, soloAlertasChk.checked);
  GROUPS = grupos;

  if (alertas>0){ badgeGlobal.style.display=''; badgeGlobal.textContent=`${alertas} alerta${alertas===1?'':'s'}`; notice.classList.add('show'); }
  else{ badgeGlobal.style.display='none'; notice.classList.remove('show'); }

  if (!grupos.length){ grid.innerHTML = `<div style="opacity:.8;color:#94a3b8">Sin resultados.</div>`; return; }

  grupos.forEach(g => grid.appendChild(cardProducto(g)));
}

function cardProducto(g){
  const provName = PROV_MAP[g.proveedor_id] || (g.proveedor_id ? `#${g.proveedor_id}` : '—');

  const card = document.createElement('div');
  card.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';
  head.innerHTML = `
    <img class="pic" src="${imgURL(g.imagen)}" alt="">
    <div style="flex:1">
      <h3 class="title">${g.nombre}</h3>
      <div class="subtitle">ID: ${g.producto_id ?? '—'} · Código: ${g.codigo || '—'}</div>
      <div class="meta">
        <div><span class="k">Categoría:</span> ${g.categoria || '—'}</div>
        <div><span class="k">Proveedor:</span> ${provName}</div>
        <div><span class="k">Precio prov:</span> $${fmt(g.precio_prov)}</div>
        <div><span class="k">Precio venta:</span> $${fmt(g.precio)}</div>
        <div style="grid-column:1/-1;"><span class="k">Descripción:</span> ${g.descripcion || '—'}</div>
      </div>
    </div>
  `;
  card.appendChild(head);

  const foot = document.createElement('div');
  foot.className = 'card-foot';
  const btnVar = document.createElement('button');
  btnVar.className = 'btn';
  btnVar.textContent = 'Variantes';
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

  // preparar filtros del historial
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
async function guardarStock(varianteId, productoId){
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
  // llenar selector de variantes
  histVarSel.innerHTML = `<option value="">Todas las variantes</option>`;
  grupo.items.forEach(v => {
    const label = `Var #${v.id} - ${v.color || '-'} / ${v.talle || '-'}`;
    const op = document.createElement('option');
    op.value = String(v.id);
    op.textContent = label;
    histVarSel.appendChild(op);
  });

  // valores por defecto
  histTipoSel.value = '';
  histQInput.value = '';
  histLimitSel.value = '50';
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
    renderHistorial(); // con filtros actuales
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
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[s]));
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
    PROV_MAP  = await fetchProveedores();
    VARIANTES = await fetchInventario();
    render();
  }catch(e){
    console.error(e);
    grid.innerHTML = `<div style="opacity:.8;color:#94a3b8">No se pudo cargar el inventario.</div>`;
  }
}

function wire(){
  btnRefrescar.addEventListener('click', init);
  btnSalir.addEventListener('click', logout);
  buscarInput.addEventListener('input', render);
  soloAlertasChk.addEventListener('change', render);

  // filtros historial
  histVarSel.addEventListener('change', renderHistorial);
  histTipoSel.addEventListener('change', renderHistorial);
  histQInput.addEventListener('input', renderHistorial);
  histLimitSel.addEventListener('change', () => {
    if (CURRENT_GROUP) loadHistorial(CURRENT_GROUP.producto_id);
  });
  histExportBtn.addEventListener('click', exportHistorialCSV);

  // ====== CIERRE DEL MODAL ======
  // Botón cerrar (evita submit si está dentro de un form)
  btnCerrar?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  // Click en overlay: cierra si el click no ocurrió dentro del contenido
modal?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

  // Tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('oculto')) closeModal();
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  // cache DOM
  grid = document.getElementById('inventario-grid');
  buscarInput = document.getElementById('buscar');
  soloAlertasChk = document.getElementById('solo-alertas');
  badgeGlobal = document.getElementById('badge-global');
  notice = document.getElementById('notice');
  btnRefrescar = document.getElementById('btn-refrescar');
  btnSalir = document.getElementById('btn-salir');

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

  // inyecta estilos del badge verde
  ensureBadgeStyles();

  wire();
  init();
});
